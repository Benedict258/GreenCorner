// The Shop's view of the Microscale feed: every variant once, with the same refs and prices the sync uses.
// Runs on the real captured pages when present, and always on the hand-written sample.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchMicroscaleCatalog, parseProductsJson, parseShopProducts } from "../src/lib/sync/microscale";
import { thumbnail } from "../src/lib/shop";

const realDir = new URL("./fixtures/real/", import.meta.url);
const realPages = existsSync(realDir)
  ? readdirSync(realDir).filter((f) => /^microscale-.*\.json$/.test(f)).sort().map((f) => readFileSync(new URL(f, realDir), "utf8"))
  : [];
const sample = readFileSync(new URL("./fixtures/microscale-products.json", import.meta.url), "utf8");

// Serves the given pages as page 1..n, then an empty page.
const pagedFetch = (pages: string[]) =>
  (async (u: string) => {
    const n = Number(new URL(u).searchParams.get("page"));
    return { ok: true, status: 200, json: async () => (n <= pages.length ? JSON.parse(pages[n - 1]) : { products: [] }) };
  }) as unknown as typeof fetch;

const feeds: [string, string[]][] = [["sample feed", [sample]]];
if (realPages.length) feeds.push(["real Microscale pages", realPages]);

describe.each(feeds)("Shop products from the %s", (_, pages) => {
  it("lists every variant once, with the sync's refs and prices", async () => {
    const { observations, products } = await fetchMicroscaleCatalog(pagedFetch([...pages]));
    const variants = pages.flatMap((p) => JSON.parse(p).products).flatMap((p: { handle?: string; variants?: unknown[] }) => (p.handle && p.variants ? p.variants : []));
    const refs = products.map((p) => p.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs.length).toBeLessThanOrEqual(variants.length);
    expect(refs.length).toBeGreaterThan(0);

    // Every variant ref the sync can price is in the Shop, at the same price.
    const obs = new Map(observations.filter((o) => o.ref.includes("#")).map((o) => [o.ref, o]));
    for (const p of products) {
      const o = obs.get(p.ref);
      expect(o, p.ref).toBeDefined();
      expect(p.price).toBe(o!.price);
      expect(p.inStock).toBe(o!.inStock);
    }
    expect(products.length).toBe(obs.size);
  });

  it("has a category, a feed position, and https images or none", async () => {
    const { products } = await fetchMicroscaleCatalog(pagedFetch([...pages]));
    products.forEach((p, i) => {
      expect(p.category.length).toBeGreaterThan(0);
      expect(p.position).toBeLessThanOrEqual(products.length * 2);
      if (p.imageUrl) expect(p.imageUrl).toMatch(/^https:\/\//);
      if (i > 0) expect(p.position).toBeGreaterThan(products[i - 1].position);
    });
  });
});

describe("parseShopProducts", () => {
  it("names variants, falls back to 'Other', and prefers the variant's own image", () => {
    const rows = parseShopProducts({
      products: [{
        handle: "pi-5", title: "Raspberry Pi 5", product_type: " ", images: [{ src: "https://cdn.shopify.com/pi.jpg" }],
        variants: [
          { id: 1, sku: "PI5-4", title: "4GB", price: "90000.00", available: true },
          { id: 2, sku: "PI5-8", title: "8GB", price: "0.00", available: false, featured_image: { src: "https://cdn.shopify.com/pi8.jpg" } },
        ],
      }],
    }, 10);
    expect(rows).toEqual([
      { ref: "pi-5#PI5-4", handle: "pi-5", title: "Raspberry Pi 5 (4GB)", category: "Other", imageUrl: "https://cdn.shopify.com/pi.jpg", price: 90000, inStock: true, position: 10 },
      { ref: "pi-5#PI5-8", handle: "pi-5", title: "Raspberry Pi 5 (8GB)", category: "Other", imageUrl: "https://cdn.shopify.com/pi8.jpg", price: null, inStock: false, position: 11 },
    ]);
  });

  it("gives a ref that appears twice in the feed no price, like the sync does", async () => {
    const dup = JSON.stringify({ products: [
      { id: 1, handle: "a", title: "A", variants: [{ sku: "SAME", price: "100" }] },
      { id: 2, handle: "a", title: "A again", variants: [{ sku: "SAME", price: "200" }] },
    ] });
    const { products } = await fetchMicroscaleCatalog(pagedFetch([dup]));
    expect(products).toHaveLength(1);
    expect(products[0].price).toBeNull();
    expect(parseProductsJson(JSON.parse(dup)).find((o) => o.ref === "a#SAME")!.price).toBeNull();
  });
});

describe("thumbnail", () => {
  it("asks Shopify's CDN for a small image and leaves other hosts alone", () => {
    expect(thumbnail("https://cdn.shopify.com/s/files/x.jpg?v=1")).toBe("https://cdn.shopify.com/s/files/x.jpg?v=1&width=360");
    expect(thumbnail("https://cdn.shopify.com/x.jpg", 120)).toBe("https://cdn.shopify.com/x.jpg?width=120");
    expect(thumbnail("https://example.com/x.jpg")).toBe("https://example.com/x.jpg");
    expect(thumbnail(null)).toBeNull();
    expect(thumbnail("not a url")).toBe("not a url");
  });
});
