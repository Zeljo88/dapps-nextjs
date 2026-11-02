"""Publish only independently validated epoch reports for the active registry."""
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
    previous_end = None
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
        if previous_end is not None and start < previous_end:
            raise ValueError("Historical epoch intervals overlap")
        previous_end = end
        epochs.append({"epoch": epoch, "startTime": start, "endTime": end,
                       "dapps": report["dapps"],
                       "validation": {"passed": True, "checkedAt": report["checkedAt"],
                                      "blocksReplayed": report["blocksReplayed"],
                                      "chainTransactionsInspected": report["chainTransactionsInspected"],
                                      "independentTransactionSamples": report["independentTransactionSamples"],
                                      "boundaryTransactionsRecovered": report["boundaryTransactionsRecovered"]}})
    return {"coverage": "partial", "registryDigest": registry_digest,
            "aggregation": "epoch", "epochs": epochs,
            "methodology": "Only completed, independently reconciled epochs for the published payment scripts are included. Counts deduplicate transactions within each DApp. Financial, trade and user metrics are not inferred."}



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
