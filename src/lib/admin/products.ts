import { query, queryOne, tx } from "../db";
import { unitPrice } from "../pricing";
import { defaultMarkup, slugify, SUPPLIER } from "../store/catalog";
import { MICROSCALE_ORIGIN, splitMicroscaleRef } from "../sync/microscale";

// Admin view of the catalog: our price next to the supplier's price, markup, stock and visibility.

export interface AdminProduct {
  id: number;
  ref: string;
  title: string;
  category: string;
  image: string | null;
  supplierPrice: number | null;
  units: number;
  markupPct: number;
  markupSource: "product" | "catalog" | "default";
  ourPrice: number | null;
  supplierInStock: boolean | null;
  ourStock: number;
  hidden: boolean;
  featured: boolean;
  supplierUrl: string;
  componentId: number | null;
  slug: string;
}

export interface AdminProductFilter {
  q?: string;
  category?: string;
  visibility?: "visible" | "hidden" | "";
  stock?: "ours" | "out" | "";
  page?: number;
}

const BASE = `
  from supplier_products p
  left join product_settings ps on ps.supplier = p.supplier and ps.ref = p.ref
  left join lateral (
    select l.units_per_listing, c.markup_pct, c.id as component_id from supplier_listings l join components c on c.id = l.component_id
    where l.supplier = p.supplier and l.supplier_ref = p.ref order by l.id limit 1
  ) lc on true
  left join stock s on s.supplier = p.supplier and s.ref = p.ref`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdmin(r: any, def: number): AdminProduct {
  const markupPct = r.ps_markup ?? r.markup_pct ?? def;
  const units = r.units_per_listing ?? 1;
  return {
    id: Number(r.id),
    ref: r.ref,
    title: r.title,
    category: r.category,
    image: r.image_url ? `/img/p/${r.id}/0` : null,
    supplierPrice: r.price_ngn,
    units,
    markupPct: Number(markupPct),
    markupSource: r.ps_markup !== null && r.ps_markup !== undefined ? "product" : r.markup_pct !== null && r.markup_pct !== undefined ? "catalog" : "default",
    ourPrice: r.price_ngn !== null ? unitPrice(r.price_ngn, units, Number(markupPct)) : null,
    supplierInStock: r.in_stock,
    ourStock: r.our_stock ?? 0,
    hidden: !!r.hidden,
    featured: !!r.featured,
    supplierUrl: `${MICROSCALE_ORIGIN}/products/${splitMicroscaleRef(r.ref).handle}`,
    componentId: r.component_id ?? null,
    slug: slugify(r.title),
  };
}

const COLS = "p.*, ps.markup_pct as ps_markup, ps.hidden, ps.featured, lc.units_per_listing, lc.markup_pct, lc.component_id, coalesce(s.quantity, 0) as our_stock";

export async function listAdminProducts(f: AdminProductFilter, pageSize = 50) {
  const def = await defaultMarkup();
  const where = [`p.supplier = '${SUPPLIER}'`];
  const params: unknown[] = [];
  if (f.q?.trim()) { params.push(`%${f.q.trim()}%`); where.push(`(p.title ilike $${params.length} or p.ref ilike $${params.length})`); }
  if (f.category) { params.push(f.category); where.push(`p.category = $${params.length}`); }
  if (f.visibility === "hidden") where.push("coalesce(ps.hidden, false)");
  if (f.visibility === "visible") where.push("not coalesce(ps.hidden, false)");
  if (f.stock === "ours") where.push("coalesce(s.quantity, 0) > 0");
  if (f.stock === "out") where.push("p.in_stock is false");
  const w = where.join(" and ");
  const total = (await queryOne(`select count(*)::int as n ${BASE} where ${w}`, params))?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  const rows = await query(`select ${COLS} ${BASE} where ${w} order by p.position limit ${pageSize} offset ${(page - 1) * pageSize}`, params);
  const categories = await query(`select category as name, count(*)::int as n from supplier_products where supplier = '${SUPPLIER}' group by 1 order by 1`);
  return { rows: rows.map((r) => toAdmin(r, def)), total, page, pages, categories, defaultMarkup: def };
}

export async function getAdminProduct(id: number) {
  const def = await defaultMarkup();
  const r = await queryOne(`select ${COLS} ${BASE} where p.id = $1`, [id]);
  if (!r) return null;
  const history = r.component_id
    ? await query(
        `select h.price_ngn, h.in_stock, h.captured_at from price_history h join supplier_listings l on l.id = h.listing_id
         where l.component_id = $1 and l.supplier = $2 order by h.captured_at desc limit 20`,
        [r.component_id, SUPPLIER],
      )
    : [];
  const projects = await query("select p.id, p.title, i.quantity from project_items i join projects p on p.id = i.project_id where i.supplier = $1 and i.ref = $2 order by p.title", [SUPPLIER, r.ref]);
  return { product: toAdmin(r, def), description: r.description as string, history, projects };
}

/** Markup for one product. It also updates its Catalog component, so quotations price it the same way. Null = back to the default. */
export async function setMarkup(ref: string, markupPct: number | null): Promise<void> {
  if (markupPct !== null && (!Number.isFinite(markupPct) || markupPct < 0 || markupPct > 1000)) throw new Error("Markup must be between 0 and 1000%.");
  await tx(async (c) => {
    await c.query(
      `insert into product_settings (supplier, ref, markup_pct) values ($1, $2, $3)
       on conflict (supplier, ref) do update set markup_pct = excluded.markup_pct, updated_at = now()`,
      [SUPPLIER, ref, markupPct],
    );
    const def = Number((await c.query("select value from settings where key = 'default_markup_pct'")).rows[0]?.value ?? 10);
    await c.query(
      "update components set markup_pct = $3 where id in (select component_id from supplier_listings where supplier = $1 and supplier_ref = $2)",
      [SUPPLIER, ref, markupPct ?? def],
    );
  });
}

export async function setVisibility(ref: string, hidden: boolean): Promise<void> {
  await query(
    `insert into product_settings (supplier, ref, hidden) values ($1, $2, $3)
     on conflict (supplier, ref) do update set hidden = excluded.hidden, updated_at = now()`,
    [SUPPLIER, ref, hidden],
  );
}

export async function setFeatured(ref: string, featured: boolean): Promise<void> {
  await query(
    `insert into product_settings (supplier, ref, featured) values ($1, $2, $3)
     on conflict (supplier, ref) do update set featured = excluded.featured, updated_at = now()`,
    [SUPPLIER, ref, featured],
  );
}

export async function setStock(ref: string, quantity: number): Promise<void> {
  const q = Math.floor(quantity);
  if (!Number.isFinite(q) || q < 0 || q > 1_000_000) throw new Error("Stock must be a whole number, 0 or more.");
  if (q === 0) await query("delete from stock where supplier = $1 and ref = $2", [SUPPLIER, ref]);
  else await query("insert into stock (supplier, ref, quantity) values ($1, $2, $3) on conflict (supplier, ref) do update set quantity = excluded.quantity, updated_at = now()", [SUPPLIER, ref, q]);
}

export async function listStock() {
  const def = await defaultMarkup();
  const rows = await query(`select ${COLS} ${BASE} where s.quantity > 0 order by p.title`);
  return rows.map((r) => toAdmin(r, def));
}
