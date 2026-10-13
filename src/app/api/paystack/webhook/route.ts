import { after } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { settlePaystack } from "@/lib/store/payments";

// Paystack calls this for every payment event. The body is signed; a charge is re-checked with
// Paystack's verify call before anything is marked paid. Always answer 200 quickly once it is ours.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("Bad signature", { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad body", { status: 400 });
  }
  const reference = event.data?.reference;
  if (event.event === "charge.success" && reference) {
    try {
      const { followUp } = await settlePaystack(reference);
      after(followUp);
    } catch (e) {
      // Let Paystack retry later (it retries failed deliveries for up to 72 hours).
      return new Response(`Could not settle: ${(e as Error).message}`, { status: 500 });
    }
  }
  return new Response("ok");
}
