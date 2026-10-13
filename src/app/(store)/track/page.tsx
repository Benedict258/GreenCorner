import { headers } from "next/headers";
import { OrderTracking } from "@/components/store/OrderTracking";
import { clientIp, FORM_LIMITS, hit } from "@/lib/guard";
import { findOrderForCustomer } from "@/lib/store/orders";

export const metadata = { title: "Track an order", robots: { index: false } };

type Params = { number?: string; email?: string };

export default async function TrackPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const number = (sp.number ?? "").trim().slice(0, 40);
  const email = (sp.email ?? "").trim().slice(0, 254);
  let order = null;
  let message = "";
  if (number && email) {
    // Guessing order numbers by email is slowed down like any other form.
    if (await hit(clientIp(await headers()), FORM_LIMITS).catch(() => null)) message = "Too many lookups. Please wait a minute.";
    else {
      order = await findOrderForCustomer(number, { email });
      if (!order) message = "We couldn't find an order with that number and email. Check both and try again.";
    }
  }
  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">Track an order</h1>
        <p className="page-head__sub">Enter your order number and the email you used at checkout.</p>
      </div>
      <form className="lookup" action="/track">
        <div className="field"><label className="field__label" htmlFor="onum">Order number</label><input className="field__input" id="onum" name="number" defaultValue={number} placeholder="W2L-ORD-1042" required /></div>
        <div className="field"><label className="field__label" htmlFor="oemail">Email</label><input className="field__input" id="oemail" name="email" type="email" defaultValue={email} required /></div>
        <button className="btn btn--primary" type="submit">Track order</button>
      </form>
      {message && <p className="notice-box notice-box--warn" role="alert" style={{ marginBottom: 24 }}>{message}</p>}
      {order && <OrderTracking o={order} />}
    </div>
  );
}
