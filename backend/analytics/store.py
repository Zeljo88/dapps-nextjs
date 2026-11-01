from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import time

from .addresses import payment_script_hash

SCHEMA = """
CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS blocks(
 slot INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, height INTEGER NOT NULL,
 parent TEXT, time REAL NOT NULL, epoch INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS transactions(
 id TEXT PRIMARY KEY, slot INTEGER NOT NULL REFERENCES blocks(slot) ON DELETE CASCADE,
 fee_lovelace TEXT NOT NULL, raw TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outputs(
 ref TEXT PRIMARY KEY, dapp TEXT NOT NULL, script TEXT NOT NULL, address TEXT NOT NULL,
 lovelace TEXT NOT NULL, value_json TEXT NOT NULL,
 created_slot INTEGER NOT NULL REFERENCES blocks(slot) ON DELETE CASCADE,
 spent_slot INTEGER REFERENCES blocks(slot) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS events(
 tx TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
 dapp TEXT NOT NULL, script TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
 PRIMARY KEY(tx,dapp,script,kind,ref));
CREATE INDEX IF NOT EXISTS events_dapp ON events(dapp,tx);
CREATE INDEX IF NOT EXISTS transactions_slot ON transactions(slot);
"""


class Store:
    def __init__(self, path: str | Path, registry: dict):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.projects = registry["projects"]
        if registry["network"] != "mainnet":
            raise ValueError("Only mainnet registries are supported")
        self.scripts = {}
        for project in self.projects:
            for script in project["scripts"]:
                script_hash = script["hash"]
                if not re.fullmatch(r"[0-9a-f]{56}", script_hash):
                    raise ValueError("Invalid script hash in registry")
                if script_hash in self.scripts:
                    raise ValueError("A script cannot be attributed to two entries")
                self.scripts[script_hash] = project["slug"]
        digest = hashlib.sha256(json.dumps(registry, sort_keys=True).encode()).hexdigest()
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(SCHEMA)
            previous = self.meta(db, "registry_digest")
            if previous and previous != digest:
                raise ValueError("Registry changed: use a new database and replay; existing observations must retain their mapping")
            self.put(db, "registry_digest", digest)
            self.put(db, "schema_version", 1)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=10000")
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def meta(db, key, default=None):
        row = db.execute("SELECT value FROM metadata WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    @staticmethod
    def put(db, key, value):
        db.execute("INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, json.dumps(value)))

    def set_state(self, **values):
        with self.connection() as db:
            for key, value in values.items():
                self.put(db, key, value)

    def checkpoints(self):
        with self.connection() as db:
            rows = db.execute("SELECT slot,hash FROM blocks ORDER BY slot DESC LIMIT 256").fetchall()
        return [{"slot": row["slot"], "id": row["hash"]} for row in rows]

    def anchor(self, point, height, timestamp, epoch):
        with self.connection() as db:
            if db.execute("SELECT 1 FROM blocks LIMIT 1").fetchone():
                raise ValueError("Database already has a checkpoint")
            db.execute("INSERT INTO blocks VALUES(?,?,?,?,?,?)", (point["slot"], point["id"], height, None, timestamp, epoch))
            self.put(db, "anchor", point)
            self.put(db, "started_at", timestamp)

    def ingest(self, block: dict, timestamp: float, epoch: int, tip_height: int):
        slot, block_hash = block["slot"], block["id"]
        with self.connection() as db:
            existing = db.execute("SELECT hash FROM blocks WHERE slot=?", (slot,)).fetchone()
            if existing:
                if existing["hash"] != block_hash:
                    raise ValueError("Conflicting block requires an explicit rollback")
                return
            previous = db.execute("SELECT hash,slot FROM blocks ORDER BY slot DESC LIMIT 1").fetchone()
            if previous and (block["ancestor"] != previous["hash"] or slot <= previous["slot"]):
                raise ValueError("Block is not the next child of the saved checkpoint")
            db.execute("INSERT INTO blocks VALUES(?,?,?,?,?,?)", (slot, block_hash, block["height"], block["ancestor"], timestamp, epoch))
            for tx in block.get("transactions", []):
                # Failed Plutus transactions consume collateral, not their normal inputs/outputs.
                # Reference inputs and unused witness scripts do not count as DApp activity.
                if tx.get("spends") != "inputs":
                    continue
                events = []
                spends = []
                creates = []
                for tx_input in tx.get("inputs", []):
                    ref = f"{tx_input['transaction']['id']}#{tx_input['index']}"
                    old = db.execute("SELECT * FROM outputs WHERE ref=? AND spent_slot IS NULL", (ref,)).fetchone()
                    if old:
                        events.append((tx["id"], old["dapp"], old["script"], "output_spent", ref))
                        spends.append(ref)
                for index, output in enumerate(tx.get("outputs", [])):
                    script = payment_script_hash(output["address"])
                    if script not in self.scripts:
                        continue
                    ref = f"{tx['id']}#{index}"
                    dapp = self.scripts[script]
                    lovelace = output["value"].get("ada", {}).get("lovelace", 0)
                    creates.append((ref, dapp, script, output["address"], str(lovelace), json.dumps(output["value"]), slot))
                    events.append((tx["id"], dapp, script, "output_created", ref))
                if not events:
                    continue
                fee = tx.get("fee", {}).get("ada", {}).get("lovelace", 0)
                db.execute("INSERT INTO transactions VALUES(?,?,?,?)", (tx["id"], slot, str(fee), json.dumps(tx)))
                db.executemany("UPDATE outputs SET spent_slot=? WHERE ref=?", [(slot, ref) for ref in spends])
                db.executemany("INSERT INTO outputs(ref,dapp,script,address,lovelace,value_json,created_slot) VALUES(?,?,?,?,?,?,?)", creates)
                db.executemany("INSERT INTO events VALUES(?,?,?,?,?)", events)
            for key, value in {"last_received_at": time.time(), "tip_height": tip_height, "phase": "running", "last_error": None}.items():
                self.put(db, key, value)

    def rollback(self, point):
        # If a fork crosses the initial anchor we must explicitly rebootstrap, not silently
        # advertise continuous coverage from a new point or discard the existing database.
        if point == "origin":
            raise ValueError("Rollback crosses pilot start; rebootstrap into a new database")
        with self.connection() as db:
            row = db.execute("SELECT hash FROM blocks WHERE slot=?", (point["slot"],)).fetchone()
            if not row or row["hash"] != point["id"]:
                raise ValueError("Rollback point is outside retained checkpoints")
            db.execute("DELETE FROM blocks WHERE slot>?", (point["slot"],))
            self.put(db, "last_received_at", time.time())

    def status(self):
        with self.connection() as db:
            last = db.execute("SELECT slot,hash,height,time,epoch FROM blocks ORDER BY slot DESC LIMIT 1").fetchone()
            state = {row["key"]: json.loads(row["value"]) for row in db.execute("SELECT * FROM metadata")}
            counts = {"blocks": db.execute("SELECT COUNT(*) FROM blocks").fetchone()[0],
                      "transactions": db.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]}
        last_received = state.get("last_received_at")
        lag = max(0, state.get("tip_height", 0) - last["height"]) if last else None
        fresh = (state.get("phase") == "running" and last_received is not None
                 and time.time() - last_received < 180 and lag is not None and lag <= 10)
        return {"network": "mainnet", "phase": state.get("phase", "not_started"), "fresh": fresh,
                "lastReceivedAt": last_received, "startedAt": state.get("started_at"),
                "checkpoint": dict(last) if last else None, "tipHeight": state.get("tip_height"),
                "lagBlocks": lag,
                "registryDigest": state.get("registry_digest"), "counts": counts,
                "lastError": state.get("last_error"), "watchedScripts": len(self.scripts),
                "coverage": "partial", "methodology": "Tracked contract output creations and spends of outputs observed since the start checkpoint. One transaction per DApp, even when several outputs match. No historical totals, trade counts, TVL or wallet counts are inferred."}

    def dapps(self, now=None, confirmations=3):
        now = time.time() if now is None else now
        status = self.status()
        maximum_height = (status["checkpoint"] or {}).get("height", 0) - confirmations
        result = []
        with self.connection() as db:
            for project in self.projects:
                summary = db.execute("""SELECT COUNT(DISTINCT t.id) AS total,
                    COUNT(DISTINCT CASE WHEN b.time>=? THEN t.id END) AS day,
                    MAX(b.time) AS last FROM events e JOIN transactions t ON e.tx=t.id
                    JOIN blocks b ON b.slot=t.slot WHERE e.dapp=? AND b.height<=?""",
                    (now - 86400, project["slug"], maximum_height)).fetchone()
                started = status["startedAt"] is not None
                result.append({**project, "observedTransactions": summary["total"] if started else None, "observedTx24h": summary["day"] if started else None,
                               "lastObservedActivity": summary["last"], "confirmationDepth": confirmations,
                               "recordedSince": status["startedAt"], "fresh": status["fresh"],
                               "activeWallets24h": None, "lifetimeTransactions": None,
                               "tvl": None, "volume24h": None, "price": None})
        return result

    def recent_events(self, slug, limit=30):
        with self.connection() as db:
            return [dict(row) for row in db.execute("""SELECT t.id AS tx,b.slot,b.height,b.time,e.script,e.kind,e.ref
                FROM events e JOIN transactions t ON t.id=e.tx JOIN blocks b ON b.slot=t.slot
                WHERE e.dapp=? ORDER BY b.slot DESC,t.id LIMIT ?""", (slug, limit))]
