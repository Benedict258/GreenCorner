import { load } from "cheerio";
import type { AnyNode, Element } from "domhandler";

// Supplier descriptions are shown on our product pages, so they are cut down to plain formatting:
// no links, images, scripts, styles or attributes, and nothing that names the supplier or its stock codes.
const KEEP = new Set(["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "h3", "h4", "table", "thead", "tbody", "tr", "th", "td", "sub", "sup", "hr", "blockquote", "code"]);
const RENAME: Record<string, string> = { h1: "h3", h2: "h3", h5: "h4", h6: "h4", b: "strong", i: "em" };
const DROP = new Set(["script", "style", "img", "meta", "link", "iframe", "object", "embed", "form", "input", "button", "svg", "video", "audio", "noscript", "template"]);
const SUPPLIER = /micro\s*scale/i;
/** Supplier stock codes such as (MSC-2782) or MDL-2315. */
const SKU = /\(?\b[A-Z]{2,4}-\d{3,5}\b\)?/g;

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Text of a node without touching the tree (cheerio's load(node) would move it out of its parent). */
function textOf(n: AnyNode): string {
  if (n.type === "text") return (n as unknown as { data: string }).data;
  const kids = (n as Element).children;
  return kids ? kids.map(textOf).join("") : "";
}

function render(nodes: AnyNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") {
      out += escapeText((n as unknown as { data: string }).data.replace(SKU, ""));
      continue;
    }
    if (n.type !== "tag") continue;
    const el = n as Element;
    let tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) continue;
    // A paragraph, list item or row that names the supplier goes entirely.
    if (["p", "li", "tr", "h1", "h2", "h3", "h4", "blockquote"].includes(tag) && SUPPLIER.test(textOf(el))) continue;
    tag = RENAME[tag] ?? tag;
    const inner = render(el.children);
    if (!KEEP.has(tag)) {
      out += inner; // unwrap a, span, div, small, font, etc.
      continue;
    }
    if (tag === "br" || tag === "hr") {
      out += `<${tag}>`;
      continue;
    }
    if (!inner.replace(/<br>|&nbsp;|\s/g, "") && tag !== "td" && tag !== "th") continue;
    out += `<${tag}>${inner}</${tag}>`;
  }
  return out;
}

/** Safe description HTML for the storefront. Empty when nothing useful is left. */
export function sanitizeDescription(html: string | null | undefined): string {
  if (!html || !html.trim()) return "";
  const $ = load(html, null, false);
  const out = render($.root().contents().toArray())
    .replace(/\s*\(\s*\)/g, "")
    // A removed stock code can leave "separately ." behind.
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .replace(/\s+<\/(li|p|td|th|h3|h4)>/g, "</$1>")
    .replace(/<(li|p|td|th|h3|h4)>\s+/g, "<$1>")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(<br>\s*){3,}/g, "<br><br>")
    .trim();
  // The supplier's name may still sit inside an inline run; never print it.
  return out.replace(/micro\s*scale(\.net)?/gi, "the supplier");
}

/** First paragraph of the description as plain text, for listings and meta descriptions. */
export function descriptionSummary(html: string, max = 160): string {
  const text = load(`<div>${html}</div>`, null, false)("p").first().text().replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
