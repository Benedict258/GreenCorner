import { query, queryOne, tx } from "./db";
import { unitPrice, type Supplier } from "./pricing";
import { MICROSCALE_ORIGIN, splitMicroscaleRef } from "./sync/microscale";

// The Shop lists the whole Microscale feed (stored by each full sync in supplier_products).
// Adding a product to the cart turns it into a component with a linked listing, so quotes,
// bundles, price safeguards and saved-price snapshots all work exactly as for hand-made components.
const SUPPLIER: Supplier = "microscale";
export const PAGE_SIZE = 48;
const DEFAULT_MARKUP = 10; // the components.markup_pct column default
const MAX_QTY = 100000;

export interface ShopItem {
  ref: string;
  title: string;
  category: string;
  imageUrl: string | null;
  price: number | null; // Microscale price
  inStock: boolean | null;
  url: string;
  componentId: number | null;
  quotePrice: number | null; // per unit, with markup: what a quote line would charge
  markupPct: number;
  inCart: number;
}

export interface ShopFilter {
  q?: string;
  category?: string;
  inStockOnly?: boolean;
  page?: number;
}

export interface ShopPage {
  items: ShopItem[];
  total: number;
  page: number;
  pages: number;
  categories: { name: string; count: number }[];
  updatedAt: string | null;
}

export async function loadShop(f: ShopFilter): Promise<ShopPage> {
  const where = ["p.supplier = $1"];
  const params: unknown[] = [SUPPLIER];
  if (f.q?.trim()) {
    params.push(`%${f.q.trim().replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(p.title ilike $${params.length} or p.ref ilike $${params.length})`);
  }
  if (f.category) {
    params.push(f.category);
    where.push(`p.category = $${params.length}`);
  }
  if (f.inStockOnly) where.push("p.in_stock is not false");
  const w = where.join(" and ");

  const [countRow, categories, meta] = await Promise.all([
    queryOne(`select count(*)::int as n from supplier_products p where ${w}`, params),
    query("select category as name, count(*)::int as count from supplier_products where supplier = $1 group by category order by lower(category)", [SUPPLIER]),
    queryOne("select max(seen_at) as at from supplier_products where supplier = $1", [SUPPLIER]),
  ]);
  const total = countRow?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(f.page ?? 1)), pages);

  const rows = await query(
    `select p.*, c.id as component_id, c.markup_pct, l.units_per_listing, ci.quantity as in_cart
     from supplier_products p
     left join supplier_listings l on l.supplier = p.supplier and l.supplier_ref = p.ref
     left join components c on c.id = l.component_id
     left join cart_items ci on ci.component_id = c.id
     where ${w} order by p.position limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    params,
  );
  const items = rows.map((r): ShopItem => {
    const markupPct = r.component_id ? r.markup_pct : DEFAULT_MARKUP;
    return {
      ref: r.ref,
      title: r.title,
      category: r.category,
      imageUrl: r.image_url,
      price: r.price_ngn,
      inStock: r.in_stock,
      url: `${MICROSCALE_ORIGIN}/products/${splitMicroscaleRef(r.ref).handle}`,
      componentId: r.component_id,
      quotePrice: r.price_ngn !== null ? unitPrice(r.price_ngn, r.units_per_listing ?? 1, markupPct) : null,
      markupPct,
      inCart: r.in_cart ?? 0,
    };
  });
  return { items, total, page, pages, categories, updatedAt: meta?.at ? new Date(meta.at).toISOString() : null };
}

/**
 * Puts a Shop product in the cart. The first time a product is picked it becomes a component with a
 * Microscale listing priced from the feed (the same price a first sync would accept).
 */
export async function addToCart(ref: string, quantity: number): Promise<{ componentId: number; name: string }> {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) throw new Error("Quantity must be a whole number of at least 1.");
  return tx(async (c) => {
    const p = (await c.query("select * from supplier_products where supplier = $1 and ref = $2", [SUPPLIER, ref])).rows[0];
    if (!p) throw new Error("That product is no longer in the Microscale catalog. Refresh the page.");
    const linked = (await c.query("select component_id from supplier_listings where supplier = $1 and supplier_ref = $2 order by id limit 1", [SUPPLIER, ref])).rows[0];
    let componentId: number;
    let name: string;
    if (linked) {
      componentId = linked.component_id;
      // Picking it in the Shop means it is wanted again, even if it was deactivated in the Catalog.
      name = (await c.query("update components set active = true where id = $1 returning name", [componentId])).rows[0].name;
    } else {
      name = String(p.title).slice(0, 200);
      componentId = (await c.query("insert into components (name, category) values ($1, $2) returning id", [name, p.category])).rows[0].id;
      const priced = p.price_ngn !== null;
      const listing = (await c.query(
        `insert into supplier_listings (component_id, supplier, supplier_ref, title, price_ngn, in_stock, status, last_synced_at, last_changed_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
        [componentId, SUPPLIER, ref, p.title, p.price_ngn, p.in_stock ?? true, priced ? "ok" : "pending", priced ? p.seen_at : null, priced ? p.seen_at : null],
      )).rows[0];
      if (priced) await c.query("insert into price_history (listing_id, price_ngn, in_stock) values ($1, $2, $3)", [listing.id, p.price_ngn, p.in_stock ?? true]);
    }
    await c.query(
      `insert into cart_items (component_id, quantity) values ($1, $2)
       on conflict (component_id) do update set quantity = least(cart_items.quantity + excluded.quantity, ${MAX_QTY})`,
      [componentId, qty],
    );
    return { componentId, name };
  });
}

export interface CartLine {
  componentId: number;
  quantity: number;
  imageUrl: string | null;
}

/** Cart lines in the order they were added, with the product image when the Shop has one. */
export async function loadCart(): Promise<CartLine[]> {
  const rows = await query(
    `select ci.component_id, ci.quantity,
       (select p.image_url from supplier_listings l join supplier_products p on p.supplier = l.supplier and p.ref = l.supplier_ref
        where l.component_id = ci.component_id limit 1) as image_url
     from cart_items ci order by ci.added_at, ci.component_id`,
  );
  return rows.map((r) => ({ componentId: r.component_id, quantity: r.quantity, imageUrl: r.image_url }));
}

export async function cartCount(): Promise<number> {
  return (await queryOne("select count(*)::int as n from cart_items"))?.n ?? 0;
}

export async function setCartQuantity(componentId: number, quantity: number): Promise<void> {
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 0 || qty > MAX_QTY) throw new Error("Quantity must be a whole number.");
  if (qty === 0) await query("delete from cart_items where component_id = $1", [componentId]);
  else await query("update cart_items set quantity = $2 where component_id = $1", [componentId, qty]);
}

export async function clearCart(): Promise<void> {
  await query("delete from cart_items");
}

/** Shop thumbnails: Shopify's CDN resizes on request, so ask for a small image instead of the full-size one. */
export function thumbnail(url: string | null, width = 360): string | null {
  if (!url) return null;
  if (!/(^|\.)cdn\.shopify\.com$/i.test(safeHost(url))) return url;
  return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
