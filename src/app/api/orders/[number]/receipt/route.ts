import { currentStaff } from "@/lib/auth";
import { findOrderForCustomer, getOrderByNumber } from "@/lib/store/orders";
import { receiptPdf } from "@/lib/store/payments";

// The receipt for a paid order: for the customer (with the order's link token) or for staff.
export async function GET(req: Request, { params }: { params: Promise<{ number: string }> }) {
  const number = decodeURIComponent((await params).number);
  const token = new URL(req.url).searchParams.get("t") ?? undefined;
  const o = (await currentStaff()) ? await getOrderByNumber(number) : await findOrderForCustomer(number, { token });
  if (!o || !o.paidAt) return new Response("Not found", { status: 404 });
  const pdf = await receiptPdf(o);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="Receipt-${o.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
