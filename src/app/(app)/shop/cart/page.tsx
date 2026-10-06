import Link from "next/link";
import { loadComponents } from "@/lib/catalog";
import { loadCart, thumbnail } from "@/lib/shop";
import { formatNaira, priceComponent } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { clearCartAction, removeFromCartAction, setCartQuantityAction } from "../actions";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const [cart, settings] = await Promise.all([loadCart(), getSettings()]);
  const comps = new Map((await loadComponents({ ids: cart.map((l) => l.componentId) })).map((c) => [c.id, c]));
  const opts = { now: new Date(), staleAfterHours: settings.staleAfterHours };
  const lines = cart.flatMap((l) => {
    const c = comps.get(l.componentId);
    return c ? [{ ...l, c, p: priceComponent(c.listings, c.markupPct, l.quantity, opts) }] : [];
  });
  const total = lines.reduce((s, l) => s + l.p.lineTotal, 0);

  return (
    <>
      <div className="page-head">
        <h1>Cart</h1>
        <div>
          <Link className="btn" href="/shop">Continue shopping</Link>
          {lines.length > 0 && <Link className="btn primary" href="/quotes/new?from=cart">Create quote</Link>}
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="card stack">
          <p>Your cart is empty.</p>
          <p><Link className="btn primary" href="/shop">Browse the Shop</Link></p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Line total</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.componentId}>
                    <td>
                      <div className="cart-item">
                        {l.imageUrl ? <img src={thumbnail(l.imageUrl, 120)!} alt="" loading="lazy" /> : <span className="cart-noimg" />}
                        <div>
                          <span className="line-name">{l.c.name}</span>
                          {l.p.warnings.length > 0 && <ul className="warnings">{l.p.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
                        </div>
                      </div>
                    </td>
                    <td className="num">
                      <form action={setCartQuantityAction.bind(null, l.componentId)} className="qty-form">
                        <input className="qty" type="number" name="quantity" min={1} max={100000} defaultValue={l.quantity} aria-label={`Quantity of ${l.c.name}`} />
                        <button className="btn small">Update</button>
                      </form>
                    </td>
                    <td className="num">{l.p.supplierUsed ? formatNaira(l.p.unitPrice) : "No price"}</td>
                    <td className="num"><strong>{formatNaira(l.p.lineTotal)}</strong></td>
                    <td>
                      <form action={removeFromCartAction.bind(null, l.componentId)}>
                        <button className="btn small danger" aria-label={`Remove ${l.c.name}`}>Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="total-bar">
            <form action={clearCartAction}><button className="btn small">Empty cart</button></form>
            <span className="muted">Same prices the quote will use. No delivery, VAT or other fees.</span>
            <strong>{formatNaira(total)}</strong>
          </div>
          <p className="cart-cta"><Link className="btn primary" href="/quotes/new?from=cart">Create quote from cart</Link></p>
        </>
      )}
    </>
  );
}
