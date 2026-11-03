"""Staging-only, read-only projections of our existing node data and final reports."""
from collections import defaultdict
from contextlib import closing
from decimal import Decimal
import hashlib
import json
import logging
import os
from pathlib import Path
import sqlite3
import threading
import time

from fastapi import FastAPI, HTTPException
from .history import history_data, wallet_fields


class Insights:
    def __init__(self, database, history_root, registry):
        self.database = Path(database).resolve()
        self.history_root = Path(history_root)
        self.projects = {p['slug']: p for p in registry['projects']}
        self.digest = hashlib.sha256(json.dumps(registry, sort_keys=True).encode()).hexdigest()

    def point_still_confirmed(self, recorded):
        if not recorded:
            return False
        with closing(sqlite3.connect(self.database.as_uri() + '?mode=ro', uri=True, timeout=2)) as db:
            db.execute('PRAGMA query_only=ON')
            db.execute('BEGIN')
            tip = db.execute('SELECT height FROM blocks ORDER BY slot DESC LIMIT 1').fetchone()
            point = db.execute('SELECT hash FROM blocks WHERE slot=?', (recorded['confirmedSlot'],)).fetchone()
            return bool(tip and tip[0] >= recorded['confirmedHeight'] + 3 and point and point[0] == recorded['confirmedHash'])

    def read(self, slug):
        if slug not in self.projects:
            raise KeyError(slug)
        now = time.time()
        with closing(sqlite3.connect(self.database.as_uri() + '?mode=ro', uri=True, timeout=2)) as db:
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA query_only=ON')
            db.execute('PRAGMA cache_size=-4096')
            db.set_progress_handler(lambda: int(time.time() - now > 3), 10000)
            db.execute('BEGIN')
            state = {r['key']: json.loads(r['value']) for r in db.execute('SELECT key,value FROM metadata')}
            if state.get('registry_digest') != self.digest:
                raise ValueError('Registry mismatch')
            tip = db.execute('SELECT height FROM blocks ORDER BY slot DESC LIMIT 1').fetchone()
            cutoff = tip['height'] - 3 if tip else -1
            confirmed = db.execute('SELECT height,time,slot,hash FROM blocks WHERE height<=? ORDER BY height DESC LIMIT 1', (cutoff,)).fetchone()
            fresh = (state.get('phase') == 'running' and state.get('last_received_at') is not None
                     and 0 <= now - state['last_received_at'] < 180 and tip is not None
                     and 0 <= state.get('tip_height', 0) - tip['height'] <= 10)
            live = None
            if confirmed and state.get('started_at') is not None:
                fee_count, total_fee = 0, 0
                for row in db.execute('''SELECT t.fee_lovelace FROM transactions t JOIN blocks b ON b.slot=t.slot
                    WHERE b.height<=? AND EXISTS(SELECT 1 FROM events e WHERE e.tx=t.id AND e.dapp=?)''', (cutoff, slug)):
                    fee = int(row[0])
                    if fee < 0:
                        raise ValueError('Invalid fee')
                    fee_count += 1
                    total_fee += fee
                outputs = dict(db.execute('''SELECT e.kind,COUNT(*) FROM events e JOIN transactions t ON t.id=e.tx
                    JOIN blocks b ON b.slot=t.slot WHERE e.dapp=? AND b.height<=? GROUP BY e.kind''', (slug, cutoff)))
                mappings = [(s['hash'], s['role'].split()[0]) for s in self.projects[slug]['scripts']]
                values = ','.join('(?,?)' for _ in mappings)
                versions = [dict(r) for r in db.execute(f'''WITH versions(script,version) AS (VALUES {values}),
                    matches AS (SELECT DISTINCT e.tx,v.version FROM events e JOIN versions v ON v.script=e.script
                    JOIN transactions t ON t.id=e.tx JOIN blocks b ON b.slot=t.slot WHERE e.dapp=? AND b.height<=?)
                    SELECT version,COUNT(*) AS transactions FROM matches GROUP BY version ORDER BY version''',
                    [v for pair in mappings for v in pair] + [slug, cutoff])]
                balances = db.execute('''SELECT o.lovelace,o.value_json FROM outputs o
                    JOIN blocks c ON c.slot=o.created_slot LEFT JOIN blocks s ON s.slot=o.spent_slot
                    WHERE o.dapp=? AND c.height<=? AND (o.spent_slot IS NULL OR s.height>?)''', (slug, cutoff, cutoff))
                ada, output_count = 0, 0
                assets = defaultdict(int)
                for row in balances:
                    amount = int(row['lovelace'])
                    value = json.loads(row['value_json'])
                    if amount < 0 or value.get('ada', {}).get('lovelace', 0) != amount:
                        raise ValueError('Invalid balance')
                    ada += amount
                    output_count += 1
                    for policy, tokens in value.items():
                        if policy == 'ada':
                            continue
                        for name, quantity in tokens.items():
                            if type(quantity) is not int or quantity < 0:
                                raise ValueError('Invalid asset quantity')
                            if quantity:
                                assets[(policy, name)] += quantity
                live = {
                    'fromTime': state['started_at'], 'throughTime': confirmed['time'], 'confirmedHeight': confirmed['height'],
                    'confirmedSlot': confirmed['slot'], 'confirmedHash': confirmed['hash'],
                    'fresh': fresh, 'transactions': fee_count, 'networkFeesLovelace': str(total_fee),
                    'averageNetworkFeeAda': str(Decimal(total_fee) / fee_count / 1000000) if fee_count else None,
                    'outputsCreated': outputs.get('output_created', 0), 'outputsSpent': outputs.get('output_spent', 0),
                    'versionTransactions': versions, 'observedLovelace': str(ada), 'observedUnspentOutputs': output_count,
                    'assetCount': len(assets), 'assetsLimit': 20,
                    'assets': [{'policyId': p, 'assetNameHex': n, 'quantity': str(q)} for (p, n), q in sorted(assets.items())[:20]],
                }
        history = history_data(self.history_root, self.digest)
        epochs = []
        for epoch in history['epochs']:
            if epoch['endTime'] > now:
                continue
            dapp = next((d for d in epoch['dapps'] if d['slug'] == slug), None)
            if not dapp:
                continue
            report = json.loads((self.history_root / f"epoch-{epoch['epoch']}-report.json").read_text())
            if report.get('registryDigest') != self.digest or report.get('passed') is not True:
                raise ValueError('Historical report changed during read')
            raw_dapp = next(d for d in report['dapps'] if d['slug'] == slug)
            validated_wallet = wallet_fields(report, raw_dapp)
            families = raw_dapp.get('walletActivity', {}).get('familyWalletCounts', {}) if validated_wallet else {}
            valid_families = (isinstance(families, dict) and all(isinstance(k, str) and 0 < len(k) <= 40
                and type(v) is int and 0 <= v <= validated_wallet['activeWallets'] for k, v in families.items()))
            network = epoch['validation']['chainTransactionsInspected']
            network = network if type(network) is int and network > 0 and network >= dapp['transactions'] else None
            epochs.append({
                'epoch': epoch['epoch'], 'startTime': epoch['startTime'], 'endTime': epoch['endTime'],
                'transactions': dapp['transactions'], 'activeWallets': dapp.get('activeWallets'),
                'orderOutputsCreated': dapp.get('walletActivity', {}).get('candidateOrderOutputs'),
                'walletVersions': [{'version': k, 'activeWallets': v} for k, v in sorted(families.items())] if valid_families else [],
                'networkTransactions': network,
                'transactionSharePercent': dapp['transactions'] / network * 100 if network else None,
            })
        return {'source': 'own-cardano-node', 'registryDigest': self.digest, 'slug': slug,
                'generatedAt': now, 'confirmationDepth': 3, 'coverage': 'partial', 'epochs': epochs, 'recorded': live}


