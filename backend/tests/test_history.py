import json
from pathlib import Path
import tempfile
import unittest

from analytics.history import history_data


class HistoryTests(unittest.TestCase):
    def report(self, epoch, start, end, daily):
        return {"epoch": epoch, "passed": True, "registryDigest": "reviewed",
                "boundaries": {"info": {"start_time": start, "end_time": end}},
                "checkedAt": "2026-11-01T00:00:00Z", "blocksReplayed": 10,
                "chainTransactionsInspected": 100, "independentTransactionSamples": 5,
                "boundaryTransactionsRecovered": 1,
                "dapps": [{"slug": "minswap", "name": "Minswap", "transactions": sum(row["transactions"] for row in daily)}],
                "daily": daily}

    def test_epoch_totals_remain_separate_and_daily_data_is_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = self.report(1, 0, 10000, [{"date": "1970-01-01", "dapp": "minswap", "transactions": 3}])
            second = self.report(2, 10000, 86400, [{"date": "1970-01-01", "dapp": "minswap", "transactions": 7}])
            for report in [first, second]:
                (root / f'epoch-{report["epoch"]}-report.json').write_text(json.dumps(report))
            result = history_data(root, "reviewed")
            self.assertEqual(len(result["epochs"]), 2)
            self.assertEqual(result["aggregation"], "epoch")
            self.assertNotIn("daily", result)
            self.assertEqual([e["dapps"][0]["transactions"] for e in result["epochs"]], [3, 7])

    def test_unvalidated_or_differently_mapped_reports_are_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = self.report(1, 0, 10000, [])
            (root / "epoch-1-report.json").write_text(json.dumps(report))
            self.assertEqual(history_data(root, "other")["epochs"], [])
            report["passed"] = False
            (root / "epoch-1-report.json").write_text(json.dumps(report))
            self.assertEqual(history_data(root, "reviewed")["epochs"], [])


if __name__ == "__main__":
    unittest.main()
