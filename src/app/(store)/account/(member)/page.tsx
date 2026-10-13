import Link from "next/link";
import { redirect } from "next/navigation";
import { statusChip } from "@/components/store/OrderTracking";
import { naira, shortDate } from "@/components/store/format";
import { listOrdersForUser, STATUS_LABEL } from "@/lib/store/orders";
import { currentCustomer } from "@/lib/users";

export const metadata = { title: "Your orders", robots: { index: false } };

export default async function AccountOrders() {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  const orders = await listOrdersForUser(user.id);
  return (
    <>
      <h1 className="main__title">Your orders</h1>
      <section className="panel" aria-label="Orders">
        {orders.length === 0 ? (
          <p style={{ padding: 20 }}>No orders yet. <Link href="/shop">Start shopping</Link> or <Link href="/projects">pick a project kit</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Your orders</caption>
              <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col" className="num">Items</th><th scope="col" className="num">Total</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="ref">{o.number}</td>
                    <td data-l="Date">{shortDate(o.createdAt)}</td>
                    <td className="num" data-l="Items">{o.lines.reduce((n, l) => n + l.quantity, 0)}</td>
                    <td className="num price" data-l="Total">{naira(o.total)}</td>
                    <td className="status"><span className={statusChip(o.status)}>{STATUS_LABEL[o.status]}</span></td>
                    <td className="act"><div className="actions"><Link className="btn btn--secondary" href={`/track/${encodeURIComponent(o.number)}?t=${o.accessToken}`}>View<span className="sr-only"> order {o.number}</span></Link></div></td>
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
