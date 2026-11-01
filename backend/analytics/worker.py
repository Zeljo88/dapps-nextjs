import asyncio
from datetime import datetime
import json
import logging
import os
from pathlib import Path
import time

from websockets.asyncio.client import connect

from .store import Store

LOG = logging.getLogger("analytics.worker")


class Rpc:
    def __init__(self, socket):
        self.socket = socket
        self.counter = 0

    async def call(self, method, params=None, timeout=30):
        self.counter += 1
        request = {"jsonrpc": "2.0", "method": method, "id": self.counter}
        if params is not None:
            request["params"] = params
        await self.socket.send(json.dumps(request))
        response = json.loads(await asyncio.wait_for(self.socket.recv(), timeout))
        if response.get("id") != self.counter:
            raise ValueError("Unexpected RPC response ID")
        if "error" in response:
            raise RuntimeError(f"Ogmios {method}: {response['error'].get('message', 'RPC error')}")
        return response["result"]


def slot_coordinates(slot, system_start, eras):
    candidates = [era for era in eras if era["start"]["slot"] <= slot and
                  (not era.get("end") or slot < era["end"]["slot"])]
    if not candidates:
        raise ValueError("No era summary covers this slot")
    era = max(candidates, key=lambda item: item["start"]["slot"])
    delta = slot - era["start"]["slot"]
    timestamp = system_start + era["start"]["time"]["seconds"] + delta * era["parameters"]["slotLength"]["milliseconds"] / 1000
    epoch = era["start"]["epoch"] + delta // era["parameters"]["epochLength"]
    return timestamp, epoch


async def session(store, url, limit_bytes):
    async with connect(url, max_size=16 * 1024 * 1024, max_queue=2, proxy=None) as socket:
        rpc = Rpc(socket)
        start_text = await rpc.call("queryNetwork/startTime")
        if start_text != "2017-09-23T21:44:51Z":
            # Also accept equivalent ISO timezone representations.
            start_value = datetime.fromisoformat(start_text.replace("Z", "+00:00")).timestamp()
            if start_value != 1506203091:
                raise ValueError("Node is not Cardano mainnet")
        system_start = datetime.fromisoformat(start_text.replace("Z", "+00:00")).timestamp()
        eras = await rpc.call("queryLedgerState/eraSummaries")
        points = store.checkpoints()
        if not points:
            tip = await rpc.call("queryNetwork/tip")
            if tip == "origin":
                raise ValueError("Node has no synced chain tip")
            # The network tip query returns a Point (id/slot), not a ChainSync Tip.
            height = await rpc.call("queryNetwork/blockHeight")
            point = {"slot": tip["slot"], "id": tip["id"]}
            await rpc.call("findIntersection", {"points": [point]})
            timestamp, epoch = slot_coordinates(point["slot"], system_start, eras)
            store.anchor(point, height, timestamp, epoch)
        else:
            intersection = await rpc.call("findIntersection", {"points": points})
            store.rollback(intersection["intersection"])
        store.set_state(phase="running", last_error=None, last_received_at=time.time())
        while True:
            size = sum(file.stat().st_size for file in store.path.parent.glob(store.path.name + "*"))
            if size > limit_bytes:
                raise RuntimeError("Pilot database size limit reached; ingestion paused for review")
            result = await rpc.call("nextBlock", timeout=180)
            if result["direction"] == "backward":
                store.rollback(result["point"])
                continue
            block = result["block"]
            timestamp, epoch = slot_coordinates(block["slot"], system_start, eras)
            store.ingest(block, timestamp, epoch, result["tip"]["height"])


async def run(store, url, stop):
    backoff = 1
    while not stop.is_set():
        try:
            await session(store, url, int(os.environ.get("ANALYTICS_MAX_DB_MB", "2048")) * 1024 * 1024)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            LOG.warning("Indexer paused: %s", error)
            store.set_state(phase="disconnected", last_error=str(error))
            try:
                await asyncio.wait_for(stop.wait(), timeout=backoff)
            except asyncio.TimeoutError:
                pass
            backoff = min(30, backoff * 2)


def main():
    logging.basicConfig(level=logging.INFO)
    directory = Path(__file__).resolve().parent
    registry = json.loads((directory / "registry.json").read_text(encoding="utf-8"))
    store = Store(os.environ.get("ANALYTICS_DB", "data/analytics.sqlite3"), registry)
    asyncio.run(run(store, os.environ.get("OGMIOS_URL", "ws://127.0.0.1:1337"), asyncio.Event()))


if __name__ == "__main__":
    main()
