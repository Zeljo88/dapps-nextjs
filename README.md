# DApps on Cardano

Next.js website backed by our selective Cardano mainnet indexer at
`https://api.dappsoncardano.com`.

The reviewed registry covers Minswap V1/V2 and published stableswap order/pool
scripts, selected SundaeSwap scripts, and WingRiders V1 request scripts. Counts describe observed contract transactions from
a known collection checkpoint. They are lower bounds, not lifetime protocol
totals, trades or users. The node feed does not calculate TVL, volume, prices or
yields. Directory TVL comes separately from reviewed DefiLlama Cardano mappings.
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

Directory and category tables show transaction and active-wallet totals for the
latest validated completed epoch. Growth compares that epoch with its immediate
consecutive validated predecessor under the same registry. Each change tooltip
shows both exact counts. Missing comparisons stay unavailable, including positive
counts following zero baselines. Six-epoch transaction and wallet line charts
appear directly in each DApp’s Overview; there is no separate History tab.
Directory rows link to the DApp website, and the DApp name opens its profile.
TVL source attribution remains in tooltips and methodology without row links.
Owner identification is supplementary tooltip metadata,
not a directory column. Wallets are not people and are not summed across DApps.

TVL uses the `Cardano.tvl` series from DefiLlama (`minswap-dex` id 1494,
`sundaeswap` parent#sundaeswap, `wingriders` id 1601). It is a provider estimate
with different coverage from our selective transaction/wallet scripts; separate
staking, borrowed and pool2 series are excluded. The latest snapshot at or before
the reporting epoch’s end is accepted only when at most 24 hours old. The table
labels it “near epoch end”, displays the approximate offset, and gives the exact
USD balance, timestamp and source attribution. It never substitutes a current value or
claims an exact boundary measurement. TVL is a balance, not a five-day sum.
The “Listed DApp TVL” card sums balances only if every listed DApp has a snapshot
at the same time; it is not total Cardano TVL. Provider failures show unavailable
without hiding the node-based counts. Only final selected balances and provenance
are cached for an hour in Next.js; daily histories are processed transiently and
no extra records are added to the relay database.

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
- `npm run test:tvl` — provider identity, time alignment, missing/stale values and aggregate checks.
- `npm run lint` — source checks.
- `npm run test:seo` — run against `npm start` on port 3000, or set SEO_BASE_URL.
- Backend: `.venv/Scripts/python -m unittest discover -s tests -v` from backend.

On Windows behind a trusted TLS-inspecting proxy, Node may need
`NODE_OPTIONS=--use-system-ca` to use the PC's trusted certificates. Do not disable
TLS verification.

## Hosting

The Vercel project `dapps-nextjs` builds the `main` branch of
`Zeljo88/dapps-nextjs`. Production API_URL points to the HTTPS API above. Analytics
pages fetch without persistent caching so an old successful response cannot be
presented as a current feed. The Python API and Ogmios stay bound to loopback on
the relay, behind nginx. Certificate renewal and daily local SQLite backups are
enabled. Off-server backups and external alerting remain follow-up work.
