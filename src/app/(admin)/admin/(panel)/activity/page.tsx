import { dateTime } from "@/components/store/format";
import { query } from "@/lib/db";

export const metadata = { title: "Activity" };

const LABEL: Record<string, string> = {
  signed_in: "Signed in", signed_out: "Signed out", order_status: "Changed an order's status", order_marked_paid: "Marked an order paid",
  refund: "Made a refund", markup: "Changed a markup", product_shown: "Showed a product", product_hidden: "Hid a product", product_featured: "Changed a featured product",
  stock: "Changed stock", project_saved: "Saved a project", project_created: "Created a project", project_deleted: "Deleted a project",
  project_published: "Published a project", project_unpublished: "Unpublished a project", demo_projects_added: "Added demo projects",
  quote_request_status: "Changed a quote request's status", quotation_from_request: "Made a quotation from a request", quotation_sent: "Emailed a quotation",
  staff_invited: "Invited staff", staff_activated: "Reactivated staff", staff_deactivated: "Deactivated staff", staff_role: "Changed a staff role", staff_joined: "Joined as staff",
  settings: "Changed settings", ip_blocked: "Blocked a visitor address", ip_unblocked: "Unblocked a visitor address",
};

function target(type: string | null, id: string | null): string {
  if (!type || !id) return "";
  const href = type === "order" ? `/admin/orders/${id}` : type === "quote_request" ? `/admin/quote-requests/${id}` : type === "project" ? `/admin/projects/${id}` : type === "quote" ? `/admin/quotes/${id}/view` : null;
  return href ? href : "";
}

export default async function Activity({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { who } = await searchParams;
  const rows = await query(`select * from audit_log ${who ? "where actor = $1" : ""} order by at desc limit 300`, who ? [who] : []);
  const [messages] = await Promise.all([query("select * from messages order by created_at desc limit 50")]);
  return (
    <>
      <div className="head"><div><h1 className="head__title">Activity</h1><p className="head__sub">Who did what, newest first{who ? ` (only ${who})` : ""}.</p></div></div>
      <section className="panel" aria-label="Activity log">
        {rows.length === 0 ? <p className="adm-empty">Nothing yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const href = target(r.target_type, r.target_id);
                  return (
                    <tr key={r.id}>
                      <td className="when">{dateTime(new Date(r.at).toISOString())}</td>
                      <td><a href={`/admin/activity?who=${encodeURIComponent(r.actor)}`}>{r.actor}</a></td>
                      <td>{LABEL[r.action] ?? r.action}{href ? <> · <a href={href}>open</a></> : r.target_id ? ` · ${r.target_id}` : ""}</td>
                      <td className="muted" style={{ maxWidth: 320, overflowWrap: "anywhere" }}>{r.detail ? JSON.stringify(r.detail) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel" aria-label="Messages sent">
        <div className="panel__head" style={{ padding: "16px 20px 0" }}><h2 className="panel__title">Emails and WhatsApp messages</h2></div>
        {messages.length === 0 ? <p className="adm-empty">No messages yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">When</th><th scope="col">Channel</th><th scope="col">To</th><th scope="col">Subject</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td className="when">{dateTime(new Date(m.created_at).toISOString())}</td>
                    <td>{m.channel === "email" ? "Email" : "WhatsApp"}</td>
                    <td>{m.recipient}</td>
                    <td>{m.subject}</td>
                    <td>{m.status === "sent" ? <span className="chip chip--ok">Sent</span> : m.status === "skipped" ? <span className="chip chip--warn" title={m.error ?? ""}>Not set up</span> : <span className="chip chip--bad" title={m.error ?? ""}>Failed</span>}</td>
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
