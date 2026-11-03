"""Package the isolated read-only staging reader, not the live worker/API."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
destination = root / '.deploy' / 'staging-metrics.zip'
destination.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['analytics/__init__.py', 'analytics/insights.py', 'analytics/history.py',
                 'analytics/wallet_methods.py', 'analytics/registry.json', 'deploy/dapps-staging-metrics.service']:
        archive.write(root / name, name)
print(destination)
