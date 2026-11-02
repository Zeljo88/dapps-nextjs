import json
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest

from analytics.retention import compact_epochs


class RetentionTests(unittest.TestCase):
    def fixture(self, root, count=1):
        report = root / "epoch-664-report.json"
        report.write_text(json.dumps({"epoch": 664, "passed": True,
            "dapps": [{"slug": "minswap", "transactions": count}],
            "daily": ["old daily data"], "sampleTransactionIds": ["tx"]}))
        database = root / "epoch-664.sqlite3"
        with closing(sqlite3.connect(database)) as db:
            db.execute("CREATE TABLE events(dapp TEXT,tx TEXT)")
            db.execute("INSERT INTO events VALUES('minswap','tx')")
            db.commit()
        return report, database

    def test_dry_run_preserves_details_and_apply_preserves_verified_totals(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            report, database = self.fixture(root)
            original = report.read_bytes()
            compact_epochs(root, [664])
            self.assertEqual(report.read_bytes(), original)
            self.assertTrue(database.exists())
            compact_epochs(root, [664], apply=True)
            summary = json.loads(report.read_text())
            self.assertEqual(summary["dapps"][0]["transactions"], 1)
            self.assertEqual(summary["retention"], "epoch-totals-only")
            self.assertNotIn("daily", summary)
            self.assertFalse(database.exists())
            compact_epochs(root, [664], apply=True)  # Safe to resume after cleanup.

    def test_mismatched_counts_leave_all_evidence_untouched(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            report, database = self.fixture(root, count=2)
            original = report.read_bytes()
            with self.assertRaisesRegex(ValueError, "totals"):
                compact_epochs(root, [664], apply=True)
            self.assertTrue(database.exists())
            self.assertEqual(report.read_bytes(), original)
