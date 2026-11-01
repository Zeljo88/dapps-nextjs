# Selective Cardano contract analytics

This is a new database built from the owner's mainnet Cardano node. No old API
statistics or historical totals are imported. The website uses a coverage-aware
view of this service. Financial metrics remain unavailable.

## What it records

- Block checkpoints and source-derived slot timestamps/epochs.
- Outputs sent to registered Minswap, SundaeSwap and WingRiders payment scripts.
- Spends of matching outputs previously observed by this indexer.
- Deduplicated transactions, evidence, a coverage start and data freshness.
- Atomic rollback of orphaned records and restoration of spent-output state.

The mappings come from official project SDKs and the SundaeSwap mainnet API,
linked in `analytics/registry.json`. Registry coverage is partial.
Changing the manifest requires a new database and replay, so existing records
cannot silently acquire a different meaning.

**Important limitations:** a pilot starting at tip has not seen older unspent
outputs. Their spends can be missed until state is bootstrapped or history is
replayed. Observed transactions are therefore a lower bound for the stated
contracts, not a complete DApp transaction total, trade count or unique-user
count. Multiple matching outputs/scripts in one transaction count only once per
DApp. Failed Plutus transactions and reference-only use are excluded. Displayed
counts use a three-block delay; the recent evidence feed is provisional.

TVL, prices, volume, lifetime totals and wallet counts are deliberately `null`.
The frontend explains these limits alongside the recorded observations.

## Local run

Python 3.10+:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pip install httpx
.venv\Scripts\python -m unittest discover -s tests -v
.venv\Scripts\python -m uvicorn analytics.api:create_app --factory --host 127.0.0.1 --port 8000
```

In another terminal run `python -m analytics.worker` with `OGMIOS_URL` pointing to
your private Ogmios 7.0.0 instance. Both processes use `ANALYTICS_DB` (default
`data/analytics.sqlite3`). Run only one worker process per database.

## Relay pilot

The `deploy/` units use the already verified node 11.0.1 socket. Services bind
to loopback, have independent resource limits, and do not replace the node or
submit API. nginx exposes the HTTPS API. Node configuration files and
credentials are never included in this repository.

Ogmios release: 7.0.0, official x86_64 Linux zip SHA-256:
`a4d07112dbbacf9a302970b6f6f7d35aa06c9a9edf013dff5547f6a7afee295e`.

Code is in `/home/azureuser/dapps-analytics/backend`, Python dependencies are
isolated in `/home/azureuser/dapps-analytics/vendor`, and the new SQLite data
is in `/mnt/cardano-data/dapps-analytics/analytics-v2.sqlite3`.

Review through an SSH tunnel, using your existing SSH identity:

```powershell
ssh -N -L 127.0.0.1:18000:127.0.0.1:8000 -i PATH_TO_YOUR_KEY azureuser@YOUR_RELAY
```

Open `http://127.0.0.1:18000/`. `/health` separates API availability from indexer
freshness. `/v1/status`, `/v1/dapps`, and `/v1/dapps/minswap/events` provide evidence.
Resource inspection: `systemctl status dapps-ogmios dapps-indexer dapps-api` and
`journalctl -u dapps-indexer`. The worker pauses if the DB files exceed 2 GiB.

To stop the pilot without deleting data:
`sudo systemctl stop dapps-api dapps-indexer dapps-ogmios`.

## Website connection — 1 November 2026

The reviewed registry contains Minswap V2, selected SundaeSwap V1/V3/V4/Stableswaps
pool/order contracts, and WingRiders V1 request contracts: three DApps, 12 payment
scripts. Coverage remains partial. In particular, WingRiders V2 is not tracked.

`analytics/sources/validation.json` records the read-only integrity checks and
independent Koios transaction sample. Run `deploy/validate_data.py DATABASE
--output REPORT.json` with the application's PYTHONPATH to repeat it. This is a
dated sample, not a guarantee that all future observations have been reviewed.

The expanded database is `/mnt/cardano-data/dapps-analytics/analytics-v2.sqlite3`.
It was replayed from the original checkpoint at height 14144018, slot 201969211.
The original database and its pre-expansion snapshot are retained. Do not run
the replay command against an existing destination or silently change a registry
against an existing database: the digest guard intentionally rejects that.

`https://api.dappsoncardano.com` is served by nginx on the relay. Only nginx is
public; the Python API and Ogmios still bind to loopback. Azure rule
`DappsAnalyticsWeb` allows TCP 80/443. The API DNS A record points to the relay.
Let's Encrypt renews through `certbot.timer`, with an nginx reload hook.

`dapps-backup.timer` runs a consistent SQLite online backup daily, retains seven
days locally, and checks backup integrity. These are same-disk recovery copies;
off-server backups and external alerting remain follow-up work. The original
2 GiB database limit still pauses ingestion rather than filling the node disk.
Inspect `/health` and `/v1/status` when a delayed feed is shown.

The website reads `/v1/status` and `/v1/dapps` without persistent caching. Detail
pages show `/v1/dapps/{slug}/events`. Unknown TVL, volume, price, yield and wallet
counts are explicitly unavailable. The existing DexHunter widget uses its own
quote provider independently of this indexer.

## Next data improvements

1. Bootstrap initial tracked UTXOs or replay history, then validate attribution
   against actual transaction inputs and contract versions.
2. Test normal load, reconnects and rollback handling over an extended period.
3. Update the frontend to render unknown metrics as unavailable and expose
   coverage, recorded-since dates and stale ingestion.
4. Add verified external financial feeds separately with provenance and expiry.
5. Configure production HTTPS, backups and alerts; review the resulting site.
6. Add full protocol coverage only after its contracts and initial UTXOs have
   been independently checked; do not relabel observations as complete totals.
