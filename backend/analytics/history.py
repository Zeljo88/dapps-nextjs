"""Publish only independently validated epoch reports for the active registry."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path


def history_data(directory: str | Path, registry_digest: str):
    reports = []
    for path in Path(directory).glob("epoch-*-report.json"):
        report = json.loads(path.read_text())
        if report.get("passed") and report.get("registryDigest") == registry_digest:
            reports.append(report)
    reports.sort(key=lambda report: report["epoch"])
    epochs = []
    daily = {}
    projects = {}
    seen = set()
    for report in reports:
        epoch = report["epoch"]
        if epoch in seen:
            raise ValueError("Duplicate historical epoch report")
        seen.add(epoch)
        start = report["boundaries"]["info"]["start_time"]
        end = report["boundaries"]["info"]["end_time"]
        if end <= start:
            raise ValueError("Invalid historical coverage interval")
        for project in report["dapps"]:
            projects[project["slug"]] = project["name"]
        epochs.append({"epoch": epoch, "startTime": start, "endTime": end,
                       "dapps": report["dapps"],
                       "validation": {"passed": True, "checkedAt": report["checkedAt"],
                                      "blocksReplayed": report["blocksReplayed"],
                                      "chainTransactionsInspected": report["chainTransactionsInspected"],
                                      "independentTransactionSamples": report["independentTransactionSamples"],
                                      "boundaryTransactionsRecovered": report["boundaryTransactionsRecovered"]}})
        day_start = int(start // 86400) * 86400
        while day_start < end:
            date = datetime.fromtimestamp(day_start, timezone.utc).strftime("%Y-%m-%d")
            value = daily.setdefault(date, {"date": date, "coverageSeconds": 0, "counts": {}})
            value["coverageSeconds"] += min(end, day_start + 86400) - max(start, day_start)
            if value["coverageSeconds"] > 86400:
                raise ValueError("Historical epoch intervals overlap")
            day_start += 86400
        for record in report["daily"]:
            counts = daily[record["date"]]["counts"]
            counts[record["dapp"]] = counts.get(record["dapp"], 0) + record["transactions"]
    result = []
    for date, day in sorted(daily.items()):
        result.append({"date": date, "partialDay": day["coverageSeconds"] < 86400,
                       "coverageSeconds": day["coverageSeconds"],
                       "dapps": [{"slug": slug, "name": name, "transactions": day["counts"].get(slug, 0)}
                                 for slug, name in sorted(projects.items())]})
    return {"coverage": "partial", "registryDigest": registry_digest, "dayTimezone": "UTC",
            "epochs": epochs, "daily": result,
            "methodology": "Only completed, independently reconciled epochs for the published payment scripts are included. Counts deduplicate transactions within each DApp. Partial UTC days are labelled; financial, trade and user metrics are not inferred."}


def create_app(history_root=None):
    from fastapi import FastAPI
    root = history_root or os.environ.get("ANALYTICS_HISTORY", "/mnt/cardano-data/dapps-analytics/history")
    registry = Path(__file__).parent / "registry.json"
    app = FastAPI(title="DappsOnCardano validated historical observations")

    @app.middleware("http")
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/v1/history")
    def history():
        digest = hashlib.sha256(json.dumps(json.loads(registry.read_text()), sort_keys=True).encode()).hexdigest()
        return history_data(root, digest)

    @app.get("/health")
    def health():
        return {"api": "ok", "role": "validated-history-reader"}

    return app
