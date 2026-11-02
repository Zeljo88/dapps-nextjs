"""Retain validated epoch totals; discard completed historical detail files only."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3


def checked_path(root, path):
    if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Retention target escapes the history directory")
    return path


def compact_epochs(root, epochs, apply=False, purge_cache=False):
    root = Path(root).resolve()
    epochs = sorted(set(epochs))
    plans = []
    # Verify every requested database before changing any report or file.
    for epoch in epochs:
        report_path = checked_path(root, root / f"epoch-{epoch}-report.json")
        original = report_path.read_bytes()
        report = json.loads(original)
        if not report.get("passed") or report["epoch"] != epoch:
            raise ValueError("Only validated completed epochs can be compacted")
        database = checked_path(root, root / f"epoch-{epoch}.sqlite3")
        detail_bytes = 0
        if database.exists():
            wal = checked_path(root, Path(str(database) + "-wal"))
            if wal.exists() and wal.stat().st_size:
                raise ValueError("Historical database still has pending WAL writes")
            with closing(sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)) as db:
                db.execute("PRAGMA query_only=ON")
                db.execute("PRAGMA cache_size=-4096")
                if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchall():
                    raise ValueError("Historical database integrity check failed")
                actual = dict(db.execute("SELECT dapp,COUNT(DISTINCT tx) FROM events GROUP BY dapp"))
                expected = {p["slug"]: p["transactions"] for p in report["dapps"]}
                if {slug: actual.get(slug, 0) for slug in expected} != expected or set(actual) - set(expected):
                    raise ValueError("Epoch totals do not match the detailed database")
            detail_bytes = database.stat().st_size
        elif report.get("retention") != "epoch-totals-only":
            raise ValueError("Detailed database missing before first compaction")
        summary = {key: value for key, value in report.items()
                   if key not in {"daily", "sampleTransactionIds", "excludedCandidates", "databaseBytes"}}
        summary.update(retention="epoch-totals-only", detailsRetained=False)
        summary.setdefault("detailsDiscardedAt", datetime.now(timezone.utc).isoformat())
        summary.setdefault("originalValidationReportSha256", hashlib.sha256(original).hexdigest())
        summary.setdefault("discardedDetailDatabaseBytes", detail_bytes)
        plans.append((epoch, report_path, database, summary, detail_bytes))
    cache_paths = []
    if purge_cache:
        reports = {json.loads(p.read_text())["epoch"] for p in root.glob("epoch-*-report.json")}
        if reports != set(epochs):
            raise ValueError("Cache purge requires all published historical epochs")
        cache_paths = [checked_path(root, root / "source-cache")]
        cache_paths += [checked_path(root, root / "prefetch" / str(epoch) / "source-cache") for epoch in epochs]
    removed_bytes = sum(plan[4] for plan in plans)
    cache_bytes = sum(f.stat().st_size for path in cache_paths if path.exists() for f in path.rglob("*") if f.is_file())
    if apply:
        for epoch, report_path, database, summary, _ in plans:
            temporary = checked_path(root, root / f"epoch-{epoch}-summary.tmp")
            temporary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
            temporary.replace(report_path)
            for suffix in ("", "-wal", "-shm"):
                checked_path(root, Path(str(database) + suffix)).unlink(missing_ok=True)
        for path in cache_paths:
            if path.exists():
                shutil.rmtree(path)
    return {"applied": apply, "epochs": epochs, "detailDatabaseBytes": removed_bytes,
            "sourceCacheBytes": cache_bytes,
            "remainingReportBytes": sum(len((json.dumps(p[3], indent=2) + "\n").encode()) for p in plans),
            "totals": {p[0]: p[3]["dapps"] for p in plans}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--epochs", required=True, type=int, nargs="+")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--purge-cache", action="store_true")
    args = parser.parse_args()
    # This CLI is for the isolated history directory, never the node/live DB.
    if args.root.resolve().name != "history":
        parser.error("The retention directory must be the dedicated history folder")
    print(json.dumps(compact_epochs(args.root, args.epochs, args.apply, args.purge_cache)))


if __name__ == "__main__":
    main()
