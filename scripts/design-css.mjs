// Builds src/styles/store.css and src/styles/admin.css from the Claude Design export in Designs/.
//   node scripts/design-css.mjs Designs src/styles/store.css store
//   node scripts/design-css.mjs Designs src/styles/admin.css admin
// Run it again whenever the design files change.
// Merges the design CSS into one stylesheet. A rule every page writes the same way stays global;
// a selector that pages style differently is scoped to each page group with :where(.pg-x), which
// adds no specificity, so each page cascades exactly as its own file did.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [src, outFile, which] = process.argv.slice(2);

const GROUPS = {
  home: ["index", "HomeM"],
  shop: ["Shop", "ShopM", "ShopEmpty"],
  product: ["Product", "ProductM", "ProductOOS"],
  projects: ["Projects"],
  project: ["Project", "ProjectM"],
  cart: ["Cart", "CartEmpty"],
  checkout: ["Checkout", "CheckoutM", "CheckoutError"],
  payfail: ["PaymentFailed"],
  success: ["Success", "Status"],
  quote: ["Quote"],
  quoteok: ["QuoteSuccess"],
  track: ["Track"],
  account: ["AccountOrders"],
  about: ["About"],
  contact: ["Contact"],
  legal: ["Delivery"],
  "ad-dash": ["AdminDashboard"],
  "ad-orders": ["AdminOrders"],
  "ad-order": ["AdminOrderDetail"],
  "ad-quote": ["AdminQuote"],
  "ad-products": ["AdminProducts"],
  "ad-project": ["AdminProjectEditor"],
  // Overlays shown on top of any page: always scoped to their own root element.
  drawer: ["CartDrawer", "CartDrawerM"],
  menu: ["MenuM"],
};
const OVERLAY = { drawer: ".cart-drawer", menu: ".menu-sheet" };
for (const g of Object.keys(GROUPS)) { const isAdmin = g.startsWith("ad-"); if ((which === "admin") !== isAdmin && !(which === "store" && OVERLAY[g])) delete GROUPS[g]; }
const SKIP_SEL = /^(\.component|#root|#root>\.component|body|\.sprite)$/;

function splitRules(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    let depth = 0, j = open;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") { depth--; if (depth === 0) break; }
    }
    const body = css.slice(open + 1, j);
    if (head.startsWith("@media")) for (const r of splitRules(body)) rules.push({ media: head.replace(/\s+/g, ""), sel: r.sel, decl: r.decl });
    else rules.push({ media: "", sel: head, decl: body.trim() });
    i = j + 1;
  }
  return rules;
}

