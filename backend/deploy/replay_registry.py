"""Create a new registry DB at the previous anchor; never relabel an existing DB."""
import json
from pathlib import Path
import sqlite3
import sys

from analytics.store import Store

old_path, new_path = map(Path, sys.argv[1:3])
if new_path.exists():
    raise SystemExit("New replay path must not already exist")
with sqlite3.connect(f"file:{old_path}?mode=ro", uri=True) as old:
    old.row_factory = sqlite3.Row
    anchor = old.execute("SELECT * FROM blocks ORDER BY slot LIMIT 1").fetchone()
    if not anchor:
        raise SystemExit("Previous database has no anchor")
    backup_path = old_path.with_name(old_path.stem + "-before-expansion.sqlite3")
    if backup_path.exists():
        raise SystemExit("Backup already exists; inspect before continuing")
    with sqlite3.connect(backup_path) as backup:
        old.backup(backup)
registry = json.loads((Path(__file__).resolve().parents[1] / "analytics/registry.json").read_text())
store = Store(new_path, registry)
store.anchor({"slot": anchor["slot"], "id": anchor["hash"]}, anchor["height"], anchor["time"], anchor["epoch"])
print(json.dumps({"backup": str(backup_path), "replay": str(new_path), "anchor": dict(anchor)}))
