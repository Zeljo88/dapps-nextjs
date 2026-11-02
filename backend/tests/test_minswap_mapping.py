import json
from pathlib import Path
import tempfile
import unittest

from analytics.addresses import payment_script_hash
from analytics.store import Store
from test_analytics import REGISTRY, ORDER, block, output, tx


class MinswapMappingTests(unittest.TestCase):
    def snapshot(self):
        return json.loads((Path(__file__).parents[1] / 'analytics/sources/minswap-mainnet.json').read_text())

    def test_all_published_mainnet_order_and_pool_credentials_are_registered(self):
        source = self.snapshot()
        project = next(p for p in REGISTRY['projects'] if p['slug'] == 'minswap')
        hashes = {s['hash'] for s in project['scripts']}
        self.assertEqual(len(hashes), 30)
        self.assertIn(payment_script_hash(source['v1']['orderAddress']), hashes)
        self.assertIn(source['v1']['poolHash'], hashes)
        self.assertEqual(len(source['stableswap']), 13)
        for pair in source['stableswap']:
            for kind in ['order', 'pool']:
                self.assertEqual(payment_script_hash(pair[kind + 'Address']), pair[kind + 'Hash'])
                self.assertIn(pair[kind + 'Hash'], hashes)

    def test_one_transaction_across_versions_counts_once_and_rolls_back(self):
        source = self.snapshot()
        addresses = [ORDER, source['v1']['orderAddress'], source['stableswap'][0]['orderAddress'], source['stableswap'][0]['poolAddress']]
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / 'observations.sqlite3', REGISTRY)
            store.anchor({'slot': 0, 'id': '0' * 64}, 0, 0, 663)
            store.ingest(block(1, [tx('a', outputs=[output(a) for a in addresses])]), 10, 664, 10)
            count = lambda: next(p for p in store.dapps(now=20, confirmations=0) if p['slug'] == 'minswap')['observedTransactions']
            self.assertEqual(count(), 1)
            store.ingest(block(2, [tx('b', inputs=[{'transaction': {'id': 'a' * 64}, 'index': i} for i in range(4)])]), 20, 664, 10)
            self.assertEqual(count(), 2)
            store.rollback({'slot': 10, 'id': f'{1:064x}'})
            self.assertEqual(count(), 1)
