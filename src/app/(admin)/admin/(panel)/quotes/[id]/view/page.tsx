import { notFound } from "next/navigation";
import Link from "next/link";
import { loadQuote } from "@/lib/quotes";
import { formatNaira, SUPPLIER_LABEL } from "@/lib/pricing";
import { formatDocDate } from "@/lib/quoteDocument";
import { formatLagos } from "@/lib/time";
import { deleteQuoteAction, duplicateQuoteAction } from "../../actions";
import ConfirmButton from "@/components/ConfirmButton";
import { Badge } from "@/components/Badges";
import { queryOne } from "@/lib/db";
import { SendQuotation } from "../../../quote-requests/RequestControls";

export const metadata = { title: "Quote" };

export default async function ViewQuote({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const q = await loadQuote(id);
  if (!q) notFound();
  const pdf = `/api/quotes/${q.id}/pdf`;
  const warnings = q.lines.reduce((n, l) => n + l.warnings.length, 0);
  const sent = await queryOne(
    `select q.customer_email, q.sent_at, q.request_id, r.number as request_number, r.email as request_email
     from quotes q left join quote_requests r on r.id = q.request_id where q.id = $1`,
    [q.id],
  );
  return (
    <>
      <div className="page-head">
        <div className="head-text">
          <h1>{q.quoteNumber}</h1>
          <p className="muted small">
            {q.name}{q.attn ? ` · Attn: ${q.attn}` : ""} · Dated {formatDocDate(q.quoteDate)}
            {q.validUntil ? ` · Valid until ${formatDocDate(q.validUntil)}` : " · No valid-until date: set one in Edit"}
          </p>
        </div>
        <div>
          <Link className="btn" href="/admin/quotes">All quotes</Link>
          <Link className="btn" href={`/admin/quotes/${q.id}`}>Edit</Link>
          <form action={duplicateQuoteAction.bind(null, q.id)}><button className="btn" title="New quotation number and today's date; catalog lines at today's prices">Duplicate</button></form>
          <form action={deleteQuoteAction.bind(null, q.id)}><ConfirmButton message="Delete this quote?">Delete</ConfirmButton></form>
          <a className="btn primary" href={pdf}>Download PDF</a>
        </div>
      </div>

      <div className="card">
        <h2>Send to the customer</h2>
        <p className="muted small">Emails the PDF with a private link where the customer can accept and pay online (Paystack or bank transfer).{sent?.request_id ? <> From request <Link href={`/admin/quote-requests/${sent.request_id}`}>{sent.request_number}</Link>.</> : null}</p>
        <SendQuotation quoteId={q.id} email={sent?.customer_email || sent?.request_email || ""} sentAt={sent?.sent_at ? formatLagos(new Date(sent.sent_at).toISOString()) : null} />
      </div>

      <iframe className="pdf-preview" src={`${pdf}?inline=1#view=FitH`} title={`Quotation ${q.quoteNumber} (PDF preview)`} />
      <p className="small muted">This is the PDF the customer receives. If the preview is blank, use <a href={`${pdf}?inline=1`} target="_blank" rel="noreferrer">Open PDF</a>.</p>

      <details className="card internal">
        <summary>Internal pricing (not on the PDF){warnings > 0 ? ` · ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}</summary>
        <p className="muted small">Prices saved on {formatLagos(q.updatedAt)} (Lagos time). Later supplier syncs do not change this quote.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th className="num">Qty</th><th>Price source</th><th className="num">Unit price</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {q.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="line-name">{l.name}</span> {l.bundleId !== null && <Badge kind="neutral">Bundle</Badge>}
                    {!l.componentId && !l.bundleId && <Badge kind="neutral">Custom</Badge>}
                    {Array.isArray(l.detail) && (
                      <details><summary>Contents</summary>
                        <ul className="small">{(l.detail as { name: string; quantity: number }[]).map((d, i) => <li key={i}>{d.quantity} × {d.name}</li>)}</ul>
                      </details>
                    )}
                    {l.warnings.length > 0 && <ul className="warnings">{l.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
                  </td>
                  <td className="num">{l.quantity}</td>
                  <td className="small">
                    {l.priceOverride ? "Set by hand" : l.supplierUsed ? `${SUPPLIER_LABEL[l.supplierUsed]} ${formatNaira(l.supplierPrice ?? 0)} + ${l.markupPct}%` : l.bundleId ? "Sum of bundle contents" : "-"}
                  </td>
                  <td className="num">{formatNaira(l.unitPrice)}</td>
                  <td className="num">{formatNaira(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4}>Total</td><td className="num">{formatNaira(q.total)}</td></tr></tfoot>
          </table>
        </div>
      </details>
    </>
  );
}
