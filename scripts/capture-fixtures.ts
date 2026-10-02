// Saves REAL Microscale data into tests/fixtures/real so the parser tests run on live data.
// Run from a machine that can reach microscale.net:  npm run capture-fixtures
//
// Saves: page 1, the last non-empty page, and the first pages that contain a kit/bundle product and an
// unavailable variant (if the shop has them). Also saves robots.txt, /.well-known/ucp and /agents.md for review.
// One request per page, one second apart, with the Waste2Light User-Agent.
import { mkdirSync, writeFileSync } from "node:fs";
import { MICROSCALE_ORIGIN } from "../src/lib/sync/microscale";
import { userAgent } from "../src/lib/sync/types";

const OUT = "tests/fixtures/real";
const headers = { "user-agent": userAgent(), accept: "application/json" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const KIT = /\b(kit|bundle|combo|set|pack)\b/i;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const saved = new Set<number>();
  const save = (n: number, body: string) => {
    writeFileSync(`${OUT}/microscale-page${n}.json`, body);
    saved.add(n);
  };

  let first: { n: number; body: string } | null = null;
  let last: { n: number; body: string } | null = null;
  let kitPage = 0;
  let unavailablePage = 0;
  let totalProducts = 0;
  for (let n = 1; n <= 100; n++) {
    const res = await fetch(`${MICROSCALE_ORIGIN}/products.json?limit=250&page=${n}`, { headers });
    if (!res.ok) throw new Error(`page ${n}: HTTP ${res.status}`);
    const body = await res.text();
    const products = JSON.parse(body).products as { title: string; variants: { available?: boolean }[] }[];
    if (!products.length) break;
    totalProducts += products.length;
    if (n === 1) first = { n, body };
    last = { n, body };
    if (!kitPage && products.some((p) => KIT.test(p.title))) { kitPage = n; save(n, body); }
    if (!unavailablePage && products.some((p) => p.variants.some((v) => v.available === false))) { unavailablePage = n; save(n, body); }
    await sleep(1000);
  }
  if (!first || !last) throw new Error("The feed returned no products");
  save(first.n, first.body);
  save(last.n, last.body);
  console.log(`Saved pages ${[...saved].sort((a, b) => a - b).join(", ")} (${totalProducts} products in the whole feed).`);
  console.log(`Kit/bundle product found: ${kitPage ? `page ${kitPage}` : "NO"}`);
  console.log(`Unavailable product found: ${unavailablePage ? `page ${unavailablePage}` : "NO"}`);

  for (const [path, file] of [["/robots.txt", "robots.txt"], ["/.well-known/ucp", "well-known-ucp.txt"], ["/agents.md", "agents.md"]] as const) {
    const r = await fetch(`${MICROSCALE_ORIGIN}${path}`, { headers: { "user-agent": userAgent() } });
    writeFileSync(`${OUT}/${file}`, `HTTP ${r.status}\n\n${await r.text()}`);
    console.log(`${path}: HTTP ${r.status} -> ${OUT}/${file}`);
    await sleep(1000);
  }
  console.log("Now run: npm test");
}
main().catch((e) => {
  console.error("capture failed:", e.message);
  process.exitCode = 1;
});
