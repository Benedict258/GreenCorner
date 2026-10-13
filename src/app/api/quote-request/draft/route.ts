import { clientIp, FORM_LIMITS, hit } from "@/lib/guard";
import { lagosToday } from "@/lib/quoteDocument";
import { renderQuotationPdf } from "@/lib/quotePdf";
import { parseLines, priceLines } from "@/lib/store/quoteRequests";

// "Download draft PDF" on the quote request form: the customer's items at today's prices, in the
// quotation layout, clearly marked as a draft. Nothing is saved.
export async function POST(req: Request) {
  if (await hit(clientIp(req.headers), FORM_LIMITS).catch(() => null)) return new Response("Too many requests. Wait a minute.", { status: 429 });
  const form = await req.formData();
  const lines = await priceLines(parseLines(String(form.get("lines") ?? "[]"))).catch(() => []);
  if (lines.length === 0) return new Response("Add at least one item first.", { status: 400 });
  const org = String(form.get("organisation") ?? "").trim().slice(0, 200) || "Your organisation";
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const total = lines.reduce((n, l) => n + l.lineTotal, 0);
  const pdf = await renderQuotationPdf(
    {
      name: org,
      attn: name,
      notes: ["Draft prepared online at today's prices. Waste2Light will confirm prices and availability in the official quotation.", ...lines.filter((l) => l.note).map((l) => `${l.title}: ${l.note}`)].join("\n"),
      quoteNumber: "DRAFT",
      quoteDate: lagosToday(),
      validUntil: null,
      total,
      lines: lines.map((l, i) => ({ id: i, quantity: l.quantity, description: l.title, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
    },
    "draft",
  );
  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="Waste2Light-draft-quotation.pdf"', "cache-control": "no-store" },
  });
}
