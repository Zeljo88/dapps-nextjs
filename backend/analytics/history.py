"""Publish only independently validated epoch reports for the active registry."""
import hashlib
import json
import os
from pathlib import Path
from .wallet_methods import METHOD, ADAPTER_VERSIONS


def wallet_fields(report, dapp):
    """Publish only final validated counts, never the working ownership records."""
    validation = report.get('walletValidation', {})
    slug = dapp['slug']
    if (validation.get('passed') is not True or validation.get('method') != METHOD
            or report.get('walletDetailsRetained') is not False
            or slug not in ADAPTER_VERSIONS
            or validation.get('adapters', {}).get(slug) != ADAPTER_VERSIONS[slug]):
        return {}
    count = dapp.get('activeWallets')
    activity = dapp.get('walletActivity', {})
    keys = ('candidateOrderOutputs', 'attributedOrderOutputs', 'scriptControlledOrderOutputs',
            'unrecognizedOrderOutputs', 'unavailableDatumOrderOutputs', 'ambiguousPaymentKeys')
    if type(count) is not int or count < 0 or activity.get('method') != METHOD:
        return {}
    if any(type(activity.get(k)) is not int or activity[k] < 0 for k in keys):
        return {}
    total, identified = activity['candidateOrderOutputs'], activity['attributedOrderOutputs']
    if count > identified or total != sum(activity[k] for k in keys[1:5]):
        return {}
    percent = round(100 * identified / total, 2) if total else 100.0
    if activity.get('attributionPercent') != percent:
        return {}
    return {'activeWallets': count, 'walletActivity': {'method': METHOD,
            **{k: activity[k] for k in keys}, 'attributionPercent': percent}}


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
                       "dapps": [{**{key: dapp[key] for key in ('slug', 'name', 'transactions')},
                                  **wallet_fields(report, dapp)} for dapp in report['dapps']],
                       "validation": {"passed": True, "checkedAt": report["checkedAt"],
                                      "blocksReplayed": report["blocksReplayed"],
                                      "chainTransactionsInspected": report["chainTransactionsInspected"],
                                      "independentTransactionSamples": report["independentTransactionSamples"],
                                      "boundaryTransactionsRecovered": report["boundaryTransactionsRecovered"]}})
    return {"coverage": "partial", "registryDigest": registry_digest,
            "aggregation": "epoch", "epochs": epochs,
            "methodology": "Completed, independently reconciled epochs for published payment scripts. Transactions deduplicate within each DApp. Active wallets count identifiable key-controlled order owners creating orders in each epoch, grouped by unambiguous observed stake keys where possible. Wallets are not people; bots and multiple wallets exist. Script-controlled and unidentified orders are excluded with coverage counts. Epoch wallet counts must not be summed into unique period users."}



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
