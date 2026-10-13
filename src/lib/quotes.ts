import { query, tx } from "./db";
import { loadBundles, loadComponents } from "./catalog";
import { priceBundle, priceComponent, roundNaira, type Supplier, type Warning } from "./pricing";
import { getSettings } from "./settings";
import { defaultDescription, isIsoDate, lagosToday, makeQuoteNumber } from "./quoteDocument";

export type LineKind = "component" | "bundle" | "custom";

export interface LineInput {
  lineId?: number | null;
  kind: LineKind;
  /** Component or bundle id; null for a custom line. */
  refId: number | null;
  quantity: number;
  /** What the customer sees in the Description column. Empty means the item's name. */
  description?: string;
  /** Unit price set by hand, in whole naira. Null or missing means the calculated price. Required for custom lines. */
  unitPrice?: number | null;
  /** Drop the saved snapshot and price this line at today's prices. */
  reprice?: boolean;
}

export interface QuoteHeader {
  /** Bill To: the school or organisation. Also the quote's name in the app. */
  billTo: string;
  attn: string;
  notes: string;
  /** YYYY-MM-DD, set by the person making the quote. */
  validUntil: string;
}

export interface QuoteLineRecord {
  id: number;
  position: number;
  componentId: number | null;
  bundleId: number | null;
  name: string;
  description: string;
  quantity: number;
  supplierUsed: Supplier | null;
  supplierPrice: number | null;
  markupPct: number | null;
  unitPrice: number;
  priceOverride: boolean;
  lineTotal: number;
  detail: unknown;
  warnings: Warning[];
}

export interface QuoteRecord {
  id: number;
  name: string;
  attn: string;
  notes: string;
  quoteNumber: string;
  quoteDate: string; // YYYY-MM-DD
  validUntil: string | null; // YYYY-MM-DD; null only on quotes made before validity existed
  createdAt: string;
  updatedAt: string;
  total: number;
  lines: QuoteLineRecord[];
}

const MAX_PRICE = 1_000_000_000;

export function lineKind(l: Pick<QuoteLineRecord, "componentId" | "bundleId">): LineKind {
  return l.componentId ? "component" : l.bundleId ? "bundle" : "custom";
}

/** pg returns a date column as a JS Date at local midnight; turn it back into the calendar date. */
const isoDay = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  const d = v as Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function toLine(r: any): QuoteLineRecord {
  return {
    id: r.id,
    position: r.position,
    componentId: r.component_id,
    bundleId: r.bundle_id,
    name: r.name,
    description: r.description ?? r.name,
    quantity: r.quantity,
    supplierUsed: r.supplier_used,
    supplierPrice: r.supplier_price_ngn,
    markupPct: r.markup_pct,
    unitPrice: r.unit_price_ngn,
    priceOverride: !!r.price_override,
    lineTotal: r.line_total_ngn,
    detail: r.detail,
    warnings: r.warnings ?? [],
  };
}

export async function loadQuote(id: number): Promise<QuoteRecord | null> {
  const [q] = await query("select * from quotes where id = $1", [id]);
  if (!q) return null;
  const lines = await query("select * from quote_lines where quote_id = $1 order by position, id", [id]);
  return {
    id: q.id,
    name: q.name,
    attn: q.bill_to_attn ?? "",
    notes: q.notes,
    quoteNumber: q.quote_number,
    quoteDate: isoDay(q.quote_date)!,
    validUntil: isoDay(q.valid_until),
    createdAt: new Date(q.created_at).toISOString(),
    updatedAt: new Date(q.updated_at).toISOString(),
    total: q.total_ngn,
    lines: lines.map(toLine),
  };
}

export async function listQuotes() {
  return (await query("select q.id, q.name, q.quote_number, q.total_ngn, q.updated_at, (select count(*)::int from quote_lines l where l.quote_id = q.id) as lines from quotes q order by q.updated_at desc")).map(
    (r) => ({ id: r.id as number, name: r.name as string, quoteNumber: r.quote_number as string, total: r.total_ngn as number, updatedAt: new Date(r.updated_at).toISOString(), lines: r.lines as number }),
  );
}

