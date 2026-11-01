# DApps on Cardano

Next.js website backed by our selective Cardano mainnet indexer at
`https://api.dappsoncardano.com`.

The reviewed registry currently covers selected Minswap, SundaeSwap and
WingRiders payment scripts. Counts describe observed contract transactions from
a known collection checkpoint. They are lower bounds, not lifetime protocol
totals, trades or users. TVL, volume, price and yield figures are unavailable in
this feed. The existing swap widget obtains quotes independently from DexHunter.

Visitors can inspect script mappings and recent transaction evidence on each
DApp page. `/methodology` explains coverage, freshness and confirmations.
The original interface is retained. Directory tables, related DApps and category
cards show only projects with a positive confirmed observation count. Projects
with no recorded activity appear automatically after their first confirmed
observation. Their registry entries and direct profiles remain available.

## Development

Use Node 22 or later. Install locked dependencies with `npm ci` and set
`API_URL=https://api.dappsoncardano.com` in `.env.local`, then run `npm run dev`.
For the Python backend and relay operations, see [backend/README.md](backend/README.md).

## Verification

- `npm run build` — production build; API_URL is required.
- `npm run test:config` — backend URL validation.
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
