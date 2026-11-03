import copy
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from fastapi.testclient import TestClient
from analytics.insights import Insights, create_app
from analytics.store import Store
from analytics.wallet_methods import METHOD, ADAPTER_VERSIONS
from test_analytics import REGISTRY, ORDER, POOL, tx, output, block


class InsightsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.path = self.root / 'live.sqlite3'
        self.history = self.root / 'history'
        self.history.mkdir()
        self.store = Store(self.path, REGISTRY)
        self.store.anchor({'slot': 0, 'id': '0' * 64}, 0, 100, 665)
        self.reader = Insights(self.path, self.history, REGISTRY)

    def tearDown(self):
        self.temp.cleanup()

    def ingest(self, n, transactions=None):
        self.store.ingest(block(n, transactions or []), 100 + n, 665, n)

    def prepared(self):
        token_output = output()
        token_output['value']['a' * 56] = {'01': 900719925474099312345}
        self.ingest(1, [tx('a', [output(), token_output, output(POOL)])])
        self.ingest(2, [tx('b', inputs=[{'transaction': {'id': 'a' * 64}, 'index': 0}])])
        self.ingest(3)
        self.ingest(4, [tx('c', inputs=[{'transaction': {'id': 'a' * 64}, 'index': 1}])])
        self.ingest(5)
        self.ingest(6)

    def report(self):
        return {'epoch': 664, 'passed': True, 'registryDigest': self.reader.digest,
                'boundaries': {'info': {'start_time': 1, 'end_time': 2}},
                'checkedAt': '2026-11-01T00:00:00Z', 'blocksReplayed': 10,
                'chainTransactionsInspected': 100, 'independentTransactionSamples': 5,
                'boundaryTransactionsRecovered': 1, 'walletDetailsRetained': False,
                'walletValidation': {'passed': True, 'method': METHOD, 'adapters': ADAPTER_VERSIONS},
                'dapps': [{'slug': 'minswap', 'name': 'Minswap', 'transactions': 10, 'activeWallets': 3,
                          'walletActivity': {'method': METHOD, 'candidateOrderOutputs': 5, 'attributedOrderOutputs': 5,
                            'scriptControlledOrderOutputs': 0, 'unrecognizedOrderOutputs': 0,
                            'unavailableDatumOrderOutputs': 0, 'attributionPercent': 100.0, 'ambiguousPaymentKeys': 0,
                            'familyWalletCounts': {'V1': 2, 'V2': 3}, 'privateWorkingKeys': ['secret-wallet-identity']}}]}

    def test_fees_and_version_transactions_deduplicate_and_respect_confirmations(self):
        self.prepared()
        r = self.reader.read('minswap')['recorded']
        self.assertEqual(r['transactions'], 2)
        self.assertEqual(r['networkFeesLovelace'], '340000')
        self.assertEqual(r['averageNetworkFeeAda'], '0.17')
        self.assertEqual(r['versionTransactions'], [{'version': 'V2', 'transactions': 2}])
        self.assertEqual(r['outputsCreated'], 3)
        self.assertEqual(r['outputsSpent'], 1)
        self.assertEqual(r['fromTime'], 100)
        self.assertEqual(r['throughTime'], 103)

    def test_balance_snapshot_restores_outputs_spent_only_in_provisional_blocks(self):
        self.prepared()
        r = self.reader.read('minswap')['recorded']
        self.assertEqual(r['observedUnspentOutputs'], 2)
        self.assertEqual(r['observedLovelace'], '6000000')
        self.assertEqual(r['assets'][0]['quantity'], '900719925474099312345')
        self.ingest(7)
        r = self.reader.read('minswap')['recorded']
        self.assertEqual(r['observedUnspentOutputs'], 1)
        self.assertEqual(r['observedLovelace'], '3000000')
        self.assertEqual(r['assets'], [])
        self.store.rollback({'slot': 30, 'id': f'{3:064x}'})
        self.ingest(4)
        self.ingest(5)
        self.ingest(6)
        self.assertEqual(self.reader.read('minswap')['recorded']['observedLovelace'], '6000000')

    def test_final_reports_expose_counts_only_and_preserve_overlapping_versions(self):
        report = self.report()
        path = self.history / 'epoch-664-report.json'
        path.write_text(json.dumps(report))
        r = self.reader.read('minswap')
        self.assertEqual(r['epochs'][0]['orderOutputsCreated'], 5)
        self.assertEqual(r['epochs'][0]['transactionSharePercent'], 10)
        self.assertEqual(r['epochs'][0]['walletVersions'], [{'version': 'V1', 'activeWallets': 2}, {'version': 'V2', 'activeWallets': 3}])
        self.assertNotIn('secret-wallet-identity', json.dumps(r))
        report['dapps'][0]['walletActivity']['familyWalletCounts']['V1'] = 99
        path.write_text(json.dumps(report))
        self.assertEqual(self.reader.read('minswap')['epochs'][0]['walletVersions'], [])

    def test_unvalidated_wallet_counts_and_wrong_registry_are_not_published(self):
        report = self.report()
        path = self.history / 'epoch-664-report.json'
        report['walletValidation']['passed'] = False
        path.write_text(json.dumps(report))
        r = self.reader.read('minswap')['epochs'][0]
        self.assertIsNone(r['orderOutputsCreated'])
        self.assertEqual(r['walletVersions'], [])
        report['registryDigest'] = 'wrong'
        path.write_text(json.dumps(report))
        self.assertEqual(self.reader.read('minswap')['epochs'], [])

    def test_zero_activity_is_not_a_zero_average_and_missing_db_is_not_created(self):
        for n in range(1, 5): self.ingest(n)
        r = self.reader.read('minswap')['recorded']
        self.assertEqual(r['transactions'], 0)
        self.assertEqual(r['networkFeesLovelace'], '0')
        self.assertIsNone(r['averageNetworkFeeAda'])
        missing = self.root / 'missing.sqlite3'
        with self.assertRaises(sqlite3.OperationalError): Insights(missing, self.history, REGISTRY).read('minswap')
        self.assertFalse(missing.exists())

    def test_reader_does_not_change_database_and_api_fails_closed(self):
        self.prepared()
        before = hashlib.sha256(self.path.read_bytes()).digest()
        with TestClient(create_app(self.path, self.history, REGISTRY)) as client:
            response = client.get('/staging/v1/dapps/minswap/metrics')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertEqual(client.get('/staging/v1/dapps/unknown/metrics').status_code, 404)
            self.assertEqual(response.json()['source'], 'own-cardano-node')
        self.assertEqual(hashlib.sha256(self.path.read_bytes()).digest(), before)
        wrong = copy.deepcopy(REGISTRY)
        wrong['version'] = 100
        with TestClient(create_app(self.path, self.history, wrong)) as client:
            self.assertEqual(client.get('/staging/v1/dapps/minswap/metrics').status_code, 503)

    def test_api_invalidates_cached_snapshot_when_rollback_removes_confirmations(self):
        self.prepared()
        with TestClient(create_app(self.path, self.history, REGISTRY)) as client:
            first = client.get('/staging/v1/dapps/minswap/metrics').json()
            self.assertEqual(first['recorded']['transactions'], 2)
            self.store.rollback({'slot': 40, 'id': f'{4:064x}'})
            second = client.get('/staging/v1/dapps/minswap/metrics').json()
            self.assertEqual(second['recorded']['confirmedHeight'], 1)
            self.assertEqual(second['recorded']['transactions'], 1)
            self.assertEqual(second['recorded']['networkFeesLovelace'], '170000')


if __name__ == '__main__': unittest.main()
