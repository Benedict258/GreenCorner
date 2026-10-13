import Link from "next/link";
import { RequestChip } from "@/components/admin/Chips";
import { Icon } from "@/components/store/Icon";
import { naira, shortDate } from "@/components/store/format";
import { listQuoteRequests, REQUEST_STATUS_LABEL } from "@/lib/store/quoteRequests";

export const metadata = { title: "Quote requests" };

export default async function QuoteRequests({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const all = await listQuoteRequests({ q: sp.q });
  const rows = sp.status && sp.status !== "all" ? all.filter((r) => r.status === sp.status) : all;
  const n = (s: string) => all.filter((r) => r.status === s).length;
  return (
    <>
      <div className="head">
        <div><h1 className="head__title">Quote requests</h1><p className="head__sub">{n("new")} new, {n("contacted")} contacted, {n("quoted")} quoted</p></div>
      </div>
      <form className="toolbar" action="/admin/quote-requests">
        <label className="search"><Icon name="search" /><span className="sr-only">Search requests</span><input name="q" type="search" defaultValue={sp.q} placeholder="Search by reference, organisation, name or phone" /></label>
        <select className="select" name="status" defaultValue={sp.status ?? "all"} aria-label="Status">
          <option value="all">All statuses</option>
          {Object.entries(REQUEST_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l} ({n(k)})</option>)}
        </select>
        <button className="btn btn--secondary" type="submit">Apply</button>
      </form>
      <section className="panel" aria-label="Quote requests list">
        {rows.length === 0 ? <p className="adm-empty">No quote requests yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Quote requests, new first</caption>
              <thead><tr><th scope="col">Reference</th><th scope="col">Date</th><th scope="col">Organisation</th><th scope="col">Contact</th><th scope="col" className="num">Items</th><th scope="col" className="num">Estimated total</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="ref"><Link href={`/admin/quote-requests/${r.id}`}>{r.number}</Link></td>
                    <td>{shortDate(r.createdAt)}</td>
                    <td>{r.organisation}</td>
                    <td>{r.contactName}</td>
                    <td className="num">{r.lines.length}</td>
                    <td className="num">{naira(r.estimatedTotal)}</td>
                    <td><RequestChip status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
