// DEFERRED: Hub360 is not active in v1. Run with: npm run test:deferred
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hub360ProductId, hub360RefFromUrl, makeRateLimited, parseProductPage, parseSearchResults } from "../../src/lib/sync/_deferred/hub360";

const fx = (n: string) => readFileSync(new URL(`../fixtures/_deferred/${n}`, import.meta.url), "utf8");

describe("Hub360 parser", () => {
  const ref = "https://hub360.cc/shop/arduino-uno-r3-18006";
  it("reads JSON-LD price and stock", () => {
    expect(parseProductPage(fx("hub360-product-jsonld.html"), ref)).toMatchObject({ price: 11900, inStock: true, title: "Arduino Uno R3" });
  });
  it("falls back to the printed price and the stock message", () => {
    expect(parseProductPage(fx("hub360-product-printed.html"), ref)).toMatchObject({ price: 1250, inStock: false });
  });
  it("returns a null price when the page has none", () => {
    expect(parseProductPage(fx("hub360-product-noprice.html"), ref).price).toBeNull();
  });
  it("parses search cards and ignores category links", () => {
    const hits = parseSearchResults(fx("hub360-search.html"));
    expect(hits.map((h) => h.ref)).toEqual(["https://hub360.cc/shop/arduino-uno-r3-18006", "https://hub360.cc/shop/arduino-nano-18010"]);
    expect(hits[0]).toMatchObject({ title: "Arduino Uno R3", price: 11900 });
  });
  it("accepts only Hub360 product URLs", () => {
    expect(hub360RefFromUrl("https://hub360.cc/shop/arduino-uno-r3-18006?x=1")).toBe(ref);
    expect(hub360RefFromUrl("https://hub360.cc/shop/category/boards-3")).toBeNull();
    expect(hub360RefFromUrl("https://evil.example/shop/a-1")).toBeNull();
    expect(hub360ProductId(ref)).toBe("18006");
  });
  it("never sends more than one request per second", async () => {
    let t = 0;
    const times: number[] = [];
    const fake = (async () => { times.push(t); return {} as Response; }) as unknown as typeof fetch;
    const f = makeRateLimited(fake, async (ms) => { t += ms; }, 1000, () => t);
    await Promise.all([f("a"), f("b"), f("c")]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(1000);
  });
});

