import { after } from "next/server";
import { redirect } from "next/navigation";
import { settlePaystack } from "@/lib/store/payments";

// Paystack sends the customer back here with ?reference=…; the result is checked with Paystack itself.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const reference = (u.searchParams.get("reference") ?? u.searchParams.get("trxref") ?? "").slice(0, 100);
  if (!reference) redirect("/checkout/failed");
  let target = `/checkout/failed?ref=${encodeURIComponent(reference)}`;
  try {
    const { outcome, followUp } = await settlePaystack(reference);
    after(followUp);
    if (outcome.kind === "paid") target = `/checkout/success/${encodeURIComponent(outcome.order.number)}?t=${outcome.order.accessToken}`;
    else if (outcome.kind === "pending" && outcome.order) target = `/track/${encodeURIComponent(outcome.order.number)}?t=${outcome.order.accessToken}&pending=1`;
  } catch {
    // Paystack could not be reached: the webhook will settle it; show the failed page with WhatsApp help.
  }
  redirect(target);
}
