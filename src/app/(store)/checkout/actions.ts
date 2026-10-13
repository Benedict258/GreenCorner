"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { setCustomerCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { clientIp, FORM_LIMITS, hit } from "@/lib/guard";
import { notifyBankTransferOrder, notifyPaymentProblem, siteUrl } from "@/lib/notify";
import { initializeTransaction, paystackEnabled } from "@/lib/paystack";
import { attachCartToUser, currentCartId } from "@/lib/store/cart";
import { getOrder, placeOrder, startPayment } from "@/lib/store/orders";
import { readAddress, readContact, summarize, text, type FieldErrors } from "@/lib/store/validate";
import { bankTransferEnabled } from "@/lib/store/storeSettings";
import { createCustomer, currentCustomer } from "@/lib/users";

export interface CheckoutState {
  error?: string;
  fields?: FieldErrors;
  values?: Record<string, string>;
}

const LABELS: Record<string, string> = { name: "name", email: "email", phone: "phone number", street: "street address", area: "area", password: "password", agree: "agreement", payment: "payment method" };

export async function checkoutAction(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$") && k !== "password").map(([k, v]) => [k, String(v)]));
  const ip = clientIp(await headers());
  if (await hit(ip, FORM_LIMITS).catch(() => null)) return { error: "Too many attempts. Please wait a minute and try again.", values };

  const cartId = await currentCartId();
  if (!cartId) return { error: "Your cart is empty or has expired.", values };
  const errors: FieldErrors = {};
  const contact = readContact(form, errors);
  const fulfilment = text(form, "fulfilment") === "pickup" ? "pickup" : "delivery";
  const address = fulfilment === "delivery" ? readAddress(form, errors) : null;
  const notes = text(form, "notes", 1000);
  const wantAccount = form.get("create_account") === "on";
  const password = String(form.get("password") ?? "");
  if (wantAccount && password.length < 8) errors.password = "Choose a password of at least 8 characters.";
  if (form.get("agree") !== "on") errors.agree = "Tick the box to agree to the Terms and Refund policy.";
  const method = text(form, "payment") === "bank_transfer" ? "bank_transfer" : "paystack";
  if (method === "paystack" && !paystackEnabled()) errors.payment = "Card payment is not switched on yet. Choose bank transfer.";
  if (method === "bank_transfer" && !(await bankTransferEnabled())) errors.payment = "Bank transfer is not available. Pay with Paystack.";
  if (Object.keys(errors).length) return { error: summarize(errors, LABELS), fields: errors, values };

  let user = await currentCustomer();
  if (!user && wantAccount) {
    try {
      user = await createCustomer({ email: contact.email, name: contact.name, phone: contact.phone, password });
      await setCustomerCookie(user.id);
    } catch (e) {
      return { error: (e as Error).message, fields: { email: (e as Error).message }, values };
    }
  }
  if (user) await attachCartToUser(cartId, user.id);

  let order;
  try {
    order = await placeOrder({ cartId, userId: user?.id ?? null, ...contact, fulfilment, address, notes, paymentMethod: method });
  } catch (e) {
    return { error: (e as Error).message, values };
  }

  // A signed-in customer's new delivery address is kept for next time.
  if (user && address) {
    await query(
      `insert into addresses (user_id, street, area, landmark)
       select $1, $2, $3, $4 where not exists (select 1 from addresses where user_id = $1 and lower(street) = lower($2) and lower(area) = lower($3))`,
      [user.id, address.street, address.area, address.landmark],
    ).catch(() => undefined);
  }

  if (method === "bank_transfer") {
    await startPayment(order.id, "bank_transfer");
    after(() => notifyBankTransferOrder(order));
    redirect(`/checkout/success/${encodeURIComponent(order.number)}?t=${order.accessToken}`);
  }

  let url: string;
  try {
    const reference = await startPayment(order.id, "paystack");
    const base = await siteUrl();
    const init = await initializeTransaction({
      email: contact.email,
      amountNgn: order.total,
      reference,
      callbackUrl: `${base}/checkout/callback`,
      metadata: { order_number: order.number, order_id: order.id, cancel_action: `${base}/checkout/failed?order=${encodeURIComponent(order.number)}` },
    });
    url = init.authorizationUrl;
  } catch (e) {
    const o = await getOrder(order.id);
    if (o) after(() => notifyPaymentProblem(o, `Could not start the Paystack payment: ${(e as Error).message}`));
    return { error: "We could not reach Paystack just now. Please try again in a moment, or choose bank transfer.", values };
  }
  redirect(url);
}
