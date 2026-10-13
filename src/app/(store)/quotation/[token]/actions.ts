"use server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { queryOne } from "@/lib/db";
import { notifyBankTransferOrder, notifyPaymentProblem, siteUrl } from "@/lib/notify";
import { initializeTransaction, paystackEnabled } from "@/lib/paystack";
import { lagosToday } from "@/lib/quoteDocument";
import { getOrder, orderFromQuote, startPayment } from "@/lib/store/orders";
import { bankTransferEnabled } from "@/lib/store/storeSettings";
import { readAddress, readContact, summarize, text, type FieldErrors } from "@/lib/store/validate";
import { currentCustomer } from "@/lib/users";

export interface AcceptState {
  error?: string;
  fields?: FieldErrors;
}

/** Accept a quotation: it becomes an order with the quotation's prices, then goes to payment. */
export async function acceptQuotationAction(token: string, _: AcceptState, form: FormData): Promise<AcceptState> {
  const q = await queryOne("select id, valid_until, request_id from quotes where access_token = $1 and sent_at is not null", [token]);
  if (!q) return { error: "This quotation link is not valid." };
  if (q.valid_until && q.valid_until < lagosToday()) return { error: "This quotation has expired. Contact us for a new one." };
  const errors: FieldErrors = {};
  const contact = readContact(form, errors);
  const fulfilment = text(form, "fulfilment") === "pickup" ? "pickup" : "delivery";
  const address = fulfilment === "delivery" ? readAddress(form, errors) : null;
  const method = text(form, "payment") === "bank_transfer" ? "bank_transfer" : "paystack";
  if (method === "paystack" && !paystackEnabled()) errors.payment = "Card payment is not switched on yet. Choose bank transfer.";
  if (method === "bank_transfer" && !(await bankTransferEnabled())) errors.payment = "Bank transfer is not available.";
  if (Object.keys(errors).length) return { error: summarize(errors, { name: "name", email: "email", phone: "phone", street: "street", area: "area", payment: "payment method" }), fields: errors };

  const user = await currentCustomer();
  const order = await orderFromQuote(q.id, { ...contact, userId: user?.id ?? null, fulfilment, address }, method);
  if (order.status !== "pending_payment") redirect(`/track/${encodeURIComponent(order.number)}?t=${order.accessToken}`);

  if (method === "bank_transfer") {
    await startPayment(order.id, "bank_transfer");
    const o = (await getOrder(order.id))!;
    after(() => notifyBankTransferOrder(o));
    redirect(`/checkout/success/${encodeURIComponent(order.number)}?t=${order.accessToken}`);
  }
  let url: string;
  try {
    const reference = await startPayment(order.id, "paystack");
    const base = await siteUrl();
    url = (await initializeTransaction({ email: contact.email, amountNgn: order.total, reference, callbackUrl: `${base}/checkout/callback`, metadata: { order_number: order.number, quote_id: q.id } })).authorizationUrl;
  } catch (e) {
    after(() => notifyPaymentProblem(order, `Could not start the Paystack payment: ${(e as Error).message}`));
    return { error: "We could not reach Paystack just now. Try again in a moment, or choose bank transfer." };
  }
  redirect(url);
}
