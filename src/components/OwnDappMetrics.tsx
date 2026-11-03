import type { HistoryData, OwnMetrics } from "@/lib/analytics";
import { selectEpochPeriod } from "@/lib/epoch-summary";
import { formatAda, metricDateTime as dateTime } from "@/lib/own-metrics";
import MetricTooltip from "./MetricTooltip";

function value(number: number | null | undefined) { return typeof number === "number" && Number.isFinite(number) && number >= 0 ? number.toLocaleString("en-US") : "—"; }
function Stat({ label, amount, help }: { label: string; amount: string; help: string }) {
  return <div className="card own-stat"><div><span>{label}</span><MetricTooltip label={`About ${label}`} text={help} /></div><strong>{amount}</strong></div>;
}

export default function OwnDappMetrics({ slug, registryDigest, history, metrics }: { slug: string; registryDigest: string; history: HistoryData | null; metrics: OwnMetrics | null }) {
  const period = selectEpochPeriod(history, registryDigest);
  const completed = period?.current;
  const dapp = completed?.dapps.find(d => d.slug === slug);
  const extra = completed ? metrics?.epochs.find(e => e.epoch === completed.epoch && e.startTime === completed.startTime && e.endTime === completed.endTime) : undefined;
  const chainTransactions = completed?.validation.chainTransactionsInspected;
  const share = dapp && typeof chainTransactions === "number" && chainTransactions > 0 && dapp.transactions <= chainTransactions ? dapp.transactions / chainTransactions * 100 : null;
  const recorded = metrics?.recorded;
  const averageFee = recorded?.averageNetworkFeeAda !== null && recorded?.averageNetworkFeeAda !== undefined ? Number(recorded.averageNetworkFeeAda) : null;
  return <div className="own-metrics" data-testid="own-dapp-metrics">
    <section aria-label="Completed epoch metrics">
      <h2>Completed epoch {completed?.epoch ?? "—"}</h2><p className="own-context">{completed ? `${dateTime(completed.startTime)} – ${dateTime(completed.endTime)}` : "Validated history unavailable"} · Our Cardano node</p>
      <div className="own-stat-grid">
        <Stat label="Transactions" amount={value(dapp?.transactions)} help="Successful transactions touching this DApp’s registered contracts, counted once per DApp during the completed epoch. Includes orders, cancellations, liquidity actions and settlements; not completed swaps." />
        <Stat label="Active wallets" amount={value(dapp?.activeWallets)} help="Distinct identifiable order owners in this completed epoch. Includes automatically recreated and later-cancelled orders. Wallets are not people." />
        <Stat label="Order/request outputs created" amount={value(dapp?.walletActivity?.candidateOrderOutputs)} help="Outputs created at tracked order/request contracts during this epoch. Includes automatic recreations and requests later cancelled or left unfilled. This is not a count of manual submissions or executed trades." />
        <Stat label="Share of Cardano transactions" amount={share === null ? "—" : `${share.toFixed(2)}%`} help="DApp transactions divided by all Cardano transactions inspected during the same validated epoch. Covers only our registered scripts. One transaction can touch multiple DApps, so these percentages must not be added together as market shares." />
      </div>
      {!!extra?.walletVersions.length && <div className="card own-table-card"><h3>Active wallets by contract version · epoch {completed?.epoch}</h3><p>A wallet can use several versions. These counts overlap and must not be added together.</p><table className="own-table"><thead><tr><th>Version / family</th><th>Identifiable wallets</th></tr></thead><tbody>{extra.walletVersions.map(v => <tr key={v.version}><td>{v.version}</td><td>{value(v.activeWallets)}</td></tr>)}</tbody></table></div>}
    </section>
    <section aria-label="Recorded period metrics" data-testid="own-recorded-metrics">
      <h2>Recorded period · partial observations</h2>
      {recorded ? <>
        <p className="own-context">{dateTime(recorded.fromTime)} – {dateTime(recorded.throughTime)} · Through confirmed block {value(recorded.confirmedHeight)} · {recorded.fresh ? "Feed current" : "Snapshot delayed"}</p>
        <p className="own-note">These figures cover the collector’s recorded period, not a complete historical epoch. {value(recorded.transactions)} transactions · {metrics?.confirmationDepth} subsequent blocks required.</p>
        <div className="own-stat-grid">
          <Stat label="Network fees paid" amount={formatAda(recorded.networkFeesLovelace)} help="Total Cardano network fees on the recorded transactions touching this DApp, counted once per transaction within this DApp. These are network costs, not trading fees or DApp revenue. Shared transactions can appear in several DApps’ totals." />
          <Stat label="Average network fee" amount={averageFee !== null && Number.isFinite(averageFee) && averageFee >= 0 ? `${averageFee.toLocaleString("en-US", { maximumFractionDigits: 6 })} ADA` : "—"} help="Total recorded network fees divided by recorded transactions for this DApp. Rounded to six decimals. No average is shown when no transactions are recorded." />
          <Stat label="Tracked outputs created" amount={value(recorded.outputsCreated)} help="Confirmed outputs created at registered contracts during the recorded collection period. A transaction can create several outputs." />
          <Stat label="Tracked outputs spent" amount={value(recorded.outputsSpent)} help="Confirmed spends of tracked outputs our collector previously observed. Spends of older unseen outputs can be missed, so this is partial activity." />
        </div>
        <div className="card own-table-card"><h3>Recorded transactions by contract version</h3><p>Each transaction counts once per version. Transactions touching multiple versions can appear in several rows.</p><table className="own-table"><thead><tr><th>Version / family</th><th>Transactions</th></tr></thead><tbody>{recorded.versionTransactions.map(v => <tr key={v.version}><td>{v.version}</td><td>{value(v.transactions)}</td></tr>)}</tbody></table></div>
        <div className="own-balance-section"><h3>Observed balances · recorded outputs only</h3><p className="own-note">Snapshot at {dateTime(recorded.throughTime)}. Only unspent outputs seen since collection began are included. Balances can include pool funds, pending orders and deposits; they are not complete liquidity or TVL.</p>
          <div className="own-stat-grid">
            <Stat label="Observed ADA at tracked contracts" amount={formatAda(recorded.observedLovelace)} help="ADA in observed outputs still unspent at the confirmation cutoff. This excludes older unspent outputs the collector has never seen and includes more than pool liquidity. It is not TVL." />
            <Stat label="Observed unspent outputs" amount={value(recorded.observedUnspentOutputs)} help="Tracked outputs created within our observed collection history and not spent by the confirmation cutoff. Outputs spent only in newer provisional blocks still count at this snapshot." />
            <Stat label="Observed token types" amount={value(recorded.assetCount)} help="Distinct policy ID and asset-name pairs with a positive balance in these observed unspent outputs. ADA is excluded. No external token-price or metadata feed is used." />
          </div>
          {!!recorded.assets.length && <details className="card own-table-card"><summary>Token quantities · raw units</summary><p>Showing {recorded.assets.length} of {value(recorded.assetCount)} token types, ordered by identifier. Quantities are raw on-chain units, without assumed decimal places or prices.</p><table className="own-table own-assets"><thead><tr><th>Policy ID / asset name (hex)</th><th>Raw quantity</th></tr></thead><tbody>{recorded.assets.map(a => <tr key={`${a.policyId}.${a.assetNameHex}`}><td><code>{a.policyId}</code><code>{a.assetNameHex || "(empty asset name)"}</code></td><td>{/^\d+$/.test(a.quantity) ? BigInt(a.quantity).toLocaleString("en-US") : "—"}</td></tr>)}</tbody></table></details>}
        </div>
      </> : <p className="own-note">Recorded-period fee and balance metrics are temporarily unavailable. Historical fee and balance totals were not retained; they are not estimated from transaction counts.</p>}
    </section>
  </div>;
}
