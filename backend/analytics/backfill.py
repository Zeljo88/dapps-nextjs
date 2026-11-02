"""Resumable, independently reconciled epoch imports. Does not modify the live DB."""
import argparse
import asyncio
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import logging
import os
from pathlib import Path
try:
    import resource
except ImportError:  # Unit tests also run on Windows; the worker runs on Linux.
    resource = None
import shutil
import sqlite3
import time
import urllib.error
import urllib.request

from websockets.asyncio.client import connect
from . import store as store_module
from .addresses import ALPHABET, payment_script_hash
from .store import Store
from .worker import Rpc, slot_coordinates
from .retention import compact_epochs

LOG = logging.getLogger("analytics.backfill")
API = "https://api.koios.rest/api/v1"
SCHEMA = """
CREATE TABLE IF NOT EXISTS history_block_stats(
 slot INTEGER PRIMARY KEY REFERENCES blocks(slot) ON DELETE CASCADE,
 tx_count INTEGER NOT NULL, invalid_count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS raw_candidates(
 tx TEXT PRIMARY KEY,slot INTEGER NOT NULL REFERENCES blocks(slot) ON DELETE CASCADE,
 raw TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS boundary_outputs(
 ref TEXT PRIMARY KEY,dapp TEXT NOT NULL,script TEXT NOT NULL,address TEXT NOT NULL,
 lovelace TEXT NOT NULL,source_slot INTEGER NOT NULL,evidence_json TEXT NOT NULL,
 spent_slot INTEGER REFERENCES blocks(slot) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS expected_txs(
 dapp TEXT NOT NULL,tx TEXT NOT NULL,height INTEGER NOT NULL,PRIMARY KEY(dapp,tx));
CREATE TABLE IF NOT EXISTS excluded_candidates(
 dapp TEXT NOT NULL,tx TEXT NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(dapp,tx));
"""


