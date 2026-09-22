"""FastAPI entry point for a hackathon-ready tool-using AI agent."""

import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field
from dotenv import load_dotenv


# Loads local .env into environment variables for development; Railway supplies them itself.
load_dotenv()


# ============================================================================
# 1. SYSTEM_PROMPT — change this text to give the agent a new role/topic.
# ============================================================================
SYSTEM_PROMPT = """
You are a helpful hackathon AI agent. Answer in the user's language.
Use tools when they can provide data or calculate an estimate. Do not invent
tool results. When you have enough information, give a concise final answer.
""".strip()


# ============================================================================
# 2. TOOLS_SCHEMA — add/edit OpenAI function definitions for a new topic here.
#    Every function name below must have an implementation in TOOLS_IMPL.
# ============================================================================
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_demo_data",
            "description": "Get example data for a requested topic. Uses synthetic data in this starter project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "What data is needed, for example: sales, customers, or inventory.",
                    }
                },
                "required": ["topic"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "estimate_value",
            "description": "Calculate an estimated total and a confidence range from numeric inputs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "quantity": {"type": "number", "description": "Number of units."},
                    "unit_value": {"type": "number", "description": "Estimated value per unit."},
                    "confidence": {
                        "type": "number",
                        "description": "Confidence from 0 to 1. Defaults to 0.8.",
                    },
                },
                "required": ["quantity", "unit_value"],
                "additionalProperties": False,
            },
        },
    },
]


# ============================================================================
# 3. TOOLS_IMPL — write the actual Python functions for the schemas above.
#    This is where to connect a database, external API, ML model, etc.
# ============================================================================
def get_demo_data(topic: str) -> dict[str, Any]:
    """Example data provider. Replace its synthetic response with real data."""
    return {
        "source": "synthetic demo data",
        "topic": topic,
        "data": {
            "period": "last 30 days",
            "active_users": 128,
            "orders": 47,
            "note": "Replace get_demo_data with your database or domain API.",
        },
    }


def estimate_value(
    quantity: float, unit_value: float, confidence: float = 0.8
) -> dict[str, Any]:
    """Example calculator. Replace or add domain-specific calculations here."""
    confidence = max(0.0, min(1.0, confidence))
    estimate = quantity * unit_value
    uncertainty = estimate * (1 - confidence)
    return {
        "estimate": round(estimate, 2),
        "confidence": confidence,
        "range": [round(estimate - uncertainty, 2), round(estimate + uncertainty, 2)],
    }


TOOLS_IMPL = {
    "get_demo_data": get_demo_data,
    "estimate_value": estimate_value,
}


app = FastAPI(title="Agentic AI Hackathon Backend", version="0.1.0")

# Permissive CORS is convenient during a hackathon. Restrict allow_origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="User message for the agent")


class ChatResponse(BaseModel):
    answer: str


def _client() -> OpenAI:
    """Read the key only from the environment; never put it in source code."""
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def _execute_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Dispatch a model-requested tool safely and make failures model-readable."""
    function = TOOLS_IMPL.get(name)
    if function is None:
        return {"error": f"Unknown tool: {name}"}
    try:
        return {"result": function(**arguments)}
    except (TypeError, ValueError) as exc:
        return {"error": f"Invalid arguments for {name}: {exc}"}
    except Exception as exc:  # Keep a tool outage from crashing the agent loop.
        return {"error": f"Tool {name} failed: {exc}"}


def run_agent(user_message: str, max_steps: int = 5, trace: list[dict[str, Any]] | None = None) -> str:
    """Run model -> tools -> model until it produces final text or reaches max_steps.

    Pass a mutable `trace` list to inspect tool calls in a demo:
        trace = []; answer = run_agent("...", trace=trace)
    Each trace entry contains the tool name, parsed arguments and returned value.
    """
    if max_steps < 1:
        raise ValueError("max_steps must be at least 1")

    trace = trace if trace is not None else []
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    client = _client()

    for step in range(1, max_steps + 1):
        response = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=messages,
            tools=TOOLS_SCHEMA,
            tool_choice="auto",
        )
        assistant_message = response.choices[0].message
        messages.append(assistant_message.model_dump(exclude_none=True))

        # No tool calls means the model has produced its final user-facing answer.
        if not assistant_message.tool_calls:
            return assistant_message.content or "I could not generate a final answer."

        for tool_call in assistant_message.tool_calls:
            try:
                arguments = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                arguments = {}
                tool_result: dict[str, Any] = {"error": "Tool arguments were not valid JSON."}
            else:
                tool_result = _execute_tool(tool_call.function.name, arguments)

            trace.append(
                {
                    "step": step,
                    "tool": tool_call.function.name,
                    "arguments": arguments,
                    "result": tool_result,
                }
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                }
            )

    return "The agent reached its maximum number of tool steps. Please try a more specific request."


@app.get("/health")
def health() -> dict[str, str]:
    """Lightweight deployment health check; does not require an API key."""
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """Public API: accepts a message and exposes only the agent's final answer."""
    try:
        # Keep this list available for server logs / a future protected demo endpoint.
        trace: list[dict[str, Any]] = []
        answer = run_agent(request.message, trace=trace)
        return ChatResponse(answer=answer)
    except KeyError:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured.") from None
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Agent request failed: {exc}") from exc
