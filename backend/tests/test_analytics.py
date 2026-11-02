import copy
import asyncio
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from analytics.addresses import payment_script_hash
from analytics.api import create_app
from analytics.store import Store
from analytics.worker import session, slot_coordinates

REGISTRY = json.loads((Path(__file__).parents[1] / "analytics" / "registry.json").read_text())
ORDER = "addr1w8p79rpkcdz8x9d6tft0x0dx5mwuzac2sa4gm8cvkw5hcnqst2ctf"
POOL = "addr1z84q0denmyep98ph3tmzwsmw0j7zau9ljmsqx6a4rvaau66j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq777e2a"


def tx(identifier, outputs=None, inputs=None, **extra):
    return {"id": identifier * 64, "spends": "inputs", "inputs": inputs or [],
            "outputs": outputs or [], "fee": {"ada": {"lovelace": 170000}}, **extra}


def output(address=ORDER):
    return {"address": address, "value": {"ada": {"lovelace": 3000000}}}


def block(number, transactions):
    return {"id": f"{number:064x}", "ancestor": f"{number-1:064x}", "slot": number * 10,
            "height": number, "transactions": transactions}


class AnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "analytics.sqlite3"
        self.store = Store(self.path, REGISTRY)
        self.store.anchor({"slot": 0, "id": "0" * 64}, 0, 0, 0)

    def tearDown(self):
        self.directory.cleanup()

    def ingest(self, number, transactions, timestamp=None):
        self.store.ingest(block(number, transactions), timestamp if timestamp is not None else time.time(), 665, number)

    def test_real_sdk_addresses_match_payment_script_not_stake_script(self):
        scripts = {script["role"]: script["hash"] for script in REGISTRY["projects"][0]["scripts"]}
        self.assertEqual(payment_script_hash(ORDER), scripts["V2 order"])
        self.assertEqual(payment_script_hash(POOL), scripts["V2 pool"])
        self.assertIsNone(payment_script_hash(ORDER[:-1] + "q"))
        self.assertIsNone(payment_script_hash("stake1" + ORDER[5:]))
        self.assertIsNone(payment_script_hash(ORDER[:10].upper() + ORDER[10:]))

    def test_transaction_with_several_scripts_and_outputs_counts_once(self):
        self.ingest(1, [tx("a", [output(), output(POOL), output()])])
        project = self.store.dapps(confirmations=0)[0]
        self.assertEqual(project["observedTransactions"], 1)
        self.assertEqual(len(self.store.recent_events("minswap")), 3)
        self.assertIsNone(project["activeWallets24h"])
        self.assertIsNone(project["lifetimeTransactions"])
        self.assertIsNone(project["tvl"])

    def test_spends_are_detected_and_rollback_restores_output_state(self):
        self.ingest(1, [tx("a", [output()])])
        spend = tx("b", inputs=[{"transaction": {"id": "a" * 64}, "index": 0}])
        self.ingest(2, [spend])
        self.assertEqual(self.store.dapps(confirmations=0)[0]["observedTransactions"], 2)
        self.store.rollback({"slot": 10, "id": f"{1:064x}"})
        self.assertEqual(self.store.dapps(confirmations=0)[0]["observedTransactions"], 1)
        self.ingest(2, [tx("c", inputs=spend["inputs"])])
        self.assertEqual(self.store.dapps(confirmations=0)[0]["observedTransactions"], 2)
        self.assertNotIn("b" * 64, [event["tx"] for event in self.store.recent_events("minswap")])

    def test_failed_scripts_references_and_unused_witnesses_do_not_count(self):
        self.ingest(1, [tx("a", [output()], spends="collaterals"),
                        tx("b", scripts={REGISTRY["projects"][0]["scripts"][0]["hash"]: {"language": "plutus:v2"}}),
                        tx("c", references=[{"transaction": {"id": "a" * 64}, "index": 0}])])
        self.assertEqual(self.store.dapps(confirmations=0)[0]["observedTransactions"], 0)

    def test_replayed_block_does_not_duplicate_events(self):
        self.ingest(1, [tx("a", [output()])])
        self.ingest(1, [tx("a", [output()])])
        self.assertEqual(self.store.dapps(confirmations=0)[0]["observedTransactions"], 1)

    def test_invalid_block_is_atomic(self):
        bad = block(1, [tx("a", [output()])])
        bad["ancestor"] = "f" * 64
        with self.assertRaises(ValueError):
            self.store.ingest(bad, time.time(), 665, 1)
        self.assertEqual(self.store.status()["counts"]["transactions"], 0)
        self.assertEqual(self.store.status()["checkpoint"]["slot"], 0)

    def test_confirmation_delay_and_rolling_window(self):
        now = 200000
        self.ingest(1, [tx("a", [output()])], now - 86401)
        self.ingest(2, [tx("b", [output()])], now - 86400)
        self.ingest(3, [tx("c", [output()])], now)
        project = self.store.dapps(now=now, confirmations=1)[0]
        self.assertEqual(project["observedTransactions"], 2)
        self.assertEqual(project["observedTx24h"], 1)

    def test_current_epoch_counts_reset_and_respect_confirmations_and_rollback(self):
        self.store.ingest(block(1,[tx('a',[output()])]),100,664,1)
        self.store.ingest(block(2,[tx('b',[output(),output()])]),200,665,2)
        self.store.ingest(block(3,[tx('c',[output()])]),300,665,3)
        row=self.store.dapps(confirmations=1)[0]
        self.assertEqual(row['observedEpoch'],665)
        self.assertEqual(row['epochRecordedSince'],200)
        self.assertEqual(row['observedTransactions'],2)
        self.assertEqual(row['observedTxEpoch'],1)
        self.store.rollback({'slot':10,'id':f'{1:064x}'})
        row=self.store.dapps(confirmations=0)[0]
        self.assertEqual(row['observedEpoch'],664)
        self.assertEqual(row['observedTxEpoch'],1)
        self.assertEqual(row['epochRecordedSince'],100)

    def test_registry_change_requires_replay_not_silent_relabelling(self):
        changed = copy.deepcopy(REGISTRY)
        changed["projects"][0]["scripts"].pop()
        with self.assertRaises(ValueError):
            Store(self.path, changed)

    def test_rollback_before_start_does_not_destroy_database(self):
        self.ingest(1, [tx("a", [output()])])
        with self.assertRaises(ValueError):
            self.store.rollback("origin")
        self.assertEqual(self.store.status()["counts"]["transactions"], 1)

    def test_disconnected_worker_marks_data_stale(self):
        self.ingest(1, [])
        self.assertTrue(self.store.status()["fresh"])
        self.store.set_state(phase="disconnected", last_error="Node unavailable")
        self.assertFalse(self.store.status()["fresh"])

    def test_catching_up_is_not_reported_as_fresh(self):
        self.store.ingest(block(1, []), time.time(), 665, 100)
        self.assertEqual(self.store.status()["lagBlocks"], 99)
        self.assertFalse(self.store.status()["fresh"])

    def test_api_reports_missing_values_and_validates_event_limit(self):
        with TestClient(create_app(self.path)) as client:
            self.assertEqual(client.get("/health").json()["api"], "ok")
            response = client.get("/v1/dapps")
            self.assertEqual(response.headers["cache-control"], "no-store")
            self.assertIsNone(response.json()[0]["price"])
            self.assertEqual(client.get("/v1/dapps/missing/events").status_code, 404)
            self.assertEqual(client.get("/v1/dapps/minswap/events?limit=10000").status_code, 422)


