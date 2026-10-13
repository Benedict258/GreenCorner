import Link from "next/link";
import { redirect } from "next/navigation";
import { naira } from "@/components/store/format";
import { paystackEnabled } from "@/lib/paystack";
import { currentCartId, loadCart, type CartLineView } from "@/lib/store/cart";
import { bankTransferEnabled } from "@/lib/store/storeSettings";
import { query } from "@/lib/db";
import { currentCustomer } from "@/lib/users";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Checkout", robots: { index: false } };

function sub(l: CartLineView): string {
  return l.kind === "kit" ? `Complete kit · ${l.kitItems?.length ?? 0} components · Qty ${l.quantity}` : `Qty ${l.quantity}`;
}

export default async function CheckoutPage() {
  const cart = await loadCart(await currentCartId());
  if (cart.lines.length === 0) redirect("/cart");
  if (cart.blocked) redirect("/cart");
  const user = await currentCustomer();
  const addr = user ? (await query("select * from addresses where user_id = $1 order by id desc limit 1", [user.id]))[0] : null;
  const lines = cart.lines.map((l) => (
    <div className="sline" key={l.id}>
      <span><b>{l.title}</b><br /><small>{sub(l)}</small></span>
      <span className="price">{naira(l.lineTotal)}</span>
    </div>
  ));

  return (
    <div className="container">
      <ol className="progress" aria-label="Checkout steps">
        <li className="progress__on"><span className="progress__n">1</span>Details</li>
        <li className="progress__on"><span className="progress__n">2</span>Delivery</li>
        <li><span className="progress__n">3</span>Payment</li>
      </ol>
      <h1 className="page-title">Checkout</h1>
      <div className="checkout">
        <CheckoutForm
          total={cart.subtotal}
          signedIn={!!user}
          paystack={paystackEnabled()}
          bankTransfer={await bankTransferEnabled()}
          defaults={{ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", street: addr?.street ?? "", area: addr?.area ?? "", landmark: addr?.landmark ?? "" }}
        />
        <div>
          <details className="mobile-summary">
            <summary><span>Show order summary</span><span className="price">{naira(cart.subtotal)}</span></summary>
            <div className="mobile-summary__body">{lines}</div>
          </details>
          <aside className="summary" aria-label="Order summary">
            <h2 className="summary__title">Order summary</h2>
            {lines}
            <dl className="rows">
              <div className="row"><dt>Subtotal</dt><dd>{naira(cart.subtotal)}</dd></div>
              <div className="row"><dt>Delivery</dt><dd>Free (Minna)</dd></div>
              <div className="row row--total"><dt>Total</dt><dd>{naira(cart.subtotal)}</dd></div>
            </dl>
            <Link href="/cart">Edit cart</Link>
          </aside>
        </div>
      </div>
      <div className="end-space" />
    </div>
  );
}
