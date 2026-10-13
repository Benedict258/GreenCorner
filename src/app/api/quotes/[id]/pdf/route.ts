import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { loadQuote } from "@/lib/quotes";
import { renderQuotationPdf } from "@/lib/quotePdf";

/** The customer quotation as a PDF. ?inline=1 shows it in the browser instead of downloading it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const id = Number((await params).id);
  const q = Number.isInteger(id) ? await loadQuote(id) : null;
  if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  const pdf = await renderQuotationPdf(q);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${q.quoteNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