class SlotConversionTests(unittest.TestCase):
    def test_slot_lengths_and_epoch_boundaries_follow_era_summaries(self):
        eras = [{"start": {"slot": 0, "epoch": 0, "time": {"seconds": 0}},
                 "end": {"slot": 100}, "parameters": {"slotLength": {"milliseconds": 20000}, "epochLength": 100}},
                {"start": {"slot": 100, "epoch": 1, "time": {"seconds": 2000}},
                 "parameters": {"slotLength": {"milliseconds": 1000}, "epochLength": 400}}]
        self.assertEqual(slot_coordinates(99, 100000, eras), (101980, 0))
        self.assertEqual(slot_coordinates(100, 100000, eras), (102000, 1))
        self.assertEqual(slot_coordinates(500, 100000, eras), (102400, 2))


class LiveProtocolShapeTests(unittest.IsolatedAsyncioTestCase):
    async def test_tip_is_a_point_without_height_and_first_block_is_saved(self):
        class FakeSocket:
            blocks = 0

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def send(self, message):
                self.request = json.loads(message)

            async def recv(self):
                method = self.request["method"]
                responses = {
                    "queryNetwork/startTime": "2017-09-23T21:44:51Z",
                    "queryLedgerState/eraSummaries": [{"start": {"slot": 0, "epoch": 0, "time": {"seconds": 0}},
                        "parameters": {"slotLength": {"milliseconds": 1000}, "epochLength": 432000}}],
                    "queryNetwork/tip": {"slot": 0, "id": "0" * 64},
                    "queryNetwork/blockHeight": 0,
                    "findIntersection": {"intersection": {"slot": 0, "id": "0" * 64}},
                }
                if method == "nextBlock":
                    self.blocks += 1
                    if self.blocks > 1:
                        raise asyncio.CancelledError()
                    result = {"direction": "forward", "block": block(1, [tx("a", [output()])]), "tip": {"height": 1}}
                else:
                    result = responses[method]
                return json.dumps({"jsonrpc": "2.0", "id": self.request["id"], "result": result})

        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory) / "analytics.sqlite3", REGISTRY)
            with patch("analytics.worker.connect", return_value=FakeSocket()):
                with self.assertRaises(asyncio.CancelledError):
                    await session(store, "ws://127.0.0.1:1337", 1024 * 1024)
            self.assertEqual(store.status()["counts"]["transactions"], 1)
            self.assertEqual(store.status()["checkpoint"]["height"], 1)


if __name__ == "__main__":
    unittest.main()
