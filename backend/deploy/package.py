"""Build a source/dependency bundle without environments, keys, or chain data."""
from pathlib import Path
from email.parser import BytesParser
import hashlib
import zipfile

root = Path(__file__).resolve().parents[1]
destination = root / ".deploy" / "pilot.zip"
destination.parent.mkdir(exist_ok=True)
locked = []
for wheel in sorted((root / ".wheels").glob("*.whl")):
    if wheel.name.startswith("pip-"):
        continue
    with zipfile.ZipFile(wheel) as archive:
        metadata_name = next(name for name in archive.namelist() if name.endswith(".dist-info/METADATA"))
        metadata = BytesParser().parsebytes(archive.read(metadata_name))
    locked.append(f"{metadata['Name']}=={metadata['Version']} --hash=sha256:{hashlib.sha256(wheel.read_bytes()).hexdigest()}")
lockfile = root / "requirements-linux-py310.lock"
lockfile.write_text("# Relay runtime, pinned to the uploaded Linux/Python 3.10 wheels.\n" + "\n".join(sorted(locked)) + "\n", encoding="utf-8")
with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
    for directory in ("analytics", "deploy"):
        for source in sorted((root / directory).rglob("*")):
            if source.is_file() and "__pycache__" not in source.parts:
                data = source.read_bytes()
                if source.suffix != ".json":
                    data = data.replace(b"\r\n", b"\n")
                archive.writestr("backend/" + source.relative_to(root).as_posix(), data)
    for name in ("requirements.txt", "requirements-linux-py310.lock", "README.md"):
        archive.writestr("backend/" + name, (root / name).read_bytes().replace(b"\r\n", b"\n"))
    for source in sorted((root / ".wheels").glob("*.whl")):
        archive.write(source, "wheels/" + source.name)
print(destination)
