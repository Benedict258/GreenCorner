// The store's money paths against a real Postgres: catalog prices, carts, checkout, Paystack
// settlement, stock, refunds, quote requests and accounts.
// Skipped unless TEST_DATABASE_URL is set. WARNING: wipes that database's data.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("platform against Postgres", () => {
  let db: typeof import("../src/lib/db");
  let catalog: typeof import("../src/lib/store/catalog");
  let cart: typeof import("../src/lib/store/cart");
  let orders: typeof import("../src/lib/store/orders");
  let requests: typeof import("../src/lib/store/quoteRequests");
  let users: typeof import("../src/lib/users");
  let products: typeof import("../src/lib/admin/products");
  let projectsAdmin: typeof import("../src/lib/admin/projects");
  let projects: typeof import("../src/lib/store/projects");
  let guard: typeof import("../src/lib/guard");
  let quotes: typeof import("../src/lib/quotes");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("../src/lib/db");
    await db.query("drop schema public cascade; create schema public;");
    await (await import("../src/lib/migrate")).migrate();
    catalog = await import("../src/lib/store/catalog");
    cart = await import("../src/lib/store/cart");
    orders = await import("../src/lib/store/orders");
    requests = await import("../src/lib/store/quoteRequests");
    users = await import("../src/lib/users");
    products = await import("../src/lib/admin/products");
    projectsAdmin = await import("../src/lib/admin/projects");
    projects = await import("../src/lib/store/projects");
    guard = await import("../src/lib/guard");
    quotes = await import("../src/lib/quotes");
  });
  afterAll(async () => db?.closePool());

  // Supplier prices: 10,000 (in stock), 2,000 (in stock), 5,000 (out of stock), 3,000 (hidden), no price.
  const ids: Record<string, number> = {};
  beforeEach(async () => {
    await db.query(`truncate supplier_products, product_settings, stock, carts, orders, payments, refunds, quote_requests, projects, users,
      components, quotes, notifications, messages, audit_log, rate_limits, blocked_ips restart identity cascade`);
    await db.query("update settings set value = '10' where key = 'default_markup_pct'");
    const rows: [string, string, number | null, boolean][] = [
      ["uno#UNO", "Arduino Uno R3 Board", 10000, true],
      ["hcsr04#HC", "HC-SR04 Ultrasonic Sensor", 2000, true],
      ["solar#S6", "6V Solar Panel", 5000, false],
      ["secret#X", "Hidden Thing", 3000, true],
      ["free#F", "Unpriced Item", null, true],
    ];
    let pos = 0;
    for (const [ref, title, price, inStock] of rows) {
      const r = await db.queryOne(
        `insert into supplier_products (supplier, ref, handle, title, category, image_url, price_ngn, in_stock, position, description, images)
         values ('microscale', $1, $2, $3, 'Boards', 'https://cdn.shopify.com/x.jpg', $4, $5, $6, '<p>Good.</p>', '["https://cdn.shopify.com/x.jpg"]') returning id`,
        [ref, ref.split("#")[0], title, price, inStock, pos++],
      );
      ids[ref] = Number(r!.id);
    }
    await products.setVisibility("secret#X", true);
  });

  const newCart = async () => {
    const id = randomUUID();
    await db.query("insert into carts (id) values ($1)", [id]);
    return id;
  };
  const contact = { name: "Aisha Bello", email: "aisha@example.com", phone: "+2348025550148" };
  const address = { street: "14 Tunga Road", area: "Tunga", landmark: "", city: "Minna", state: "Niger" };

  describe("catalog", () => {
    it("lists only priced, visible products at supplier price + markup", async () => {
      const page = await catalog.listProducts({ inStockOnly: false });
      expect(page.items.map((p) => p.title)).toEqual(["Arduino Uno R3 Board", "HC-SR04 Ultrasonic Sensor", "6V Solar Panel"]);
      expect(page.items[0].price).toBe(11000);
      expect(JSON.stringify(page)).not.toMatch(/cdn\.shopify|microscale/i);
      expect(page.items[0].image).toBe(`/img/p/${ids["uno#UNO"]}/0`);
    });

    it("hides out-of-stock items by default, unless we hold stock", async () => {
      expect((await catalog.listProducts({ inStockOnly: true })).total).toBe(2);
      await products.setStock("solar#S6", 2);
      const solar = (await catalog.listProducts({ inStockOnly: true })).items.find((p) => p.ref === "solar#S6");
      expect(solar?.availability).toBe("low");
    });

    it("uses a product's own markup, and that also prices quotations", async () => {
      const { componentId } = await db.tx((c) => import("../src/lib/shop").then((s) => s.ensureComponent(c, "uno#UNO")));
      await products.setMarkup("uno#UNO", 25);
      expect((await catalog.getProduct(ids["uno#UNO"]))!.price).toBe(12500);
      expect((await db.queryOne("select markup_pct from components where id = $1", [componentId]))!.markup_pct).toBe(25);
      await products.setMarkup("uno#UNO", null);
      expect((await catalog.getProduct(ids["uno#UNO"]))!.price).toBe(11000);
    });

    it("searches titles word by word and sorts by price", async () => {
      expect((await catalog.listProducts({ q: "ultrasonic hc-sr04" })).items.map((p) => p.ref)).toEqual(["hcsr04#HC"]);
      expect((await catalog.listProducts({ q: "uno#UNO" })).total).toBe(0); // stock codes are not searchable
      expect((await catalog.listProducts({ sort: "price-asc", inStockOnly: false })).items[0].ref).toBe("hcsr04#HC");
    });

    it("never serves a hidden product's page or image", async () => {
      expect(await catalog.getProduct(ids["secret#X"])).toBeNull();
      expect(await catalog.productImageSource(ids["secret#X"], 0)).toBeNull();
      expect(await catalog.productImageSource(ids["uno#UNO"], 0)).toBe("https://cdn.shopify.com/x.jpg");
    });
  });

  describe("cart and checkout", () => {
    it("adds, merges and totals; refuses out-of-stock products", async () => {
      const c = await newCart();
      await cart.addProductToCart(c, ids["uno#UNO"], 1);
      await cart.addProductToCart(c, ids["uno#UNO"], 2);
      await cart.addProductToCart(c, ids["hcsr04#HC"], 1);
      await expect(cart.addProductToCart(c, ids["solar#S6"], 1)).rejects.toThrow(/out of stock/);
      await expect(cart.addProductToCart(c, ids["secret#X"], 1)).rejects.toThrow(/no longer available/);
      const v = await cart.loadCart(c);
      expect(v.lines.map((l) => [l.title, l.quantity, l.lineTotal])).toEqual([["Arduino Uno R3 Board", 3, 33000], ["HC-SR04 Ultrasonic Sensor", 1, 2200]]);
      expect(v.subtotal).toBe(35200);
      expect(v.blocked).toBe(false);
    });

    it("places an order with locked prices, then a verified Paystack payment marks it paid once", async () => {
      const c = await newCart();
      await cart.addProductToCart(c, ids["uno#UNO"], 2);
      await products.setStock("uno#UNO", 5);
      const o = await orders.placeOrder({ cartId: c, userId: null, ...contact, fulfilment: "delivery", address, notes: "", paymentMethod: "paystack" });
      expect(o).toMatchObject({ status: "pending_payment", total: 22000, subtotal: 22000 });
      expect(o.number).toMatch(/^W2L-ORD-\d{4,}$/);
      expect(o.lines[0]).toMatchObject({ supplierPrice: 10000, markupPct: 10, unitPrice: 11000, quantity: 2 });

      // A later supplier price change does not touch the order.
      await db.query("update supplier_products set price_ngn = 20000 where ref = 'uno#UNO'");
      expect((await orders.getOrder(o.id))!.total).toBe(22000);

      const ref = await orders.startPayment(o.id, "paystack");
      const base = { reference: ref, currency: "NGN", channel: "card", paidAt: null, raw: {} };
      // Wrong amount: refused, order stays unpaid.
      expect((await orders.applyPaystackResult({ ...base, status: "success", amountKobo: 100 })).kind).toBe("failed");
      const ref2 = await orders.startPayment(o.id, "paystack");
      const paid = await orders.applyPaystackResult({ ...base, reference: ref2, status: "success", amountKobo: 2_200_000 });
      expect(paid).toMatchObject({ kind: "paid", firstTime: true });
      const again = await orders.applyPaystackResult({ ...base, reference: ref2, status: "success", amountKobo: 2_200_000 });
      expect(again).toMatchObject({ kind: "paid", firstTime: false });

      const after = (await orders.getOrder(o.id))!;
      expect(after.status).toBe("paid");
      expect(after.lines[0].source).toBe("stock"); // we held 5, so it comes from our stock
      expect((await db.queryOne("select quantity from stock where ref = 'uno#UNO'"))!.quantity).toBe(3);
      expect((await cart.loadCart(c)).lines).toHaveLength(0); // the cart is emptied only once paid
    });

    it("keeps the cart when a payment fails", async () => {
      const c = await newCart();
      await cart.addProductToCart(c, ids["hcsr04#HC"], 1);
      const o = await orders.placeOrder({ cartId: c, userId: null, ...contact, fulfilment: "pickup", address: null, notes: "", paymentMethod: "paystack" });
      const ref = await orders.startPayment(o.id, "paystack");
      expect((await orders.applyPaystackResult({ reference: ref, status: "abandoned", amountKobo: 220000, currency: "NGN", channel: null, paidAt: null, raw: {} })).kind).toBe("failed");
      expect((await orders.getOrder(o.id))!.status).toBe("pending_payment");
      expect((await cart.loadCart(c)).lines).toHaveLength(1);
    });

    it("bank transfer: the team marks it paid; then statuses move in order, refunds add up", async () => {
      const c = await newCart();
      await cart.addProductToCart(c, ids["uno#UNO"], 1);
      await cart.addProductToCart(c, ids["hcsr04#HC"], 2);
      const o = await orders.placeOrder({ cartId: c, userId: null, ...contact, fulfilment: "delivery", address, notes: "", paymentMethod: "bank_transfer" });
      await expect(orders.setOrderStatus(o.id, "confirmed", "staff@x")).rejects.toThrow(/not paid/);
      await orders.markPaidManually(o.id, "staff@x", "");
      await expect(orders.markPaidManually(o.id, "staff@x", "")).rejects.toThrow(/not waiting/);
      expect((await orders.setOrderStatus(o.id, "confirmed", "staff@x")).status).toBe("confirmed");

      const line = (await orders.getOrder(o.id))!.lines.find((l) => l.ref === "hcsr04#HC")!;
      const { amount } = await orders.markLineUnavailable(line.id, "staff@x");
      expect(amount).toBe(4400);
      let r = await orders.recordRefund(o.id, line.id, amount, "unavailable", "owner@x", { ref: null, status: "manual" });
      expect(r).toMatchObject({ refunded: 4400, status: "confirmed" });
      r = await orders.recordRefund(o.id, null, 11000, "", "owner@x", { ref: null, status: "manual" });
      expect(r).toMatchObject({ refunded: 15400, status: "refunded" });
      expect(r.events.some((e) => e.status === "refunded")).toBe(true);
    });

    it("finds an order for a customer only with its token or its email", async () => {
      const c = await newCart();
      await cart.addProductToCart(c, ids["uno#UNO"], 1);
      const o = await orders.placeOrder({ cartId: c, userId: null, ...contact, fulfilment: "pickup", address: null, notes: "", paymentMethod: "paystack" });
      expect(await orders.findOrderForCustomer(o.number, { token: o.accessToken })).not.toBeNull();
      expect(await orders.findOrderForCustomer(o.number, { email: "AISHA@example.com" })).not.toBeNull();
      expect(await orders.findOrderForCustomer(o.number, { token: "wrong" })).toBeNull();
      expect(await orders.findOrderForCustomer(o.number, { email: "someone@else.com" })).toBeNull();
    });
  });

  describe("projects and kits", () => {
    const kit = async (items: { ref: string; quantity: number }[]) => projectsAdmin.saveProject(null, {
      title: "Smart dustbin", slug: "smart-dustbin", summary: "", description: "", learn: [], level: "Beginner", ageGroup: "Secondary", topics: [],
      buildTime: "", imageUrl: null, videoUrl: null, steps: [], safety: "", downloads: [], published: true, position: 1, items,
    });

    it("prices a kit as the sum of its parts and stores it as parts in the order", async () => {
      const pid = await kit([{ ref: "uno#UNO", quantity: 1 }, { ref: "hcsr04#HC", quantity: 2 }]);
      const p = (await projects.getProjectBySlug("smart-dustbin"))!;
      expect(p.kitPrice).toBe(11000 + 4400);
      const c = await newCart();
      await cart.addKitToCart(c, pid, 3);
      const v = await cart.loadCart(c);
      expect(v.lines[0]).toMatchObject({ kind: "kit", quantity: 3, lineTotal: 15400 * 3 });
      const o = await orders.placeOrder({ cartId: c, userId: null, ...contact, fulfilment: "pickup", address: null, notes: "", paymentMethod: "paystack" });
      expect(o.total).toBe(46200);
      expect(o.lines.map((l) => [l.title, l.quantity, l.kitLabel])).toEqual([["Arduino Uno R3 Board", 3, "Smart dustbin kit"], ["HC-SR04 Ultrasonic Sensor", 6, "Smart dustbin kit"]]);
    });

    it("lets a kit with an out-of-stock part be bought, but not one with a part no longer sold", async () => {
      const pid = await kit([{ ref: "uno#UNO", quantity: 1 }, { ref: "solar#S6", quantity: 1 }]);
      const c = await newCart();
      await cart.addKitToCart(c, pid, 1);
      expect((await cart.loadCart(c)).lines[0].availability).toBe("low");
      await products.setVisibility("solar#S6", true);
      await expect(cart.addKitToCart(c, pid, 1)).rejects.toThrow(/no longer sold/);
      expect((await cart.loadCart(c)).blocked).toBe(true);
    });

    it("rejects a duplicate page address and bad links", async () => {
      await kit([]);
      await expect(kit([])).rejects.toThrow(/already uses/);
      await expect(projectsAdmin.saveProject(null, { title: "X project", slug: "x", summary: "", description: "", learn: [], level: "Beginner", ageGroup: "", topics: [], buildTime: "", imageUrl: "javascript:alert(1)", videoUrl: null, steps: [], safety: "", downloads: [], published: false, position: 0, items: [] })).rejects.toThrow(/https/);
    });
  });

  describe("quote requests", () => {
    it("turns a request into a quotation, sends it, and the accepted quotation becomes an order at its prices", async () => {
      const pid = await projectsAdmin.saveProject(null, {
        title: "Solar charger", slug: "solar-charger", summary: "", description: "", learn: [], level: "Beginner", ageGroup: "Secondary", topics: [],
        buildTime: "", imageUrl: null, videoUrl: null, steps: [], safety: "", downloads: [], published: true, position: 1, items: [{ ref: "hcsr04#HC", quantity: 2 }],
      });
      const r = await requests.createQuoteRequest({
        userId: null, organisation: "Hillcrest Model Academy", contactName: "Hauwa Abdullahi", contactRole: "Teacher", phone: "+2348055550173",
        email: "hauwa@example.com", students: 30, neededBy: null, fulfilment: "delivery", message: "",
        lines: [{ ref: "uno#UNO", projectId: null, quantity: 2, note: "" }, { ref: null, projectId: pid, quantity: 10, note: "extra wires" }],
      });
      expect(r.number).toMatch(/^W2L-REQ-\d{4}$/);
      expect(r.estimatedTotal).toBe(22000 + 44000);

      const quoteId = await requests.quotationFromRequest(r.id);
      expect(await requests.quotationFromRequest(r.id)).toBe(quoteId); // the same quotation, not a second one
      const q = (await quotes.loadQuote(quoteId))!;
      expect(q.name).toBe("Hillcrest Model Academy");
      expect(q.lines.map((l) => [l.quantity, l.unitPrice])).toEqual([[2, 11000], [10, 4400]]);
      expect(q.lines[1].description).toMatch(/^Solar charger kit\. Includes: HC-SR04/);
      expect((await requests.getQuoteRequest(r.id))!.status).toBe("quoted");

      const token = await requests.markQuotationSent(quoteId, "hauwa@example.com");
      expect(token.length).toBeGreaterThan(20);
      const o = await orders.orderFromQuote(quoteId, { name: "Hauwa", email: "hauwa@example.com", phone: "+2348055550173", userId: null, fulfilment: "delivery", address }, "bank_transfer");
      expect(o.total).toBe(q.total);
      expect((await orders.orderFromQuote(quoteId, { name: "Hauwa", email: "hauwa@example.com", phone: "+2348055550173", userId: null, fulfilment: "delivery", address }, "bank_transfer")).id).toBe(o.id);
      expect((await requests.getQuoteRequest(r.id))!.status).toBe("accepted");
    });

    it("accepts a message-only request but not an empty one", async () => {
      const base = { userId: null, organisation: "Org", contactName: "A B", contactRole: "", phone: "+2348025550148", email: "a@b.co", students: null, neededBy: null, fulfilment: "pickup" as const, lines: [] };
      await expect(requests.createQuoteRequest({ ...base, message: "" })).rejects.toThrow(/Add at least one item/);
      expect((await requests.createQuoteRequest({ ...base, message: "We need 20 solar kits for a STEM fair." })).lines).toHaveLength(0);
    });
  });

  describe("accounts", () => {
    it("a new account adopts earlier guest orders with the same email; logins are separated by kind", async () => {
      const c = await newCart();
      await cart.addProductToCart(c, ids["uno#UNO"], 1);
      const o = await orders.placeOrder({ cartId: c, userId: null, ...contact, fulfilment: "pickup", address: null, notes: "", paymentMethod: "paystack" });
      const u = await users.createCustomer({ email: "Aisha@Example.com", name: "Aisha", phone: "+2348025550148", password: "longpassword" });
      expect((await orders.getOrder(o.id))!.userId).toBe(u.id);
      await expect(users.createCustomer({ email: "aisha@example.com", name: "A", phone: "", password: "longpassword" })).rejects.toThrow(/already exists/);
      expect(await users.verifyLogin("aisha@example.com", "longpassword", "customer")).not.toBeNull();
      expect(await users.verifyLogin("aisha@example.com", "longpassword", "staff")).toBeNull();
      expect(await users.verifyLogin("aisha@example.com", "wrong-password", "customer")).toBeNull();
    });

    it("staff invitations set a password once", async () => {
      const { user, token } = await users.inviteStaff("maryam@waste2light.com", "Maryam", "staff");
      expect(await users.verifyLogin(user.email, "whatever1", "staff")).toBeNull(); // no password yet
      await users.consumePasswordToken(token, "staffpassword");
      expect(await users.verifyLogin(user.email, "staffpassword", "staff")).toMatchObject({ role: "staff" });
      await expect(users.consumePasswordToken(token, "another-one")).rejects.toThrow(/expired|used/);
    });

    it("a cart follows the customer to a new device", async () => {
      const u = await users.createCustomer({ email: "b@example.com", name: "B", phone: "", password: "longpassword" });
      const phone = await newCart();
      await cart.addProductToCart(phone, ids["uno#UNO"], 1);
      await cart.attachCartToUser(phone, u.id);
      const laptop = await newCart();
      await cart.addProductToCart(laptop, ids["uno#UNO"], 2);
      await cart.addProductToCart(laptop, ids["hcsr04#HC"], 1);
      await cart.attachCartToUser(laptop, u.id);
      const v = await cart.loadCart(laptop);
      expect(v.lines.map((l) => [l.ref, l.quantity])).toEqual([["uno#UNO", 2], ["hcsr04#HC", 1]]);
      expect(await db.queryOne("select 1 from carts where id = $1", [phone])).toBeNull();
    });
  });

  it("rate limits count per visitor and window", async () => {
    const lim = [{ name: "t", max: 3, windowSec: 60 }];
    for (let i = 0; i < 3; i++) expect(await guard.hit("1.2.3.4", lim)).toBeNull();
    expect(await guard.hit("1.2.3.4", lim)).toMatchObject({ name: "t" });
    expect(await guard.hit("5.6.7.8", lim)).toBeNull();
  });

  it("lists the busiest visitors and blocks one", async () => {
    for (let i = 0; i < 5; i++) await guard.hit("9.9.9.9", guard.PAGE_LIMITS);
    await guard.hit("8.8.8.8", guard.PAGE_LIMITS);
    await guard.blockIp("9.9.9.9", "test");
    const top = await guard.busiestVisitors(5);
    expect(top[0]).toMatchObject({ ip: "9.9.9.9", hits: 5, blocked: true });
    expect(await guard.isBlocked("9.9.9.9")).toBe(true);
    await guard.unblockIp("9.9.9.9");
    expect(await guard.isBlocked("9.9.9.9")).toBe(false);
  });
});
