import { query, queryOne } from "../db";
import { unitPrice, type Supplier } from "../pricing";

// The public catalog. Everything here is safe to show a customer: our price only, never the
// supplier's price, name, link, handle or stock code. Admin-only views read the same rows through
// the admin product helpers instead.

export const SUPPLIER: Supplier = "microscale";
export const PAGE_SIZE = 48;
export const DEFAULT_MARKUP = 10;
export const LOW_STOCK = 3;

export type Availability = "in" | "low" | "out";

export interface StoreProduct {
  id: number;
  slug: string;
  ref: string;
  title: string;
  category: string;
  image: string | null; // our own image URL (/img/p/<id>/0), never the supplier CDN
  imageCount: number;
  price: number; // whole naira, what the customer pays per unit
  availability: Availability;
  ourStock: number;
  featured: boolean;
}

export interface StoreProductDetail extends StoreProduct {
  description: string;
  images: string[];
}

export function slugify(s: string): string {
  return s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

export function productPath(p: { id: number; slug: string }): string {
  return `/shop/${p.id}-${p.slug}`;
}

/** "/shop/123-arduino-uno" -> 123 */
export function idFromSlug(param: string): number | null {
  const m = /^(\d+)(?:-|$)/.exec(param);
  return m ? Number(m[1]) : null;
}

export function productImage(id: number, index = 0): string {
  return `/img/p/${id}/${index}`;
}

export async function defaultMarkup(): Promise<number> {
  const row = await queryOne("select value from settings where key = 'default_markup_pct'");
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MARKUP;
}

// The markup used for a product: set on the product in admin, else on its Catalog component, else the default.
// $1 is always the default markup.
const FROM = `
  from supplier_products p
  left join product_settings ps on ps.supplier = p.supplier and ps.ref = p.ref
  left join lateral (
    select l.units_per_listing, c.markup_pct from supplier_listings l join components c on c.id = l.component_id
    where l.supplier = p.supplier and l.supplier_ref = p.ref order by l.id limit 1
  ) lc on true
  left join stock s on s.supplier = p.supplier and s.ref = p.ref`;
// $1 (the default markup) is referenced here so every query that filters on PUBLIC can pass it.
const PUBLIC = `p.price_ngn is not null and not coalesce(ps.hidden, false) and $1::numeric >= 0`;
const MARKUP = `coalesce(ps.markup_pct, lc.markup_pct, $1)`;
const PRICE_SQL = `round(p.price_ngn * (100 + ${MARKUP}) / 100 / coalesce(lc.units_per_listing, 1))`;
const COLUMNS = `p.id, p.ref, p.supplier, p.title, p.category, p.image_url, jsonb_array_length(p.images) as image_count,
  p.price_ngn, p.in_stock, coalesce(lc.units_per_listing, 1) as units, ${MARKUP} as markup_pct,
  coalesce(s.quantity, 0) as our_stock, coalesce(ps.featured, false) as featured`;

export function availability(supplierInStock: boolean | null, ourStock: number): Availability {
  if (supplierInStock !== false) return "in";
  if (ourStock > LOW_STOCK) return "in";
  if (ourStock > 0) return "low";
  return "out";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProduct(r: any): StoreProduct {
  return {
    id: Number(r.id),
    slug: slugify(r.title),
    ref: r.ref,
    title: r.title,
    category: r.category,
    image: r.image_url ? productImage(Number(r.id)) : null,
    imageCount: Math.max(r.image_count ?? 0, r.image_url ? 1 : 0),
    price: unitPrice(r.price_ngn, r.units, r.markup_pct),
    availability: availability(r.in_stock, r.our_stock),
    ourStock: r.our_stock,
    featured: r.featured,
  };
}

export type SortKey = "relevance" | "price-asc" | "price-desc" | "newest" | "name";
export const SORTS: [SortKey, string][] = [
  ["relevance", "Relevance"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["newest", "Newest"],
  ["name", "A to Z"],
];

export interface ProductFilter {
  q?: string;
  category?: string;
  inStockOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  page?: number;
}

export interface ProductPage {
  items: StoreProduct[];
  total: number;
  page: number;
  pages: number;
}

function filterSql(f: ProductFilter, params: unknown[]): string {
  const where = [`p.supplier = '${SUPPLIER}'`, PUBLIC];
  const q = f.q?.trim();
  if (q) {
    // Every word must appear in the title (searching stock codes would reveal the supplier's).
    for (const word of q.split(/\s+/).slice(0, 6)) {
      params.push(`%${word.replace(/[%_\\]/g, "\\$&")}%`);
      where.push(`p.title ilike $${params.length}`);
    }
  }
  if (f.category) {
    params.push(f.category);
    where.push(`p.category = $${params.length}`);
  }
  if (f.inStockOnly) where.push(`(p.in_stock is not false or coalesce(s.quantity, 0) > 0)`);
  if (f.minPrice && f.minPrice > 0) {
    params.push(f.minPrice);
    where.push(`${PRICE_SQL} >= $${params.length}`);
  }
  if (f.maxPrice && f.maxPrice > 0) {
    params.push(f.maxPrice);
    where.push(`${PRICE_SQL} <= $${params.length}`);
  }
  return where.join(" and ");
}

function orderSql(sort: SortKey | undefined, queryParam: number): string {
  switch (sort) {
    case "price-asc": return `${PRICE_SQL} asc, p.position`;
    case "price-desc": return `${PRICE_SQL} desc, p.position`;
    case "newest": return "p.id desc";
    case "name": return "lower(p.title), p.position";
    default:
      // In stock first, then the supplier's own order (roughly its newest and most popular first).
      return `${queryParam ? `position(lower($${queryParam}::text) in lower(p.title)) = 0, ` : ""}(p.in_stock is false and coalesce(s.quantity, 0) = 0), p.position`;
  }
}

export async function listProducts(f: ProductFilter): Promise<ProductPage> {
  const markup = await defaultMarkup();
  const params: unknown[] = [markup];
  const q = f.q?.trim();
  const where = filterSql(f, params);
  const count = await queryOne(`select count(*)::int as n ${FROM} where ${where}`, params);
  // The search words rank exact title matches first; that parameter goes last so the count query does not need it.
  const relevance = !!q && (!f.sort || f.sort === "relevance");
  if (relevance) params.push(q);
  const total = count?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(f.page ?? 1)), pages);
  const rows = await query(
    `select ${COLUMNS} ${FROM} where ${where} order by ${orderSql(f.sort, relevance ? params.length : 0)}
     limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    params,
  );
  return { items: rows.map(toProduct), total, page, pages };
}

export interface CategoryCount {
  name: string;
  count: number;
}

export async function listCategories(): Promise<CategoryCount[]> {
  const markup = await defaultMarkup();
  return query(
    `select p.category as name, count(*)::int as count ${FROM} where p.supplier = '${SUPPLIER}' and ${PUBLIC}
     group by p.category order by count(*) desc, p.category`,
    [markup],
  );
}

export async function countProducts(): Promise<number> {
  const markup = await defaultMarkup();
  return (await queryOne(`select count(*)::int as n ${FROM} where p.supplier = '${SUPPLIER}' and ${PUBLIC}`, [markup]))?.n ?? 0;
}

export async function getProduct(id: number): Promise<StoreProductDetail | null> {
  const markup = await defaultMarkup();
  const r = await queryOne(`select ${COLUMNS}, p.description, p.images ${FROM} where p.id = $2 and ${PUBLIC}`, [markup, id]);
  if (!r) return null;
  const p = toProduct(r);
  const n = Array.isArray(r.images) && r.images.length ? r.images.length : r.image_url ? 1 : 0;
  return { ...p, description: r.description ?? "", images: Array.from({ length: n }, (_, i) => productImage(p.id, i)) };
}

/** Products by ref, for carts, kits and orders. Hidden or unpriced products come back as missing. */
export async function getProductsByRef(refs: string[]): Promise<Map<string, StoreProduct & { supplierPrice: number; units: number; markupPct: number; supplierInStock: boolean | null }>> {
  const out = new Map();
  if (refs.length === 0) return out;
  const markup = await defaultMarkup();
  const rows = await query(`select ${COLUMNS} ${FROM} where p.supplier = '${SUPPLIER}' and p.ref = any($2::text[]) and ${PUBLIC}`, [markup, refs]);
  for (const r of rows) out.set(r.ref, { ...toProduct(r), supplierPrice: r.price_ngn, units: r.units, markupPct: r.markup_pct, supplierInStock: r.in_stock });
  return out;
}

export async function featuredProducts(limit = 8): Promise<StoreProduct[]> {
  const markup = await defaultMarkup();
  const rows = await query(
    `select ${COLUMNS} ${FROM} where p.supplier = '${SUPPLIER}' and ${PUBLIC} and p.image_url is not null
       and (p.in_stock is not false or coalesce(s.quantity, 0) > 0)
     order by coalesce(ps.featured, false) desc, (p.price_ngn between 500 and 30000) desc, p.position limit $2`,
    [markup, limit],
  );
  return rows.map(toProduct);
}

export async function relatedProducts(p: StoreProduct, limit = 4): Promise<StoreProduct[]> {
  const markup = await defaultMarkup();
  const rows = await query(
    `select ${COLUMNS} ${FROM} where p.supplier = '${SUPPLIER}' and ${PUBLIC} and p.category = $2 and p.id <> $3
       and (p.in_stock is not false or coalesce(s.quantity, 0) > 0)
     order by p.position limit $4`,
    [markup, p.category, p.id, limit],
  );
  return rows.map(toProduct);
}

/** Search suggestions for the header search box. */
export async function suggest(q: string, limit = 6): Promise<{ id: number; slug: string; title: string; price: number; image: string | null }[]> {
  if (q.trim().length < 2) return [];
  const page = await listProducts({ q, page: 1 });
  return page.items.slice(0, limit).map((p) => ({ id: p.id, slug: p.slug, title: p.title, price: p.price, image: p.image }));
}

/** Supplier image address for our image route. Never sent to the browser. */
export async function productImageSource(id: number, index: number): Promise<string | null> {
  const r = await queryOne(
    `select p.image_url, p.images from supplier_products p left join product_settings ps on ps.supplier = p.supplier and ps.ref = p.ref
     where p.id = $1 and not coalesce(ps.hidden, false)`,
    [id],
  );
  if (!r) return null;
  const list: string[] = Array.isArray(r.images) && r.images.length ? r.images : r.image_url ? [r.image_url] : [];
  return list[index] ?? null;
}

export const CATEGORY_ICONS: [RegExp, string][] = [
  [/board|arduino|microcontroller/i, "board"],
  [/sensor/i, "sensor"],
  [/power|solar|batter/i, "sun"],
  [/led|display|light/i, "led"],
  [/electromech|motor/i, "motor"],
  [/module|radio|wireless|rf/i, "wifi"],
  [/tool|accessor|programmer/i, "tools"],
  [/prototyp|wire|connector|breadboard/i, "wire"],
  [/kit|forge/i, "box"],
  [/integrated|component|ic\b/i, "chip"],
];

export function categoryIcon(name: string): string {
  return CATEGORY_ICONS.find(([re]) => re.test(name))?.[1] ?? "box";
}
