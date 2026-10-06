// Runs against a real Postgres. Skipped unless TEST_DATABASE_URL is set. WARNING: wipes that database's data.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("sync + quotes against Postgres", () => {
  let db: typeof import("../src/lib/db");
  let run: typeof import("../src/lib/sync/run");
  let quotes: typeof import("../src/lib/quotes");
  let catalog: typeof import("../src/lib/catalog");

  let feedPrice = 12500;
  let extraProducts: object[] = []; // more products in the feed, for the Shop tests
  const feed = (price: number, available = true) =>
    ({ products: [{ handle: "arduino-uno-r3", title: "Arduino Uno R3", variants: [{ sku: "UNO", title: "Default Title", price: String(price), available }] }, ...extraProducts] });
  const fakeFeed = (async (u: string) => {
    const page = new URL(u).searchParams.get("page");
    return { ok: true, status: 200, json: async () => (page === "1" ? feed(feedPrice) : { products: [] }) };
  }) as unknown as typeof fetch;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("../src/lib/db");
    await db.query("drop schema public cascade; create schema public;");
    await (await import("../src/lib/migrate")).migrate();
    run = await import("../src/lib/sync/run");
    quotes = await import("../src/lib/quotes");
    catalog = await import("../src/lib/catalog");
  });
  afterAll(async () => db?.closePool());

  let compId = 0;
  beforeEach(async () => {
    await db.query("truncate components, bundles, quotes, sync_runs, supplier_products restart identity cascade");
    feedPrice = 12500;
    extraProducts = [];
    compId = (await db.query("insert into components (name, category) values ('Arduino Uno R3', 'Boards') returning id"))[0].id;
    await db.query("insert into supplier_listings (component_id, supplier, supplier_ref) values ($1, 'microscale', 'arduino-uno-r3#UNO')", [compId]);
  });

  let feedCalls = 0;
  const countingFeed = (async (u: string, i?: RequestInit) => { feedCalls++; return (fakeFeed as unknown as (u: string, i?: RequestInit) => Promise<unknown>)(u, i); }) as unknown as typeof fetch;
  const sync = () => run.runSync({ supplier: "microscale", trigger: "manual", fetchFn: countingFeed });
  const listing = async () => (await catalog.loadComponent(compId))!.listings[0];

  it("makes one pass per run: one request per feed page, none per product", async () => {
    await db.query("insert into components (name) values ('B'), ('C')");
    await db.query("insert into supplier_listings (component_id, supplier, supplier_ref) select id, 'microscale', 'arduino-uno-r3#UNO' from components where name in ('B') ");
    feedCalls = 0;
    await sync();
    expect(feedCalls).toBe(2); // page 1 + the empty page that ends the pass
  });

  it("fetches the first price and stock", async () => {
    const r = await sync();
    expect(r).toMatchObject({ status: "success", updated: 1, failed: 0 });
    expect(await listing()).toMatchObject({ price: 12500, inStock: true, status: "ok" });
    expect((await db.query("select * from price_history")).length).toBe(1);
  });

  it("applies a small change but holds a forced 40% jump for review", async () => {
    await sync();
    feedPrice = 13000;
    await sync();
    expect((await listing()).price).toBe(13000);
    feedPrice = 18200; // +40%
    await sync();
    const l = await listing();
    expect(l.price).toBe(13000);
    expect(l.status).toBe("held");
    const held = await db.query("select * from held_changes where decision = 'pending'");
    expect(held).toHaveLength(1);
    await run.decideHeldChange(held[0].id, "approved");
    expect(await listing()).toMatchObject({ price: 18200, status: "ok" });
  });

  it("does not re-queue a rejected jump", async () => {
    await sync();
    feedPrice = 18200;
    await sync();
    const [h] = await db.query("select id from held_changes");
    await run.decideHeldChange(h.id, "rejected");
    await sync();
    expect(await db.query("select 1 from held_changes where decision = 'pending'")).toHaveLength(0);
    expect((await listing()).price).toBe(12500);
  });

  it("keeps the last good price when the feed drops the item or gives zero", async () => {
    await sync();
    feedPrice = 0;
    const r = await sync();
    expect(r.status).toBe("failed");
    expect(await listing()).toMatchObject({ price: 12500, status: "error" });
  });

  it("skips when another run holds the supplier lock", async () => {
    const c = await db.getPool().connect();
    await c.query("select pg_advisory_lock(7731, 1)");
    try {
      expect((await sync()).status).toBe("skipped");
    } finally {
      await c.query("select pg_advisory_unlock(7731, 1)");
      c.release();
    }
  });

  it("saved quotes keep their prices after a sync; quantity changes keep the snapshot", async () => {
    await sync();
    const id = await quotes.saveQuote(null, "School A", "", [{ kind: "component", refId: compId, quantity: 4 }]);
    expect((await quotes.loadQuote(id))!.total).toBe(55000);
    feedPrice = 14000;
    await sync();
    let q = (await quotes.loadQuote(id))!;
    expect(q.total).toBe(55000);
    // edit quantity: snapshot unit price is kept
    await quotes.saveQuote(id, "School A", "", [{ lineId: q.lines[0].id, kind: "component", refId: compId, quantity: 5 }]);
    q = (await quotes.loadQuote(id))!;
    expect(q.lines[0].unitPrice).toBe(13750);
    expect(q.total).toBe(68750);
    // reprice picks up today's price
    await quotes.saveQuote(id, "School A", "", [{ lineId: q.lines[0].id, kind: "component", refId: compId, quantity: 5, reprice: true }]);
    expect((await quotes.loadQuote(id))!.lines[0].unitPrice).toBe(15400);
    // duplicate prices at today's prices
    const copy = await quotes.duplicateQuote(id);
    expect((await quotes.loadQuote(copy))!.total).toBe(77000);
  });

  it("ignores Hub360 rows: hidden from pricing and never synced", async () => {
    await db.query("insert into supplier_listings (component_id, supplier, supplier_ref, price_ngn, status) values ($1, 'hub360', 'https://hub360.cc/shop/x-1', 1, 'ok')", [compId]);
    const c = (await catalog.loadComponent(compId))!;
    expect(c.listings.map((l) => l.supplier)).toEqual(["microscale"]);
    const r = await run.runSync({ supplier: "hub360", trigger: "manual", fetchFn: (() => { throw new Error("must not fetch"); }) as unknown as typeof fetch });
    expect(r.status).toBe("failed");
    expect((await db.query("select log from sync_runs where id = $1", [r.runId]))[0].log).toMatch(/not enabled/);
  });

  it("prices a bundle live from its components", async () => {
    await sync();
    const b = (await db.query("insert into bundles (name) values ('Starter kit') returning id"))[0].id;
    await db.query("insert into bundle_items (bundle_id, component_id, quantity) values ($1, $2, 2)", [b, compId]);
    const id = await quotes.saveQuote(null, "Kit", "", [{ kind: "bundle", refId: b, quantity: 3 }]);
    const q = (await quotes.loadQuote(id))!;
    expect(q.lines[0].unitPrice).toBe(27500);
    expect(q.total).toBe(82500);
  });

  const relay = { handle: "relay-8ch", title: "8 channel relay", product_type: "Modules", images: [{ src: "https://cdn.shopify.com/relay.jpg" }], variants: [{ id: 77, sku: "", title: "Default Title", price: "9550.00", available: false }] };

  it("lists the whole feed in the Shop even with nothing linked, and drops products that leave the feed", async () => {
    await db.query("truncate components restart identity cascade");
    extraProducts = [relay];
    expect((await sync()).status).toBe("success");
    expect(await db.query("select ref, title, category, image_url, price_ngn, in_stock from supplier_products order by position")).toEqual([
      { ref: "arduino-uno-r3#UNO", title: "Arduino Uno R3", category: "Other", image_url: null, price_ngn: 12500, in_stock: true },
      { ref: "relay-8ch#id:77", title: "8 channel relay", category: "Modules", image_url: "https://cdn.shopify.com/relay.jpg", price_ngn: 9550, in_stock: false },
    ]);
    extraProducts = [];
    await sync();
    expect((await db.query("select ref from supplier_products")).map((r) => r.ref)).toEqual(["arduino-uno-r3#UNO"]);
  });

  it("a single-component sync (after linking) leaves the Shop alone", async () => {
    await sync();
    await db.query("delete from supplier_products");
    await run.runSync({ supplier: "microscale", trigger: "manual", componentId: compId, fetchFn: countingFeed });
    expect(await db.query("select 1 from supplier_products")).toHaveLength(0);
  });

  it("adds a Shop product to the cart as one priced, linked component and quotes it", async () => {
    const shop = await import("../src/lib/shop");
    extraProducts = [relay];
    await sync();
    const page = await shop.loadShop({ q: "relay" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ ref: "relay-8ch#id:77", category: "Modules", price: 9550, inStock: false, componentId: null, quotePrice: 10505, inCart: 0 });

    const { componentId } = await shop.addToCart("relay-8ch#id:77", 2);
    await shop.addToCart("relay-8ch#id:77", 3);
    expect(await shop.loadCart()).toMatchObject([{ componentId, quantity: 5, imageUrl: "https://cdn.shopify.com/relay.jpg" }]);
    const c = (await catalog.loadComponent(componentId))!;
    expect(c).toMatchObject({ name: "8 channel relay", category: "Modules", markupPct: 10, active: true });
    expect(c.listings).toHaveLength(1);
    expect(c.listings[0]).toMatchObject({ supplierRef: "relay-8ch#id:77", price: 9550, inStock: false, status: "ok" });
    expect((await shop.loadShop({ q: "relay" })).items[0]).toMatchObject({ componentId, inCart: 5 });

    // The next scheduled sync treats it like any linked listing.
    expect((await sync()).failed).toBe(0);
    // A deactivated component is brought back, not duplicated, when picked again.
    await db.query("update components set active = false where id = $1", [componentId]);
    expect((await shop.addToCart("relay-8ch#id:77", 1)).componentId).toBe(componentId);
    expect((await catalog.loadComponent(componentId))!.active).toBe(true);
    expect(await db.query("select 1 from supplier_listings where supplier_ref = 'relay-8ch#id:77'")).toHaveLength(1);

    const id = await quotes.saveQuote(null, "From cart", "", (await shop.loadCart()).map((l) => ({ kind: "component" as const, refId: l.componentId, quantity: l.quantity })));
    expect((await quotes.loadQuote(id))!.total).toBe(10505 * 6);
    await shop.clearCart();
    expect(await shop.cartCount()).toBe(0);
    await expect(shop.addToCart("not-in-feed#X", 1)).rejects.toThrow(/no longer in the Microscale catalog/);
  });
});
