import Link from "next/link";
import { Icon } from "@/components/store/Icon";
import { ago, naira, timeOnly } from "@/components/store/format";
import { dailySales, dashboardStats, needsAttention } from "@/lib/admin/dashboard";
import { SyncNowButton } from "./SyncNowButton";

export const metadata = { title: "Dashboard" };

const ICON = { request: "quote", order: "bag", unavailable: "alert", held: "sync", transfer: "card" } as const;

export default async function Dashboard() {
  const [s, attention, sales] = await Promise.all([dashboardStats(), needsAttention(8), dailySales(30)]);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date());
  const monthStart = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "Africa/Lagos" }).format(new Date());
  const total = sales.reduce((n, d) => n + d.total, 0);
  const best = Math.max(0, ...sales.map((d) => d.total));

  return (
    <>
      <div className="head">
        <div><h1 className="head__title">Dashboard</h1><p className="head__sub">{today}</p></div>
        <SyncNowButton />
      </div>
      <section className="stats" aria-label="Today at a glance">
        <div className="stat"><p className="stat__label">Sales today</p><p className="stat__value">{naira(s.salesToday)}</p><p className="stat__foot">{s.paidToday} paid order{s.paidToday === 1 ? "" : "s"}</p></div>
        <div className="stat"><p className="stat__label">Sales this month</p><p className="stat__value">{naira(s.salesMonth)}</p><p className="stat__foot">{monthStart}, paid orders less refunds</p></div>
        <div className={`stat${s.ordersToConfirm ? " stat--alert" : ""}`}><p className="stat__label">New orders to confirm</p><p className="stat__value">{s.ordersToConfirm}</p><p className="stat__foot"><Link href="/admin/orders?status=paid">Open orders</Link></p></div>
        <div className={`stat${s.openRequests ? " stat--alert" : ""}`}><p className="stat__label">Open quote requests</p><p className="stat__value">{s.openRequests}</p><p className="stat__foot"><Link href="/admin/quote-requests">Open requests</Link></p></div>
        <div className="stat"><p className="stat__label">Items to source from Microscale</p><p className="stat__value">{s.itemsToSource}</p><p className="stat__foot">Across {s.ordersToSource} order{s.ordersToSource === 1 ? "" : "s"}</p></div>
        <div className="stat"><p className="stat__label">Low stock (ours)</p><p className="stat__value">{s.lowStock}</p><p className="stat__foot"><Link href="/admin/stock">View stock</Link></p></div>
        <div className="stat">
          <p className="stat__label">Last sync</p>
          <p className="stat__value">{s.lastSync ? timeOnly(s.lastSync.at) : "Never"}</p>
          <p className="stat__foot">
            {s.lastSync && <span className={`chip ${s.lastSync.status === "success" ? "chip--ok" : s.lastSync.status === "running" ? "chip--info" : "chip--warn"}`}>{s.lastSync.status === "success" ? "Finished" : s.lastSync.status}</span>}{" "}
            {s.heldChanges > 0 && <Link className="chip chip--warn" href="/admin/sync">{s.heldChanges} price change{s.heldChanges === 1 ? "" : "s"} held</Link>}
          </p>
        </div>
      </section>
      <div className="grid">
        <section className="panel" aria-labelledby="attn-title">
          <div className="panel__head"><h2 className="panel__title" id="attn-title">Needs attention</h2><span className="stat__foot">Oldest first</span></div>
          {attention.length === 0 ? <p className="adm-empty">All caught up.</p> : (
            <ul className="attn">
              {attention.map((a, i) => (
                <li key={i}>
                  <span className={`attn__icon${a.tone ? ` attn__icon--${a.tone}` : ""}`}><Icon name={ICON[a.kind]} /></span>
                  <div><p className="attn__title"><Link href={a.href}>{a.title}</Link></p><p className="attn__sub">{a.sub}</p></div>
                  <p className={`attn__age${Date.now() - new Date(a.since).getTime() > 86_400_000 ? " attn__age--late" : ""}`}>{ago(a.since).replace(" ago", "")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel chart" aria-labelledby="chart-title">
          <div className="panel__head"><h2 className="panel__title" id="chart-title">Sales, last 30 days</h2><span className="chip chip--info">Paid orders</span></div>
          <div className="panel__body">
            <div className="chart__sum">
              <span>Total<b>{naira(total)}</b></span>
              <span>Best day<b>{naira(best)}</b></span>
              <span>Daily average<b>{naira(total / sales.length)}</b></span>
            </div>
            <SalesChart sales={sales} />
          </div>
        </section>
      </div>
    </>
  );
}

/** Bars per day, scaled to a round top value. Drawn on the server from the real figures. */
function SalesChart({ sales }: { sales: { day: string; total: number }[] }) {
  const max = Math.max(...sales.map((d) => d.total), 1);
  const step = niceStep(max / 2);
  const top = step * 2;
  const x0 = 56, x1 = 712, y0 = 196, y1 = 52;
  const w = (x1 - x0) / sales.length;
  const y = (v: number) => y0 - (v / top) * (y0 - y1);
  const label = (v: number) => (v >= 1_000_000 ? `₦${+(v / 1_000_000).toFixed(1)}m` : v >= 1000 ? `₦${Math.round(v / 1000)}k` : `₦${v}`);
  const dayLabel = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const best = sales.reduce((a, b) => (b.total > a.total ? b : a), sales[0]);
  return (
    <svg viewBox="0 0 720 250" role="img" aria-label={`Bar chart of daily paid sales over the last ${sales.length} days. Best day ${dayLabel(best.day)} with ${label(best.total)}.`}>
      <g>
        {[0, step, top].map((v) => (
          <g key={v}>
            <line className="grid-line" x1={x0} x2={x1} y1={y(v)} y2={y(v)} />
            <text x={48} y={y(v) + 4} textAnchor="end">{label(v)}</text>
          </g>
        ))}
      </g>
      <g>
        {sales.map((d, i) => {
          const h = Math.max(d.total > 0 ? 2 : 0, y0 - y(d.total));
          return <rect key={d.day} className={`bar${i === sales.length - 1 ? " bar--today" : ""}`} x={(x0 + i * w + 2).toFixed(1)} y={y0 - h} width={Math.max(2, w - 6).toFixed(1)} height={h} rx={2}><title>{`${dayLabel(d.day)}: ${naira(d.total)}`}</title></rect>;
        })}
      </g>
      <g>
        {sales.map((d, i) => (i % 5 === 0 && i < sales.length - 3 ? <text key={d.day} x={x0 + i * w + w / 2} y={220} textAnchor="middle">{dayLabel(d.day)}</text> : null))}
        <text x={x1 - 8} y={220} textAnchor="end">Today</text>
      </g>
    </svg>
  );
}

function niceStep(v: number): number {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
