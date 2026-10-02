// Runs the Microscale parser on REAL pages saved by `npm run capture-fixtures`
// (tests/fixtures/real/microscale-*.json). Skipped, with a visible reason, when none have been captured.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseProductsJson } from "../src/lib/sync/microscale";

const dir = new URL("./fixtures/real/", import.meta.url);
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^microscale-.*\.json$/.test(f)) : [];
const d = files.length ? describe : describe.skip;

if (!files.length) console.warn("[real-data] No captured Microscale files in tests/fixtures/real. Run `npm run capture-fixtures` from a machine that can reach microscale.net.");

d("Microscale parser on real captured pages", () => {
  for (const f of files) {
    const raw = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    const obs = parseProductsJson(raw);

    it(`${f}: parses every product without throwing`, () => {
      expect(raw.products.length).toBeGreaterThan(0);
      expect(obs.length).toBeGreaterThanOrEqual(raw.products.length);
    });
    it(`${f}: prices are positive numbers or null, never zero or NaN`, () => {
      for (const o of obs) expect(o.price === null || (Number.isFinite(o.price) && o.price > 0)).toBe(true);
      expect(obs.some((o) => o.price !== null)).toBe(true);
    });
    it(`${f}: stock flag mirrors Shopify's available boolean`, () => {
      for (const p of raw.products) for (const v of p.variants) {
        const o = obs.find((x) => x.ref === (v.sku ? `${p.handle}#${v.sku}` : `${p.handle}#id:${v.id}`));
        if (o && typeof v.available === "boolean") expect(o.inStock).toBe(v.available);
      }
    });
    it(`${f}: raw price strings convert exactly`, () => {
      for (const p of raw.products) for (const v of p.variants) {
        const ref = v.sku ? `${p.handle}#${v.sku}` : `${p.handle}#id:${v.id}`;
        const matches = obs.filter((x) => x.ref === ref);
        if (matches.length === 1 && matches[0].price !== null) expect(matches[0].price).toBeCloseTo(Number(v.price), 2);
      }
    });
  }
});
