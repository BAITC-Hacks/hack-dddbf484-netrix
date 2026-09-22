# Agentic AI Hackathon Backend

Minimal backend for an AI agent with FastAPI, the OpenAI API, and function/tool calling. It is deliberately structured so a team can replace the domain logic during a hackathon without touching the agent loop.

## Architecture

`POST /chat` accepts a user message and calls `run_agent(message, max_steps=5)`.

```text
user -> OpenAI model -> tool calls? -- no --> final answer -> API response
                         |
                        yes
                         v
                TOOLS_IMPL result -> conversation history -> model again
```

The loop stops when the model returns normal text or after five model/tool rounds. Tool call results are sent back as messages with role `tool`, which lets the model use the result in its final answer.

The only externally returned payload is intentionally simple:

```json
{"answer": "..."}
```

`run_agent` has an optional mutable `trace` parameter. Every tool call adds an entry with `step`, `tool`, `arguments`, and `result`, ready to show later in a protected demo/debug view. The public endpoint keeps that trace internal so the response remains `{"answer": str}`.

## Project files

- `backend/main.py` — FastAPI app, three customizable blocks, and the universal agent loop.
- `backend/requirements.txt` — Python dependencies.
- `backend/Procfile` — Railway web process.
- `backend/.env.example` — environment-variable template; contains no secret.

## Run locally

Requires Python 3.10+.

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Put the real value in `.env` (it is loaded automatically), or set `OPENAI_API_KEY` in your shell:

```bash
export OPENAI_API_KEY="your_real_key"
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000/docs` for interactive API docs.

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Chat request:

```bash
curl -X POST http://127.0.0.1:8000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Get sales data, then estimate its value for 10 units at 25 each."}'
```

## Adapt it to your hackathon topic

You only need to edit the three marked blocks in `backend/main.py`; **do not change `run_agent`**.

1. Update `SYSTEM_PROMPT` with the agent role, rules, language, and when it should use data.
2. Add/update a function description in `TOOLS_SCHEMA`. Its `name` and JSON `parameters` define what the model may call.
3. Implement the matching Python function in `TOOLS_IMPL`. It can call your database, external service, scoring model, or calculation. Return JSON-serializable `dict`, `list`, strings, or numbers.

Example schema/implementation pairing:

```python
# In TOOLS_SCHEMA: name = "find_nearby_clinics", parameters = {"city": ...}
def find_nearby_clinics(city: str) -> dict:
    return {"city": city, "clinics": ["..."]}

TOOLS_IMPL["find_nearby_clinics"] = find_nearby_clinics
```

The name must match exactly. The loop parses model JSON arguments, calls the matching implementation, records a trace entry, and returns its JSON result to the model automatically.

## Deploy to Railway

1. Push this repository to GitHub and create a project in [Railway](https://railway.app/).
2. Choose **Deploy from GitHub repo**, select the repository, and set **Root Directory** to `backend`.
3. In Railway's **Variables** tab, add `OPENAI_API_KEY` with the real key. Optionally add `OPENAI_MODEL`.
4. Railway reads `backend/Procfile` and starts `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. After deploy, visit `/health` on the generated service URL, then call `/chat`.

Never commit `.env` or expose the API key in a frontend. The backend accesses it only with `os.environ["OPENAI_API_KEY"]`.

## Notes for production

The starter enables CORS for every origin to speed up hackathon frontend work. Before production, replace `allow_origins=["*"]` with your deployed frontend domain. Add authentication and a protected trace/debug endpoint before exposing tool details to end users.
