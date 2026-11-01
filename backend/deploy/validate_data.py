"""Read-only integrity and independent transaction evidence checks. No fabricated totals."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import urllib.request

from analytics.addresses import payment_script_hash


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("database")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    registry = json.loads((root / "analytics/registry.json").read_text())
    projects = {p["slug"]: {s["hash"] for s in p["scripts"]} for p in registry["projects"]}
    db = sqlite3.connect(f"file:{Path(args.database).as_posix()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    # One consistent read snapshot while the live indexer continues ingesting.
    db.execute("BEGIN")
    assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "SQLite integrity check failed"
    assert not db.execute("PRAGMA foreign_key_check").fetchall(), "Broken foreign keys"
    checkpoint = dict(db.execute("SELECT slot,hash,height FROM blocks ORDER BY slot DESC LIMIT 1").fetchone())
    events = db.execute("SELECT e.*,t.raw,b.hash AS block_hash,b.height,b.slot FROM events e JOIN transactions t ON t.id=e.tx JOIN blocks b ON b.slot=t.slot").fetchall()
    for event in events:
        raw = json.loads(event["raw"])
        assert raw["spends"] == "inputs"
        assert event["script"] in projects[event["dapp"]]
        if event["kind"] == "output_created":
            txid, index = event["ref"].split("#")
            assert txid == event["tx"]
            assert payment_script_hash(raw["outputs"][int(index)]["address"]) == event["script"]
        else:
            old = db.execute("SELECT * FROM outputs WHERE ref=?", (event["ref"],)).fetchone()
            assert old and old["script"] == event["script"] and old["spent_slot"] == event["slot"]
            assert any(f'{i["transaction"]["id"]}#{i["index"]}' == event["ref"] for i in raw["inputs"])
    selected = []
    for slug in projects:
        selected.extend(row[0] for row in db.execute("SELECT DISTINCT t.id FROM events e JOIN transactions t ON t.id=e.tx WHERE e.dapp=? ORDER BY t.slot DESC LIMIT 5", (slug,)))
    selected = sorted(set(selected))
    if not selected:
        raise SystemExit("No observations available to validate")
    request = urllib.request.Request("https://api.koios.rest/api/v1/tx_info", data=json.dumps({"_tx_hashes": selected, "_inputs": True, "_scripts": True}).encode(), headers={"Content-Type": "application/json", "User-Agent": "DappsOnCardano-validation/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        independent = {tx["tx_hash"]: tx for tx in json.load(response)}
    evidence = []
    for txid in selected:
        other = independent.get(txid)
        assert other, f"Independent source has no transaction {txid}"
        matched = [e for e in events if e["tx"] == txid]
        assert other["block_hash"] == matched[0]["block_hash"]
        assert other["block_height"] == matched[0]["height"]
        assert other["absolute_slot"] == matched[0]["slot"]
        for event in matched:
            field = "outputs" if event["kind"] == "output_created" else "inputs"
            txhash, index = event["ref"].split("#")
            output = next((o for o in other[field] if o["tx_hash"] == txhash and o["tx_index"] == int(index)), None)
            assert output and payment_script_hash(output["payment_addr"]["bech32"]) == event["script"]
        evidence.append({"tx": txid, "blockHeight": other["block_height"], "dapps": sorted({e["dapp"] for e in matched}), "matchedEvents": len(matched)})
    report = {"checkedAt": datetime.now(timezone.utc).isoformat(), "checkpoint": checkpoint,
              "sqliteIntegrity": "ok", "foreignKeys": "ok", "eventAttributionChecks": len(events),
              "independentSource": "https://api.koios.rest/api/v1/tx_info", "sampledTransactions": len(evidence),
              "evidence": evidence, "coverage": "partial", "limitations": "Sample validation does not prove complete protocol coverage. Historical spends before the anchor and unregistered contracts can be missed."}
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
