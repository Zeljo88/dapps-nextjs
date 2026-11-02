import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import sqlite3

import cbor2

from analytics.adapters.minswap import MinswapWalletAdapter
from analytics.backfill import HistoricalStore
from analytics.wallets import aggregate, constructor, decode, SCHEMA
from analytics.wallet_backfill import discard_details
from test_analytics import REGISTRY, ORDER, POOL, block, tx, output


def c(index, *fields):
    return cbor2.CBORTag(121 + index if index < 7 else 1280 + index - 7, list(fields))


def address(payment, stake=None, script=False):
    return c(0, c(int(script), payment), c(0, c(0, c(0, stake))) if stake else c(1))


def datum(family, payment=b'a'*28, stake=None, script=False, recipient=None):
    owner = address(payment, stake, script)
    if family == 'V2':
        return c(0, c(1 if script else 0, payment), recipient or owner, c(0), owner, c(0), c(0, b'', b''), c(10), 300000, c(1))
    return c(0, owner, owner, c(1), c(2, 1), 300000, 2000000)


class WalletTests(unittest.TestCase):
    def test_shared_aggregation_is_scoped_per_dapp_and_handles_ambiguous_stake_links(self):
        db = sqlite3.connect(':memory:')
        try:
            db.executescript('CREATE TABLE blocks(slot INTEGER PRIMARY KEY); INSERT INTO blocks VALUES(1);'+SCHEMA)
            # One payment key linked to two stakes stays a payment identity;
            # an enterprise address sharing another payment key is grouped.
            rows = [('one','a','x'),('one','a','y'),('one','b','x'),('one','b',None),
                    ('two','a','x'),('two','b','x')]
            for i,(slug,payment,stake) in enumerate(rows):
                db.execute('INSERT INTO wallet_orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                           (str(i),1,slug,'family','script','tx',i,None,None,'identified',payment,stake))
            first,second = aggregate(db,'one'),aggregate(db,'two')
            self.assertEqual(first['activeWallets'],2)
            self.assertEqual(first['walletActivity']['ambiguousPaymentKeys'],1)
            self.assertEqual(second['activeWallets'],1)
        finally:db.close()

    def test_retention_checks_counts_before_deleting_temporary_wallet_records(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            store=HistoricalStore(root/'epoch-664.sqlite3',REGISTRY,{},[MinswapWalletAdapter(REGISTRY)])
            store.anchor({'slot':0,'id':'0'*64},0,0,663)
            o=output();o['datum']=cbor2.dumps(datum('V2')).hex()
            store.ingest(block(1,[tx('a',outputs=[o])]),10,664,10)
            with store.connection() as db:
                metric=aggregate(db,'minswap')
                db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            store.close()
            with self.assertRaises(ValueError):
                discard_details(root,664,{}, {'minswap':{**metric,'activeWallets':100}})
            self.assertTrue((root/'epoch-664.sqlite3').exists())
            report={'dapps':[{'slug':'minswap',**metric}]}
            discard_details(root,664,report,{'minswap':metric})
            self.assertFalse(list(root.glob('*.sqlite3*')))
            final=(root/'epoch-664-report.json').read_text()
            self.assertFalse(json.loads(final)['walletDetailsRetained'])
            self.assertNotIn((b'a'*28).hex(),final)

    def test_independent_json_owner_decoder_matches_cbor(self):
        def as_json(value):
            if isinstance(value,cbor2.CBORTag):
                index,fields=constructor(value)
                return {'constructor':index,'fields':[as_json(x) for x in fields]}
            if isinstance(value,bytes):return {'bytes':value.hex()}
            if isinstance(value,int):return {'int':value}
            return [as_json(x) for x in value]
        adapter=MinswapWalletAdapter(REGISTRY)
        for family in ['V1','V2','Stableswap']:
            for script in [False,True]:
                value=datum(family,stake=b's'*28,script=script)
                self.assertEqual(adapter.participant(family,value),adapter.reference_participant(family,as_json(value)))

    def test_owner_fields_and_script_exclusion_for_all_families(self):
        adapter = MinswapWalletAdapter(REGISTRY)
        for family in ['V1','V2','Stableswap']:
            owner = adapter.participant(family, decode(cbor2.dumps(datum(family, stake=b's'*28)).hex()))
            self.assertEqual((owner.payment, owner.stake), ((b'a'*28).hex(), (b's'*28).hex()))
            self.assertEqual(adapter.participant(family, datum(family, script=True)).status, 'script_controlled')

    def test_v2_third_party_refund_does_not_steal_owner_attribution(self):
        owner = MinswapWalletAdapter(REGISTRY).participant('V2', datum('V2', recipient=address(b'z'*28, b's'*28)))
        self.assertEqual(owner.payment, (b'a'*28).hex())
        self.assertIsNone(owner.stake)

    def test_v1_trailing_extension_matches_official_sdk_prefix_decoding(self):
        original = datum('V1')
        extended = c(0, *original.value, c(0, 1, 2))
        owner = MinswapWalletAdapter(REGISTRY).participant('V1', extended)
        self.assertEqual(owner.status, 'identified')
        self.assertEqual(owner.payment, (b'a'*28).hex())

    def test_count_deduplicates_orders_families_and_shared_stake_with_rollback(self):
        snapshot=json.loads((Path(__file__).parents[1]/'analytics/sources/minswap-mainnet.json').read_text())
        order_addresses=[snapshot['v1']['orderAddress'], ORDER, snapshot['stableswap'][0]['orderAddress']]
        with tempfile.TemporaryDirectory() as folder:
            store=HistoricalStore(Path(folder)/'epoch.sqlite3', REGISTRY, {}, [MinswapWalletAdapter(REGISTRY)])
            store.anchor({'slot':0,'id':'0'*64},0,0,663)
            outputs=[]
            for i,(family,addr) in enumerate(zip(['V1','V2','Stableswap'],order_addresses)):
                o=output(addr);o['datum']=cbor2.dumps(datum(family, payment=bytes([97+i])*28, stake=b's'*28)).hex();outputs.append(o)
            pool=output(POOL);pool['datum']=cbor2.dumps(datum('V2',payment=b'p'*28)).hex();outputs.append(pool)
            store.ingest(block(1,[tx('a',outputs=outputs)]),10,664,10)
            with store.connection() as db:
                counts=aggregate(db,'minswap')
            self.assertEqual(counts['activeWallets'],1)
            self.assertEqual(counts['walletActivity']['attributedOrderOutputs'],3)
            extra=output();extra['datum']=cbor2.dumps(datum('V2',payment=b'e'*28)).hex()
            store.ingest(block(2,[tx('b',outputs=[extra])]),20,664,10)
            with store.connection() as db:self.assertEqual(aggregate(db,'minswap')['activeWallets'],2)
            store.rollback({'slot':10,'id':f'{1:064x}'})
            with store.connection() as db:self.assertEqual(aggregate(db,'minswap')['activeWallets'],1)
            store.close()

    def test_hashed_datum_witness_and_failed_transaction_handling(self):
        with tempfile.TemporaryDirectory() as folder:
            store=HistoricalStore(Path(folder)/'epoch.sqlite3',REGISTRY,{},[MinswapWalletAdapter(REGISTRY)])
            store.anchor({'slot':0,'id':'0'*64},0,0,663)
            raw=cbor2.dumps(datum('V2')).hex();h=hashlib.blake2b(bytes.fromhex(raw),digest_size=32).hexdigest();o=output();o['datumHash']=h
            store.ingest(block(1,[tx('a',outputs=[o],datums={h:raw}),tx('b',outputs=[o],spends='collaterals')]),10,664,10)
            with store.connection() as db:self.assertEqual(aggregate(db,'minswap')['walletActivity']['candidateOrderOutputs'],1)
            store.close()

    def test_decode_rejects_trailing_bytes_and_invalid_address(self):
        with self.assertRaises(ValueError):decode(cbor2.dumps(c(0)).hex()+'00')
        with self.assertRaises(ValueError):MinswapWalletAdapter(REGISTRY).participant('V1',c(0))
