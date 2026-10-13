import Link from "next/link";
import { CartLineControls } from "@/components/store/CartLineControls";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { currentCartId, loadCart } from "@/lib/store/cart";

export const metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const cart = await loadCart(await currentCartId());

  if (cart.lines.length === 0) {
    return (
      <div className="container">
        <div className="page-head"><h1 className="page-head__title">Your cart</h1></div>
        <div className="empty">
          <svg className="empty__art" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="60" cy="60" r="52" strokeOpacity=".25" />
            <path d="M28 36h9l8 38a5 5 0 0 0 5 4h28a5 5 0 0 0 5-4l6-26H42" />
            <circle cx="52" cy="90" r="4" /><circle cx="82" cy="90" r="4" />
            <path d="M62 30c0-8 6-13 14-13 0 8-6 13-14 13zM62 30v14" />
          </svg>
          <h2 className="empty__title">Your cart is empty</h2>
          <p className="empty__text">Add a component or a complete project kit to get started.</p>
          <div className="empty__actions">
            <Link className="btn btn--primary btn--lg" href="/shop">Shop components</Link>
            <Link className="btn btn--secondary btn--lg" href="/projects">Explore projects</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">Your cart</h1>
        <p className="page-head__count">{cart.count} item{cart.count === 1 ? "" : "s"}</p>
      </div>
      <div className="cart">
        <ul className="cart__list" aria-label="Items in your cart">
          {cart.lines.map((l) =>
            l.kind === "kit" ? (
              <li key={l.id}>
                <section className="kit-group" aria-label={l.title}>
                  <div className="kit-group__head">
                    <span className="kit-group__icon"><Icon name="box" /></span>
                    <div>
                      <p className="kit-group__tag">Complete kit{l.quantity > 1 ? ` × ${l.quantity}` : ""}</p>
                      <p className="kit-group__name"><Link href={l.href}>{l.title.replace(/ kit$/, "")}</Link></p>
                      {l.availability === "low" && <p className="line__unit" style={{ color: "var(--color-warn)" }}>One part is out of stock: we&apos;ll call you to agree a swap.</p>}
                      {l.availability === "out" && <p className="line__unit" style={{ color: "var(--color-danger)" }}>Part of this kit is no longer sold. Remove it to check out.</p>}
                    </div>
                    <span className="price kit-group__total">{naira(l.lineTotal)}</span>
                    <CartLineControls lineId={l.id} quantity={l.quantity} kind="kit" name={l.title} />
                  </div>
                  <ul className="kit-group__parts" aria-label="Parts in this kit">
                    {l.kitItems?.map((i) => (
                      <li key={i.ref}>
                        <span><b>{i.quantity * l.quantity} ×</b> {i.product?.title ?? "No longer sold"}{i.product?.availability === "out" ? " (out of stock)" : ""}</span>
                        <span>{naira(i.lineTotal * l.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </li>
            ) : (
              <li key={l.id}>
                <article className="line">
                  <span className="line__thumb">{l.image ? <img src={`${l.image}?w=120`} alt="" width={64} height={64} style={{ objectFit: "contain", width: "100%", height: "100%" }} /> : <Icon name="chip" className="" />}</span>
                  <div>
                    <p className="line__name">{l.missing ? l.title : <Link href={l.href} prefetch={false}>{l.title}</Link>}</p>
                    <p className="line__unit">
                      {l.missing ? <b style={{ color: "var(--color-danger)" }}>Remove this item to check out</b>
                        : l.availability === "out" ? <b style={{ color: "var(--color-danger)" }}>Out of stock: remove it to check out</b>
                          : `${naira(l.unitPrice)} each`}
                    </p>
                  </div>
                  <span className="price line__total">{naira(l.lineTotal)}</span>
                  <CartLineControls lineId={l.id} quantity={l.quantity} kind="product" name={l.title} />
                </article>
              </li>
            ),
          )}
        </ul>
        <aside className="summary" aria-label="Order summary">
          <h2 className="summary__title">Summary</h2>
          <dl className="summary__rows">
            <div className="summary__row"><dt>Subtotal</dt><dd>{naira(cart.subtotal)}</dd></div>
            <div className="summary__row"><dt>Delivery</dt><dd>Free (Minna)</dd></div>
            <div className="summary__row summary__row--total"><dt>Total</dt><dd>{naira(cart.subtotal)}</dd></div>
          </dl>
          <p className="summary__note">Prices can change until you pay. Your price is locked when you check out.</p>
          <div className="summary__actions">
            {cart.blocked
              ? <span className="btn btn--lg btn--block" aria-disabled="true" style={{ opacity: .6 }}>Remove unavailable items to check out</span>
              : <Link className="btn btn--primary btn--lg btn--block" href="/checkout">Checkout</Link>}
            <Link className="btn btn--secondary btn--block" href="/quote-request">Request a quote instead</Link>
            <Link className="btn btn--text btn--block" href="/shop">Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
