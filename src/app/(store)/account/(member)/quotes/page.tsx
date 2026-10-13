import Link from "next/link";
import { redirect } from "next/navigation";
import { naira, shortDate } from "@/components/store/format";
import { query } from "@/lib/db";
import { lagosToday } from "@/lib/quoteDocument";
import { listRequestsForUser } from "@/lib/store/quoteRequests";
import { currentCustomer } from "@/lib/users";

export const metadata = { title: "Your quotes", robots: { index: false } };

export default async function AccountQuotes() {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  const requests = await listRequestsForUser(user.id);
  // The official quotations sent for these requests (only once sent do they show here).
  const quotes = requests.length
    ? await query("select id, request_id, quote_number, total_ngn, valid_until, access_token, sent_at, accepted_at from quotes where request_id = any($1::int[]) and sent_at is not null", [requests.map((r) => r.id)])
    : [];
  const today = lagosToday();
  return (
    <>
      <h1 className="main__title">Your quotes</h1>
      <section className="panel" aria-labelledby="q-title">
        <div className="panel__head"><h2 className="panel__title" id="q-title">Quotes</h2><Link className="btn btn--secondary" href="/quote-request">New quote request</Link></div>
        {requests.length === 0 ? (
          <p style={{ padding: 20 }}>No quote requests yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Your quote requests and quotations</caption>
              <thead><tr><th scope="col">Reference</th><th scope="col">Date</th><th scope="col" className="num">Estimate</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {requests.map((r) => {
                  const q = quotes.find((x) => x.request_id === r.id);
                  const expired = q?.valid_until && q.valid_until < today && !q.accepted_at;
                  return (
                    <tr key={r.id}>
                      <td className="ref">{q ? q.quote_number : r.number}</td>
                      <td data-l="Date">{shortDate(r.createdAt)}</td>
                      <td className="num price" data-l="Estimate">{naira(q ? Number(q.total_ngn) : r.estimatedTotal)}</td>
                      <td className="status">
                        {q?.accepted_at ? <span className="chip chip--done">Accepted</span>
                          : expired ? <span className="chip chip--expired">Expired</span>
                            : q ? <span className="chip chip--progress">Quoted</span>
                              : r.status === "closed" ? <span className="chip chip--expired">Closed</span>
                                : <span className="chip chip--neutral">Sent</span>}
                      </td>
                      <td className="act">
                        <div className="actions">
                          {q ? (
                            <>
                              <a className="btn btn--secondary" href={`/api/quotation/${q.access_token}/pdf`}>View PDF</a>
                              {!expired && !q.accepted_at && <Link className="btn btn--primary" href={`/quotation/${q.access_token}`}>Accept and pay</Link>}
                            </>
                          ) : <span className="chip chip--neutral">We&apos;ll call you soon</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
