# DApps on Cardano

Next.js website backed by our selective Cardano mainnet indexer at
`https://api.dappsoncardano.com`.

The reviewed registry covers Minswap V1/V2 and published stableswap order/pool
scripts, selected SundaeSwap scripts, and WingRiders V1 request scripts. Counts describe observed contract transactions from
a known collection checkpoint. They are lower bounds, not lifetime protocol
totals, trades or users. The node feed does not calculate TVL, volume, prices or
yields. Activity and Overview metrics use our node and retained validated
summaries. Directory TVL remains a separate DefiLlama Cardano estimate until
reliable TVL from our own indexer is available. Provider, coverage and snapshot
time stay in tooltips; no provider hyperlink is added to directory rows.
The existing swap widget obtains quotes independently from DexHunter.

Visitors can inspect script mappings and validated epoch activity on each
DApp page. `/methodology` explains coverage, freshness and confirmations.
The original interface is retained. Directory tables, related DApps and category
cards show only projects with a positive confirmed observation count. Projects
with no recorded activity appear automatically after their first confirmed
observation. Their registry entries and direct profiles remain available.
Validated historical periods appear as an epoch line chart in each DApp's
Overview tab. Only epoch totals and validation summaries are retained after
historical validation; temporary detail and response caches are removed.
Historical imports run separately from the live working database.

Validated active-wallet counts appear in a second epoch line chart where a
reviewed protocol adapter is available. Minswap identifies key-controlled order
owners across V1, V2 and stableswap, groups unambiguous observed stake keys and
reports attribution coverage. Wallets are not people; epoch counts cannot be
added into unique period users. Only final counts and validation metadata remain.
The replay, deduplication, validation, API and chart code are shared so other
DApps can reuse them with their own ownership adapters.
SundaeSwap uses its V1/V3/V4/stableswap owner authorization keys; WingRiders uses
the explicit owners of tracked V1 constant-product/stableswap requests. Each
protocol keeps its own validation proof and attribution coverage.

Directory and category tables default to transaction and active-wallet totals
for the latest validated completed epoch, compared with its immediate validated
predecessor under the same registry. The selector also offers the last six
consecutive completed epochs (summed transactions and average wallets per epoch,
not unique 30-day wallets) and the current incomplete epoch. Six-epoch growth
compares only with the preceding six completed epochs, requiring twelve adjacent
validated epochs; absent comparison data stays unavailable. Current transactions
are confirmed observations collected so far, with the collection start shown.
They are withheld when the live checkpoint is stale or belongs to another epoch.
Current wallets stay pending and current growth is hidden. The progress indicator
uses the page's reporting time, not an independently updating live clock.
Summary cards and table metrics use the same selected period. Biggest rises and
declines describe transaction percentage changes among the filtered DApps and
use the table's comparison. Each change tooltip shows both underlying counts.
Positive counts after a zero baseline have no percentage change.
Six-epoch transaction and wallet line charts
appear directly in each DApp’s Overview; there is no separate History tab.
Directory rows link to the DApp website, and the DApp name opens its profile.
Owner identification is supplementary tooltip metadata,
not a directory column. Wallets are not people and are not summed across DApps.

Overview adds completed-epoch order/request counts, overlapping version-level
wallet counts and share of network transactions from our validated node replay.
An order/request activity line chart joins the transaction and wallet charts.
A separate recorded-period section shows network fees in ADA, average fees,
output creations/spends and overlapping version-level transaction counts. Its
collection start and confirmed cutoff are explicit. Observed balances include
only tracked outputs seen since collection began and unspent at that cutoff;
they include deposits and pending orders and are not complete liquidity or TVL.
Token quantities are exact raw units with policy IDs/hex names, without external
metadata or prices. No historical fee values are invented from compacted totals.
Directory TVL uses a single snapshot near the selected completed period's end,
not a sum across six epochs; the current view uses a recent provider snapshot.
Missing/stale values remain unavailable. Our partial observed balances are never
substituted as TVL. The detail-page own-data sections do not use these valuations.
The optional staging reader supplies aggregates under `/staging/v1/dapps/{slug}/metrics`
and caches only aggregate responses in memory for 30 seconds. No new raw records
or wallet credentials are stored. Missing/mismatched reader data stays unavailable.

The live API filters confirmed transactions by the actual current block epoch
and exposes its collection start, so counts reset correctly at epoch boundaries.
No historical replay or additional retained transaction data is required.

## Development

Use Node 22 or later. Install locked dependencies with `npm ci` and set
`API_URL=https://api.dappsoncardano.com` in `.env.local`, then run `npm run dev`.
For the Python backend and relay operations, see [backend/README.md](backend/README.md).

## Verification

- `npm run build` — production build; API_URL is required.
- `npm run test:config` — backend URL validation.
- `npm run test:epochs` — epoch selection, growth and missing-data checks.
- `npm run test:own` — exact ADA units, source and registry isolation.
- `npm run test:tvl` — provider identity, time alignment, missing/stale values and aggregate checks.
- `npm run lint` — source checks.
- `npm run test:seo` — run against `npm start` on port 3000, or set SEO_BASE_URL.
- Backend: `.venv/Scripts/python -m unittest discover -s tests -v` from backend.

On Windows behind a trusted TLS-inspecting proxy, Node may need
`NODE_OPTIONS=--use-system-ca` to use the PC's trusted certificates. Do not disable
TLS verification.

## Hosting

Changes are reviewed on the `staging` branch before production. Pushes to
`staging` use Vercel's Preview environment and its branch preview URL; `main`
remains the production branch for `dappsoncardano.com`. The preview uses the
public analytics API for read-only data. The optional metrics reader is isolated
from the production API and collector; it never writes database records. `API_URL` must be configured for
Preview as well as Production. After review, merge a pull request from `staging`
into `main`; that merge triggers the production build. Do not promote or merge
staging automatically just because its checks pass.

The Vercel project `dapps-nextjs` builds the `main` branch of
`Zeljo88/dapps-nextjs`. Production API_URL points to the HTTPS API above. Analytics
pages fetch without persistent caching so an old successful response cannot be
presented as a current feed. The Python API and Ogmios stay bound to loopback on
the relay, behind nginx. Certificate renewal and daily local SQLite backups are
enabled. Off-server backups and external alerting remain follow-up work.
