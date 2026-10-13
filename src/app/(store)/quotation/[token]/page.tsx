import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { queryOne } from "@/lib/db";
import { paystackEnabled } from "@/lib/paystack";
import { formatDocDate, lagosToday } from "@/lib/quoteDocument";
import { loadQuote } from "@/lib/quotes";
import { bankTransferEnabled } from "@/lib/store/storeSettings";
import { formatPhone } from "@/lib/users";
import { AcceptForm } from "./AcceptForm";

export const metadata = { title: "Your quotation", robots: { index: false } };

export default async function QuotationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,}$/.test(token)) notFound();
  const row = await queryOne(
    `select q.id, q.customer_email, q.customer_phone, q.accepted_at, r.contact_name, r.fulfilment,
       (select o.number from orders o where o.quote_id = q.id and o.status <> 'cancelled' order by o.id desc limit 1) as order_number,
       (select o.access_token from orders o where o.quote_id = q.id and o.status <> 'cancelled' order by o.id desc limit 1) as order_token,
       (select o.paid_at from orders o where o.quote_id = q.id and o.status <> 'cancelled' order by o.id desc limit 1) as order_paid
     from quotes q left join quote_requests r on r.id = q.request_id where q.access_token = $1 and q.sent_at is not null`,
    [token],
  );
  const q = row ? await loadQuote(row.id) : null;
  if (!row || !q) notFound();
  const expired = !!q.validUntil && q.validUntil < lagosToday() && !row.accepted_at;

  return (
    <div className="simple simple--wide">
      <div className="simple__card">
        <p className="hero__eyebrow" style={{ color: "var(--color-primary)", margin: 0 }}>Quotation {q.quoteNumber}</p>
        <h1 className="simple__title">For {q.name}</h1>
        <p className="simple__sub">Dated {formatDocDate(q.quoteDate)}{q.validUntil ? `, valid until ${formatDocDate(q.validUntil)}` : ""}.</p>
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left" }}>Description</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {q.lines.map((l) => <tr key={l.id}><td style={{ padding: "8px 0", borderBottom: "1px solid #edefe9" }}>{l.description}</td><td className="num">{l.quantity}</td><td className="num">{naira(l.lineTotal)}</td></tr>)}
            </tbody>
            <tfoot><tr><td style={{ paddingTop: 10, fontWeight: 700 }}>Total</td><td /><td className="num price" style={{ paddingTop: 10, fontWeight: 700 }}>{naira(q.total)}</td></tr></tfoot>
          </table>
        </div>
        <p><a className="btn btn--secondary" href={`/api/quotation/${token}/pdf`} target="_blank" rel="noreferrer"><Icon name="file" />View the PDF</a></p>
        <hr style={{ border: 0, borderTop: "1px solid var(--color-border)", margin: "24px 0" }} />
        {row.order_number && row.order_paid ? (
          <p className="notice-box">You accepted and paid this quotation. <Link href={`/track/${encodeURIComponent(row.order_number)}?t=${row.order_token}`}>Track order {row.order_number}</Link>.</p>
        ) : expired ? (
          <p className="notice-box notice-box--warn">This quotation has expired. <a href="https://wa.me/2348078787646">Message us</a> and we&apos;ll send an updated one.</p>
        ) : (
          <>
            <h2 style={{ font: "800 22px var(--font-head)", margin: "0 0 12px" }}>Accept and pay</h2>
            {row.order_number && <p className="notice-box" style={{ marginBottom: 12 }}>Order {row.order_number} is waiting for payment. Paying again here continues it.</p>}
            <AcceptForm
              token={token}
              total={q.total}
              paystack={paystackEnabled()}
              bankTransfer={await bankTransferEnabled()}
              defaults={{ name: row.contact_name ?? q.attn.split(",")[0] ?? "", email: row.customer_email ?? "", phone: row.customer_phone ? formatPhone(row.customer_phone) : "", fulfilment: row.fulfilment ?? "delivery" }}
            />
          </>
        )}
      </div>
    </div>
  );
}