def create_app(db_path=None, history_root=None, registry=None):
    registry = registry or json.loads((Path(__file__).parent / 'registry.json').read_text())
    reader = Insights(db_path or os.environ['ANALYTICS_DB'], history_root or os.environ['ANALYTICS_HISTORY'], registry)
    app = FastAPI(title='DappsOnCardano staging own-data metrics', docs_url=None, redoc_url=None)
    cache = {}
    lock = threading.Lock()

    @app.middleware('http')
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get('/staging/health')
    def health():
        return {'api': 'ok', 'role': 'read-only-own-metrics'}

    @app.get('/staging/v1/dapps/{slug}/metrics')
    def metrics(slug: str):
        if slug not in reader.projects:
            raise HTTPException(404, 'Unknown DApp')
        with lock:
            try:
                if slug in cache and time.time() - cache[slug][0] < 30 and reader.point_still_confirmed(cache[slug][1]['recorded']):
                    return cache[slug][1]
                result = reader.read(slug)
            except (sqlite3.Error, ValueError, OSError, KeyError, TypeError) as error:
                logging.getLogger(__name__).warning('Staging own-data read failed: %s', error)
                raise HTTPException(503, 'Own-data metrics temporarily unavailable') from None
            cache[slug] = (time.time(), result)
            return result
    return app
