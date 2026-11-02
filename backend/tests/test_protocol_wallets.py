import json
from pathlib import Path
import sqlite3
import unittest
import cbor2

from analytics.adapters.sundaeswap import SundaeSwapWalletAdapter
from analytics.adapters.wingriders import WingRidersWalletAdapter
from analytics.wallets import Participant, WalletCollector, aggregate, SCHEMA, constructor
from test_wallets import c, address
from test_analytics import REGISTRY


def plutus_json(value):
    if isinstance(value,cbor2.CBORTag):
        i,f=constructor(value)
        return {'constructor':i,'fields':[plutus_json(x) for x in f]}
    if isinstance(value,bytes):return {'bytes':value.hex()}
    if type(value) is int:return {'int':value}
    return {'list':[plutus_json(x) for x in value]}


def sundae(family,owner=b's'*28,destination=None,alternate=None,policy=0):
    destination=destination or address(b'p'*28,b's'*28)
    if family=='V1':
        return c(0,b'id',c(0,c(0,destination,c(1)),c(0,alternate) if alternate else c(1)),100,c(0,c(0),1,c(0,1)))
    auth=c(policy,owner) if policy in (0,6) else c(policy,[])
    dest=c(0,destination,c(0))
    if family=='V4':return c(0,auth,dest,100,100,b't'*32,[],c(0))
    return c(0,c(0,b'i'*28),auth,100,dest,c(1,[],[]),b'')


def wing(owner=b'p'*28,beneficiary=None):
    return c(0,c(0,beneficiary or address(b'p'*28,b's'*28),owner,123456,c(0,c(0,b'',b''),c(0,b't'*28,b'token'))),c(0,c(0),1))


class ProtocolWalletTests(unittest.TestCase):
    def test_sundae_owner_keys_across_all_tracked_versions_and_independent_json(self):
        adapter=SundaeSwapWalletAdapter(REGISTRY)
        for family in ('V1','V3','V4','Stableswaps'):
            value=sundae(family)
            owner=adapter.participant(family,value)
            self.assertEqual(owner,adapter.reference_participant(family,plutus_json(value)))
            self.assertEqual(owner.kind,'authorization')
            self.assertEqual(owner.payment,(b's'*28).hex())
            self.assertIsNone(owner.stake)
        self.assertEqual(len(adapter.order_scripts),4)

    def test_sundae_alternate_and_routed_owner_not_receiver_or_batcher(self):
        adapter=SundaeSwapWalletAdapter(REGISTRY)
        v1=sundae('V1',alternate=b'a'*28)
        self.assertEqual(adapter.participant('V1',v1).payment,(b'a'*28).hex())
        for family in ('V3','V4','Stableswaps'):
            value=sundae(family,owner=b'a'*28,destination=address(b'r'*28,b'z'*28))
            self.assertEqual(adapter.participant(family,value).payment,(b'a'*28).hex())
            for policy in (1,2,3,4,5,6):
                value=sundae(family,policy=policy)
                self.assertEqual(adapter.participant(family,value).status,'script_controlled')
                self.assertEqual(adapter.participant(family,value),adapter.reference_participant(family,plutus_json(value)))

    def test_wing_explicit_owner_stake_grouping_and_third_party_beneficiary(self):
        adapter=WingRidersWalletAdapter(REGISTRY)
        for family in ('V1','V1-stableswap'):
            for value in (wing(),wing(owner=b'a'*28),wing(beneficiary=address(b'p'*28,b's'*28,script=True))):
                self.assertEqual(adapter.participant(family,value),adapter.reference_participant(family,plutus_json(value)))
            self.assertEqual(adapter.participant(family,wing()).stake,(b's'*28).hex())
            self.assertIsNone(adapter.participant(family,wing(owner=b'a'*28)).stake)
        self.assertEqual(len(adapter.order_scripts),2)

    def test_shared_collector_deduplicates_sundae_signature_across_families(self):
        adapter=SundaeSwapWalletAdapter(REGISTRY)
        db=sqlite3.connect(':memory:')
        try:
            db.executescript('CREATE TABLE blocks(slot INTEGER PRIMARY KEY); INSERT INTO blocks VALUES(1);'+SCHEMA)
            collector=WalletCollector([adapter],lambda s:s)
            outputs=[{'address':script,'datum':cbor2.dumps(sundae(family)).hex()} for script,family in adapter.order_scripts.items()]
            collector.ingest(db,{'slot':1,'transactions':[{'id':'a'*64,'spends':'inputs','outputs':outputs}]})
            result=aggregate(db,'sundaeswap')
            self.assertEqual(result['activeWallets'],1)
            self.assertEqual(result['walletActivity']['attributedOrderOutputs'],4)
        finally:db.close()

    def test_malformed_owner_keys_are_excluded(self):
        s=SundaeSwapWalletAdapter(REGISTRY);w=WingRidersWalletAdapter(REGISTRY)
        for adapter,family,value in [(s,'V3',sundae('V3',owner=b'bad')),(w,'V1',wing(owner=b'bad'))]:
            self.assertEqual(WalletCollector.identify(adapter,family,cbor2.dumps(value).hex()).status,'unrecognized_datum')
            self.assertEqual(adapter.reference_participant(family,plutus_json(value)).status,'unrecognized_datum')

    def test_non_sdk_wing_request_actions_remain_explicit_exclusions(self):
        adapter=WingRidersWalletAdapter(REGISTRY)
        _,fields=constructor(wing())
        for action in (3,4):
            value=c(0,fields[0],c(action))
            self.assertEqual(WalletCollector.identify(adapter,'V1',cbor2.dumps(value).hex()).status,'unrecognized_datum')
            self.assertEqual(adapter.reference_participant('V1',plutus_json(value)).status,'unrecognized_datum')
