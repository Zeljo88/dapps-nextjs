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
is in `/mnt/cardano-data/dapps-analytics/analytics-v3.sqlite3`.

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

The reviewed registry contains Minswap V1/V2 and 13 published stableswap
order/pool pairs (30 payment scripts), selected SundaeSwap V1/V3/V4/Stableswaps
contracts (8 scripts), and WingRiders V1 request contracts (2 scripts):
three DApps, 40 payment scripts. Coverage remains partial. In particular, WingRiders V2 is not tracked.

`analytics/sources/validation.json` records the read-only integrity checks and
independent Koios transaction sample. Run `deploy/validate_data.py DATABASE
--output REPORT.json` with the application's PYTHONPATH to repeat it. This is a
dated sample, not a guarantee that all future observations have been reviewed.

The expanded database is `/mnt/cardano-data/dapps-analytics/analytics-v3.sqlite3`.
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
`backfill-minswap-v3-runtime`. Install the trial unit and start it with
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
source API requests and caches responses temporarily during validation.

When independent API queries dominate elapsed time, `deploy/prefetch-history.py`
can prepare reference inventories for an explicitly bounded list of completed
epochs while node replay remains sequential. It uses at most two source workers,
a 1.5-second minimum request interval per worker, separate working caches, and
unique atomic cache publication files. It applies the same host/live-feed guards
and never writes a historical database or publishes a validated epoch. The main
importer still performs every reconciliation and validation check. The one-off
server run for epochs 660 and 659 is capped at 25% of one core and 256 MiB RAM.

Historical publication uses epoch totals only, with one point per completed epoch on a line chart.
The API omits daily aggregation. Completed historical epochs retain totals, boundaries, validation markers and
original report hashes. Detailed epoch databases and transaction-response caches
are discarded after integrity and count checks. Original daily checks and sampled
transaction IDs are removed from retained summaries. The live working database
remains separate. Missing epochs remain gaps rather than zero activity.

Only passed reports matching the active registry digest are exposed by
`GET /v1/history`. In production, a separate loopback reader on port 8001 serves
this exact nginx path, allowing historical publication without restarting the
live API or collector. `dapps-history-api.service` is read-only and capped at
128 MiB. DApp detail pages show a History tab with an interactive epoch activity chart
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

## Epoch totals retention

`analytics.retention` defaults to a dry run. To review completed epochs:

```
python -m analytics.retention --root /mnt/cardano-data/dapps-analytics/history --epochs 659 660 661 662 663 664 --purge-cache
```

Add `--apply` only when detail deletion is intended and historical import/prefetch
jobs have stopped. The tool verifies SQLite integrity and exact per-DApp counts
for every requested database before changing any files. It atomically retains
summary reports before removing their detailed DB/WAL/SHM files. Cache removal
requires all published historical epochs. The node DB and live working DB are
outside this retention directory and are never cleanup targets.

Future historical imports default to the same totals-only compaction after the
batch validates. `--retain-details` explicitly preserves detail for audit runs.
The isolated backfill runtime must be rebuilt/uploaded to use a source change;
the original backfill-runtime is preserved as provenance for the original imports.

## Minswap expansion — 2 November 2026

Minswap's V1/V2 and mainnet stableswap mapping is pinned to SDK commit
`ccf8fe740a7f56b7bda7f973596cbf6577871985`; the source addresses and hashes are
recorded in `analytics/sources/minswap-mainnet.json`. The mapping still excludes
factory-only, farming, staking, governance and launch-event contracts.
Transactions touching multiple Minswap families are counted once per epoch.

Epochs 659–664 are recalculated in an isolated directory with the expanded
registry, including independent credential-set reconciliation and node replay.
Only validated totals and metadata are promoted; raw historical records and
source caches are discarded after the batch. Live data is replayed into
`analytics-v3.sqlite3` from the original anchor before public services switch.
The staged replay preserves previously observed transactions; independent live
samples cover V1, V2 and stableswap separately. No registry is changed in place
against an existing database.

The isolated job uses the same CPU/memory/load guards as the initial import,
and a private writable temporary directory for SQLite validation sorts. Boundary
recovery metadata is derived from persisted evidence so checkpoint resumption
reports the full recovery total, including repairs committed before a restart.

## Reusable epoch wallet enrichment

`analytics.wallet_backfill` enriches existing, validated epoch summaries without
changing their transaction totals or the live collector. Run it against an
isolated output directory, with the same registry digest as the base reports:

