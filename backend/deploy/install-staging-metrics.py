"""Install our isolated staging reader and add only the /staging/ nginx route."""
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time
import urllib.request
import zipfile

application = Path('/home/azureuser/dapps-analytics')
runtime = application / 'staging-metrics-runtime'
archive_path = application / 'staging-metrics.zip'
config = Path('/etc/nginx/sites-available/dapps-api')
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backups = application / 'source-backups'
backups.mkdir(exist_ok=True)

def get(url):
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.load(response)

before = get('http://127.0.0.1:8000/v1/status')
if not before.get('fresh'):
    raise RuntimeError('Existing live feed is delayed; staging installation stopped')
if runtime.exists():
    with zipfile.ZipFile(backups / f'staging-reader-before-{stamp}.zip', 'w', zipfile.ZIP_DEFLATED) as saved:
        for path in runtime.rglob('*'):
            if path.is_file(): saved.write(path, path.relative_to(runtime))
runtime.mkdir(exist_ok=True)
with zipfile.ZipFile(archive_path) as archive:
    for name in archive.namelist():
        if not (runtime / name).resolve().is_relative_to(runtime.resolve()):
            raise ValueError('Archive path escapes staging runtime')
    archive.extractall(runtime)
subprocess.run(['sudo', 'install', '-m', '644', str(runtime / 'deploy/dapps-staging-metrics.service'),
                '/etc/systemd/system/dapps-staging-metrics.service'], check=True)
subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
subprocess.run(['sudo', 'systemctl', 'enable', 'dapps-staging-metrics'], check=True)
subprocess.run(['sudo', 'systemctl', 'restart', 'dapps-staging-metrics'], check=True)
for attempt in range(20):
    try:
        get('http://127.0.0.1:8002/staging/health')
        break
    except OSError:
        time.sleep(.25)
else:
    raise RuntimeError('Staging reader did not become healthy')
checks = []
for slug in ['minswap', 'sundaeswap', 'wingriders']:
    started = time.perf_counter()
    data = get(f'http://127.0.0.1:8002/staging/v1/dapps/{slug}/metrics')
    if data['registryDigest'] != before['registryDigest'] or not data.get('recorded') or len(data.get('epochs', [])) < 6:
        raise RuntimeError('Own-data response did not pass staging checks')
    checks.append({'slug': slug, 'readMs': round((time.perf_counter()-started)*1000),
                   'recordedTransactions': data['recorded']['transactions'], 'epochs': len(data['epochs'])})
original = config.read_text()
if 'location ^~ /staging/' not in original:
    marker = '    location = /v1/history {'
    if original.count(marker) != 1:
        raise RuntimeError('Unexpected API nginx configuration')
    backup = backups / f'nginx-before-staging-metrics-{stamp}.conf'
    backup.write_text(original)
    candidate = application / 'staging-metrics-nginx.conf'
    block = '''    location ^~ /staging/ {
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:8002;
        proxy_connect_timeout 3s;
        proxy_read_timeout 10s;
        proxy_set_header Host $host;
        add_header X-Content-Type-Options nosniff always;
    }
'''
    candidate.write_text(original.replace(marker, block + marker, 1))
    if config.read_text() != original:
        raise RuntimeError('API nginx configuration changed during installation')
    subprocess.run(['sudo', 'install', '-m', '644', str(candidate), str(config)], check=True)
    try:
        subprocess.run(['sudo', 'nginx', '-t'], check=True)
    except subprocess.CalledProcessError:
        subprocess.run(['sudo', 'install', '-m', '644', str(backup), str(config)], check=True)
        raise
    subprocess.run(['sudo', 'systemctl', 'reload', 'nginx'], check=True)
after = get('http://127.0.0.1:8000/v1/status')
print(json.dumps({'checks': checks, 'productionFeedFresh': after['fresh'], 'lagBlocks': after['lagBlocks']}))
subprocess.run(['systemctl', 'show', 'dapps-staging-metrics', '--property=MemoryCurrent,CPUUsageNSec,ActiveState'], check=True)
