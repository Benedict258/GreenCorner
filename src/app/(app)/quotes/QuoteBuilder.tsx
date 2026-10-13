"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatNaira, priceBundle, priceComponent, SUPPLIER_LABEL, type ListingPrice, type Supplier, type Warning } from "@/lib/pricing";
import { defaultDescription, formatDocDate, lagosToday, nairaInWords } from "@/lib/quoteDocument";
import { ListingBadges } from "@/components/Badges";
import { saveQuoteAction } from "./actions";

type LineKind = "component" | "bundle" | "custom";

export interface BuilderCatalog {
  nowIso: string;
  staleAfterHours: number;
  components: { id: number; name: string; category: string; markupPct: number; listings: ListingPrice[] }[];
  bundles: { id: number; name: string; items: { componentId: number; quantity: number }[] }[];
}
export interface InitialLine {
  lineId: number;
  kind: LineKind;
  refId: number | null;
  name: string;
  description: string;
  quantity: number;
  supplierUsed: Supplier | null;
  unitPrice: number;
  priceOverride: boolean;
  markupPct: number | null;
  warnings: Warning[];
  detail: { name: string; quantity: number; unitPrice: number; lineTotal: number }[] | null;
}
export interface InitialQuote {
  id: number | null;
  billTo: string;
  attn: string;
  notes: string;
  validUntil: string; // YYYY-MM-DD or ""
  quoteNumber: string | null;
  quoteDate: string | null;
  lines: InitialLine[];
}
/** Lines to start a new quote with, priced live (the Shop cart). */
export interface StartLine { kind: "component" | "bundle"; refId: number; quantity: number }

interface Line {
  key: string;
  kind: LineKind;
  refId: number | null;
  quantity: number;
  reprice: boolean;
  frozen: InitialLine | null;
  description: string;
  /** Unit price typed by hand; "" means the calculated price. */
  priceText: string;
}

