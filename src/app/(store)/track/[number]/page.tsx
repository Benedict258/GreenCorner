import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTracking } from "@/components/store/OrderTracking";
import { findOrderForCustomer } from "@/lib/store/orders";
import { currentCustomer } from "@/lib/users";

export const metadata = { title: "Your order", robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; pending?: string }> };

/** The private order link from emails (token), or a signed-in customer's own order. */
export default async function OrderLinkPage({ params, searchParams }: Props) {
  const [{ number }, { t, pending }] = await Promise.all([params, searchParams]);
  let o = await findOrderForCustomer(decodeURIComponent(number), { token: t });
  if (!o) {
    const user = await currentCustomer();
    if (user) {
      const own = await findOrderForCustomer(decodeURIComponent(number), { email: user.email });
      if (own && own.userId === user.id) o = own;
    }
  }
  if (!o) notFound();
  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">Your order</h1>
        <p className="page-head__sub">{pending ? "Your payment is still being confirmed. This page updates as soon as it is." : <Link href="/track">Track a different order</Link>}</p>
      </div>
      <OrderTracking o={o} />
    </div>
  );
}
