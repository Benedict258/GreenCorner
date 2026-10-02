import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchMicroscaleFeed, microscaleHandleFromUrl, parseProductsJson, splitMicroscaleRef } from "../src/lib/sync/microscale";
import { decide } from "../src/lib/sync/safeguards";
import { latestDueSlot } from "../src/lib/time";
import { parsePrice } from "../src/lib/sync/types";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

describe("Microscale parser", () => {
  const obs = parseProductsJson(JSON.parse(fx("microscale-products.json")));
  const get = (ref: string) => obs.find((o) => o.ref === ref);
  it("reads price and stock per SKU", () => {
    expect(get("arduino-uno-r3#ARD-UNO-R3")).toMatchObject({ price: 12500, inStock: true, title: "Arduino Uno R3" });
    expect(get("waterproof-project-case#CASE-L")).toMatchObject({ price: 14200, inStock: false });
    expect(get("waterproof-project-case#CASE-S")?.title).toBe("Waterproof Project Case (Small)");
  });
  it("offers a handle-only ref for the first variant", () => {
    expect(get("arduino-uno-r3")?.price).toBe(12500);
  });
  it("turns a zero price into null instead of a price", () => {
    expect(get("jumper-wires-40")?.price).toBeNull();
  });
  it("fails loudly when the feed shape changes", () => {
    expect(() => parseProductsJson({ items: [] })).toThrow(/products/);
  });
  it("splits refs and URLs", () => {
    expect(splitMicroscaleRef("a-b#SKU1")).toEqual({ handle: "a-b", sku: "SKU1" });
    expect(splitMicroscaleRef("a-b")).toEqual({ handle: "a-b", sku: null });
    expect(microscaleHandleFromUrl("https://www.microscale.net/products/arduino-uno-r3?variant=1")).toBe("arduino-uno-r3");
    expect(microscaleHandleFromUrl("https://example.com/products/x")).toBeNull();
  });
  it("gives SKU-less variants a variant-id ref and keeps duplicate refs out of pricing", () => {
    const o = parseProductsJson({ products: [
      { id: 9, handle: "kit", title: "Kit", variants: [{ id: 91, sku: "", title: "A", price: "100.00", available: true }, { id: 92, sku: "", title: "B", price: "200.00", available: true }] },
      { id: 10, handle: "dup", title: "Dup", variants: [{ id: 101, sku: "X", price: "1.00", available: true }, { id: 102, sku: "X", price: "2.00", available: true }] },
    ] });
    expect(o.find((x) => x.ref === "kit#id:92")?.price).toBe(200);
    expect(o.filter((x) => x.ref === "dup#X").every((x) => x.price === null)).toBe(true);
  });
  it("stops loudly if the shop ignores the page parameter", async () => {
    const page = JSON.parse(fx("microscale-products.json"));
    const fake = (async () => ({ ok: true, status: 200, json: async () => page })) as unknown as typeof fetch;
    await expect(fetchMicroscaleFeed(fake)).rejects.toThrow(/repeats page/);
  });
  it("sends a User-Agent that identifies Waste2Light and makes one request per page", async () => {
    const seen: { url: string; ua: string }[] = [];
    const pages = [JSON.parse(fx("microscale-products.json")), { products: [] }];
    let i = 0;
    const fake = (async (u: string, init?: RequestInit) => { seen.push({ url: u, ua: String((init?.headers as Record<string, string>)["user-agent"]) }); return { ok: true, status: 200, json: async () => pages[i++] }; }) as unknown as typeof fetch;
    await fetchMicroscaleFeed(fake);
    expect(seen).toHaveLength(2);
    expect(seen[0].url).toBe("https://www.microscale.net/products.json?limit=250&page=1");
    expect(seen.every((x) => /Waste2Light/.test(x.ua))).toBe(true);
  });
  it("pages until an empty page", async () => {
    const pages = [JSON.parse(fx("microscale-products.json")), { products: [] }];
    let i = 0;
    const fake = (async () => ({ ok: true, status: 200, json: async () => pages[i++] })) as unknown as typeof fetch;
    const all = await fetchMicroscaleFeed(fake);
    expect(i).toBe(2);
    expect(all.length).toBeGreaterThan(3);
  });
});

describe("safeguards", () => {
  it("never accepts missing, zero or non-numeric prices", () => {
    expect(decide(1000, null, 30).kind).toBe("error");
    expect(decide(1000, 0, 30).kind).toBe("error");
    expect(decide(1000, NaN, 30).kind).toBe("error");
    expect(parsePrice("call us")).toBeNull();
  });
  it("accepts a first price, no-ops on equal, updates small moves", () => {
    expect(decide(null, 500, 30).kind).toBe("first");
    expect(decide(1000, 1000, 30).kind).toBe("unchanged");
    expect(decide(1000, 1200, 30).kind).toBe("update");
  });
  it("holds a jump above the threshold, in both directions", () => {
    expect(decide(1000, 1400, 30)).toMatchObject({ kind: "hold", newPrice: 1400 });
    expect(decide(1000, 600, 30).kind).toBe("hold");
    expect(decide(1000, 1300, 30).kind).toBe("update"); // exactly 30% passes
  });
});

describe("sync schedule", () => {
  const times = ["06:00", "18:00"];
  it("finds the latest slot in Lagos time (UTC+1)", () => {
    expect(latestDueSlot(times, new Date("2026-10-02T05:30:00Z"))?.toISOString()).toBe("2026-10-02T05:00:00.000Z"); // 06:30 Lagos
    expect(latestDueSlot(times, new Date("2026-10-02T04:30:00Z"))?.toISOString()).toBe("2026-10-01T17:00:00.000Z"); // 05:30 Lagos -> yesterday 18:00
    expect(latestDueSlot(times, new Date("2026-10-02T17:10:00Z"))?.toISOString()).toBe("2026-10-02T17:00:00.000Z");
  });
});
