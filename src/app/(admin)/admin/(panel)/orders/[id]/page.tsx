import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderChip } from "@/components/admin/Chips";
import { Icon } from "@/components/store/Icon";
import { dateTime, naira } from "@/components/store/format";
import { currentStaff } from "@/lib/auth";
import { query } from "@/lib/db";
import { getOrder, nextStatus, STATUS_LABEL, timelineSteps, type OrderStatus } from "@/lib/store/orders";
import { formatPhone } from "@/lib/users";
import { waNumber } from "@/lib/messaging";
import { CancelButton, MarkPaid, NextStatusButton, NoteForm, RefundForm, SourceSelect, StatusPicker, UnavailableButton } from "./OrderControls";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const o = await getOrder(Number((await params).id));
  if (!o) notFound();
  const staff = await currentStaff();
  const owner = staff?.role === "owner";
  const [payments, refunds] = await Promise.all([
    query("select * from payments where order_id = $1 order by created_at desc", [o.id]),
    query("select * from refunds where order_id = $1 order by created_at desc", [o.id]),
  ]);
  const paid = payments.find((p) => p.status === "success");
  const next = nextStatus(o.status, o.fulfilment);
  const steps = timelineSteps(o.fulfilment);
  const reached = new Map<string, string>();
  for (const e of o.events) if (e.status) reached.set(e.status, e.at);
  const current = steps.indexOf(o.status);
  const unavailable = o.lines.filter((l) => l.status === "unavailable").length;

  // Margin is only known for supplier lines that have a supplier price.
  const costed = o.lines.filter((l) => l.status === "ok" && l.source !== "stock" && l.supplierPrice !== null);
  const cost = costed.reduce((n, l) => n + ((l.supplierPrice ?? 0) / l.unitsPerListing) * l.quantity, 0);
  const sale = costed.reduce((n, l) => n + l.lineTotal, 0);
  const pendingRefund = o.lines.filter((l) => l.status === "unavailable").reduce((n, l) => n + l.lineTotal, 0);
  const statusOptions: [OrderStatus, string][] = (["confirmed", "sourcing", "ready", o.fulfilment === "delivery" ? "out_for_delivery" : "ready_for_pickup", "completed"] as OrderStatus[])
    .filter((s) => s !== o.status).map((s) => [s, STATUS_LABEL[s]]);

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/admin/orders">Orders</Link> › {o.number}</nav>
      <div className="head">
        <div>
          <h1 className="head__title">{o.number} <OrderChip status={o.status} /> {o.paidAt ? <span className="chip s-ok">Paid</span> : <span className="chip s-bad">Not paid</span>}</h1>
          <p className="head__sub">Placed {dateTime(o.createdAt)} · {o.fulfilment === "delivery" ? "Delivery in Minna" : "Pickup at Bosso"}{o.quoteId ? <> · from <Link href={`/admin/quotes/${o.quoteId}/view`}>quotation</Link></> : null}</p>
        </div>
        {next && o.paidAt && <NextStatusButton orderId={o.id} label={STATUS_LABEL[next]} />}
      </div>
      <div className="layout">
        <div className="stack">
          <section className="panel" aria-label="Status">
            <div className="panel__body">
              <ol className="steps" aria-label="Order status">
                {steps.map((s, i) => {
                  const done = current > i || (current === i && s === "completed");
                  const now = current === i && s !== "completed";
                  return (
                    <li key={s} className={`st${done ? " st--done" : now ? " st--now" : ""}`} aria-current={now ? "step" : undefined}>
                      <b>{s === "paid" ? "New" : STATUS_LABEL[s]}</b>{reached.get(s) ? dateTime(reached.get(s)!) : i === current + 1 ? "Next" : ""}
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
          <section className="panel" aria-labelledby="items-title">
            <div className="panel__head"><h2 className="panel__title" id="items-title">Items</h2>{unavailable > 0 && <span className="chip s-bad">{unavailable} item{unavailable === 1 ? "" : "s"} unavailable</span>}</div>
            <div className="internal"><Icon name="lock" /><span>Staff only. Source costs, markup and margin never appear on the public site.</span></div>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Order lines with our price, Microscale price, markup and margin</caption>
                <thead><tr><th scope="col">Item</th><th scope="col">Source</th><th scope="col" className="num">Qty</th><th scope="col" className="num">Our price</th><th scope="col" className="num">Microscale price</th><th scope="col" className="num">Markup</th><th scope="col" className="num">Margin</th><th scope="col" className="num">Line total</th></tr></thead>
                <tbody>
                  {o.lines.map((l) => {
                    const unitCost = l.supplierPrice !== null ? l.supplierPrice / l.unitsPerListing : null;
                    const margin = unitCost !== null && l.source !== "stock" ? (l.unitPrice - unitCost) * l.quantity : null;
                    return (
                      <tr key={l.id} className={l.status !== "ok" ? "row--bad" : undefined}>
                        <td>
                          <p className="name">{l.title}</p>
                          {l.kitLabel && <p className="sub">Part of {l.kitLabel}{l.kitQuantity && l.kitQuantity > 1 ? ` × ${l.kitQuantity}` : ""}</p>}
                          {l.status === "unavailable" && <p className="sub"><span className="chip s-bad">Unavailable</span></p>}
                          {l.status === "refunded" && <p className="sub"><span className="chip s-refund">Refunded {naira(l.refunded)}</span></p>}
                          {l.status === "ok" && o.paidAt && owner && !["cancelled", "refunded", "completed"].includes(o.status) && <UnavailableButton orderId={o.id} lineId={l.id} amount={naira(l.lineTotal)} />}
                        </td>
                        <td>{l.ref ? <SourceSelect orderId={o.id} lineId={l.id} value={l.source} /> : <span className="src">Custom</span>}</td>
                        <td className="num">{l.quantity}</td>
                        <td className="num">{naira(l.unitPrice)}</td>
                        <td className="num">{unitCost !== null ? naira(unitCost) : "–"}</td>
                        <td className="num">{l.markupPct !== null ? `${Number(l.markupPct).toFixed(1)}%` : "–"}</td>
                        <td className={`num${margin && margin > 0 ? " pos" : ""}`}>{margin !== null ? naira(margin) : "–"}</td>
                        <td className="num">{naira(l.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="sum">
              <div className="sum__row"><dt>Order total{o.paidAt ? " (paid)" : ""}</dt><dd>{naira(o.total)}</dd></div>
              <div className="sum__row"><dt>Cost of Microscale lines</dt><dd>{naira(cost)}</dd></div>
              <div className="sum__row"><dt>Margin on those lines</dt><dd className="pos">{naira(sale - cost)}{sale > 0 ? ` (${(((sale - cost) / sale) * 100).toFixed(1)}%)` : ""}</dd></div>
              {pendingRefund > 0 && <div className="sum__row"><dt>Unavailable, to refund</dt><dd>{naira(pendingRefund)}</dd></div>}
              {o.refunded > 0 && <div className="sum__row"><dt>Refunded</dt><dd>{naira(o.refunded)}</dd></div>}
              <div className="sum__row sum__row--big"><dt>Customer keeps paying for</dt><dd>{naira(o.total - o.refunded)}</dd></div>
            </dl>
          </section>
          <section className="panel" aria-labelledby="hist-title">
            <div className="panel__head"><h2 className="panel__title" id="hist-title">History</h2></div>
            <div className="panel__body">
              <ol className="hist">
                {[...o.events].reverse().map((e, i) => (
                  <li key={i}><b>{e.status ? (e.status === "paid" ? "Payment received" : e.status === "pending_payment" ? "Order placed" : `Moved to ${STATUS_LABEL[e.status]}`) : e.note.startsWith("Note:") ? "Note" : "Update"}</b> {e.status ? e.note : e.note.replace(/^Note: /, "")}{e.actor !== "system" && e.actor !== "customer" ? ` · ${e.actor}` : ""}<time dateTime={e.at}>{dateTime(e.at)}</time></li>
                ))}
              </ol>
            </div>
          </section>
        </div>
        <aside className="stack" aria-label="Customer and payment">
          <section className="panel" aria-labelledby="cust-title">
            <div className="panel__head"><h2 className="panel__title" id="cust-title">Customer</h2>{o.userId && <Link href={`/admin/customers/${o.userId}`}>Account</Link>}</div>
            <div className="panel__body">
              <dl className="kv"><dt>Name</dt><dd>{o.name}</dd><dt>Phone</dt><dd>{formatPhone(o.phone)}</dd><dt>Email</dt><dd>{o.email}</dd></dl>
              <div className="contact-btns">
                <a className="btn btn--primary" href={`tel:${o.phone}`}><Icon name="phone" />Call</a>
                <a className="btn btn--secondary" href={`https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(`Hello ${o.name.split(" ")[0]}, this is Waste2Light about your order ${o.number}.`)}`}><Icon name="whatsapp" />WhatsApp</a>
                <a className="btn btn--secondary" href={`mailto:${o.email}?subject=${encodeURIComponent(`Your order ${o.number}`)}`}><Icon name="mail" />Email</a>
              </div>
            </div>
          </section>
          <section className="panel" aria-labelledby="del-title">
            <div className="panel__head"><h2 className="panel__title" id="del-title">{o.fulfilment === "delivery" ? "Delivery" : "Pickup"}</h2></div>
            <div className="panel__body">
              {o.fulfilment === "delivery" && o.address ? <p>Delivery in Minna<br />{o.address.street}, {o.address.area}{o.address.landmark ? <><br />{o.address.landmark}</> : null}</p> : <p>Pickup at Waste2Light, Bosso, Minna</p>}
              {o.notes && <p className="note">{o.notes}<small>Customer note</small></p>}
            </div>
          </section>
          <section className="panel" aria-labelledby="pay-title">
            <div className="panel__head"><h2 className="panel__title" id="pay-title">Payment</h2>{o.paidAt ? <span className="chip s-ok">Paid</span> : <span className="chip s-bad">Not paid</span>}</div>
            <div className="panel__body">
              <dl className="kv">
                <dt>Provider</dt><dd>{o.paymentMethod === "paystack" ? "Paystack" : "Bank transfer"}</dd>
                {paid && <><dt>Reference</dt><dd>{paid.reference}</dd></>}
                <dt>Amount</dt><dd>{naira(o.total)}</dd>
                {o.paidAt && <><dt>Paid</dt><dd>{dateTime(o.paidAt)}</dd></>}
                {paid?.channel && <><dt>Method</dt><dd>{paid.channel}</dd></>}
              </dl>
              {!o.paidAt && o.status === "pending_payment" && <MarkPaid orderId={o.id} total={naira(o.total)} />}
              {o.paidAt && <p style={{ marginTop: 10 }}><a href={`/api/orders/${encodeURIComponent(o.number)}/receipt`}>Download receipt (PDF)</a></p>}
              {refunds.length > 0 && (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                  {refunds.map((r) => <li key={r.id}>{naira(Number(r.amount_ngn))} · {r.status}{r.error ? ` (${r.error})` : ""} · {dateTime(new Date(r.created_at).toISOString())}</li>)}
                </ul>
              )}
            </div>
          </section>
          {owner && o.paidAt && o.refunded < o.total && (
            <section className="panel" aria-labelledby="ref-title">
              <div className="panel__head"><h2 className="panel__title" id="ref-title">Refund</h2></div>
              <div className="panel__body"><RefundForm orderId={o.id} max={o.total - o.refunded} /></div>
            </section>
          )}
          {o.paidAt && !["cancelled", "refunded", "completed"].includes(o.status) && (
            <section className="panel" aria-labelledby="st-title">
              <div className="panel__head"><h2 className="panel__title" id="st-title">Status</h2></div>
              <div className="panel__body"><StatusPicker orderId={o.id} options={statusOptions} /></div>
            </section>
          )}
          <section className="panel" aria-labelledby="notes-title">
            <div className="panel__head"><h2 className="panel__title" id="notes-title">Add a note</h2></div>
            <div className="panel__body"><NoteForm orderId={o.id} /></div>
          </section>
          {!["cancelled", "refunded", "completed"].includes(o.status) && (!o.paidAt || o.refunded >= o.total) && (
            <section className="panel"><div className="panel__body"><CancelButton orderId={o.id} /></div></section>
          )}
        </aside>
      </div>
    </>
  );
}
