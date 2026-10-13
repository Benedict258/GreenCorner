import Link from "next/link";
import { OrderChip } from "@/components/admin/Chips";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { listOrders } from "@/lib/store/orders";
import { formatPhone } from "@/lib/users";

export const metadata = { title: "Orders" };

type Params = { status?: string; q?: string; range?: string; page?: string };

const TABS: [string, string, string[]][] = [
  ["all", "All", []],
  ["paid", "New", ["paid"]],
  ["confirmed", "Confirmed", ["confirmed"]],
  ["sourcing", "Sourcing", ["sourcing"]],
  ["ready", "Ready", ["ready"]],
  ["out_for_delivery", "Out for delivery", ["out_for_delivery", "ready_for_pickup"]],
  ["completed", "Completed", ["completed"]],
  ["pending_payment", "Awaiting payment", ["pending_payment"]],
  ["cancelled", "Cancelled / Refunded", ["cancelled", "refunded"]],
];

function rangeDates(range?: string): { from?: string; to?: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const minus = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  if (range === "today") return { from: today, to: today };
  if (range === "7") return { from: minus(6), to: today };
  if (range === "30") return { from: minus(29), to: today };
  if (range === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return {};
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const status = TABS.find(([k]) => k === sp.status)?.[0] ?? "all";
  // Two statuses share a tab; the list query takes one, so those tabs filter in two passes.
  const statuses = TABS.find(([k]) => k === status)![2];
  const { from, to } = rangeDates(sp.range);
  const base = { q: sp.q, from, to, page: Number(sp.page) || 1 };
  const data = statuses.length === 2
    ? await mergeTwo(statuses, base)
    : await listOrders({ ...base, status: statuses[0] ?? "all" });
  const counts = data.counts;
  const count = (keys: string[]) => (keys.length ? keys.reduce((n, k) => n + (counts[k] ?? 0), 0) : Object.values(counts).reduce((a, b) => a + b, 0));
  const href = (p: Partial<Params>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: sp.status, q: sp.q, range: sp.range, ...p })) if (v && v !== "all") u.set(k, v);
    const s = u.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };
  const exportHref = `/api/admin/orders.csv?${new URLSearchParams(Object.entries({ status: statuses.join(","), q: sp.q ?? "", from: from ?? "", to: to ?? "" }).filter(([, v]) => v)).toString()}`;

  return (
    <>
      <div className="head">
        <div><h1 className="head__title">Orders</h1><p className="head__sub">{data.total} order{data.total === 1 ? "" : "s"}{sp.range ? " in this period" : ""}</p></div>
        <a className="btn btn--secondary" href={exportHref}><Icon name="download" />Export CSV</a>
      </div>
      <div className="tabs" role="group" aria-label="Filter by status">
        {TABS.map(([k, label, keys]) => (
          <Link key={k} className="tab" href={href({ status: k, page: undefined })} aria-pressed={status === k}>{label} <span className="tab__n">{count(keys)}</span></Link>
        ))}
      </div>
      <form className="toolbar" action="/admin/orders">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <label className="search"><Icon name="search" /><span className="sr-only">Search orders</span><input name="q" type="search" defaultValue={sp.q} placeholder="Search by order number, name or phone" /></label>
        <label className="sr-only" htmlFor="od">Date range</label>
        <select className="select" id="od" name="range" defaultValue={sp.range ?? ""}>
          <option value="">Any date</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="month">This month</option>
        </select>
        <button className="btn btn--secondary" type="submit">Apply</button>
      </form>
      <section className="panel" aria-label="Orders list">
        {data.rows.length === 0 ? <p className="adm-empty">No orders here yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Orders, newest first</caption>
              <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Customer</th><th scope="col">Phone</th><th scope="col" className="num">Items</th><th scope="col" className="num">Total</th><th scope="col">Payment</th><th scope="col">Status</th><th scope="col">Type</th></tr></thead>
              <tbody>
                {data.rows.map((o) => (
                  <tr key={o.id}>
                    <td className="ref"><Link href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                    <td className="when"><span>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date(o.createdAt))}</span></td>
                    <td className="cust">{o.name}</td>
                    <td className="hide-m muted">{formatPhone(o.phone)}</td>
                    <td className="num hide-m">{o.items}</td>
                    <td className="num tot">{naira(o.total)}</td>
                    <td className="hide-m">{o.paid ? "Paid" : o.paymentMethod === "bank_transfer" ? "Awaiting transfer" : "Not paid"}</td>
                    <td className="status"><OrderChip status={o.status} /></td>
                    <td className="hide-m">{o.fulfilment === "delivery" ? "Delivery" : "Pickup"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.pages > 1 && (
          <div className="pager">
            <span>Page {data.page} of {data.pages}</span>
            <ul className="pager__list">
              {data.page > 1 && <li><Link className="pager__link" href={href({ page: String(data.page - 1) })}>Previous</Link></li>}
              {data.page < data.pages && <li><Link className="pager__link" href={href({ page: String(data.page + 1) })}>Next</Link></li>}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

async function mergeTwo(statuses: string[], base: { q?: string; from?: string; to?: string; page: number }) {
  const [a, b] = await Promise.all(statuses.map((s) => listOrders({ ...base, status: s, page: 1 }, 500)));
  const rows = [...a.rows, ...b.rows].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return { rows, total: rows.length, page: 1, pages: 1, counts: a.counts };
}
