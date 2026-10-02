import { describe, expect, it } from "vitest";
import { chooseListing, formatNaira, priceBundle, priceComponent, unitPrice, type ListingPrice } from "../src/lib/pricing";

const now = new Date("2026-10-02T12:00:00Z");
const opts = { now, staleAfterHours: 48 };
const L = (o: Partial<ListingPrice> & { supplier: ListingPrice["supplier"] }): ListingPrice => ({
  price: 1000, inStock: true, unitsPerListing: 1, status: "ok", lastSyncedAt: "2026-10-02T06:00:00Z", ...o,
});

describe("unitPrice", () => {
  it("adds markup and rounds to the naira", () => {
    expect(unitPrice(12500, 1, 10)).toBe(13750);
    expect(unitPrice(9800, 1, 10)).toBe(10780);
  });
  it("divides packs before markup", () => {
    expect(unitPrice(1250, 5, 10)).toBe(275);
    expect(unitPrice(1000, 3, 10)).toBe(367); // 366.67
  });
  it("rounds half up and handles fractional markup", () => {
    expect(unitPrice(1005, 1, 0)).toBe(1005);
    expect(unitPrice(10, 4, 0)).toBe(3); // 2.5 -> 3
    expect(unitPrice(1000, 1, 12.5)).toBe(1125);
  });
  it("rejects zero units", () => {
    expect(() => unitPrice(100, 0, 10)).toThrow();
  });
});

describe("priceComponent", () => {
  it("reproduces the PRD worked example (₦98,120)", () => {
    const uno = priceComponent([L({ supplier: "microscale", price: 12500 })], 10, 4, opts);
    const box = priceComponent([L({ supplier: "microscale", price: 9800 })], 10, 4, opts);
    expect(uno.unitPrice).toBe(13750);
    expect(uno.lineTotal).toBe(55000);
    expect(box.lineTotal).toBe(43120);
    expect(uno.lineTotal + box.lineTotal).toBe(98120);
  });
  it("prices from the Microscale listing: price / units x (1 + markup)", () => {
    const r = priceComponent([L({ supplier: "microscale", price: 29360, unitsPerListing: 1 })], 10, 2, opts);
    expect(r.supplierUsed).toBe("microscale");
    expect(r.unitPrice).toBe(32296);
    expect(r.lineTotal).toBe(64592);
  });
  it("divides a pack before applying markup (units_per_listing > 1)", () => {
    const r = priceComponent([L({ supplier: "microscale", price: 1500, unitsPerListing: 5 })], 10, 12, opts);
    expect(r.unitPrice).toBe(330); // 1500 / 5 = 300, +10%
    expect(r.lineTotal).toBe(3960);
    expect(priceComponent([L({ supplier: "microscale", price: 1000, unitsPerListing: 3 })], 10, 1, opts).unitPrice).toBe(367); // 366.67 rounds up
    expect(priceComponent([L({ supplier: "microscale", price: 1000, unitsPerListing: 3 })], 0, 1, opts).unitPrice).toBe(333); // 333.33 rounds down
  });
  it("uses the component's own markup, including a non-default one", () => {
    expect(priceComponent([L({ supplier: "microscale", price: 10000 })], 25, 1, opts).unitPrice).toBe(12500);
  });
  it("keeps an out-of-stock Microscale item with a warning and its last known price", () => {
    const r = priceComponent([L({ supplier: "microscale", price: 5000, inStock: false })], 10, 2, opts);
    expect(r.unitPrice).toBe(5500);
    expect(r.lineTotal).toBe(11000);
    expect(r.warnings.map((w) => w.code)).toEqual(["out_of_stock"]);
    expect(r.warnings[0].message).toMatch(/Microscale/);
  });
  it("still picks the lowest in-stock per-unit price if a second supplier is ever enabled", () => {
    const m = L({ supplier: "microscale", price: 1000 });
    const h = L({ supplier: "hub360", price: 1500, unitsPerListing: 5 });
    expect(chooseListing([m, h])?.supplier).toBe("hub360");
    expect(chooseListing([L({ supplier: "microscale", price: 500, inStock: false }), L({ supplier: "hub360", price: 900 })])?.supplier).toBe("hub360");
  });
  it("warns on stale and held prices", () => {
    const old = L({ supplier: "microscale", lastSyncedAt: "2026-09-29T00:00:00Z" });
    expect(priceComponent([old], 10, 1, opts).warnings.map((w) => w.code)).toContain("stale");
    expect(priceComponent([L({ supplier: "microscale", status: "held" })], 10, 1, opts).warnings.map((w) => w.code)).toContain("held");
  });
  it("leaves unpriced lines out of the total", () => {
    const r = priceComponent([L({ supplier: "microscale", price: null, status: "pending", lastSyncedAt: null })], 10, 3, opts);
    expect(r.lineTotal).toBe(0);
    expect(r.warnings[0].code).toBe("no_price");
  });
});

describe("priceBundle", () => {
  const items = [
    { componentId: 1, name: "Uno", markupPct: 10, quantity: 1, listings: [L({ supplier: "microscale", price: 12500 })] },
    { componentId: 2, name: "Case", markupPct: 20, quantity: 2, listings: [L({ supplier: "microscale", price: 9800 })] },
  ];
  it("sums component unit prices x quantities with each component's own markup", () => {
    const b = priceBundle(items, 3, opts);
    expect(b.unitPrice).toBe(13750 + 2 * 11760);
    expect(b.lineTotal).toBe(b.unitPrice * 3);
  });
  it("carries component warnings with the component name", () => {
    const b = priceBundle([{ ...items[0], listings: [L({ supplier: "microscale", inStock: false })] }], 1, opts);
    expect(b.warnings[0].message).toMatch(/^Uno:/);
  });
  it("updates when a component price changes", () => {
    const before = priceBundle(items, 1, opts).unitPrice;
    const changed = [{ ...items[0], listings: [L({ supplier: "microscale", price: 13500 })] }, items[1]];
    expect(priceBundle(changed, 1, opts).unitPrice).toBeGreaterThan(before);
  });
});

describe("formatNaira", () => {
  it("uses the ₦ sign and thousands separators", () => {
    expect(formatNaira(12500)).toBe("₦12,500");
    expect(formatNaira(98120)).toBe("₦98,120");
  });
});