type Snapshot = Omit<QuoteLineRecord, "id" | "position">;

function cleanPrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = roundNaira(Number(v));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PRICE) throw new Error("Unit prices must be more than ₦0 and at most ₦1,000,000,000.");
  return n;
}

/**
 * Saves a quote. Each line is re-priced from the database here (the client is never trusted for calculated
 * prices), except lines that already exist on this quote and are unchanged: those keep their saved snapshot so
 * later supplier syncs never change a saved quote. A unit price typed by hand replaces the calculated one.
 * The quotation number and date are set once, when the quote is first saved.
 */
export async function saveQuote(id: number | null, header: QuoteHeader, inputs: LineInput[]): Promise<number> {
  const billTo = header.billTo.trim().slice(0, 200);
  if (!billTo) throw new Error("Fill in Bill To: the school or organisation the quote is for.");
  const attn = header.attn.trim().slice(0, 200);
  const notes = header.notes.trim().slice(0, 4000);
  if (!isIsoDate(header.validUntil)) throw new Error("Set the Valid Until date.");
  if (inputs.length === 0) throw new Error("Add at least one item.");
  if (inputs.length > 200) throw new Error("A quote can have at most 200 lines.");
  const settings = await getSettings();
  const now = new Date();
  const opts = { now, staleAfterHours: settings.staleAfterHours };

  const existingQuote = id ? await loadQuote(id) : null;
  if (id && !existingQuote) throw new Error("Quote not found.");
  const existing = existingQuote?.lines ?? [];
  const quoteDate = existingQuote?.quoteDate ?? lagosToday(now);
  if (header.validUntil < quoteDate) throw new Error("Valid Until cannot be before the quotation date.");

  const compIds = inputs.filter((l) => l.kind === "component" && l.refId).map((l) => l.refId as number);
  const bundleIds = inputs.filter((l) => l.kind === "bundle" && l.refId).map((l) => l.refId as number);
  const bundles = await loadBundles({ ids: bundleIds });
  const neededComps = new Set([...compIds, ...bundles.flatMap((b) => b.items.map((i) => i.componentId))]);
  const comps = new Map((await loadComponents({ ids: [...neededComps] })).map((c) => [c.id, c]));
  const bundleMap = new Map(bundles.map((b) => [b.id, b]));

  const snapshots: Snapshot[] = inputs.map((inp) => {
    const qty = Math.floor(Number(inp.quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > 100000) throw new Error("Quantities must be whole numbers from 1 to 100,000.");
    const override = cleanPrice(inp.unitPrice);
    const description = String(inp.description ?? "").trim().slice(0, 2000);
    const prev = inp.lineId ? existing.find((e) => e.id === inp.lineId) : undefined;
    const sameRef = prev && lineKind(prev) === inp.kind && (inp.kind === "custom" || (inp.kind === "component" ? prev.componentId : prev.bundleId) === inp.refId);
    // A line whose hand-set price is cleared goes back to the calculated price, at today's prices.
    const keep = prev && sameRef && !inp.reprice && !(prev.priceOverride && override === null);

    let base: Snapshot;
    if (keep) {
      base = { ...prev! };
    } else if (inp.kind === "custom") {
      if (!description) throw new Error("A custom line needs a description.");
      if (override === null) throw new Error(`Set a unit price for "${description.slice(0, 60)}".`);
      base = {
        componentId: null, bundleId: null, name: description.split(/\r?\n/)[0].slice(0, 200), description, quantity: qty, supplierUsed: null,
        supplierPrice: null, markupPct: null, unitPrice: override, priceOverride: true, lineTotal: 0, detail: null, warnings: [],
      };
    } else if (inp.kind === "component") {
      const c = comps.get(inp.refId as number);
      if (!c) throw new Error("A component on this quote no longer exists.");
      const p = priceComponent(c.listings, c.markupPct, qty, opts);
      base = {
        componentId: c.id, bundleId: null, name: c.name, description: c.name, quantity: qty, supplierUsed: p.supplierUsed, supplierPrice: p.supplierPrice,
        markupPct: c.markupPct, unitPrice: p.unitPrice, priceOverride: false, lineTotal: 0, detail: null, warnings: p.warnings,
      };
    } else {
      const b = bundleMap.get(inp.refId as number);
      if (!b) throw new Error("A bundle on this quote no longer exists.");
      const items = b.items.map((i) => {
        const c = comps.get(i.componentId)!;
        return { componentId: c.id, name: c.name, markupPct: c.markupPct, listings: c.listings, quantity: i.quantity };
      });
      const p = priceBundle(items, qty, opts);
      base = {
        componentId: null, bundleId: b.id, name: b.name, description: defaultDescription(b.name, items), quantity: qty, supplierUsed: null,
        supplierPrice: null, markupPct: null, unitPrice: p.unitPrice, priceOverride: false, lineTotal: 0, detail: p.breakdown, warnings: p.warnings,
      };
    }
    const unitPrice = override ?? base.unitPrice;
    return {
      ...base,
      description: description || base.description,
      quantity: qty,
      unitPrice,
      priceOverride: override !== null,
      lineTotal: unitPrice * qty,
    };
  });

  const total = snapshots.reduce((s, l) => s + l.lineTotal, 0);
  return tx(async (c) => {
    let quoteId = id;
    if (quoteId) {
      await c.query(
        "update quotes set name = $2, bill_to_attn = $3, notes = $4, valid_until = $5, total_ngn = $6, updated_at = now() where id = $1",
        [quoteId, billTo, attn, notes, header.validUntil, total],
      );
      await c.query("delete from quote_lines where quote_id = $1", [quoteId]);
    } else {
      // Lock so two quotes saved at the same moment cannot take the same number.
      await c.query("lock table quotes in share row exclusive mode");
      const probe = makeQuoteNumber(billTo, quoteDate, []);
      const taken = (await c.query("select quote_number from quotes where quote_number = $1 or quote_number like $2", [probe, `${probe}-%`])).rows.map((r) => r.quote_number);
      const quoteNumber = makeQuoteNumber(billTo, quoteDate, taken);
      quoteId = (await c.query(
        `insert into quotes (name, bill_to_attn, notes, quote_number, quote_date, valid_until, total_ngn)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [billTo, attn, notes, quoteNumber, quoteDate, header.validUntil, total],
      )).rows[0].id;
    }
    let pos = 0;
    for (const s of snapshots) {
      await c.query(
        `insert into quote_lines (quote_id, position, component_id, bundle_id, name, description, quantity, supplier_used, supplier_price_ngn, markup_pct,
           unit_price_ngn, price_override, line_total_ngn, detail, warnings) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [quoteId, pos++, s.componentId, s.bundleId, s.name, s.description, s.quantity, s.supplierUsed, s.supplierPrice, s.markupPct, s.unitPrice,
         s.priceOverride, s.lineTotal, s.detail ? JSON.stringify(s.detail) : null, JSON.stringify(s.warnings)],
      );
    }
    return quoteId as number;
  });
}

/**
 * Copies a quote into a new one with a new number and today's date. Catalog lines are priced at today's prices;
 * hand-set prices, descriptions and custom lines are copied as they are. The validity keeps the same length.
 */
export async function duplicateQuote(id: number): Promise<number> {
  const q = await loadQuote(id);
  if (!q) throw new Error("Quote not found.");
  const days = q.validUntil ? Math.max(0, Math.round((Date.parse(q.validUntil) - Date.parse(q.quoteDate)) / 86_400_000)) : 14;
  const today = lagosToday();
  const validUntil = new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10);
  const inputs: LineInput[] = q.lines.map((l) => ({
    kind: lineKind(l),
    refId: l.componentId ?? l.bundleId,
    quantity: l.quantity,
    description: l.description,
    unitPrice: l.priceOverride ? l.unitPrice : null,
  }));
  return saveQuote(null, { billTo: q.name, attn: q.attn, notes: q.notes, validUntil }, inputs);
}

export async function deleteQuote(id: number): Promise<void> {
  await query("delete from quotes where id = $1", [id]);
}