def write_json(path, value):
    temporary = Path(str(path) + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


@lru_cache(maxsize=65536)
def fast_script_hash(address):
    # The first Bech32 word contains the address type. Key-payment addresses
    # can never match; script candidates still receive full checksum validation.
    lower = address.lower()
    if lower.startswith("addr1") and len(lower) > 5:
        top = ALPHABET.find(lower[5])
        if top >= 0 and top // 2 not in (1, 3, 5, 7):
            return None
    return payment_script_hash(address)


class Koios:
    def __init__(self, root, minimum_interval=0.6):
        self.root = root / "source-cache"
        self.root.mkdir(exist_ok=True)
        self.last_request = 0
        self.minimum_interval = minimum_interval
        self.requests = 0
        self.tick = lambda: None

    def request(self, path, body=None, exact_count=False):
        self.tick()
        key = hashlib.sha256(json.dumps([path, body], sort_keys=True).encode()).hexdigest()
        cached = self.root / (key + ".json")
        if cached.exists():
            saved = json.loads(cached.read_text())
            if not exact_count or (saved.get("range") or "").rsplit("/", 1)[-1].isdigit():
                return saved
        for attempt in range(4):
            time.sleep(max(0, self.minimum_interval - (time.monotonic() - self.last_request)))
            request = urllib.request.Request(API + path,
                data=None if body is None else json.dumps(body).encode(),
                headers={"Content-Type": "application/json",
                         **({"Prefer": "count=exact"} if exact_count else {}),
                         "User-Agent": "DappsOnCardano-historical-validation/1.0"})
            self.last_request = time.monotonic()
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    result = {"data": json.load(response), "range": response.headers.get("Content-Range"),
                              "source": API + path, "receivedAt": time.time()}
                self.requests += 1
                write_json(cached, result)
                return result
            except (urllib.error.URLError, TimeoutError):
                if attempt == 3:
                    raise
                time.sleep(2 ** (attempt + 1))

    def get(self, path):
        return self.request(path)["data"]

    def transaction_info(self, identifiers):
        identifiers = sorted(set(identifiers))
        result = {}
        for offset in range(0, len(identifiers), 50):
            rows = self.request("/tx_info", {"_tx_hashes": identifiers[offset:offset + 50],
                                            "_inputs": True, "_scripts": True})["data"]
            result.update({row["tx_hash"]: row for row in rows})
        if set(result) != set(identifiers):
            raise ValueError("Independent transaction response is incomplete")
        return result

    def epoch(self, epoch):
        info = self.get(f"/epoch_info?_epoch_no={epoch}")[0]
        first = self.get(f"/blocks?epoch_no=eq.{epoch}&order=block_height.asc&limit=1")[0]
        last = self.get(f"/blocks?epoch_no=eq.{epoch}&order=block_height.desc&limit=1")[0]
        previous = self.request("/block_info", {"_block_hashes": [first["parent_hash"]]})["data"][0]
        if previous["hash"] != first["parent_hash"] or last["block_height"] - first["block_height"] + 1 != info["blk_count"]:
            raise ValueError("Independent epoch boundaries disagree")
        if info["end_time"] > time.time() - 3600:
            raise ValueError("Only completed historical epochs are accepted")
        return {"info": info, "first": first, "last": last, "previous": previous}

    def credential_transactions(self, scripts, first_height, last_height, page_size=1000):
        if not 1 <= page_size <= 1000:
            raise ValueError("Independent page size must respect the Koios 1000-row limit")
        rows = {}
        total = None
        offset = 0
        lower = first_height
        while True:
            page = self.request(f"/credential_txs?block_height=lte.{last_height}&order=block_height.asc,tx_hash.asc&limit={page_size}&offset={offset}",
                                {"_payment_credentials": scripts, "_after_block_height": lower}, exact_count=total is None)
            values = page["data"]
            content_range = page["range"] or ""
            if total is None:
                if "/" not in content_range or not content_range.rsplit("/", 1)[1].isdigit():
                    raise ValueError("Exact independent pagination total is unavailable")
                total = int(content_range.rsplit("/", 1)[1])
            for row in values:
                if not first_height <= row["block_height"] <= last_height:
                    raise ValueError("Independent credential query crossed epoch boundaries")
                rows[row["tx_hash"]] = row["block_height"]
            if not values or len(rows) >= total or len(values) < page_size:
                break
            # Advance the indexed block-height lower bound, retaining the last
            # block inclusively so a page boundary cannot drop its transactions.
            page_last_height = values[-1]["block_height"]
            if page_last_height == lower:
                offset += len(values)
            else:
                lower = page_last_height
                offset = 0
        if total is not None and len(rows) != total:
            raise ValueError("Independent credential pagination did not yield the exact advertised total")
        return rows


class HistoricalStore(Store):
    def __init__(self, path, registry, expected):
        self._shared = None
        super().__init__(path, registry)
        self._shared = sqlite3.connect(self.path, timeout=10)
        self._shared.row_factory = sqlite3.Row
        self._shared.execute("PRAGMA foreign_keys=ON")
        self._shared.execute("PRAGMA busy_timeout=10000")
        # A replayable history DB can recover its last durable checkpoint after
        # a power loss. Keep WAL open and checkpoint periodically instead of
        # forcing a disk sync and WAL teardown on every historical block.
        self._shared.execute("PRAGMA synchronous=NORMAL")
        self._shared.execute("PRAGMA cache_size=-16384")
        self._shared.execute("PRAGMA wal_autocheckpoint=10000")
        self.expected = expected
        self.candidates = {tx for records in expected.values() for tx in records}
        with self.connection() as db:
            db.executescript(SCHEMA)
            db.executemany("INSERT OR IGNORE INTO expected_txs VALUES(?,?,?)",
                           [(dapp, tx, height) for dapp, records in expected.items() for tx, height in records.items()])

    @contextmanager
    def connection(self):
        if self._shared is None:
            with super().connection() as db:
                yield db
        else:
            with self._shared:
                yield self._shared

    def close(self):
        if self._shared is not None:
            self._shared.close()
            self._shared = None

    def after_ingest(self, db, block):
        transactions = block.get("transactions", [])
        db.execute("INSERT INTO history_block_stats VALUES(?,?,?)",
                   (block["slot"], len(transactions), sum(tx.get("spends") != "inputs" for tx in transactions)))
        db.executemany("""INSERT INTO raw_candidates SELECT ?,?,?
            WHERE NOT EXISTS(SELECT 1 FROM transactions WHERE id=?)""",
            [(tx["id"], block["slot"], json.dumps(tx), tx["id"]) for tx in transactions if tx["id"] in self.candidates])

    def actual(self):
        with self.connection() as db:
            return {project["slug"]: {row[0] for row in db.execute("SELECT DISTINCT tx FROM events WHERE dapp=?", (project["slug"],))}
                    for project in self.projects}

    def raw_transaction(self, tx):
        with self.connection() as db:
            row = db.execute("SELECT slot,raw FROM transactions WHERE id=? UNION ALL SELECT slot,raw FROM raw_candidates WHERE tx=? LIMIT 1", (tx, tx)).fetchone()
        if not row:
            raise ValueError(f"Independent candidate {tx} was not found in the node's blocks")
        return row["slot"], json.loads(row["raw"])


def system_snapshot():
    memory = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        parts = line.split()
        memory[parts[0].rstrip(":")] = int(parts[1]) * 1024
    ticks = [int(value) for value in Path("/proc/stat").read_text().splitlines()[0].split()[1:9]]
    with urllib.request.urlopen("http://127.0.0.1:8000/v1/status", timeout=5) as response:
        live = json.load(response)
    return {"time": time.time(), "memoryAvailable": memory["MemAvailable"],
            "ticks": ticks, "load1": os.getloadavg()[0], "liveFresh": live["fresh"],
            "liveLag": live["lagBlocks"], "liveHeight": (live["checkpoint"] or {}).get("height"),
            "liveLastReceived": live["lastReceivedAt"]}


class Monitor:
    def __init__(self, root, epoch, sampler=system_snapshot):
        self.path = root / f"epoch-{epoch}-load.jsonl"
        self.sampler = sampler
        self.previous = sampler()
        self.samples = []
        self.last_check = time.monotonic()
        self.violation = None
        self.sample(force=True)

    def sample(self, force=False):
        if not force and time.monotonic() - self.last_check < 5:
            return
        snapshot = self.sampler()
        ticks = snapshot.pop("ticks")
        delta = [now - before for now, before in zip(ticks, self.previous["ticks"])]
        elapsed = snapshot["time"] - self.previous.get("time", snapshot["time"] - 1)
        self.previous = {"ticks": ticks, "time": snapshot["time"]}
        total = sum(delta)
        snapshot["cpuBusyPercent"] = max(0, 100 * (total - delta[3] - delta[4]) / total) if total and elapsed >= 0.25 else 0
        snapshot["ioWaitPercent"] = max(0, 100 * delta[4] / total) if total and elapsed >= 0.25 else 0
        snapshot["workerPeakRssBytes"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024 if resource else 0
        root = self.path.parent
        snapshot["databaseBytes"] = sum(path.stat().st_size for path in root.glob(self.path.name.replace("-load.jsonl", ".sqlite3") + "*"))
        self.samples.append(snapshot)
        with self.path.open("a") as output:
            output.write(json.dumps(snapshot) + "\n")
        self.last_check = time.monotonic()
        reasons = []
        if snapshot["memoryAvailable"] < 4 * 1024 ** 3:
            reasons.append("less than 4 GiB memory available")
        if snapshot["databaseBytes"] > 4 * 1024 ** 3 or shutil.disk_usage(root).free < 20 * 1024 ** 3:
            reasons.append("historical storage limit reached")
        if snapshot["cpuBusyPercent"] > 85:
            reasons.append("host CPU above 85 percent")
        if snapshot["ioWaitPercent"] > 20:
            reasons.append("host I/O wait above 20 percent")
        if not snapshot["liveFresh"] or snapshot["liveLag"] is None or snapshot["liveLag"] > 10:
            reasons.append("live collector is delayed")
        if reasons:
            self.violation = "; ".join(reasons)
            raise RuntimeError("Historical import stopped by load guard: " + self.violation)

    def summary(self):
        return {"samples": len(self.samples), "maximumCpuBusyPercent": max(s["cpuBusyPercent"] for s in self.samples),
                "maximumIoWaitPercent": max(s["ioWaitPercent"] for s in self.samples),
                "minimumMemoryAvailableBytes": min(s["memoryAvailable"] for s in self.samples),
                "workerPeakRssBytes": max(s["workerPeakRssBytes"] for s in self.samples),
                "maximumLiveLagBlocks": max(s["liveLag"] or 0 for s in self.samples),
                "allLiveSamplesFresh": all(s["liveFresh"] for s in self.samples),
                "guardViolation": self.violation}


def adjusted_rate(current, ceiling, sample):
    if sample["ioWaitPercent"] > 8 or sample["cpuBusyPercent"] > 60:
        return max(10, current * 0.7)
    if sample["ioWaitPercent"] < 3 and sample["cpuBusyPercent"] < 50:
        return min(ceiling, current + 5)
    return current


async def replay(store, boundaries, monitor, url, rate):
    async with connect(url, max_size=16 * 1024 * 1024, max_queue=4, proxy=None) as socket:
        rpc = Rpc(socket)
        start = await rpc.call("queryNetwork/startTime")
        if datetime.fromisoformat(start.replace("Z", "+00:00")).timestamp() != 1506203091:
            raise ValueError("Historical reader is not connected to mainnet")
        eras = await rpc.call("queryLedgerState/eraSummaries")
        previous = boundaries["previous"]
        if not store.checkpoints():
            store.anchor({"slot": previous["abs_slot"], "id": previous["hash"]}, previous["block_height"], previous["block_time"], previous["epoch_no"])
        intersection = await rpc.call("findIntersection", {"points": store.checkpoints()})
        store.rollback(intersection["intersection"])
        height = store.status()["checkpoint"]["height"]
        if height >= boundaries["last"]["block_height"]:
            return
        pending = deque()
        counter = rpc.counter
        async def request():
            nonlocal counter
            counter += 1
            pending.append(counter)
            await socket.send(json.dumps({"jsonrpc": "2.0", "method": "nextBlock", "id": counter}))
        await request()
        await request()
        processed = 0
        started = time.monotonic()
        logged = started
        deadline = started
        effective_rate = min(50, rate)
        sample_count = len(monitor.samples)
        while True:
            response = json.loads(await asyncio.wait_for(socket.recv(), 90))
            if response.get("id") != pending.popleft() or "error" in response:
                raise ValueError("Historical chain-sync response failed")
            result = response["result"]
            await request()
            if result["direction"] == "backward":
                store.rollback(result["point"])
                continue
            block = result["block"]
            if block["height"] > boundaries["last"]["block_height"]:
                raise ValueError("Historical reader crossed the stop boundary")
            timestamp, epoch = slot_coordinates(block["slot"], 1506203091, eras)
            if epoch != boundaries["info"]["epoch_no"]:
                raise ValueError("Historical block is outside the requested epoch")
            store.ingest(block, timestamp, epoch, result["tip"]["height"])
            processed += 1
            monitor.sample()
            if len(monitor.samples) != sample_count:
                effective_rate = adjusted_rate(effective_rate, rate, monitor.samples[-1])
                sample_count = len(monitor.samples)
            if time.monotonic() - logged >= 15:
                LOG.info("epoch=%s height=%s last=%s blocks_per_second=%.1f rate_limit=%.1f", epoch, block["height"], boundaries["last"]["block_height"], processed / (time.monotonic() - started), effective_rate)
                logged = time.monotonic()
                write_json(monitor.path.parent / "status.json", {"phase": "replaying", "epoch": epoch,
                    "height": block["height"], "lastHeight": boundaries["last"]["block_height"],
                    "blocksPerSecond": processed / (time.monotonic() - started), "updatedAt": time.time()})
            if block["height"] == boundaries["last"]["block_height"]:
                return
            deadline = max(deadline + 1 / effective_rate, time.monotonic())
            await asyncio.sleep(max(0, deadline - time.monotonic()))


def reconcile_boundary_spends(store, source, boundaries, monitor):
    actual = store.actual()
    missing = {slug: set(expected) - actual[slug] for slug, expected in store.expected.items()}
    for slug, expected in store.expected.items():
        if actual[slug] - set(expected):
            raise ValueError("Node observations contain transactions absent from the independent credential history")
    identifiers = set().union(*missing.values())
    information = source.transaction_info(identifiers)
    original_ids = set()
    repairs = []
    excluded = []
    for slug, identifiers in missing.items():
        scripts = {item["hash"] for project in store.projects if project["slug"] == slug for item in project["scripts"]}
        for txid in sorted(identifiers):
            slot, raw = store.raw_transaction(txid)
            independent = information[txid]
            with store.connection() as db:
                block = db.execute("SELECT * FROM blocks WHERE slot=?", (slot,)).fetchone()
            if independent["block_hash"] != block["hash"] or independent["absolute_slot"] != slot:
                raise ValueError("Boundary transaction disagrees with the node's block")
            if raw.get("spends") != "inputs":
                excluded.append((slug, txid, "failed_transaction"))
                continue
            if any(fast_script_hash(output["address"]) in scripts for output in raw.get("outputs", [])):
                raise ValueError("A matching output was missed during the local replay")
            matched = []
            for item in independent["inputs"]:
                script = fast_script_hash(item["payment_addr"]["bech32"])
                if script not in scripts:
                    continue
                ref = f'{item["tx_hash"]}#{item["tx_index"]}'
                if not any(f'{entry["transaction"]["id"]}#{entry["index"]}' == ref for entry in raw["inputs"]):
                    raise ValueError("Independent input is absent from the node's transaction")
                matched.append((ref, script, item))
                original_ids.add(item["tx_hash"])
            if not matched:
                reference_match = any(fast_script_hash(item["payment_addr"]["bech32"]) in scripts
                                      and any(f'{entry["transaction"]["id"]}#{entry["index"]}' == f'{item["tx_hash"]}#{item["tx_index"]}'
                                              for entry in raw.get("references", []))
                                      for item in independent.get("reference_inputs", []))
                if reference_match:
                    excluded.append((slug, txid, "reference_only"))
                    continue
                raise ValueError("Independent credential candidate has no explained executed or reference match")
            repairs.append((slug, txid, slot, raw, matched))
    originals = source.transaction_info(original_ids)
    repaired_events = 0
    for slug, txid, slot, raw, matched in repairs:
        with store.connection() as db:
            for ref, script, item in matched:
                origin = originals[item["tx_hash"]]
                if origin["absolute_slot"] >= boundaries["first"]["abs_slot"]:
                    raise ValueError("A within-epoch input was missed; refusing to mask an indexing defect")
                original = next((output for output in origin["outputs"] if output["tx_index"] == item["tx_index"]), None)
                if not original or original["payment_addr"]["bech32"] != item["payment_addr"]["bech32"] or original["value"] != item["value"]:
                    raise ValueError("Boundary source output evidence does not agree")
                fee = raw.get("fee", {}).get("ada", {}).get("lovelace", 0)
                db.execute("INSERT OR IGNORE INTO transactions VALUES(?,?,?,?)", (txid, slot, str(fee), json.dumps(raw)))
                db.execute("INSERT OR IGNORE INTO boundary_outputs VALUES(?,?,?,?,?,?,?,?)",
                           (ref, slug, script, item["payment_addr"]["bech32"], item["value"], origin["absolute_slot"], json.dumps(origin), slot))
                db.execute("INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)", (txid, slug, script, "output_spent", ref))
                repaired_events += 1
        monitor.sample()
    with store.connection() as db:
        db.executemany("INSERT OR REPLACE INTO excluded_candidates VALUES(?,?,?)", excluded)
    actual = store.actual()
    for slug, expected in store.expected.items():
        removed = {txid for excluded_slug, txid, _ in excluded if excluded_slug == slug}
        if actual[slug] != set(expected) - removed:
            raise ValueError("Final node transaction set does not reconcile to the independent credential history")
    return {"boundaryTransactionsRecovered": len({item[1] for item in repairs}),
            "boundarySpendEventsRecovered": repaired_events,
            "excludedCandidates": [{"dapp": slug, "tx": tx, "reason": reason} for slug, tx, reason in excluded]}


def validate(store, source, boundaries, monitor):
    epoch = boundaries["info"]["epoch_no"]
    with store.connection() as db:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Historical SQLite integrity failed")
        totals = db.execute("SELECT COUNT(*) AS blocks,SUM(s.tx_count) AS transactions FROM history_block_stats s JOIN blocks b ON b.slot=s.slot WHERE b.epoch=?", (epoch,)).fetchone()
        if totals["blocks"] != boundaries["info"]["blk_count"] or totals["transactions"] != boundaries["info"]["tx_count"]:
            raise ValueError("Replayed block/transaction totals do not match the independent epoch totals")
        first = db.execute("SELECT * FROM blocks WHERE epoch=? ORDER BY slot LIMIT 1", (epoch,)).fetchone()
        last = db.execute("SELECT * FROM blocks WHERE epoch=? ORDER BY slot DESC LIMIT 1", (epoch,)).fetchone()
        if first["hash"] != boundaries["first"]["hash"] or last["hash"] != boundaries["last"]["hash"]:
            raise ValueError("Imported first/last block hashes differ from the independent source")
        bad = db.execute("SELECT COUNT(*) FROM (SELECT hash,parent,height,LAG(height) OVER(ORDER BY slot) AS previous_height,LAG(hash) OVER(ORDER BY slot) AS previous FROM blocks) WHERE previous IS NOT NULL AND (parent!=previous OR height!=previous_height+1)").fetchone()[0]
        if bad:
            raise ValueError("Historical block ancestry is discontinuous")
        event_count = 0
        previous_tx = None
        raw = None
        for event in db.execute("""SELECT e.*,t.slot,t.raw FROM events e JOIN transactions t ON t.id=e.tx ORDER BY e.tx,e.dapp,e.script,e.kind,e.ref"""):
            if previous_tx != event["tx"]:
                raw = json.loads(event["raw"])
                previous_tx = event["tx"]
            if raw.get("spends") != "inputs" or store.scripts.get(event["script"]) != event["dapp"]:
                raise ValueError("Historical event attribution is invalid")
            if event["kind"] == "output_created":
                txid, index = event["ref"].split("#")
                if txid != event["tx"] or fast_script_hash(raw["outputs"][int(index)]["address"]) != event["script"]:
                    raise ValueError("Historical creation evidence differs from the node transaction")
            else:
                old = db.execute("SELECT script,address,spent_slot FROM outputs WHERE ref=? UNION ALL SELECT script,address,spent_slot FROM boundary_outputs WHERE ref=? LIMIT 1", (event["ref"], event["ref"])).fetchone()
                if not old or old["script"] != event["script"] or old["spent_slot"] != event["slot"] or fast_script_hash(old["address"]) != event["script"]:
                    raise ValueError("Historical spend evidence is invalid")
                if not any(f'{item["transaction"]["id"]}#{item["index"]}' == event["ref"] for item in raw["inputs"]):
                    raise ValueError("Historical spend has no consumed input")
            event_count += 1
        days = [dict(row) for row in db.execute("""SELECT strftime('%Y-%m-%d',b.time,'unixepoch') AS date,e.dapp,COUNT(DISTINCT e.tx) AS transactions
          FROM events e JOIN transactions t ON t.id=e.tx JOIN blocks b ON b.slot=t.slot GROUP BY date,e.dapp ORDER BY date,e.dapp""")]
        samples = set()
        for project in store.projects:
            ids = [row[0] for row in db.execute("SELECT DISTINCT e.tx FROM events e JOIN transactions t ON t.id=e.tx WHERE dapp=? ORDER BY t.slot,e.tx", (project["slug"],))]
            if ids:
                samples.update(ids[index] for index in {0, min(1, len(ids)-1), len(ids)//2, max(0,len(ids)-2), len(ids)-1})
            if sum(day["transactions"] for day in days if day["dapp"] == project["slug"]) != len(ids):
                raise ValueError("Daily counts do not sum to the epoch total")
    independent = source.transaction_info(samples)
    for txid, other in independent.items():
        with store.connection() as db:
            block = db.execute("SELECT b.* FROM transactions t JOIN blocks b ON b.slot=t.slot WHERE t.id=?", (txid,)).fetchone()
            events = db.execute("SELECT * FROM events WHERE tx=?", (txid,)).fetchall()
        if other["block_hash"] != block["hash"] or other["block_height"] != block["height"] or other["absolute_slot"] != block["slot"]:
            raise ValueError("Historical sample differs from independent block metadata")
        for event in events:
            field = "outputs" if event["kind"] == "output_created" else "inputs"
            ref_tx, index = event["ref"].split("#")
            output = next((item for item in other[field] if item["tx_hash"] == ref_tx and item["tx_index"] == int(index)), None)
            if not output or fast_script_hash(output["payment_addr"]["bech32"]) != event["script"]:
                raise ValueError("Historical sample's independent payment credential differs")
        monitor.sample()
    return {"blocksReplayed": totals["blocks"], "chainTransactionsInspected": totals["transactions"],
            "eventAttributionChecks": event_count, "independentTransactionSamples": len(samples),
            "sampleTransactionIds": sorted(samples), "dailyTimezone": "UTC", "daily": days,
            "dapps": [{"slug": project["slug"], "name": project["name"], "transactions": len(store.actual()[project["slug"]])} for project in store.projects]}


async def run(args):
    root = Path(args.root)
    root.mkdir(parents=True, exist_ok=True)
    registry = json.loads((Path(__file__).parent / "registry.json").read_text())
    digest = hashlib.sha256(json.dumps(registry, sort_keys=True).encode()).hexdigest()
    store_module.payment_script_hash = fast_script_hash
    source = Koios(root)
    for epoch in args.epochs:
        report_path = root / f"epoch-{epoch}-report.json"
        if report_path.exists():
            existing = json.loads(report_path.read_text())
            if existing.get("passed") and existing.get("registryDigest") == digest:
                LOG.info("Already validated epoch %s; skipping", epoch)
                continue
            raise ValueError("An existing report requires review before it can be replaced")
        if shutil.disk_usage(root).free < 20 * 1024 ** 3:
            raise RuntimeError("Less than 20 GiB free; historical import stopped")
        monitor = Monitor(root, epoch)
        source.tick = monitor.sample
        started = time.time()
        LOG.info("Preparing independent epoch %s transaction inventory", epoch)
        write_json(root / "status.json", {"phase": "preparing", "epoch": epoch, "updatedAt": time.time()})
        bounds = source.epoch(epoch)
        expected = {project["slug"]: source.credential_transactions([script["hash"] for script in project["scripts"]], bounds["first"]["block_height"], bounds["last"]["block_height"]) for project in registry["projects"]}
        monitor.sample(force=True)
        store = HistoricalStore(root / f"epoch-{epoch}.sqlite3", registry, expected)
        store.set_state(historical_epoch=epoch, historical_boundaries=bounds)
        await replay(store, bounds, monitor, args.ogmios, args.rate)
        monitor.sample(force=True)
        LOG.info("Reconciling epoch %s boundary spends", epoch)
        write_json(root / "status.json", {"phase": "reconciling_boundaries", "epoch": epoch, "updatedAt": time.time()})
        repaired = reconcile_boundary_spends(store, source, bounds, monitor)
        LOG.info("Validating epoch %s evidence and daily totals", epoch)
        write_json(root / "status.json", {"phase": "validating", "epoch": epoch, "updatedAt": time.time()})
        checks = validate(store, source, bounds, monitor)
        monitor.sample(force=True)
        report = {"epoch": epoch, "passed": True, "registryDigest": digest,
                  "runtimeSha256": {name: hashlib.sha256((Path(__file__).parent / name).read_bytes()).hexdigest()
                                    for name in ["backfill.py", "store.py", "addresses.py", "worker.py"]},
                  "checkedAt": datetime.now(timezone.utc).isoformat(),
                  "startedAt": started, "durationSeconds": time.time()-started, "boundaries": bounds,
                  "source": API, "independentCredentialCandidates": {slug: len(ids) for slug, ids in expected.items()},
                  "coverage": "partial", "limitations": "Only the published payment scripts are covered. Counts are contract transactions, not trades or users. Boundary resolutions use independently retained Koios source-output evidence.",
                  **repaired, **checks, "load": monitor.summary(), "databaseBytes": store.path.stat().st_size}
        store.set_state(phase="historical_validated", validation_report=str(report_path))
        with store.connection() as db:
            db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        store.close()
        # Include the final WAL checkpoint in a normal five-second load sample,
        # rather than measuring a misleading sub-second finalization spike.
        await asyncio.sleep(max(0, 5 - (time.monotonic() - monitor.last_check)))
        monitor.sample(force=True)
        report["load"] = monitor.summary()
        report["databaseBytes"] = store.path.stat().st_size
        write_json(report_path, report)
        LOG.info("VALIDATED epoch=%s blocks=%s transactions=%s load=%s", epoch, checks["blocksReplayed"], checks["dapps"], report["load"])
    validated = sorted(json.loads(path.read_text())["epoch"] for path in root.glob("epoch-*-report.json")
                       if json.loads(path.read_text()).get("passed"))
    if not args.retain_details:
        write_json(root / "status.json", {"phase": "compacting", "epochs": validated, "updatedAt": time.time()})
        LOG.info("Retaining epoch totals only: %s", compact_epochs(root, validated, apply=True, purge_cache=True))
    write_json(root / "status.json", {"phase": "complete", "epochs": args.epochs, "validatedEpochs": validated, "updatedAt": time.time()})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--epochs", type=int, nargs="+", default=[664])
    parser.add_argument("--rate", type=float, default=100)
    parser.add_argument("--retain-details", action="store_true", help="Keep detailed history for an explicit audit run; default retains only verified epoch totals")
    parser.add_argument("--ogmios", default="ws://127.0.0.1:1337")
    args = parser.parse_args()
    if args.rate <= 0:
        parser.error("--rate must be positive")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        asyncio.run(run(args))
    except Exception as error:
        root = Path(args.root)
        if root.exists():
            previous = json.loads((root / "status.json").read_text()) if (root / "status.json").exists() else {}
            write_json(root / "status.json", {**previous, "phase": "failed", "error": str(error), "updatedAt": time.time()})
        raise


if __name__ == "__main__":
    main()