let seq = 0;
const newKey = () => `l${++seq}`;
const parsePrice = (s: string): number | null => {
  const n = Number(s.replace(/[₦,\s]/g, ""));
  return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export default function QuoteBuilder({ catalog, initial, startLines = [], fromCart = false }: { catalog: BuilderCatalog; initial: InitialQuote; startLines?: StartLine[]; fromCart?: boolean }) {
  const router = useRouter();
  const [billTo, setBillTo] = useState(initial.billTo);
  const [attn, setAttn] = useState(initial.attn);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [notes, setNotes] = useState(initial.notes);
  const now = useMemo(() => new Date(catalog.nowIso), [catalog.nowIso]);
  const opts = { now, staleAfterHours: catalog.staleAfterHours };
  const comps = useMemo(() => new Map(catalog.components.map((c) => [c.id, c])), [catalog]);
  const bundles = useMemo(() => new Map(catalog.bundles.map((b) => [b.id, b])), [catalog]);

  const bundleItems = (b: BuilderCatalog["bundles"][number]) =>
    b.items.map((i) => { const c = comps.get(i.componentId)!; return { componentId: c.id, name: c.name, markupPct: c.markupPct, listings: c.listings, quantity: i.quantity }; });
  const describe = (kind: LineKind, refId: number | null): string => {
    if (kind === "component") return comps.get(refId!)?.name ?? "";
    if (kind === "bundle") { const b = bundles.get(refId!); return b ? defaultDescription(b.name, bundleItems(b)) : ""; }
    return "";
  };

  const [lines, setLines] = useState<Line[]>(() => [
    ...initial.lines.map((l) => ({
      key: newKey(), kind: l.kind, refId: l.refId, quantity: l.quantity, reprice: false, frozen: l,
      description: l.description, priceText: l.priceOverride ? String(l.unitPrice) : "",
    })),
    ...startLines.map((l) => ({ key: newKey(), kind: l.kind, refId: l.refId, quantity: l.quantity, reprice: false, frozen: null, description: describe(l.kind, l.refId), priceText: "" })),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const change = (fn: (l: Line[]) => Line[]) => { setLines(fn); setDirty(true); };
  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };

  function add(kind: "component" | "bundle", refId: number) {
    change((ls) => {
      const hit = ls.find((l) => l.kind === kind && l.refId === refId);
      if (hit) return ls.map((l) => (l === hit ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { key: newKey(), kind, refId, quantity: 1, reprice: false, frozen: null, description: describe(kind, refId), priceText: "" }];
    });
  }
  const addCustom = () => change((ls) => [...ls, { key: newKey(), kind: "custom", refId: null, quantity: 1, reprice: false, frozen: null, description: "", priceText: "" }]);
  const patch = (key: string, p: Partial<Line>) => change((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  // Same rules as saveQuote: a saved calculated price is kept until repriced; otherwise the price is calculated
  // live; a price typed by hand always wins. (Clearing a hand-set price on a saved line reprices it.)
  const rows = lines.map((l) => {
    const keepSaved = !!l.frozen && !l.reprice && !l.frozen.priceOverride;
    let calc: number | null = null;
    let warnings: Warning[] = [];
    let listings: ListingPrice[] | null = null;
    let markup: number | null = null;
    let gone = false;
    if (l.kind === "component") {
      const c = comps.get(l.refId!);
      if (c) {
        const p = priceComponent(c.listings, c.markupPct, l.quantity, opts);
        calc = p.supplierUsed ? p.unitPrice : null;
        warnings = p.warnings;
        listings = c.listings;
        markup = c.markupPct;
      } else {
        gone = true;
        warnings = [{ code: "no_price", message: "This component was removed from the Catalog." } as Warning];
      }
    } else if (l.kind === "bundle") {
      const b = bundles.get(l.refId!);
      if (b) {
        const p = priceBundle(bundleItems(b), l.quantity, opts);
        calc = p.unitPrice;
        warnings = p.warnings;
      } else {
        gone = true;
        warnings = [{ code: "no_price", message: "This bundle was removed." } as Warning];
      }
    }
    if (keepSaved) {
      calc = l.frozen!.unitPrice;
      warnings = l.frozen!.warnings;
    }
    const typed = parsePrice(l.priceText);
    const unit = typed ?? calc ?? 0;
    const badPrice = l.priceText.trim() !== "" && typed === null;
    return { l, calc, typed, unit, total: unit * l.quantity, badPrice, frozen: keepSaved, gone, listings, markup, warnings };
  });
  const total = rows.reduce((s, r) => s + r.total, 0);

  function save() {
    setError(null);
    if (!billTo.trim()) return setError("Fill in Bill To: the school or organisation the quote is for.");
    if (!validUntil) return setError("Set the Valid Until date.");
    if (lines.length === 0) return setError("Add at least one item.");
    const bad = rows.find((r) => r.badPrice || (r.l.kind === "custom" && (!r.typed || !r.l.description.trim())));
    if (bad) return setError(bad.l.kind === "custom" ? "Each custom line needs a description and a unit price." : `Check the unit price for "${bad.l.description.slice(0, 60)}".`);
    start(async () => {
      const res = await saveQuoteAction(
        initial.id,
        { billTo, attn, notes, validUntil },
        lines.map((l) => ({
          lineId: l.frozen?.lineId ?? null, kind: l.kind, refId: l.refId, quantity: l.quantity, reprice: l.reprice,
          description: l.description, unitPrice: parsePrice(l.priceText),
        })),
        fromCart,
      );
      if ("error" in res) return setError(res.error);
      setDirty(false);
      router.push(`/quotes/${res.id}/view`);
    });
  }

  const today = lagosToday(now);
  return (
    <>
      <div className="page-head">
        <h1>{initial.id ? `Edit quotation ${initial.quoteNumber}` : "New quotation"}</h1>
        <div>
          <Link className="btn" href={initial.id ? `/quotes/${initial.id}/view` : fromCart ? "/shop/cart" : "/quotes"}>{fromCart ? "Back to cart" : dirty ? "Discard" : "Back"}</Link>
          {initial.id && lines.some((l) => l.frozen) && (
            <button type="button" className="btn" onClick={() => change((ls) => ls.map((l) => ({ ...l, reprice: true })))} title="Replace saved calculated prices with today's prices">Reprice all</button>
          )}
          <button type="button" className="btn primary" onClick={save} disabled={pending}>{pending ? "Saving..." : "Save quote"}</button>
        </div>
      </div>
      {error && <p className="error card" role="alert">{error}</p>}

      <div className="card stack">
        <div className="row">
          <label>Bill to (school or organisation) *<input value={billTo} onChange={(e) => touch(setBillTo)(e.target.value)} maxLength={200} placeholder="e.g. Superior Minds Academy" required /></label>
          <label>Attn<input value={attn} onChange={(e) => touch(setAttn)(e.target.value)} maxLength={200} placeholder="e.g. The School Administrator" /></label>
        </div>
        <div className="row">
          <label style={{ flex: "0 1 220px" }}>Valid until *<input type="date" value={validUntil} min={initial.quoteDate ?? today} onChange={(e) => touch(setValidUntil)(e.target.value)} required /></label>
          <p className="muted small doc-meta">
            {initial.quoteNumber
              ? <>Quotation No <strong>{initial.quoteNumber}</strong> · Date {formatDocDate(initial.quoteDate!)}</>
              : <>The quotation number and date ({formatDocDate(today)}) are set automatically when you save.</>}
          </p>
        </div>
        <label>Notes <span className="small">(one point per line; each line is a bullet on the PDF)</span>
          <textarea rows={4} value={notes} onChange={(e) => touch(setNotes)(e.target.value)} maxLength={4000}
            placeholder={"e.g. Kits will be delivered and set up within 2 working days of payment confirmation.\nThis quotation is valid for 14 days from the date above."} />
        </label>
      </div>

      <Picker catalog={catalog} onAdd={add} onAddCustom={addCustom} />

      <div className="table-wrap">
        <table className="builder-table">
          <thead>
            <tr><th className="num">Qty</th><th>Description (as printed)</th><th className="num">Unit price</th><th className="num">Amount</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No items yet. Search above to add components or bundles, or add a custom line.</td></tr>}
            {rows.map((r) => (
              <tr key={r.l.key}>
                <td className="num"><input className="qty" type="number" min={1} max={100000} value={r.l.quantity} aria-label="Quantity" onFocus={(e) => e.target.select()} onChange={(e) => patch(r.l.key, { quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} /></td>
                <td className="desc-cell">
                  <textarea rows={Math.min(6, Math.max(2, Math.ceil(r.l.description.length / 70)))} value={r.l.description} maxLength={2000}
                    aria-label="Description" placeholder={r.l.kind === "custom" ? "Describe this item, e.g. STEM Master Kit — includes ..." : ""}
                    onChange={(e) => patch(r.l.key, { description: e.target.value })} />
                  <div className="line-info small">
                    {r.l.kind === "bundle" && <span className="badge neutral">Bundle</span>}
                    {r.l.kind === "custom" && <span className="badge neutral">Custom line</span>}
                    {r.frozen && <span className="badge neutral" title="Saved price kept">Saved price</span>}
                    {r.frozen && !r.gone && <button type="button" className="btn small" onClick={() => patch(r.l.key, { reprice: true })}>Reprice</button>}
                    {r.l.kind === "component" && r.listings?.map((l) => (
                      <span key={l.supplier} className="muted">
                        {SUPPLIER_LABEL[l.supplier]} {l.price !== null ? formatNaira(l.price) : "no price"}{l.unitsPerListing > 1 ? ` (pack of ${l.unitsPerListing})` : ""} + {r.markup}%{" "}
                        <ListingBadges l={l} now={now} staleAfterHours={catalog.staleAfterHours} />
                      </span>
                    ))}
                  </div>
                  {r.warnings.length > 0 && <ul className="warnings">{r.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
                </td>
                <td className="num price-cell">
                  <input className="price" inputMode="numeric" value={r.l.priceText} aria-label="Unit price"
                    placeholder={r.calc !== null ? String(r.calc) : "Price"} aria-invalid={r.badPrice || undefined}
                    onFocus={(e) => e.target.select()} onChange={(e) => patch(r.l.key, { priceText: e.target.value })} />
                  {r.l.kind !== "custom" && (r.typed !== null
                    ? <small>Set by hand · <button type="button" className="link-btn" onClick={() => patch(r.l.key, { priceText: "" })}>use {r.calc !== null ? formatNaira(r.calc) : "calculated"}</button></small>
                    : <small>Calculated</small>)}
                </td>
                <td className="num"><strong>{formatNaira(r.total)}</strong></td>
                <td><button type="button" className="btn small danger" aria-label="Remove line" onClick={() => change((ls) => ls.filter((x) => x.key !== r.l.key))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="total-bar">
        <span className="muted">{total > 0 ? `${nairaInWords(total)}. ` : ""}No delivery, VAT or other fees.</span>
        <strong aria-live="polite">{formatNaira(total)}</strong>
      </div>
    </>
  );
}

function Picker({ catalog, onAdd, onAddCustom }: { catalog: BuilderCatalog; onAdd: (k: "component" | "bundle", id: number) => void; onAddCustom: () => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const cats = useMemo(() => [...new Set(catalog.components.map((c) => c.category))].sort(), [catalog]);
  const needle = q.trim().toLowerCase();
  const opts = { now: new Date(catalog.nowIso), staleAfterHours: catalog.staleAfterHours };
  const compHits = catalog.components.filter((c) => (!cat || c.category === cat) && (!needle || c.name.toLowerCase().includes(needle))).slice(0, 15);
  const bundleHits = cat ? [] : catalog.bundles.filter((b) => !needle || b.name.toLowerCase().includes(needle)).slice(0, 8);

  return (
    <div className="card" ref={wrap} onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <div className="row">
        <label>Add a component or bundle
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search by name" autoComplete="off" />
        </label>
        <label style={{ flex: "0 1 200px" }}>Category
          <select value={cat} onChange={(e) => { setCat(e.target.value); setOpen(true); }}>
            <option value="">All</option>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" className="btn" onClick={onAddCustom}>Add custom line</button>
      </div>
      {open && (compHits.length > 0 || bundleHits.length > 0) && (
        <div className="picker"><div className="picker-list" role="listbox">
          {bundleHits.map((b) => (
            <button type="button" key={`b${b.id}`} onClick={() => onAdd("bundle", b.id)}>
              <span>{b.name} <span className="badge neutral">Bundle</span></span>
              <span className="muted">{formatNaira(priceBundle(b.items.map((i) => { const c = catalog.components.find((x) => x.id === i.componentId)!; return { componentId: c.id, name: c.name, markupPct: c.markupPct, listings: c.listings, quantity: i.quantity }; }), 1, opts).unitPrice)}</span>
            </button>
          ))}
          {compHits.map((c) => {
            const p = priceComponent(c.listings, c.markupPct, 1, opts);
            return (
              <button type="button" key={`c${c.id}`} onClick={() => onAdd("component", c.id)}>
                <span>{c.name} <span className="muted small">{c.category}</span></span>
                <span className="muted">{p.supplierUsed ? formatNaira(p.unitPrice) : "No price"}</span>
              </button>
            );
          })}
        </div></div>
      )}
      {open && compHits.length === 0 && bundleHits.length === 0 && <p className="muted">Nothing matches. Find it in the <Link href="/shop">Shop</Link> and add it to the cart, add it in the Catalog, or use Add custom line.</p>}
    </div>
  );
}
