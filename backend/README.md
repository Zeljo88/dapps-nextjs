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

## Historical imports and aggregation

Imports run **one completed epoch at a time**, with durable block checkpoints,
in a separate database per epoch under
`/mnt/cardano-data/dapps-analytics/history`. The live database is not replaced.
The requested six completed epochs are 659 through 664, inclusive.

`python -m analytics.backfill --root HISTORY_DIRECTORY --epochs 664 --rate 100`
runs the trial. `deploy/dapps-backfill.service` uses an isolated runtime, a
one-core CPU quota, a 1 GiB memory cap and low scheduling priority. After the
trial passes, `deploy/dapps-backfill-expand.conf` runs epochs 663–659. The reader
stops on low available RAM (<4 GiB), low disk space (<20 GiB), >85% host CPU,
>20% I/O wait, or an unhealthy/delayed live feed. A stopped job resumes from its
last saved block; validated epoch reports are not silently overwritten.
Build that runtime with `python deploy/package-backfill.py`, upload
`.deploy/backfill.zip` to the existing application folder, and extract it into
`backfill-runtime`. Install the trial unit and start it with
`systemctl start --no-block dapps-backfill`. Install the expansion drop-in only
after the trial report passes and its load is reviewed, then daemon-reload and
start the same unit. The history directory must be writable by `azureuser`.
The rate is an upper limit: replay starts at 50 blocks/s and adjusts toward the
configured cap when resources allow. It slows when I/O wait exceeds 8% or host
CPU exceeds 60%, before reaching the hard stop thresholds. The historical WAL
checkpoints every 10,000 pages; final checkpoint work is included in load checks.

Validation checks independent first/last block hashes, complete block and chain
transaction totals, chain ancestry, every stored attribution event, exact
per-DApp transaction sets from paginated Koios payment-credential history, and
independent samples from the beginning, middle and end of the epoch. A candidate
is excluded only when failure or reference-only use is explained. Transactions
spending older outputs are recovered using the actual node transaction and
retained independent source-output evidence, without inventing creation events
inside the epoch. This reconciles transaction counts, not a complete starting
UTXO snapshot suitable for TVL calculations.

The historical database keeps a persistent WAL connection with synchronous
NORMAL. Block transactions remain atomic and consistent; after an OS/power
failure, recent uncheckpointed work can be replayed from the node. The live
database's durability settings are unchanged. The historical reader limits
source API requests and caches immutable responses for reproducibility.

Store timestamps in UTC and derive **both epoch and daily views**. Daily buckets
split at UTC midnight, while epochs split at Cardano's actual epoch boundary.
Edge days with incomplete coverage are marked partial. The publication layer
combines adjacent epoch fragments and verifies coverage does not exceed 24h.

Only passed reports matching the active registry digest are exposed by
`GET /v1/history`. In production, a separate loopback reader on port 8001 serves
this exact nginx path, allowing historical publication without restarting the
live API or collector. `dapps-history-api.service` is read-only and capped at
128 MiB. DApp detail pages show a History tab with Per epoch / Per day controls
when validated periods are available. Existing live counters retain their
original collection date and scope.

## Remaining data improvements

1. Bootstrap a complete starting UTXO set before implementing historical balances
   or TVL; boundary transaction recovery alone is not a balance snapshot.
2. Add external alerting for prolonged live-feed delays and disk limits.
3. Expand reviewed protocol/version mappings with a new, validated registry replay.
4. Add verified external financial feeds separately with provenance and expiry.
5. Add off-server backups; the existing daily recovery copies share the node disk.
6. Add full protocol coverage only after its contracts and initial UTXOs have
   been independently checked; do not relabel observations as complete totals.
