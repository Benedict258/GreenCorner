import Link from "next/link";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { listAdminProducts } from "@/lib/admin/products";
import { currentStaff } from "@/lib/auth";
import { MarkupInput, StockInput, VisibleSwitch } from "./ProductControls";

export const metadata = { title: "Products" };

type Params = { q?: string; category?: string; visibility?: string; stock?: string; page?: string };

export default async function Products({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const owner = (await currentStaff())?.role === "owner";
  const data = await listAdminProducts({ q: sp.q, category: sp.category, visibility: (sp.visibility as "visible" | "hidden") || "", stock: (sp.stock as "ours" | "out") || "", page: Number(sp.page) || 1 });
  const href = (p: Partial<Params>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) u.set(k, String(v));
    return `/admin/products?${u}`;
  };
  return (
    <>
      <div className="head">
        <div><h1 className="head__title">Products</h1><p className="head__sub">{data.total.toLocaleString("en-NG")} products · prices follow Microscale, plus your markup (default {data.defaultMarkup}%)</p></div>
        <Link className="btn btn--secondary" href="/admin/sync"><Icon name="sync" />Sync</Link>
      </div>
      <form className="toolbar" action="/admin/products">
        <label className="search"><Icon name="search" /><span className="sr-only">Search products</span><input name="q" type="search" defaultValue={sp.q} placeholder="Search by name or SKU" /></label>
        <label className="sr-only" htmlFor="pcat">Category</label>
        <select className="select" id="pcat" name="category" defaultValue={sp.category ?? ""}>
          <option value="">All categories</option>
          {data.categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.n})</option>)}
        </select>
        <label className="sr-only" htmlFor="pvis">Visibility</label>
        <select className="select" id="pvis" name="visibility" defaultValue={sp.visibility ?? ""}><option value="">All visibility</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select>
        <label className="sr-only" htmlFor="pstock">Stock</label>
        <select className="select" id="pstock" name="stock" defaultValue={sp.stock ?? ""}><option value="">Any stock</option><option value="ours">In our stock</option><option value="out">Out at Microscale</option></select>
        <button className="btn btn--secondary" type="submit">Apply</button>
      </form>
      <section className="panel" aria-label="Products">
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Products with Microscale price, markup, our price and stock</caption>
            <thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col" className="num">Microscale price</th><th scope="col" className="num">Markup %</th><th scope="col" className="num">Our price</th><th scope="col">Microscale stock</th><th scope="col">Our stock</th><th scope="col">Visible</th></tr></thead>
            <tbody>
              {data.rows.map((p) => (
                <tr key={p.ref}>
                  <td>
                    <div className="pname">
                      <span className="pname__img">{p.image ? <img src={`${p.image}?w=80`} alt="" width={40} height={40} style={{ objectFit: "contain", width: "100%", height: "100%" }} /> : <Icon name="chip" />}</span>
                      <div><Link href={`/admin/products/${p.id}`}>{p.title}</Link><small>SKU {p.ref.split("#")[1] ?? p.ref}{p.units > 1 ? ` · pack of ${p.units}` : ""}</small></div>
                    </div>
                  </td>
                  <td className="muted">{p.category}</td>
                  <td className="num">{p.supplierPrice !== null ? naira(p.supplierPrice) : "No price"}</td>
                  <td className="num"><MarkupInput refId={p.ref} value={p.markupPct} label={p.title} isDefault={p.markupSource === "default"} disabled={!owner} /></td>
                  <td className="num price">{p.ourPrice !== null ? naira(p.ourPrice) : "–"}</td>
                  <td><span className={`stock ${p.supplierInStock === false ? "stock--out" : "stock--in"}`}>{p.supplierInStock === false ? "Out of stock" : "In stock"}</span></td>
                  <td><StockInput refId={p.ref} value={p.ourStock} label={p.title} /></td>
                  <td><VisibleSwitch refId={p.ref} visible={!p.hidden} label={p.title} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <span>Showing {((data.page - 1) * 50 + 1).toLocaleString("en-NG")} to {Math.min(data.page * 50, data.total).toLocaleString("en-NG")} of {data.total.toLocaleString("en-NG")}</span>
          <div className="pager__btns">
            {data.page > 1 && <Link className="pager__btn" href={href({ page: String(data.page - 1) })} aria-label="Previous page">‹</Link>}
            <span className="pager__btn" aria-current="page">{data.page}</span>
            {data.page < data.pages && <Link className="pager__btn" href={href({ page: String(data.page + 1) })} aria-label="Next page">›</Link>}
          </div>
        </div>
      </section>
      {!owner && <p className="stat__foot">Only an owner can change markups.</p>}
    </>
  );
}
