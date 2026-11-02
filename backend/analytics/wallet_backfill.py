"""Reusable completed-epoch participant counts with per-protocol adapters.

Reads all blocks, counts order creators, validates sampled ownership independently,
then retains only epoch counts. Existing validated transaction totals are preserved.
"""
import argparse
import asyncio
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
import shutil
import sqlite3
import time

from . import store as store_module
from .adapters.minswap import MinswapWalletAdapter
from .backfill import HistoricalStore, Koios, Monitor, fast_script_hash, replay, write_json
from .wallets import METHOD, aggregate

LOG = logging.getLogger('analytics.wallet_backfill')
ADAPTERS = {'minswap': MinswapWalletAdapter}


def resolve_missing(store, source, adapters):
    with store.connection() as db:
        hashes = [r[0] for r in db.execute("SELECT DISTINCT datum_hash FROM wallet_orders WHERE status='missing_datum'") if r[0]]
    for offset in range(0, len(hashes), 50):
        rows = source.request('/datum_info', {'_datum_hashes': hashes[offset:offset+50]})['data']
        found = {r['datum_hash']: r for r in rows}
        with store.connection() as db:
            for h in hashes[offset:offset+50]:
                record = found.get(h)
                if not record or not record.get('bytes'):
                    # Unpublished datum hashes cannot identify an order owner.
                    # Keep the count as explicitly unattributed, never invent one.
                    db.execute("UPDATE wallet_orders SET status='unavailable_datum' WHERE datum_hash=?", (h,))
                    continue
                datum = record['bytes']
                if hashlib.blake2b(bytes.fromhex(datum), digest_size=32).hexdigest() != h:
                    raise ValueError('Independent datum bytes disagree with on-chain hash')
                for ref, slug, family in db.execute('SELECT ref,dapp,family FROM wallet_orders WHERE datum_hash=?', (h,)).fetchall():
                    owner = store.wallet_collector.identify(adapters[slug], family, datum)
                    db.execute('UPDATE wallet_orders SET datum=?,status=?,payment=?,stake=? WHERE ref=?',
                               (datum, owner.status, owner.payment, owner.stake, ref))


