"""Online SQLite snapshot with seven-day retention; runs as the indexer user."""
from datetime import datetime, timezone
from pathlib import Path
import os
import sqlite3
import time

source = Path(os.environ.get("ANALYTICS_DB", "/mnt/cardano-data/dapps-analytics/analytics-v3.sqlite3"))
destination = source.parent / "backups"
destination.mkdir(mode=0o750, exist_ok=True)
name = "analytics-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".sqlite3"
with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as db, sqlite3.connect(destination / name) as backup:
    db.backup(backup, pages=100, sleep=0.05)
    if backup.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise RuntimeError("Backup integrity check failed")
for previous in destination.glob("analytics-*.sqlite3"):
    if previous.stat().st_mtime < time.time() - 7 * 86400:
        previous.unlink()
print(destination / name)
