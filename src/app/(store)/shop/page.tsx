import Link from "next/link";
import { ProductCard } from "@/components/store/Cards";
import { Icon } from "@/components/store/Icon";
import { AutoSubmitSelect, FiltersButton, StockToggle } from "@/components/store/ShopControls";
import { naira } from "@/components/store/format";
import { countProducts, listCategories, listProducts, PAGE_SIZE, SORTS, type SortKey } from "@/lib/store/catalog";

type Params = { q?: string; category?: string; stock?: string; min?: string; max?: string; sort?: string; page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  if (sp.q) return { title: `“${sp.q}” in the shop`, robots: { index: false } };
  if (sp.category) return { title: sp.category };
  return { title: "Shop all components" };
}

const toNum = (s?: string) => {
  const n = Number((s ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  // In stock only is on by default; "stock=all" turns it off.
  const inStockOnly = sp.stock !== "all";
  const sort = (SORTS.some(([k]) => k === sp.sort) ? sp.sort : "relevance") as SortKey;
  const min = toNum(sp.min);
  const max = toNum(sp.max);
  const [page, categories, all] = await Promise.all([
    listProducts({ q: sp.q, category: sp.category, inStockOnly, minPrice: min, maxPrice: max, sort, page: Number(sp.page) || 1 }),
    listCategories(),
    countProducts(),
  ]);

  const href = (p: Partial<Params>) => {
    const u = new URLSearchParams();
    const merged: Params = { q: sp.q, category: sp.category, stock: sp.stock, min: sp.min, max: sp.max, sort: sp.sort, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const first = (page.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page.page * PAGE_SIZE, page.total);
  const pages = pagerPages(page.page, page.pages);
  const hasFilters = !!(sp.q || sp.category || !inStockOnly || min || max);

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li>{sp.category || sp.q ? <Link href="/shop">Shop</Link> : <span aria-current="page">Shop</span>}</li>
          {sp.category && <li aria-current="page">{sp.category}</li>}
          {sp.q && !sp.category && <li aria-current="page">Search</li>}
        </ol>
      </nav>
      <div className="shop-head">
        <div>
          <h1 className="shop-head__title">{sp.q ? `Results for “${sp.q}”` : sp.category ?? "Shop all components"}</h1>
          <p className="shop-head__count">{page.total.toLocaleString("en-NG")} of {all.toLocaleString("en-NG")} products</p>
        </div>
      </div>
      <div className="shop">
        <aside className="filters" id="shop-filters" aria-label="Filters">
          <fieldset className="filters__group">
            <legend className="filters__legend">Category</legend>
            <Link className={`cat-link${!sp.category ? " cat-link--on" : ""}`} href={href({ category: undefined, page: undefined })} aria-current={!sp.category ? "true" : undefined}>
              <span>All categories</span><span className="cat-link__n">{all.toLocaleString("en-NG")}</span>
            </Link>
            {categories.map((c) => (
              <Link key={c.name} className={`cat-link${sp.category === c.name ? " cat-link--on" : ""}`} href={href({ category: c.name, page: undefined })} aria-current={sp.category === c.name ? "true" : undefined}>
                <span>{c.name}</span><span className="cat-link__n">{c.count.toLocaleString("en-NG")}</span>
              </Link>
            ))}
          </fieldset>
          <form action="/shop" className="filters__group" style={{ gap: 24 }}>
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
            <fieldset className="filters__group">
              <legend className="filters__legend">Availability</legend>
              <StockToggle checked={inStockOnly} />
            </fieldset>
            <fieldset className="filters__group">
              <legend className="filters__legend">Price range</legend>
              <div className="price-range">
                <div className="field"><label className="field__label" htmlFor="pmin">Min (₦)</label><input className="field__input" id="pmin" name="min" inputMode="numeric" defaultValue={min ? min.toLocaleString("en-NG") : ""} placeholder="0" /></div>
                <div className="field"><label className="field__label" htmlFor="pmax">Max (₦)</label><input className="field__input" id="pmax" name="max" inputMode="numeric" defaultValue={max ? max.toLocaleString("en-NG") : ""} placeholder="Any" /></div>
              </div>
              <button className="btn btn--secondary btn--block" type="submit" data-close-filters>Apply price</button>
            </fieldset>
          </form>
        </aside>
        <section aria-label="Products">
          <div className="toolbar">
            <FiltersButton target="shop-filters" />
            <form className="sort" action="/shop">
              {Object.entries({ q: sp.q, category: sp.category, stock: sp.stock, min: sp.min, max: sp.max }).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
              <span>Sort by</span>
              <label className="sr-only" htmlFor="sort">Sort products</label>
              <AutoSubmitSelect id="sort" name="sort" defaultValue={sort}>
                {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </AutoSubmitSelect>
              <noscript><button className="btn btn--secondary" type="submit">Sort</button></noscript>
            </form>
          </div>
          {hasFilters && (
            <div className="active" aria-label="Active filters">
              {sp.q && <span className="filter-chip">“{sp.q}”<Link href={href({ q: undefined, page: undefined })} aria-label="Remove search"><Icon name="close" /></Link></span>}
              {sp.category && <span className="filter-chip">{sp.category}<Link href={href({ category: undefined, page: undefined })} aria-label="Remove category filter"><Icon name="close" /></Link></span>}
              {inStockOnly ? (
                <span className="filter-chip">In stock only<Link href={href({ stock: "all", page: undefined })} aria-label="Remove in stock filter"><Icon name="close" /></Link></span>
              ) : (
                <span className="filter-chip">Including out of stock<Link href={href({ stock: undefined, page: undefined })} aria-label="Show in stock only"><Icon name="close" /></Link></span>
              )}
              {(min || max) && <span className="filter-chip">{min ? naira(min) : "₦0"} to {max ? naira(max) : "any"}<Link href={href({ min: undefined, max: undefined, page: undefined })} aria-label="Remove price filter"><Icon name="close" /></Link></span>}
              <Link className="active__clear" href="/shop">Clear all</Link>
            </div>
          )}
          {page.items.length === 0 ? (
            <div className="empty">
              <div className="empty__icon"><Icon name="search" /></div>
              <h2 className="empty__title">{sp.q ? `No components match “${sp.q}”.` : "No components match these filters."}</h2>
              <p className="empty__text">Check the spelling, or try fewer words. Can&apos;t find it? Ask us on WhatsApp, we may be able to source it.</p>
              <div className="empty__actions">
                <Link className="btn btn--primary" href="/shop">Clear filters</Link>
                <a className="btn btn--secondary" href="https://wa.me/2348078787646"><Icon name="whatsapp" />Ask on WhatsApp</a>
              </div>
            </div>
          ) : (
            <>
              <div className="product-grid">{page.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              {page.pages > 1 && (
                <nav className="pager" aria-label="Pagination">
                  <p className="pager__info">Showing {first.toLocaleString("en-NG")} to {last.toLocaleString("en-NG")} of {page.total.toLocaleString("en-NG")}</p>
                  <ul className="pager__list">
                    {page.page > 1 && <li><Link className="pager__link" href={href({ page: String(page.page - 1) })} rel="prev">Previous</Link></li>}
                    {pages.map((n, i) => n === null
                      ? <li key={`gap${i}`}><span className="pager__link" aria-hidden="true">…</span></li>
                      : <li key={n}><Link className="pager__link" href={href({ page: n === 1 ? undefined : String(n) })} aria-current={n === page.page ? "page" : undefined}>{n}</Link></li>)}
                    {page.page < page.pages && <li><Link className="pager__link" href={href({ page: String(page.page + 1) })} rel="next">Next</Link></li>}
                  </ul>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** 1 … 4 5 6 … 27 */
function pagerPages(current: number, total: number): (number | null)[] {
  const want = new Set([1, total, current - 1, current, current + 1]);
  const out: (number | null)[] = [];
  let prev = 0;
  for (let n = 1; n <= total; n++) {
    if (!want.has(n)) continue;
    if (n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
