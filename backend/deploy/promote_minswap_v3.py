"""Review/promote the isolated Minswap V1/V2/stableswap migration; dry-run by default."""
import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request

BASE = Path('/home/azureuser/dapps-analytics')
DATA = Path('/mnt/cardano-data/dapps-analytics')
STAGE = BASE / 'backend-minswap-v3'
HISTORY = DATA / 'history-minswap-v3'
UNITS = ['dapps-api', 'dapps-indexer', 'dapps-history-api', 'dapps-backup', 'dapps-backfill']
ACTIVE = ['dapps-indexer', 'dapps-api', 'dapps-history-api']


def read(port, path):
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/{path}', timeout=15) as response:
        return json.load(response)


def systemctl(*args):
    subprocess.run(['sudo', '-n', 'systemctl', *args], check=True)


def review():
    for name in ['dapps-minswap-history-v3', 'dapps-minswap-prefetch-v3', 'dapps-backup']:
        if subprocess.run(['systemctl', 'is-active', '--quiet', name]).returncode == 0:
            raise RuntimeError(f'{name} must finish before promotion')
    registry = json.loads((STAGE / 'analytics/registry.json').read_text())
    digest = hashlib.sha256(json.dumps(registry, sort_keys=True).encode()).hexdigest()
    assert len(registry['projects'][0]['scripts']) == 30
    state = json.loads((HISTORY / 'status.json').read_text())
    assert state['phase'] == 'complete' and state['validatedEpochs'] == list(range(659, 665))
    assert not list(HISTORY.glob('epoch-*.sqlite3*')) and not (HISTORY / 'source-cache').exists()
    sys.path.insert(0, str(STAGE))
    from analytics.history import history_data
    expanded = history_data(HISTORY, digest)
    prior = read(8001, 'v1/history')
    assert [e['epoch'] for e in expanded['epochs']] == list(range(659, 665))
    changes = []
    runtime = {name: hashlib.sha256((STAGE / 'analytics' / name).read_bytes()).hexdigest()
               for name in ['backfill.py', 'store.py', 'addresses.py', 'worker.py']}
    for old, new in zip(prior['epochs'], expanded['epochs']):
        assert old['epoch'] == new['epoch']
        report = json.loads((HISTORY / f"epoch-{new['epoch']}-report.json").read_text())
        assert report['runtimeSha256'] == runtime and report['retention'] == 'epoch-totals-only'
        assert not report['detailsRetained'] and 'daily' not in report
        before = {p['slug']: p['transactions'] for p in old['dapps']}
        after = {p['slug']: p['transactions'] for p in new['dapps']}
        assert after['sundaeswap'] == before['sundaeswap'] and after['wingriders'] == before['wingriders']
        assert after['minswap'] >= before['minswap']
        changes.append({'epoch': new['epoch'], 'oldMinswap': before['minswap'], 'newMinswap': after['minswap'], 'additional': after['minswap'] - before['minswap']})
    assert changes[-1]['newMinswap'] == 24726
    live = read(8002, 'v1/status')
    assert live['fresh'] and live['lagBlocks'] == 0 and live['registryDigest'] == digest and live['watchedScripts'] == 40
    with closing(sqlite3.connect(f'file:{DATA}/analytics-v2.sqlite3?mode=ro', uri=True)) as old, closing(sqlite3.connect(f'file:{DATA}/analytics-v3.sqlite3?mode=ro', uri=True)) as new:
        old.execute('BEGIN'); new.execute('BEGIN')
        height = min(old.execute('SELECT MAX(height) FROM blocks').fetchone()[0], new.execute('SELECT MAX(height) FROM blocks').fetchone()[0])
        query = 'SELECT DISTINCT e.dapp,e.tx FROM events e JOIN transactions t ON t.id=e.tx JOIN blocks b ON b.slot=t.slot WHERE b.height<=?'
        before = set(old.execute(query, (height,))); after = set(new.execute(query, (height,)))
        assert not before - after
    validation = json.loads((STAGE / 'analytics/sources/validation.json').read_text())
    assert {family for sample in validation['minswapFamilySamples'] for family in sample['families']} == {'V1', 'V2', 'Stableswap'}
    for name in ['dapps-api', 'dapps-indexer', 'dapps-backup']:
        assert 'analytics-v3.sqlite3' in (STAGE / f'deploy/{name}.service').read_text()
    assert (BASE / 'backfill-minswap-v3-runtime/analytics/registry.json').read_text() == (STAGE / 'analytics/registry.json').read_text()
    assert not (BASE / 'backend-before-minswap-v3').exists() and not (DATA / 'history-before-minswap-v3').exists()
    return {'registryDigest': digest, 'epochs': changes, 'priorTransactionsPreservedThroughHeight': height,
            'summaryBytes': sum(p.stat().st_size for p in HISTORY.glob('epoch-*-report.json'))}


def install_units(directory):
    for name in UNITS:
        subprocess.run(['sudo', '-n', 'install', '-m', '644', str(directory / f'{name}.service'), f'/etc/systemd/system/{name}.service'], check=True)
    systemctl('daemon-reload')


def promote(plan):
    receipt = BASE / 'migration-minswap-v3'
    receipt.mkdir(exist_ok=True)
    saved = receipt / 'previous-units'
    saved.mkdir(exist_ok=True)
    for name in UNITS:
        shutil.copy2(f'/etc/systemd/system/{name}.service', saved / f'{name}.service')
    systemctl('stop', 'dapps-minswap-live-v3', 'dapps-minswap-api-v3')
    systemctl('stop', *ACTIVE)
    try:
        (BASE / 'backend').rename(BASE / 'backend-before-minswap-v3')
        STAGE.rename(BASE / 'backend')
        (DATA / 'history').rename(DATA / 'history-before-minswap-v3')
        HISTORY.rename(DATA / 'history')
        install_units(BASE / 'backend/deploy')
        systemctl('start', *ACTIVE)
        for attempt in range(30):
            try:
                live = read(8000, 'v1/status')
                history = read(8001, 'v1/history')
                assert live['fresh'] and live['registryDigest'] == plan['registryDigest'] and live['watchedScripts'] == 40
                assert history['registryDigest'] == plan['registryDigest'] and len(history['epochs']) == 6
                break
            except Exception:
                if attempt == 29:
                    raise
                time.sleep(1)
    except Exception:
        systemctl('stop', *ACTIVE)
        if (BASE / 'backend-before-minswap-v3').exists():
            if (BASE / 'backend').exists():
                (BASE / 'backend').rename(STAGE)
            (BASE / 'backend-before-minswap-v3').rename(BASE / 'backend')
        if (DATA / 'history-before-minswap-v3').exists():
            if (DATA / 'history').exists():
                (DATA / 'history').rename(HISTORY)
            (DATA / 'history-before-minswap-v3').rename(DATA / 'history')
        install_units(saved)
        systemctl('start', *ACTIVE)
        raise
    plan.update(applied=True, liveFresh=live['fresh'], liveLagBlocks=live['lagBlocks'])
    (receipt / 'promotion.json').write_text(json.dumps(plan, indent=2) + '\n')
    return plan


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    plan = review()
    print(json.dumps(promote(plan) if args.apply else {'applied': False, **plan}))
