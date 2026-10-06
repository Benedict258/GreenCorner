import Link from "next/link";
import { cartCount, loadShop, thumbnail } from "@/lib/shop";
import { formatNaira } from "@/lib/pricing";
import { formatLagos } from "@/lib/time";
import { Badge } from "@/components/Badges";
import AddToCart from "./AddToCart";

export const metadata = { title: "Shop" };

type Params = { q?: string; category?: string; stock?: string; page?: string };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const [shop, inCart] = await Promise.all([
    loadShop({ q: sp.q, category: sp.category, inStockOnly: sp.stock === "in", page: Number(sp.page) || 1 }),
    cartCount(),
  ]);
  const href = (p: Partial<Params>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, category: sp.category, stock: sp.stock, ...p })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const allCount = shop.categories.reduce((n, c) => n + c.count, 0);

  return (
    <>
      <div className="page-head">
        <div className="head-text">
          <h1>Shop</h1>
          <p className="muted small">
            Every Microscale product. Prices include your markup.
            {shop.updatedAt && <> Updated {formatLagos(shop.updatedAt)} (Lagos time).</>}
          </p>
        </div>
        {inCart > 0 && <div><Link className="btn primary" href="/quotes/new?from=cart">Create quote from cart ({inCart})</Link></div>}
      </div>

      {allCount === 0 ? (
        <div className="card stack">
          <p>The Shop is empty until the first sync reads the Microscale catalog.</p>
          <p><Link className="btn primary" href="/sync">Go to Sync and run Sync now</Link></p>
        </div>
      ) : (
        <>
          <form className="card row" action="/shop">
            <label>Search<input name="q" defaultValue={sp.q} placeholder="Name or SKU, e.g. arduino, relay, MDL-2315" /></label>
            <label style={{ flex: "0 1 220px" }}>Category
              <select name="category" defaultValue={sp.category ?? ""}>
                <option value="">All categories ({allCount})</option>
                {shop.categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" name="stock" value="in" defaultChecked={sp.stock === "in"} /> In stock only</label>
            <button className="btn">Show</button>
            {(sp.q || sp.category || sp.stock) && <Link className="btn" href="/shop">Clear</Link>}
          </form>

          <p className="muted small">{shop.total === 0 ? "Nothing matches." : `${shop.total} product${shop.total === 1 ? "" : "s"}${shop.pages > 1 ? `, page ${shop.page} of ${shop.pages}` : ""}`}</p>

          <ul className="product-grid">
            {shop.items.map((p) => (
              <li key={p.ref} className="product-card">
                <a className="product-image" href={p.url} target="_blank" rel="noreferrer" title="Open on microscale.net">
                  {p.imageUrl ? <img src={thumbnail(p.imageUrl)!} alt="" loading="lazy" /> : <span className="muted small">No image</span>}
                </a>
                <div className="product-body">
                  <span className="muted small">{p.category}</span>
                  <h2 className="product-title">{p.title}</h2>
                  <div className="product-price">
                    {p.quotePrice !== null ? (
                      <>
                        <strong>{formatNaira(p.quotePrice)}</strong>
                        <span className="muted small">Microscale {formatNaira(p.price!)} + {p.markupPct}%</span>
                      </>
                    ) : <span className="muted">No price</span>}
                  </div>
                  <div>{p.inStock === false ? <Badge kind="bad">Out of stock</Badge> : <Badge kind="ok">In stock</Badge>}</div>
                </div>
                <AddToCart productRef={p.ref} title={p.title} inCart={p.inCart} disabled={p.price === null} />
              </li>
            ))}
          </ul>

          {shop.pages > 1 && (
            <nav className="pager" aria-label="Pages">
              {shop.page > 1 ? <Link className="btn" href={href({ page: String(shop.page - 1) })}>Previous</Link> : <span />}
              <span className="muted small">Page {shop.page} of {shop.pages}</span>
              {shop.page < shop.pages ? <Link className="btn" href={href({ page: String(shop.page + 1) })}>Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
