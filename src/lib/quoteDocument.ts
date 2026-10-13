// The customer-facing quotation: fixed company details and the rules for the parts that are filled in.
// The fixed parts below are printed on every quotation exactly as written.
import { lagosParts } from "./time";

export const COMPANY = {
  name: "WASTE2LIGHT LTD",
  tagline: "Clean-Energy Technology & Manufacturing",
  payment: [
    ["Account Name", "Waste2Light Ltd"],
    ["Bank", "ACCESS BANK"],
    ["Account Number", "1980167231"],
  ] as const,
  authorizedBy: "Authorized by (Waste2Light Ltd)",
  signatureLine: "Name, Signature & Date",
};

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(now: Date = new Date()): string {
  const { y, m, day } = lagosParts(now);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "2026-10-06" -> "06 October 2026", as on the paper quotation. */
export function formatDocDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Accepts only a real calendar date written YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const SMALL_WORDS = new Set(["of", "the", "and", "for", "at", "in", "on", "a", "an"]);

/** "Superior Minds Academy" -> "SMA". Small joining words are skipped; at most 4 letters. */
export function customerInitials(billTo: string): string {
  const words = billTo.normalize("NFKD").replace(/[^A-Za-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const main = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
  const letters = (main.length ? main : words).map((w) => w[0].toUpperCase()).join("").slice(0, 4);
  return letters || "CUS";
}

/**
 * Quotation number as on the paper quotes: W2L-<customer initials>-<YYYYMMDD of the quote date>.
 * A second quote for the same initials on the same day gets -2, then -3, and so on.
 */
export function makeQuoteNumber(billTo: string, quoteDate: string, taken: Iterable<string>): string {
  const base = `W2L-${customerInitials(billTo)}-${quoteDate.replaceAll("-", "")}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function under1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
  const r = n % 100;
  if (r > 0) {
    const words = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : "");
    parts.push(n >= 100 ? `and ${words}` : words);
  }
  return parts.join(" ");
}

/** 300000 -> "Three Hundred Thousand Naira Only". Amounts are whole naira. */
export function nairaInWords(amount: number): string {
  const n = Math.round(amount);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Amount must be a whole, non-negative number of naira.");
  if (n === 0) return "Zero Naira Only";
  const groups: string[] = [];
  let rest = n;
  for (let i = 0; rest > 0; i++, rest = Math.floor(rest / 1000)) {
    const g = rest % 1000;
    if (g) groups.unshift(`${under1000(g)}${SCALES[i] ? ` ${SCALES[i]}` : ""}`);
  }
  return `${groups.join(" ")} Naira Only`;
}

/** Default customer description: the item name; for a bundle, its contents too, like the paper quotes. */
export function defaultDescription(name: string, contents?: { name: string; quantity: number }[] | null): string {
  if (!contents?.length) return name;
  return `${name} — Includes: ${contents.map((c) => (c.quantity > 1 ? `${c.name} x${c.quantity}` : c.name)).join(", ")}`;
}

/** Notes are typed one per line; each non-empty line is one bullet. Leading "-", "*" or "•" is dropped. */
export function notesToBullets(notes: string): string[] {
  return notes.split(/\r?\n/).map((l) => l.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
}
