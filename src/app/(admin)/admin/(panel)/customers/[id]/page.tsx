import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderChip, RequestChip } from "@/components/admin/Chips";
import { Icon } from "@/components/store/Icon";
import { naira, shortDate } from "@/components/store/format";
import { query } from "@/lib/db";
import { waNumber } from "@/lib/messaging";
import { listOrdersForUser } from "@/lib/store/orders";
import { listRequestsForUser } from "@/lib/store/quoteRequests";
import { formatPhone, getUser } from "@/lib/users";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUser(Number((await params).id));
  if (!u || u.role !== "customer") notFound();
  const [orders, requests, addresses] = await Promise.all([listOrdersForUser(u.id), listRequestsForUser(u.id), query("select * from addresses where user_id = $1 order by id desc", [u.id])]);
  const spent = orders.filter((o) => o.paidAt).reduce((n, o) => n + o.total - o.refunded, 0);
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/admin/customers">Customers</Link> › {u.name || u.email}</nav>
      <div className="head"><div><h1 className="head__title">{u.name || u.email}</h1><p className="head__sub">Customer since {shortDate(u.createdAt)} · {orders.length} order{orders.length === 1 ? "" : "s"} · {naira(spent)} spent</p></div></div>
      <div className="layout">
        <div className="stack">
          <section className="panel" aria-label="Orders">
            <div className="panel__head"><h2 className="panel__title">Orders</h2></div>
            {orders.length === 0 ? <p className="adm-empty">No orders.</p> : (
              <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Date</th><th className="num">Total</th><th>Status</th></tr></thead><tbody>
                {orders.map((o) => <tr key={o.id}><td className="ref"><Link href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td>{shortDate(o.createdAt)}</td><td className="num">{naira(o.total)}</td><td><OrderChip status={o.status} /></td></tr>)}
              </tbody></table></div>
            )}
          </section>
          <section className="panel" aria-label="Quote requests">
            <div className="panel__head"><h2 className="panel__title">Quote requests</h2></div>
            {requests.length === 0 ? <p className="adm-empty">No quote requests.</p> : (
              <div className="table-wrap"><table className="table"><thead><tr><th>Reference</th><th>Date</th><th>Organisation</th><th className="num">Estimate</th><th>Status</th></tr></thead><tbody>
                {requests.map((r) => <tr key={r.id}><td className="ref"><Link href={`/admin/quote-requests/${r.id}`}>{r.number}</Link></td><td>{shortDate(r.createdAt)}</td><td>{r.organisation}</td><td className="num">{naira(r.estimatedTotal)}</td><td><RequestChip status={r.status} /></td></tr>)}
              </tbody></table></div>
            )}
          </section>
        </div>
        <aside className="stack">
          <section className="panel" aria-label="Contact">
            <div className="panel__head"><h2 className="panel__title">Contact</h2></div>
            <div className="panel__body">
              <dl className="kv"><dt>Email</dt><dd>{u.email}</dd><dt>Phone</dt><dd>{formatPhone(u.phone)}</dd><dt>Last sign-in</dt><dd>{u.lastLoginAt ? shortDate(u.lastLoginAt) : "Never"}</dd></dl>
              <div className="contact-btns">
                <a className="btn btn--primary" href={`tel:${u.phone}`}><Icon name="phone" />Call</a>
                <a className="btn btn--secondary" href={`https://wa.me/${waNumber(u.phone)}`}><Icon name="whatsapp" />WhatsApp</a>
                <a className="btn btn--secondary" href={`mailto:${u.email}`}><Icon name="mail" />Email</a>
              </div>
            </div>
          </section>
          <section className="panel" aria-label="Addresses">
            <div className="panel__head"><h2 className="panel__title">Addresses</h2></div>
            <div className="panel__body">{addresses.length === 0 ? <p>None saved.</p> : <ul>{addresses.map((a) => <li key={a.id}>{a.street}, {a.area}{a.landmark ? ` (${a.landmark})` : ""}</li>)}</ul>}</div>
          </section>
        </aside>
      </div>
    </>
  );
}
