import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/store/Icon";
import { dateTime, naira } from "@/components/store/format";
import { getAdminProduct } from "@/lib/admin/products";
import { currentStaff } from "@/lib/auth";
import { FeaturedSwitch, MarkupInput, StockInput, VisibleSwitch } from "../ProductControls";

export const metadata = { title: "Product" };

export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getAdminProduct(Number((await params).id));
  if (!data) notFound();
  const { product: p, history, projects, description } = data;
  const owner = (await currentStaff())?.role === "owner";
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/admin/products">Products</Link> › {p.title}</nav>
      <div className="head">
        <div><h1 className="head__title">{p.title}</h1><p className="head__sub">{p.category} · {p.ref}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!p.hidden && p.ourPrice !== null && <a className="btn btn--secondary" href={`/shop/${p.id}-${p.slug}`} target="_blank" rel="noreferrer">View on store</a>}
          <a className="btn btn--secondary" href={p.supplierUrl} target="_blank" rel="noreferrer">View on Microscale <Icon name="arrow" /></a>
        </div>
      </div>
      <div className="layout">
        <div className="stack">
          <section className="panel" aria-labelledby="price-title">
            <div className="panel__head"><h2 className="panel__title" id="price-title">Price</h2></div>
            <div className="internal"><Icon name="lock" /><span>Staff only. Customers see only our price.</span></div>
            <div className="panel__body">
              <dl className="kv">
                <dt>Microscale price</dt><dd>{p.supplierPrice !== null ? naira(p.supplierPrice) : "No price (not sold on the store)"}{p.units > 1 ? ` for a pack of ${p.units}` : ""}</dd>
                <dt>Markup</dt><dd><MarkupInput refId={p.ref} value={p.markupPct} label={p.title} isDefault={p.markupSource === "default"} disabled={!owner} /> % <span className="stat__foot">({p.markupSource === "default" ? "default" : p.markupSource === "catalog" ? "from the Catalog" : "set for this product"})</span></dd>
                <dt>Our price</dt><dd><b>{p.ourPrice !== null ? naira(p.ourPrice) : "–"}</b> per unit</dd>
                <dt>Margin</dt><dd>{p.ourPrice !== null && p.supplierPrice !== null ? naira(p.ourPrice - p.supplierPrice / p.units) : "–"}</dd>
              </dl>
            </div>
          </section>
          <section className="panel" aria-labelledby="hist-title">
            <div className="panel__head"><h2 className="panel__title" id="hist-title">Price history</h2></div>
            <div className="panel__body">
              {history.length === 0 ? <p>Price history starts once the product is used in an order, a quotation or a kit.</p> : (
                <ol className="hist">{history.map((h, i) => <li key={i}><b>{naira(Number(h.price_ngn))}</b> {h.in_stock ? "in stock" : "out of stock"}<time>{dateTime(new Date(h.captured_at).toISOString())}</time></li>)}</ol>
              )}
            </div>
          </section>
          {description && (
            <section className="panel" aria-labelledby="desc-title">
              <div className="panel__head"><h2 className="panel__title" id="desc-title">Description on the store</h2></div>
              <div className="panel__body prose-desc" dangerouslySetInnerHTML={{ __html: description }} />
            </section>
          )}
        </div>
        <aside className="stack">
          <section className="panel" aria-labelledby="vis-title">
            <div className="panel__head"><h2 className="panel__title" id="vis-title">On the store</h2></div>
            <div className="panel__body" style={{ display: "grid", gap: 12 }}>
              <div className="switch-row"><span>Visible on the store</span><VisibleSwitch refId={p.ref} visible={!p.hidden} label={p.title} /></div>
              <div className="switch-row"><span>Show among popular products</span><FeaturedSwitch refId={p.ref} featured={p.featured} /></div>
              <p><span className={`stock ${p.supplierInStock === false ? "stock--out" : "stock--in"}`}>{p.supplierInStock === false ? "Out of stock at Microscale" : "In stock at Microscale"}</span></p>
              <div><span className="field__label">Our stock</span> <StockInput refId={p.ref} value={p.ourStock} label={p.title} /></div>
            </div>
          </section>
          <section className="panel" aria-labelledby="pj-title">
            <div className="panel__head"><h2 className="panel__title" id="pj-title">Used in projects</h2></div>
            <div className="panel__body">
              {projects.length === 0 ? <p>Not in any project kit.</p> : <ul>{projects.map((pr) => <li key={pr.id}><Link href={`/admin/projects/${pr.id}`}>{pr.title}</Link> × {pr.quantity}</li>)}</ul>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