def validate_wallets(store, source, base, adapters, monitor):
    with store.connection() as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Wallet working database integrity failed')
        total = db.execute('SELECT COUNT(*),SUM(tx_count) FROM history_block_stats').fetchone()
        if tuple(total) != (base['blocksReplayed'], base['chainTransactionsInspected']):
            raise ValueError('Wallet scan did not cover the complete validated epoch')
        bounds = base['boundaries']
        first = db.execute('SELECT hash FROM blocks WHERE epoch=? ORDER BY slot LIMIT 1', (base['epoch'],)).fetchone()[0]
        last = db.execute('SELECT hash FROM blocks WHERE epoch=? ORDER BY slot DESC LIMIT 1', (base['epoch'],)).fetchone()[0]
        if first != bounds['first']['hash'] or last != bounds['last']['hash']:
            raise ValueError('Wallet scan boundary hashes differ from the validated epoch')
        bad = db.execute('''SELECT COUNT(*) FROM (SELECT parent,height,LAG(hash) OVER(ORDER BY slot) AS p,
            LAG(height) OVER(ORDER BY slot) AS h FROM blocks) WHERE p IS NOT NULL AND (parent!=p OR height!=h+1)''').fetchone()[0]
        if bad:
            raise ValueError('Wallet scan ancestry is discontinuous')
        metrics = {slug: aggregate(db, slug) for slug in adapters}
        sample_refs = set()
        for slug in adapters:
            for family, in db.execute('SELECT DISTINCT family FROM wallet_orders WHERE dapp=?', (slug,)):
                refs = [r[0] for r in db.execute('SELECT ref FROM wallet_orders WHERE dapp=? AND family=? AND datum IS NOT NULL ORDER BY slot,ref', (slug, family))]
                if refs:
                    sample_refs.update(refs[i] for i in {0, min(1,len(refs)-1), len(refs)//2, max(0,len(refs)-2), len(refs)-1})
            for status, in db.execute('SELECT DISTINCT status FROM wallet_orders WHERE dapp=?', (slug,)):
                row = db.execute('SELECT ref FROM wallet_orders WHERE dapp=? AND status=? AND datum IS NOT NULL ORDER BY slot LIMIT 1', (slug,status)).fetchone()
                if row:
                    sample_refs.add(row[0])
        samples = [dict(db.execute('SELECT w.*,b.hash AS block_hash,b.height FROM wallet_orders w JOIN blocks b ON b.slot=w.slot WHERE ref=?', (ref,)).fetchone()) for ref in sorted(sample_refs)]
    txs = source.transaction_info([r['tx'] for r in samples])
    hashes = sorted({r['datum_hash'] for r in samples})
    info = {}
    for offset in range(0, len(hashes), 50):
        info.update({r['datum_hash']: r for r in source.request('/datum_info', {'_datum_hashes':hashes[offset:offset+50]})['data']})
    for sample in samples:
        other = txs[sample['tx']]
        if other['block_hash'] != sample['block_hash'] or other['block_height'] != sample['height'] or other['absolute_slot'] != sample['slot']:
            raise ValueError('Independent wallet sample block metadata differs')
        output = next((o for o in other['outputs'] if o['tx_index'] == sample['output_index']), None)
        if not output or fast_script_hash(output['payment_addr']['bech32']) != sample['script'] or output['datum_hash'] != sample['datum_hash']:
            raise ValueError('Independent wallet sample output differs')
        datum = info.get(sample['datum_hash'])
        if not datum or hashlib.blake2b(bytes.fromhex(datum['bytes']),digest_size=32).hexdigest() != sample['datum_hash']:
            raise ValueError('Independent wallet sample datum differs')
        owner = adapters[sample['dapp']].reference_participant(sample['family'], datum['value'])
        if (owner.status,owner.payment,owner.stake) != (sample['status'],sample['payment'],sample['stake']):
            raise ValueError('Independent JSON wallet attribution differs from node CBOR decoding')
        monitor.sample()
    return metrics, len(samples)


def discard_details(root, epoch, report, expected_metrics):
    database = root / f'epoch-{epoch}.sqlite3'
    if database.exists():
        with closing(sqlite3.connect(f'file:{database.as_posix()}?mode=ro', uri=True)) as db:
            for slug, metric in expected_metrics.items():
                if aggregate(db,slug) != metric:
                    raise ValueError('Wallet counts changed before retention cleanup')
        if database.resolve().parent != root.resolve() or database.is_symlink():
            raise ValueError('Wallet cleanup target escapes the isolated directory')
        for suffix in ['', '-wal', '-shm']:
            Path(str(database)+suffix).unlink(missing_ok=True)
    report['walletDetailsRetained'] = False
    report['walletDetailsDiscardedAt'] = datetime.now(timezone.utc).isoformat()
    write_json(root/f'epoch-{epoch}-report.json', report)


async def run(args):
    root = Path(args.root)
    root.mkdir(parents=True,exist_ok=True)
    registry = json.loads((Path(__file__).parent/'registry.json').read_text())
    digest = hashlib.sha256(json.dumps(registry,sort_keys=True).encode()).hexdigest()
    adapters = {slug: ADAPTERS[slug](registry) for slug in args.dapps}
    source = Koios(root)
    store_module.payment_script_hash = fast_script_hash
    for epoch in args.epochs:
        base_path = Path(args.base_history)/f'epoch-{epoch}-report.json'
        base_bytes = base_path.read_bytes()
        base = json.loads(base_bytes)
        if not base.get('passed') or base['registryDigest'] != digest:
            raise ValueError('Wallet scan requires a validated epoch under the active registry')
        report_path = root/f'epoch-{epoch}-report.json'
        if report_path.exists():
            saved = json.loads(report_path.read_text())
            if saved.get('walletValidation',{}).get('method') == METHOD and saved['walletValidation'].get('passed') and saved['walletValidation']['baseSummarySha256'] == hashlib.sha256(base_bytes).hexdigest():
                metrics = {d['slug']:{k:d[k] for k in ['activeWallets','walletActivity']} for d in saved['dapps'] if d['slug'] in adapters}
                discard_details(root,epoch,saved,metrics)
                continue
            raise ValueError('Existing wallet report needs review before replacement')
        monitor = Monitor(root,epoch)
        source.tick = monitor.sample
        write_json(root/'status.json',{'phase':'preparing','epoch':epoch,'updatedAt':time.time()})
        LOG.info('Preparing wallet scan epoch=%s',epoch)
        bounds = source.epoch(epoch)
        if bounds['first']['hash'] != base['boundaries']['first']['hash'] or bounds['last']['hash'] != base['boundaries']['last']['hash']:
            raise ValueError('Current independent epoch boundaries differ from the base summary')
        store = HistoricalStore(root/f'epoch-{epoch}.sqlite3',registry,{},list(adapters.values()))
        await replay(store,bounds,monitor,args.ogmios,args.rate)
        write_json(root/'status.json',{'phase':'validating_wallets','epoch':epoch,'updatedAt':time.time()})
        LOG.info('Validating wallet owners epoch=%s',epoch)
        resolve_missing(store,source,adapters)
        metrics,samples = validate_wallets(store,source,base,adapters,monitor)
        report = dict(base)
        report['dapps'] = [dict(d,**metrics.get(d['slug'],{})) for d in base['dapps']]
        report['walletValidation'] = {'passed':True,'method':METHOD,'checkedAt':datetime.now(timezone.utc).isoformat(),
            'baseSummarySha256':hashlib.sha256(base_bytes).hexdigest(),'independentSamples':samples,
            'adapters':{slug:a.version for slug,a in adapters.items()},
            'runtimeSha256':{name:hashlib.sha256((Path(__file__).parent/name).read_bytes()).hexdigest() for name in ['wallet_backfill.py','wallets.py','wallet_methods.py','adapters/minswap.py','backfill.py','store.py','addresses.py']}}
        report['walletDetailsRetained'] = True
        with store.connection() as db:db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        store.close()
        await asyncio.sleep(max(0,5-(time.monotonic()-monitor.last_check)))
        monitor.sample(force=True)
        report['walletValidation']['load'] = monitor.summary()
        write_json(report_path,report)
        discard_details(root,epoch,report,metrics)
        LOG.info('VALIDATED_WALLETS epoch=%s counts=%s',epoch,json.dumps(metrics))
    shutil.rmtree(root/'source-cache',ignore_errors=False)
    write_json(root/'status.json',{'phase':'complete','validatedEpochs':sorted(args.epochs),'updatedAt':time.time()})


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',required=True)
    parser.add_argument('--base-history',required=True)
    parser.add_argument('--epochs',type=int,nargs='+',required=True)
    parser.add_argument('--dapps',nargs='+',choices=sorted(ADAPTERS),default=['minswap'])
    parser.add_argument('--ogmios',default='ws://127.0.0.1:1337')
    parser.add_argument('--rate',type=float,default=80)
    args=parser.parse_args()
    if Path(args.root).resolve()==Path(args.base_history).resolve():parser.error('Use an isolated output directory')
    if args.rate<=0:parser.error('Rate must be positive')
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
    try:asyncio.run(run(args))
    except Exception as error:
        root=Path(args.root)
        if root.exists():
            state=json.loads((root/'status.json').read_text()) if (root/'status.json').exists() else {}
            write_json(root/'status.json',{**state,'phase':'failed','error':str(error),'updatedAt':time.time()})
        raise


if __name__=='__main__':main()
