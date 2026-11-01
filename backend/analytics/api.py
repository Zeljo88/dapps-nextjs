import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse

from .store import Store
from .history import history_data

DIRECTORY = Path(__file__).resolve().parent


def create_app(db_path=None):
    registry = json.loads((DIRECTORY / "registry.json").read_text(encoding="utf-8"))
    store = Store(db_path or os.environ.get("ANALYTICS_DB", "data/analytics.sqlite3"), registry)
    app = FastAPI(title="DappsOnCardano fresh analytics pilot", version="0.1.0")

    @app.middleware("http")
    async def no_stale_cache(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/", response_class=HTMLResponse)
    def dashboard():
        return (DIRECTORY / "dashboard.html").read_text(encoding="utf-8")

    @app.get("/health")
    def health():
        status = store.status()
        return {"api": "ok", "indexerFresh": status["fresh"], "phase": status["phase"]}

    @app.get("/v1/status")
    def status():
        return store.status()

    @app.get("/v1/validation")
    def validation():
        report = DIRECTORY / "sources" / "validation.json"
        if not report.exists():
            raise HTTPException(404, "Validation report not yet available")
        return json.loads(report.read_text())

    @app.get("/v1/dapps")
    def projects():
        return store.dapps()

    @app.get("/v1/history")
    def history():
        directory = os.environ.get("ANALYTICS_HISTORY", "/mnt/cardano-data/dapps-analytics/history")
        return history_data(directory, store.status()["registryDigest"])

    @app.get("/v1/dapps/{slug}/events")
    def events(slug: str, limit: int = Query(30, ge=1, le=100)):
        if slug not in {project["slug"] for project in registry["projects"]}:
            raise HTTPException(404, "DApp is not in this pilot's registry")
        return {"coverage": "partial", "provisional": True, "events": store.recent_events(slug, limit)}

    return app
