"""HTTP interface for the deterministic contractor matching service."""

from fastapi import FastAPI

from matching import MatchRequest, MatchResponse, load_catalog, match_profiles


app = FastAPI(title="HackAlem contractor matching", version="1.0.0")
catalog = load_catalog()


@app.get("/health")
def health() -> dict[str, int | str]:
    return {"status": "ok", "profiles": len(catalog)}


@app.post("/match", response_model=MatchResponse)
def match(request: MatchRequest) -> MatchResponse:
    return match_profiles(request, catalog)
