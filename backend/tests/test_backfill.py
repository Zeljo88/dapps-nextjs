import copy
import json
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from analytics.addresses import payment_script_hash
from analytics.backfill import HistoricalStore, Koios, Monitor, adjusted_rate, fast_script_hash, reconcile_boundary_spends
from test_analytics import REGISTRY, ORDER, block, output, tx


class BackfillTests(unittest.TestCase):
    def test_adaptive_rate_slows_before_the_io_stop_threshold_and_respects_bounds(self):
        self.assertLess(adjusted_rate(100, 100, {"ioWaitPercent": 12, "cpuBusyPercent": 10}), 100)
        self.assertEqual(adjusted_rate(10, 100, {"ioWaitPercent": 15, "cpuBusyPercent": 10}), 10)
        self.assertLessEqual(adjusted_rate(99, 100, {"ioWaitPercent": 1, "cpuBusyPercent": 10}), 100)
    def test_pagination_retains_transactions_across_a_large_block_boundary(self):
        records = [{"tx_hash": f"{i:064x}", "block_height": 1 if i < 41 else 2 if i < 1041 else 3} for i in range(1101)]
        class Source(Koios):
            def request(self, path, body=None, exact_count=False):
                offset = int(path.rsplit("offset=", 1)[1])
                available = [r for r in records if r["block_height"] >= body["_after_block_height"]]
                return {"data": available[offset:offset+500], "range": "0-499/1101" if exact_count else "0-499/*"}
        source = object.__new__(Source)
        result = source.credential_transactions(["script"], 1, 3, page_size=500)
        self.assertEqual(set(result), {r["tx_hash"] for r in records})

    def test_failed_and_unmatched_candidates_are_retained_atomically(self):
        with tempfile.TemporaryDirectory() as directory:
            expected = {p["slug"]: {} for p in REGISTRY["projects"]}
            expected["minswap"] = {"a" * 64: 1, "b" * 64: 1}
            store = HistoricalStore(Path(directory) / "history.sqlite3", REGISTRY, expected)
            store.anchor({"slot": 0, "id": "0" * 64}, 0, 0, 663)
            store.ingest(block(1, [tx("a", spends="collaterals"), tx("b")]), 10, 664, 100)
            with store.connection() as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM raw_candidates").fetchone()[0], 2)
                self.assertEqual(db.execute("SELECT tx_count,invalid_count FROM history_block_stats").fetchone()[0], 2)
            store.rollback({"slot": 0, "id": "0" * 64})
            with store.connection() as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM raw_candidates").fetchone()[0], 0)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM history_block_stats").fetchone()[0], 0)
            store.close()

    def test_boundary_spend_is_recovered_with_no_invented_creation_event(self):
        with tempfile.TemporaryDirectory() as directory:
            expected = {p["slug"]: {} for p in REGISTRY["projects"]}
            expected["minswap"] = {"b" * 64: 2}
            store = HistoricalStore(Path(directory) / "history.sqlite3", REGISTRY, expected)
            store.anchor({"slot": 10, "id": f"{1:064x}"}, 1, 10, 663)
            raw = tx("b", inputs=[{"transaction": {"id": "a" * 64}, "index": 0}])
            store.ingest(block(2, [raw]), 20, 664, 100)
            evidence = {"tx_hash": "a" * 64, "tx_index": 0, "value": "3000000", "payment_addr": {"bech32": ORDER}}
            records = {"b" * 64: {"block_hash": f"{2:064x}", "absolute_slot": 20, "inputs": [evidence]},
                       "a" * 64: {"absolute_slot": 5, "outputs": [evidence]}}
            class Source:
                def transaction_info(self, identifiers):
                    return {key: records[key] for key in identifiers}
            class QuietMonitor:
                def sample(self):
                    pass
            result = reconcile_boundary_spends(store, Source(), {"first": {"abs_slot": 20}}, QuietMonitor())
            self.assertEqual(result["boundaryTransactionsRecovered"], 1)
            self.assertEqual(store.actual()["minswap"], {"b" * 64})
            with store.connection() as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM outputs").fetchone()[0], 0)
                self.assertEqual(db.execute("SELECT kind FROM events").fetchone()[0], "output_spent")
            # A repeated validation is idempotent and rollbacks restore boundary state.
            resumed = reconcile_boundary_spends(store, Source(), {"first": {"abs_slot": 20}}, QuietMonitor())
            self.assertEqual(resumed["boundaryTransactionsRecovered"], 1)
            self.assertEqual(resumed["boundarySpendEventsRecovered"], 1)
            store.rollback({"slot": 10, "id": f"{1:064x}"})
            with store.connection() as db:
                self.assertIsNone(db.execute("SELECT spent_slot FROM boundary_outputs").fetchone()[0])
            store.close()

    def test_decoder_optimization_keeps_checksum_and_network_validation(self):
        for address in [ORDER, ORDER[:-1] + "q", ORDER.upper(), ORDER[:10].upper() + ORDER[10:],
                        "addr1q9dhugez3ka82k2kgh7r2lg0j7aztr8uell46kydfwu3vk6n8w2cdu8mn2ha278q6q25a9rc6gmpfeekavuargcd32vsvxhl7e"]:
            self.assertEqual(fast_script_hash(address), payment_script_hash(address))

    def test_memory_or_live_lag_stops_import(self):
        healthy = {"time": 100, "ticks": [0,0,0,100,0,0,0,0], "memoryAvailable": 8*1024**3,
                   "load1": 0.1, "liveFresh": True, "liveLag": 0, "liveHeight": 1, "liveLastReceived": 100}
        with tempfile.TemporaryDirectory() as directory, patch("analytics.backfill.shutil.disk_usage", return_value=SimpleNamespace(free=100*1024**3)):
            monitor = Monitor(Path(directory), 664, sampler=lambda: copy.deepcopy(healthy))
            self.assertEqual(monitor.summary()["maximumCpuBusyPercent"], 0)
            healthy["liveLag"] = 11
            with self.assertRaisesRegex(RuntimeError, "live collector"):
                monitor.sample(force=True)


if __name__ == "__main__":
    unittest.main()
