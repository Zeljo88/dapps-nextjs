"""Build the reviewed mainnet registry from pinned official source snapshots."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "analytics"
path = root / "registry.json"
registry = json.loads(path.read_text(encoding="utf-8"))
registry["version"] = 2
registry["projects"] = registry["projects"][:1]
snapshot = root / "sources" / "sundaeswap-mainnet.json"
protocols = json.loads(snapshot.read_text(encoding="utf-8-sig"))["data"]["protocols"]
scripts = []
for protocol in protocols:
    for validator in protocol["blueprint"]["validators"]:
        if validator["title"] in ("pool.spend", "order.spend", "escrow.spend"):
            scripts.append({"role": f'{protocol["version"]} {validator["title"]}', "hash": validator["hash"]})
registry["projects"].extend([
    {"slug": "sundaeswap", "name": "SundaeSwap", "category": "DEFI", "subCategory": "AMM_DEX",
     "website": "https://sundae.fi", "coverage": "partial",
     "description": "Observed activity at the V1, V3, V4 and Stableswaps pool and order payment credentials published by SundaeSwap. Staking, governance and other protocol actions are not included.",
     "source": "https://api.sundae.fi/graphql",
     "sourceDocumentation": "https://github.com/SundaeSwap-finance/sundae-sdk/blob/e32b6e2d8a2329468c82e32d20a942dbc6d40601/packages/core/src/QueryProviders/QueryProviderSundaeSwap.ts",
     "sourceSnapshotSha256": hashlib.sha256(snapshot.read_bytes()).hexdigest(),
     "scripts": scripts},
    {"slug": "wingriders", "name": "WingRiders", "category": "DEFI", "subCategory": "AMM_DEX",
     "website": "https://www.wingriders.com", "coverage": "partial",
     "description": "Observed activity at WingRiders V1 constant-product and stableswap request payment credentials. Pool, V2, farming and governance contracts are not yet covered.",
     "source": "https://github.com/WingRiders/dex-blockfrost-adapter/blob/main/src/constants.ts",
     "sourceFileSha": "5ff762895f4ee5a61628df4f69052234537a1100",
     "scripts": [
         {"role": "V1 request", "hash": "86ae9eebd8b97944a45201e4aec1330a72291af2d071644bba015959"},
         {"role": "V1 stableswap request", "hash": "c5e0385012d5f010b1dc7ab42ba632944052de232051ec6ce3bfd72e"}]}])
for project in registry["projects"]:
    project["mappingReviewedOn"] = "2026-11-01"
path.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
print(f'{len(registry["projects"])} DApps, {sum(len(p["scripts"]) for p in registry["projects"])} scripts')