// rules per group, deduped, in first-seen order
const groupRules = {};
const rootVars = new Map();
const fontLinks = new Set();
for (const [g, files] of Object.entries(GROUPS)) {
  const seen = new Set();
  groupRules[g] = [];
  for (const f of files) {
    const html = readFileSync(join(src, `${f}.html`), "utf8");
    for (const m of html.matchAll(/<link href="(https:\/\/fonts[^"]+)"/g)) fontLinks.add(m[1]);
    const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const r of splitRules(css)) {
      if (r.sel === ":root" && !r.media) {
        for (const d of r.decl.split(";")) { const k = d.indexOf(":"); if (k > 0) rootVars.set(d.slice(0, k).trim(), d.slice(k + 1).trim()); }
        continue;
      }
      if (SKIP_SEL.test(r.sel)) continue;
      const key = `${r.media}|${r.sel}|${r.decl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      groupRules[g].push(r);
    }
  }
}

// A (media, selector) is global when every non-overlay group that uses it writes exactly one identical rule.
// Keyed by selector alone: a selector is global only when every group that uses it writes exactly the
// same rules for it at every screen size (otherwise a media rule from one page would leak onto another).
const usage = new Map(); // sel -> Map(group -> Set(media|decl))
for (const [g, rules] of Object.entries(groupRules)) {
  if (OVERLAY[g]) continue;
  for (const r of rules) {
    if (!usage.has(r.sel)) usage.set(r.sel, new Map());
    const m = usage.get(r.sel);
    if (!m.has(g)) m.set(g, new Set());
    m.get(g).add(`${r.media}|${r.decl}`);
  }
}
// Pages that use each class in any selector. A rule like .chip::before used by two pages must not
// leak onto a third page that styles .chip without it.
const classPages = new Map();
for (const [sel, m] of usage) for (const cls of sel.match(/\.[\w-]+/g) ?? []) {
  if (!classPages.has(cls)) classPages.set(cls, new Set());
  for (const g of m.keys()) classPages.get(cls).add(g);
}
const isGlobal = (k) => {
  const sel = k.slice(k.indexOf("|") + 1);
  const m = usage.get(sel);
  if (!m) return false;
  for (const cls of sel.match(/\.[\w-]+/g) ?? []) for (const g of classPages.get(cls) ?? []) if (!m.has(g)) return false;
  const sigs = new Set([...m.values()].map((s) => [...s].sort().join("\n")));
  return sigs.size === 1;
};

function scopeSel(sel, scope) {
  return sel.split(/,(?![^(]*\))/).map((s) => {
    s = s.trim();
    if (s.startsWith("@")) return s;
    return `${scope} ${s}`;
  }).join(",");
}

let out = `/* Generated from Designs/*.html by merge.mjs. Global rules first, then page-scoped rules. */\n`;
out += `:root{${[...rootVars].map(([k, v]) => `${k}:${v}`).join(";")}}\n`;
out += "body{margin:0;background:var(--color-bg)}\n";
// Order: every page's rules must keep their relative order. Each rule unit (a global rule shared by
// pages, or one page's scoped rule) is a node; consecutive rules in a page are edges. A stable
// topological sort gives one order that respects every page. A global rule caught in a cycle is
// split back into per-page scoped copies and the sort is retried.
const wrap = (media, rule) => (media ? `${media}{${rule}}\n` : `${rule}\n`);
const demoted = new Set();
function unitKey(g, r) {
  const k = `${r.media}|${r.sel}`;
  if (OVERLAY[g]) return `O|${g}|${k}|${r.decl}`;
  if (isGlobal(k) && !demoted.has(k)) return `G|${k}|${r.decl}`;
  return `S|${g}|${k}|${r.decl}`;
}
function build() {
  const nodes = new Map(); // key -> {g, r, order}
  const edges = new Map();
  const indeg = new Map();
  let seq = 0;
  for (const [g, rules] of Object.entries(groupRules)) {
    let prev = null;
    for (const r of rules) {
      const key = unitKey(g, r);
      if (!nodes.has(key)) { nodes.set(key, { g, r, order: seq++ }); edges.set(key, new Set()); indeg.set(key, 0); }
      if (prev && prev !== key && !edges.get(prev).has(key)) { edges.get(prev).add(key); indeg.set(key, indeg.get(key) + 1); }
      prev = key;
    }
  }
  // Kahn's algorithm, always taking the earliest-seen ready node.
  const ready = [...nodes.keys()].filter((k) => indeg.get(k) === 0).sort((a, b) => nodes.get(a).order - nodes.get(b).order);
  const out = [];
  while (ready.length) {
    const k = ready.shift();
    out.push(k);
    for (const n of edges.get(k)) {
      indeg.set(n, indeg.get(n) - 1);
      if (indeg.get(n) === 0) {
        const o = nodes.get(n).order;
        let at = ready.findIndex((x) => nodes.get(x).order > o);
        if (at < 0) at = ready.length;
        ready.splice(at, 0, n);
      }
    }
  }
  if (out.length < nodes.size) {
    // Find one real cycle among the unsorted nodes (DFS), and return its global nodes.
    const done = new Set(out);
    const left = [...nodes.keys()].filter((k) => !done.has(k));
    const state = new Map();
    const stack = [];
    let found = null;
    const dfs = (k) => {
      state.set(k, 1); stack.push(k);
      for (const n of edges.get(k)) {
        if (done.has(n) || found) continue;
        if (state.get(n) === 1) { found = stack.slice(stack.indexOf(n)); return; }
        if (!state.has(n)) dfs(n);
        if (found) return;
      }
      state.set(k, 2); stack.pop();
    };
    for (const k of left) { if (!state.has(k)) dfs(k); if (found) break; }
    const globals = (found ?? left).filter((k) => k.startsWith("G|"));
    return { cycle: globals.length ? globals : left.filter((k) => k.startsWith("G|")), nodes, out };
  }
  return { cycle: null, nodes, out };
}
let res = build();
for (let tries = 0; res.cycle && tries < 500; tries++) {
  const k = res.cycle[0].split("|").slice(1, 3).join("|");
  demoted.add(k);
  res = build();
}
if (res.cycle) throw new Error("could not order rules");
console.log("demoted from global:", demoted.size);
for (const key of res.out) {
  const { g, r } = res.nodes.get(key);
  if (key.startsWith("G|")) out += wrap(r.media, `${r.sel}{${r.decl}}`);
  else if (key.startsWith("O|")) out += wrap(r.media, `${scopeSel(r.sel, `:where(${OVERLAY[g]})`)}{${r.decl}}`);
  else out += wrap(r.media, `${scopeSel(r.sel, `:where(.pg-${g})`)}{${r.decl}}`);
}writeFileSync(outFile, out);
console.log("fonts:", [...fontLinks].join(" | "));
console.log("bytes:", out.length);
