import Link from "next/link";
import { Icon } from "@/components/store/Icon";
import { naira, shortDate } from "@/components/store/format";
import { query } from "@/lib/db";
import { formatPhone, listCustomers } from "@/lib/users";

export const metadata = { title: "Customers" };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [accounts, guests] = await Promise.all([
    listCustomers(q),
    // People who ordered or asked for a quote without an account, grouped by email.
    query(
      `select lower(email) as email, max(name) as name, max(phone) as phone, count(*)::int as orders,
         coalesce(sum(total_ngn - refunded_ngn) filter (where paid_at is not null), 0) as spent, max(created_at) as last_at
       from orders where user_id is null ${q ? "and (email ilike $1 or name ilike $1 or phone ilike $1)" : ""}
       group by lower(email) order by max(created_at) desc limit 100`,
      q ? [`%${q}%`] : [],
    ),
  ]);
  return (
    <>
      <div className="head"><div><h1 className="head__title">Customers</h1><p className="head__sub">{accounts.length} account{accounts.length === 1 ? "" : "s"} · {guests.length} guest buyer{guests.length === 1 ? "" : "s"}</p></div></div>
      <form className="toolbar" action="/admin/customers">
        <label className="search"><Icon name="search" /><span className="sr-only">Search customers</span><input name="q" type="search" defaultValue={q} placeholder="Search by name, email or phone" /></label>
        <button className="btn btn--secondary" type="submit">Search</button>
      </form>
      <section className="panel" aria-label="Customer accounts">
        <div className="panel__head" style={{ padding: "16px 20px 0" }}><h2 className="panel__title">Accounts</h2></div>
        {accounts.length === 0 ? <p className="adm-empty">No customer accounts yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col" className="num">Orders</th><th scope="col" className="num">Spent</th><th scope="col" className="num">Quotes</th><th scope="col">Joined</th></tr></thead>
              <tbody>
                {accounts.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/admin/customers/${c.id}`}>{c.name || "(no name)"}</Link>{!c.active && <> <span className="adm-pill adm-pill--muted">Inactive</span></>}</td>
                    <td>{c.email}</td><td>{formatPhone(c.phone)}</td>
                    <td className="num">{c.orders}</td><td className="num">{naira(c.spent)}</td><td className="num">{c.quotes}</td>
                    <td>{shortDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel" aria-label="Guest buyers">
        <div className="panel__head" style={{ padding: "16px 20px 0" }}><h2 className="panel__title">Guest buyers</h2></div>
        {guests.length === 0 ? <p className="adm-empty">No guest orders.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col" className="num">Orders</th><th scope="col" className="num">Spent</th><th scope="col">Last order</th></tr></thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.email}>
                    <td><Link href={`/admin/orders?q=${encodeURIComponent(g.email)}`}>{g.name}</Link></td>
                    <td>{g.email}</td><td>{formatPhone(g.phone)}</td><td className="num">{g.orders}</td><td className="num">{naira(Number(g.spent))}</td><td>{shortDate(new Date(g.last_at).toISOString())}</td>
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
