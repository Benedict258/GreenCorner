import Link from "next/link";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { listStock } from "@/lib/admin/products";
import { StockInput } from "../products/ProductControls";

export const metadata = { title: "Stock" };

export default async function StockPage() {
  const rows = await listStock();
  const value = rows.reduce((n, p) => n + (p.ourPrice ?? 0) * p.ourStock, 0);
  return (
    <>
      <div className="head">
        <div><h1 className="head__title">Stock</h1><p className="head__sub">What Waste2Light holds itself: {rows.length} product{rows.length === 1 ? "" : "s"}, worth {naira(value)} at our prices.</p></div>
        <Link className="btn btn--secondary" href="/admin/products"><Icon name="plus" />Add stock from Products</Link>
      </div>
      <p className="stat__foot">Products we hold can be bought even when Microscale is out of stock. Paid orders take from this stock first; the rest is bought from Microscale.</p>
      <section className="panel" aria-label="Stock">
        {rows.length === 0 ? <p className="adm-empty">No stock recorded yet. Set &quot;Our stock&quot; on any product in Products.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col" className="num">Our price</th><th scope="col">Quantity</th><th scope="col">Microscale</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.ref}>
                    <td><Link href={`/admin/products/${p.id}`}>{p.title}</Link>{p.ourStock <= 3 && <> <span className="adm-pill adm-pill--warn">Low</span></>}</td>
                    <td className="muted">{p.category}</td>
                    <td className="num">{p.ourPrice !== null ? naira(p.ourPrice) : "–"}</td>
                    <td><StockInput refId={p.ref} value={p.ourStock} label={p.title} /></td>
                    <td><span className={`stock ${p.supplierInStock === false ? "stock--out" : "stock--in"}`}>{p.supplierInStock === false ? "Out" : "In stock"}</span></td>
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
