import Link from "next/link";
import { listQuotes } from "@/lib/quotes";
import { formatNaira } from "@/lib/pricing";
import { formatLagos } from "@/lib/time";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const quotes = await listQuotes();
  return (
    <>
      <div className="page-head">
        <h1>Quotes</h1>
        <div><Link className="btn primary" href="/admin/quotes/new">New quote</Link></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Quotation No</th><th>Bill to</th><th>Lines</th><th className="num">Total</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {quotes.length === 0 && <tr><td colSpan={6} className="muted">No quotes yet. Start one with New quote.</td></tr>}
            {quotes.map((q) => (
              <tr key={q.id}>
                <td className="nowrap"><Link href={`/admin/quotes/${q.id}/view`}>{q.quoteNumber}</Link></td>
                <td>{q.name}</td>
                <td>{q.lines}</td>
                <td className="num">{formatNaira(q.total)}</td>
                <td>{formatLagos(q.updatedAt)}</td>
                <td><a className="btn small" href={`/api/quotes/${q.id}/pdf`}>PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
