"""Warm immutable reference caches; never replay, publish or modify a database.

Run with the frozen backfill runtime on PYTHONPATH. Separate work caches and
unique atomic publication files allow the main importer to read concurrently.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import logging
import os
from pathlib import Path
import threading
import time

from analytics.backfill import Koios, Monitor


class PrefetchSource(Koios):
    def __init__(self, root, work):
        super().__init__(work, minimum_interval=1.5)
        self.published = root / "source-cache"

    def request(self, path, body=None, exact_count=False):
        self.tick()
        key = hashlib.sha256(json.dumps([path, body], sort_keys=True).encode()).hexdigest()
        target = self.published / (key + ".json")
        if target.exists():
            saved = json.loads(target.read_text())
            if not exact_count or (saved.get("range") or "").rsplit("/", 1)[-1].isdigit():
                return saved
        saved = super().request(path, body, exact_count)
        temporary = target.with_suffix(f".prefetch-{os.getpid()}-{threading.get_ident()}.tmp")
        temporary.write_text(json.dumps(saved, indent=2) + "\n")
        temporary.replace(target)
        logging.info("Cached %s rows from %s", len(saved["data"]), path)
        return saved


def prepare(root, registry, epoch):
    if (root / f"epoch-{epoch}-report.json").exists():
        return {"epoch": epoch, "alreadyValidated": True}
    work = root / "prefetch" / str(epoch)
    work.mkdir(parents=True, exist_ok=True)
    monitor = Monitor(work, epoch)
    source = PrefetchSource(root, work)
    source.tick = monitor.sample
    bounds = source.epoch(epoch)
    counts = {}
    for project in registry["projects"]:
        transactions = source.credential_transactions(
            [script["hash"] for script in project["scripts"]],
            bounds["first"]["block_height"], bounds["last"]["block_height"])
        counts[project["slug"]] = len(transactions)
        logging.info("Prepared epoch=%s dapp=%s inventory=%s", epoch, project["slug"], len(transactions))
    monitor.sample(force=True)
    result = {"epoch": epoch, "preparedAt": time.time(), "inventory": counts,
              "load": monitor.summary(), "note": "Reference cache only; not a validated historical epoch."}
    (work / "prepared.json").write_text(json.dumps(result, indent=2) + "\n")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--registry", required=True, type=Path)
    parser.add_argument("--epochs", required=True, type=int, nargs="+")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    registry = json.loads(args.registry.read_text())
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda epoch: prepare(args.root, registry, epoch), args.epochs))
    print(json.dumps(results))


if __name__ == "__main__":
    main()