```
python -m analytics.wallet_backfill --root /mnt/cardano-data/dapps-analytics/history-wallets-minswap-v1 --base-history /mnt/cardano-data/dapps-analytics/history --epochs 664 663 662 661 660 659 --dapps minswap --rate 80
```

The Minswap adapter identifies key-controlled owners named in **order outputs created** in an
epoch, across V1, V2 and the registered stableswap scripts. V1 and stableswap use
the sender in the datum. V2 uses signature authorization, with a refund-address
stake key only when its payment key matches that authorization. Pool outputs,
execution-only batchers and failed transactions do not identify active owners.
Automatically recreated orders are included. Orders can later be cancelled or
left unfilled; this is not a count of manual visits, traders,
completed swaps, all participants, or people. Script-controlled authorizations,
unrecognized datums and unavailable published datums have explicit excluded
order counts. API errors fail the run rather than turning missing data into zero.

Within each DApp and epoch, a payment key observed with exactly one key stake
credential groups under that stake key. Several payment keys sharing that stake
key count once. Payment keys without stake information, or with conflicting
observed stake keys, fall back to payment-key identity. This is a transparent
heuristic, not proof of an individual account: custodians, bots, shared keys,
multiple stake keys and smart wallets limit comparisons. Wallet totals across
epochs or protocols must not be summed to infer unique period users.

The shared engine handles replay, rollback, datum hashing, deduplication,
independent SQL/Python aggregation, validation, load guards and cleanup. Each
protocol supplies an adapter under `analytics/adapters/` with a slug, version,
script-to-family mapping, a CBOR participant decoder and a separate decoder for
independent Plutus JSON samples. Register the adapter in `wallet_backfill.ADAPTERS`
and its reviewed version in `wallet_methods.ADAPTER_VERSIONS`. Extend the method
contract if another DApp needs a different activity definition; never label all
contract recipients or batchers as users. The API and chart consume optional
validated counts by slug and require no Minswap-specific chart code.
Once their adapters are reviewed, pass several slugs to `--dapps` to calculate
them together during one replay of each epoch. Deduplication remains separate
per DApp; the same wallet can participate in several protocols.

Every enrichment replays the complete epoch, checks the previously validated
boundaries/block totals/chain ancestry and independently samples ownership via
Koios. A temporary SQLite database holds order datums and owner credentials.
After count validation it is removed, including WAL/SHM files; source responses
are removed after the batch. Only final integer counts, attribution counts,
method/adapter versions and validation metadata remain. No wallet identifiers
or sampled transaction IDs are included in the final wallet report. The API
publishes the metric only after validation and temporary database cleanup.

The pinned `cbor2` dependency is included in both requirements files. Build the
isolated runtime with `deploy/package-backfill.py`; install its Linux dependency
into a separate vendor directory before running this enrichment. Keep
`PrivateTmp=true` alongside `ProtectSystem=strict` so SQLite can perform validation
sorts. Use the existing one-core/1 GiB/low-priority profile and live-feed guards.
Do not replace runtime files while a job is running: final reports hash the
runtime that performed the calculation. Promote the complete validated batch
and restart only the history API; the live indexer needs no migration.

### SundaeSwap and WingRiders owner adapters

`--dapps sundaeswap wingriders` calculates both protocols in one epoch replay.
The reviewed source commits and blob hashes are recorded in
`analytics/sources/wallet-adapters-mainnet.json`.

SundaeSwap covers the registered V1 escrow, V3, V4 and stableswap order scripts.
V1 uses the alternate authorization key, otherwise a key stake credential then
a key payment credential from its destination, following SDK cancellation rules.
V3/V4/stableswaps use the explicit single-signature owner policy. Arbitrary
payout recipients are not owners. Complex multisignature and script policies
are excluded with coverage counts. Sundae's signature keys may be stake or
payment credentials, so all families deduplicate the same opaque authorization
key. Temporary keys use an `authorization:` namespace and are never claimed to
be observed payment-to-stake links.

WingRiders V1 constant-product and stableswap requests use the explicit owner
key in RequestDatumV1 metadata. A matching key-payment beneficiary can supply
its stake credential for grouping; third-party beneficiaries cannot. The V2,
pool, farming and governance scripts remain outside this registry.

The default `--minimum-attribution 95` pauses a new enrichment before deleting
details if identified order coverage falls below 95%, so unexpected formats can
be reviewed. This measures attribution within tracked outputs, not complete
protocol coverage. Completed epochs retain separate per-DApp ownership proofs
under `walletValidations`. Adding another adapter preserves existing wallet
counts and their original proof instead of replacing them with the new job's
validation. Resume also checks the exact requested adapter versions.
