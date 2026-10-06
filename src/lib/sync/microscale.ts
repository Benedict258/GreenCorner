import type { SupplierAdapter } from "./adapters";
import { parsePrice, userAgent, type Fetcher, type Observation, type ShopProduct, type SupplierSearchHit } from "./types";

export const MICROSCALE_ORIGIN = "https://www.microscale.net";
const FEED_CACHE_MS = 10 * 60_000;

interface ShopifyVariant {
  id?: number;
  sku?: string | null;
  title?: string;
  price?: string | number;
  available?: boolean;
  featured_image?: { src?: string } | null;
}
interface ShopifyProduct {
  id?: number;
  handle?: string;
  title?: string;
  product_type?: string;
  images?: { src?: string }[];
  variants?: ShopifyVariant[];
}

/**
 * Ref format: "<handle>#<sku>". A variant with no SKU gets "<handle>#id:<variantId>".
 * A bare "<handle>" means the product's first variant.
 */
export function makeMicroscaleRef(handle: string, sku?: string | null, variantId?: number): string {
  if (sku) return `${handle}#${sku}`;
  if (variantId !== undefined) return `${handle}#id:${variantId}`;
  return handle;
}

export function splitMicroscaleRef(ref: string): { handle: string; sku: string | null } {
  const i = ref.indexOf("#");
  return i === -1 ? { handle: ref, sku: null } : { handle: ref.slice(0, i), sku: ref.slice(i + 1) || null };
}

/**
 * One observation per variant, plus a handle-only ref for the first variant.
 * A ref that appears more than once in the feed is ambiguous, so its price is set to null:
 * the safeguards then refuse to write it instead of guessing which variant was meant.
 */
export function parseProductsJson(json: unknown): Observation[] {
  const products = (json as { products?: ShopifyProduct[] })?.products;
  if (!Array.isArray(products)) throw new Error("Microscale feed: missing products array");
  const out: Observation[] = [];
  for (const p of products) {
    if (!p.handle || !Array.isArray(p.variants)) continue;
    const variants = p.variants;
    variants.forEach((v, i) => {
      const multi = variants.length > 1;
      const title = multi && v.title && v.title !== "Default Title" ? `${p.title} (${v.title})` : String(p.title ?? p.handle);
      const inStock = typeof v.available === "boolean" ? v.available : null;
      const price = parsePrice(v.price);
      out.push({ ref: makeMicroscaleRef(p.handle as string, v.sku, v.id), title, price, inStock });
      if (i === 0) out.push({ ref: makeMicroscaleRef(p.handle as string), title, price, inStock });
    });
  }
  const seen = new Map<string, number>();
  for (const o of out) seen.set(o.ref, (seen.get(o.ref) ?? 0) + 1);
  return out.map((o) => ((seen.get(o.ref) ?? 0) > 1 ? { ...o, price: null } : o));
}

/**
 * One Shop row per variant, in feed order, for browsing the whole catalog. Uses the same refs as
 * parseProductsJson (never the handle-only alias) and the same rule for ambiguous refs: no price.
 */
export function parseShopProducts(json: unknown, startPosition = 0): ShopProduct[] {
  const products = (json as { products?: ShopifyProduct[] })?.products;
  if (!Array.isArray(products)) throw new Error("Microscale feed: missing products array");
  const out: ShopProduct[] = [];
  for (const p of products) {
    if (!p.handle || !Array.isArray(p.variants)) continue;
    const multi = p.variants.length > 1;
    for (const v of p.variants) {
      out.push({
        ref: makeMicroscaleRef(p.handle, v.sku, v.id),
        handle: p.handle,
        title: multi && v.title && v.title !== "Default Title" ? `${p.title} (${v.title})` : String(p.title ?? p.handle),
        category: p.product_type?.trim() || "Other",
        imageUrl: v.featured_image?.src || p.images?.[0]?.src || null,
        price: parsePrice(v.price),
        inStock: typeof v.available === "boolean" ? v.available : null,
        position: startPosition + out.length,
      });
    }
  }
  return out;
}

/** A ref seen more than once is ambiguous: keep one row, without a price, as parseProductsJson does. */
function dedupeShop(rows: ShopProduct[]): ShopProduct[] {
  const byRef = new Map<string, ShopProduct>();
  for (const r of rows) {
    const prev = byRef.get(r.ref);
    byRef.set(r.ref, prev ? { ...prev, price: null } : r);
  }
  return [...byRef.values()];
}

export interface MicroscaleFeed {
  observations: Observation[];
  products: ShopProduct[];
}

/** Pages through /products.json until a page comes back empty. One pass, no per-product requests. */
export async function fetchMicroscaleFeed(
  fetchFn: Fetcher = fetch,
  opts: { maxPages?: number; onPage?: (page: number, count: number) => void } = {},
): Promise<Observation[]> {
  return (await fetchMicroscaleCatalog(fetchFn, opts)).observations;
}

