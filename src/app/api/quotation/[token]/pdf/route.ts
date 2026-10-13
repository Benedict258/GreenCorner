import { queryOne } from "@/lib/db";
import { renderQuotationPdf } from "@/lib/quotePdf";
import { loadQuote } from "@/lib/quotes";

// The official quotation PDF for the customer, through the private link in their email.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,}$/.test(token)) return new Response("Not found", { status: 404 });
  const row = await queryOne("select id from quotes where access_token = $1 and sent_at is not null", [token]);
  const q = row ? await loadQuote(row.id) : null;
  if (!q) return new Response("Not found", { status: 404 });
  const pdf = await renderQuotationPdf(q);
  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${q.quoteNumber}.pdf"`, "cache-control": "private, no-store" },
  });
}
