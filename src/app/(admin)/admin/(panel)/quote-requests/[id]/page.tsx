import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestChip } from "@/components/admin/Chips";
import { Icon } from "@/components/store/Icon";
import { dateTime, naira } from "@/components/store/format";
import { query } from "@/lib/db";
import { waNumber } from "@/lib/messaging";
import { formatDocDate } from "@/lib/quoteDocument";
import { getProject } from "@/lib/store/projects";
import { getProductsByRef } from "@/lib/store/catalog";
import { getQuoteRequest } from "@/lib/store/quoteRequests";
import { formatPhone } from "@/lib/users";
import { CreateQuotationButton, NotesBox, SendQuotation, StatusSelect } from "../RequestControls";

export const metadata = { title: "Quote request" };

export default async function QuoteRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const r = await getQuoteRequest(Number((await params).id));
  if (!r) notFound();
  // Stock check: kit parts and products that are out of stock now.
  const warnings: string[] = [];
  for (const l of r.lines) {
    if (l.projectId) {
      const p = await getProject(l.projectId);
      const out = p?.items.filter((i) => !i.product || i.product.availability === "out") ?? [];
      if (out.length) warnings.push(`${out.length} of the ${p?.items.length} parts in ${l.title} ${out.length === 1 ? "is" : "are"} out of stock: ${out.map((i) => i.product?.title ?? "a part no longer sold").join(", ")}.`);
    }
  }
  const products = await getProductsByRef(r.lines.filter((l) => l.ref).map((l) => l.ref!));
  for (const l of r.lines) if (l.ref && products.get(l.ref)?.availability === "out") warnings.push(`${l.title} is out of stock.`);
  const quote = r.quoteId ? (await query("select id, quote_number, total_ngn, sent_at, customer_email from quotes where id = $1", [r.quoteId]))[0] : null;
  const orders = r.quoteId ? await query("select id, number, status, paid_at from orders where quote_id = $1 order by id desc", [r.quoteId]) : [];

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/admin/quote-requests">Quote requests</Link> › {r.number}</nav>
      <div className="head">
        <div><h1 className="head__title">{r.number} <RequestChip status={r.status} /></h1><p className="head__sub">Received {dateTime(r.createdAt)} · {r.organisation}</p></div>
        <CreateQuotationButton id={r.id} existing={!!quote} />
      </div>
      <div className="layout">
        <div className="stack">
          <section className="panel" aria-labelledby="req-title">
            <div className="panel__head"><h2 className="panel__title" id="req-title">Request</h2></div>
            <div className="panel__body">
              <dl className="kv">
                <dt>Organisation</dt><dd>{r.organisation}</dd>
                <dt>Contact person</dt><dd>{r.contactName}{r.contactRole ? `, ${r.contactRole}` : ""}</dd>
                <dt>Phone</dt><dd>{formatPhone(r.phone)}</dd>
                <dt>Email</dt><dd>{r.email}</dd>
                {r.students && <><dt>Students</dt><dd>{r.students}</dd></>}
                {r.neededBy && <><dt>Needed by</dt><dd>{formatDocDate(r.neededBy)}</dd></>}
                <dt>Delivery</dt><dd>{r.fulfilment === "delivery" ? "Delivery in Minna" : "Pickup at Bosso"}</dd>
              </dl>
              {r.message && <p className="msg">{r.message}</p>}
            </div>
          </section>
          <section className="panel" aria-labelledby="its-title">
            <div className="panel__head"><h2 className="panel__title" id="its-title">Items requested</h2></div>
            {r.lines.length === 0 ? <p className="adm-empty">No items: see the message.</p> : (
              <div className="table-wrap">
                <table className="items">
                  <thead><tr><th scope="col">Item</th><th scope="col" className="num">Qty</th><th scope="col" className="num">Unit price</th><th scope="col" className="num">Line total</th></tr></thead>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={l.id}>
                        <td><p><b>{l.title}</b></p><p className="sub">{l.projectId ? "Complete kit" : "Component"}</p>{l.note && <p className="sub">Customer note: {l.note}</p>}</td>
                        <td className="num">{l.quantity}</td>
                        <td className="num">{naira(l.unitPrice)}</td>
                        <td className="num price">{naira(l.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {warnings.length > 0 && <div className="panel__body">{warnings.map((w, i) => <p className="warn" key={i}><Icon name="alert" /><span>Stock check: {w} Confirm lead time before you promise a date.</span></p>)}</div>}
          </section>
          {quote && (
            <section className="panel" aria-labelledby="qq-title">
              <div className="panel__head"><h2 className="panel__title" id="qq-title">Quotation {quote.quote_number}</h2><span className="chip chip--info">{naira(Number(quote.total_ngn))}</span></div>
              <div className="panel__body" style={{ display: "grid", gap: 12 }}>
                <p><Link href={`/admin/quotes/${quote.id}`}>Edit in the quote builder</Link> · <Link href={`/admin/quotes/${quote.id}/view`}>View PDF</Link></p>
                <SendQuotation quoteId={quote.id} email={quote.customer_email || r.email} sentAt={quote.sent_at ? dateTime(new Date(quote.sent_at).toISOString()) : null} />
                {orders.map((o) => <p key={o.id}>Order <Link href={`/admin/orders/${o.id}`}>{o.number}</Link> · {o.paid_at ? "paid" : "waiting for payment"}</p>)}
              </div>
            </section>
          )}
        </div>
        <aside className="stack" aria-label="Actions">
          <section className="panel" aria-labelledby="act-title">
            <div className="panel__head"><h2 className="panel__title" id="act-title">Contact</h2></div>
            <div className="panel__body">
              <div className="contact-btns">
                <a className="btn btn--primary" href={`tel:${r.phone}`}><Icon name="phone" />Call</a>
                <a className="btn btn--secondary" href={`https://wa.me/${waNumber(r.phone)}?text=${encodeURIComponent(`Hello ${r.contactName.split(" ")[0]}, this is Waste2Light about your quote request ${r.number}.`)}`}><Icon name="whatsapp" />WhatsApp</a>
                <a className="btn btn--secondary" href={`mailto:${r.email}?subject=${encodeURIComponent(`Your quote request ${r.number}`)}`}><Icon name="mail" />Email</a>
              </div>
              <StatusSelect id={r.id} value={r.status} />
            </div>
          </section>
          <section className="panel" aria-labelledby="qn-title">
            <div className="panel__head"><h2 className="panel__title" id="qn-title">Notes</h2></div>
            <div className="panel__body"><NotesBox id={r.id} notes={r.adminNotes} /></div>
          </section>
          <section className="panel" aria-labelledby="qh-title">
            <div className="panel__head"><h2 className="panel__title" id="qh-title">History</h2></div>
            <div className="panel__body">
              <ol className="hist">
                {quote?.sent_at && <li><b>Quotation emailed</b> to {quote.customer_email}<time>{dateTime(new Date(quote.sent_at).toISOString())}</time></li>}
                {r.updatedAt !== r.createdAt && <li><b>Last updated</b><time>{dateTime(r.updatedAt)}</time></li>}
                <li><b>Request received</b> from the website<time dateTime={r.createdAt}>{dateTime(r.createdAt)}</time></li>
              </ol>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