/** The same single pass as fetchMicroscaleFeed, also keeping every variant for the Shop. */
export async function fetchMicroscaleCatalog(
  fetchFn: Fetcher = fetch,
  opts: { maxPages?: number; onPage?: (page: number, count: number) => void } = {},
): Promise<MicroscaleFeed> {
  const max = opts.maxPages ?? 100;
  const all: Observation[] = [];
  const products: ShopProduct[] = [];
  let prevFirstId: unknown = null;
  for (let page = 1; page <= max; page++) {
    const res = await fetchFn(`${MICROSCALE_ORIGIN}/products.json?limit=250&page=${page}`, {
      headers: { "user-agent": userAgent(), accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Microscale feed page ${page}: HTTP ${res.status}`);
    const json = await res.json();
    const pageProducts = (json as { products?: ShopifyProduct[] }).products;
    if (!Array.isArray(pageProducts)) throw new Error(`Microscale feed page ${page}: missing products array`);
    if (pageProducts.length === 0) return { observations: all, products: dedupeShop(products) };
    // If the shop ignored the page parameter we would loop on the same page; stop loudly instead.
    const firstId = pageProducts[0].id ?? pageProducts[0].handle;
    if (page > 1 && firstId !== undefined && firstId === prevFirstId) {
      throw new Error(`Microscale feed page ${page} repeats page ${page - 1}; refusing to continue`);
    }
    prevFirstId = firstId;
    all.push(...parseProductsJson(json));
    products.push(...parseShopProducts(json, products.length));
    opts.onPage?.(page, pageProducts.length);
  }
  throw new Error(`Microscale feed: still returning products after ${max} pages`);
}

/** Pull the handle out of a pasted Microscale product URL. */
export function microscaleHandleFromUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (!/(^|\.)microscale\.net$/i.test(u.hostname)) return null;
    const m = /\/products\/([^/?#]+)/.exec(u.pathname);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

let feedCache: { at: number; feed: MicroscaleFeed } | null = null;

async function cachedFeed(fetchFn: Fetcher, maxAgeMs: number, onPage?: (p: number, n: number) => void): Promise<MicroscaleFeed> {
  if (feedCache && Date.now() - feedCache.at < maxAgeMs) return feedCache.feed;
  const feed = await fetchMicroscaleCatalog(fetchFn, { onPage });
  feedCache = { at: Date.now(), feed };
  return feed;
}

export function clearMicroscaleCache(): void {
  feedCache = null;
}

/** In-app search reads the same public feed (cached 10 min); pasting a product URL lists that product's variants. */
export async function searchMicroscale(q: string, fetchFn: Fetcher = fetch): Promise<SupplierSearchHit[]> {
  const handle = microscaleHandleFromUrl(q);
  if (/^https?:\/\//i.test(q.trim()) && !handle) {
    throw new Error("That is not a Microscale product URL (it should look like https://www.microscale.net/products/name)");
  }
  const feed = (await cachedFeed(fetchFn, FEED_CACHE_MS)).observations;
  const needle = q.trim().toLowerCase();
  const hits = feed.filter((o) => {
    if (!o.ref.includes("#")) return false; // list each variant once; handle-only refs duplicate the first variant
    if (handle) return o.ref.startsWith(`${handle}#`);
    return o.title.toLowerCase().includes(needle) || o.ref.toLowerCase().includes(needle);
  });
  return hits.slice(0, 25).map((o) => ({
    supplier: "microscale" as const,
    ref: o.ref,
    title: o.title,
    price: o.price,
    inStock: o.inStock,
    url: `${MICROSCALE_ORIGIN}/products/${o.ref.split("#")[0]}`,
  }));
}

export const microscaleAdapter: SupplierAdapter = {
  id: "microscale",
  async observe(refs, ctx) {
    const feed = await cachedFeed(ctx.fetchFn ?? fetch, ctx.allowCache ? FEED_CACHE_MS : 0, (p, n) => ctx.log(`Feed page ${p}: ${n} products.`));
    ctx.onProducts?.(feed.products);
    const byRef = new Map(feed.observations.map((o) => [o.ref, o]));
    const out = new Map<string, Observation | Error>();
    for (const ref of refs) {
      const o = byRef.get(ref);
      if (o) out.set(ref, o);
    }
    return out;
  },
  search: searchMicroscale,
  normalizeRef(input) {
    const ref = input.trim();
    return /^[a-z0-9][a-z0-9-_.]*(#.+)?$/i.test(ref) ? ref : null;
  },
  invalidRefMessage: "That is not a valid Microscale listing. Pick one from the search results.",
};
