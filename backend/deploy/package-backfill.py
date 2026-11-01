"""Bundle the isolated historical reader; reuse the relay's installed vendor deps."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
destination = root / ".deploy" / "backfill.zip"
destination.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ("__init__.py", "addresses.py", "store.py", "worker.py", "registry.json", "backfill.py"):
        path = root / "analytics" / name
        data = path.read_bytes()
        if path.suffix != ".json":
            data = data.replace(b"\r\n", b"\n")
        archive.writestr("analytics/" + name, data)
    for name in ("dapps-backfill.service", "dapps-backfill-expand.conf"):
        archive.writestr(name, (root / "deploy" / name).read_bytes().replace(b"\r\n", b"\n"))
print(destination)
