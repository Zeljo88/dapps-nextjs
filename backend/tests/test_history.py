import json
from pathlib import Path
import tempfile
import unittest
from copy import deepcopy

from analytics.history import history_data
from analytics.wallet_methods import METHOD, ADAPTER_VERSIONS


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

    def test_wallet_publication_requires_final_validated_supported_counts(self):
        report = self.report(1, 0, 10000, [])
        activity = dict(method=METHOD, candidateOrderOutputs=10, attributedOrderOutputs=8,
                        scriptControlledOrderOutputs=1, unrecognizedOrderOutputs=1,
                        unavailableDatumOrderOutputs=0, attributionPercent=80.0, ambiguousPaymentKeys=0,
                        privateWorkingKeys=['must-never-be-published'])
        report['dapps'][0].update(activeWallets=3, walletActivity=activity)
        report.update(walletValidation={'passed':True,'method':METHOD,'adapters':ADAPTER_VERSIONS},
                      walletDetailsRetained=False)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'epoch-1-report.json'
            def publish(value):
                path.write_text(json.dumps(value))
                return history_data(directory, 'reviewed')['epochs'][0]['dapps'][0]
            result = publish(report)
            self.assertEqual(result['activeWallets'],3)
            self.assertNotIn('privateWorkingKeys',result['walletActivity'])
            enriched=deepcopy(report)
            enriched['walletValidations']={'minswap':deepcopy(report['walletValidation'])}
            enriched['walletValidation']['adapters']={'sundaeswap':ADAPTER_VERSIONS['sundaeswap']}
            self.assertEqual(publish(enriched)['activeWallets'],3)
            enriched['walletValidations']['minswap']['passed']=False
            self.assertNotIn('activeWallets',publish(enriched))
            for change in ['pending','unvalidated','unknown_adapter','invalid_count','coverage_mismatch']:
                bad = deepcopy(report)
                if change == 'pending':bad['walletDetailsRetained'] = True
                if change == 'unvalidated':bad['walletValidation']['passed'] = False
                if change == 'unknown_adapter':bad['walletValidation']['adapters'] = {'minswap':'future-unreviewed'}
                if change == 'invalid_count':bad['dapps'][0]['activeWallets'] = 9
                if change == 'coverage_mismatch':bad['dapps'][0]['walletActivity']['attributionPercent'] = 99
                self.assertNotIn('activeWallets',publish(bad),change)
            zero = deepcopy(report)
            zero['dapps'][0]['activeWallets'] = 0
            zero['dapps'][0]['walletActivity'].update({k:0 for k in activity if k.endswith('OrderOutputs')})
            zero['dapps'][0]['walletActivity']['attributionPercent'] = 100.0
            self.assertEqual(publish(zero)['activeWallets'],0)


if __name__ == "__main__":
    unittest.main()
