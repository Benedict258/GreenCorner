import { notFound } from "next/navigation";
import QuoteBuilder from "../QuoteBuilder";
import { loadBuilderCatalog } from "../builderData";
import { lineKind, loadQuote } from "@/lib/quotes";

export const metadata = { title: "Edit quote" };

export default async function EditQuote({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const q = await loadQuote(id);
  if (!q) notFound();
  const catalog = await loadBuilderCatalog();
  return (
    <QuoteBuilder
      catalog={catalog}
      initial={{
        id: q.id, billTo: q.name, attn: q.attn, notes: q.notes, validUntil: q.validUntil ?? "", quoteNumber: q.quoteNumber, quoteDate: q.quoteDate,
        lines: q.lines.map((l) => ({
          lineId: l.id, kind: lineKind(l), refId: l.componentId ?? l.bundleId, name: l.name, description: l.description,
          quantity: l.quantity, supplierUsed: l.supplierUsed, unitPrice: l.unitPrice, priceOverride: l.priceOverride, markupPct: l.markupPct, warnings: l.warnings,
          detail: Array.isArray(l.detail) ? (l.detail as { name: string; quantity: number; unitPrice: number; lineTotal: number }[]) : null,
        })),
      }}
    />
  );
}
