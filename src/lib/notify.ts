import { headers } from "next/headers";
import { formatNaira } from "./pricing";
import { COMPANY } from "./quoteDocument";
import { addNotification, sendEmail, sendWhatsApp, teamContacts, type Attachment } from "./messaging";
import { STATUS_LABEL, type Order, type OrderStatus } from "./store/orders";
import type { QuoteRequest } from "./store/quoteRequests";
import { formatPhone } from "./users";

// What the platform tells whom, and when. Each function is safe to run after the response (via after()):
// a failed email or WhatsApp is logged in `messages` and never undoes the order or request.

export const STORE_NAME = "Waste2Light Store";
export const CONTACT = {
  phone: "+234 813 439 2943",
  whatsapp: "+234 807 878 7646",
  whatsappLink: "https://wa.me/2348078787646",
  email: "info@waste2light.com",
  address: "Waste2Light Ltd, Bosso, Minna, Niger State, Nigeria",
};

/** The public address of the site, for links in emails and the Paystack return address. */
export async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  } catch {
    // outside a request (scripts): fall through
  }
  return "http://localhost:3000";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One plain, branded email layout. Body parts are already-escaped HTML. */
export function emailLayout(title: string, parts: string[], cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f8f3;font-family:Inter,Arial,sans-serif;color:#17231c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d8dad5;border-radius:12px">
<tr><td style="background:#0c4a23;border-radius:12px 12px 0 0;padding:18px 24px;color:#ffffff;font:800 20px Manrope,Arial,sans-serif">Waste<span style="color:#f6c453">2</span>Light <span style="font:600 12px Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Store</span></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font:800 22px/1.25 Manrope,Arial,sans-serif;color:#17231c">${esc(title)}</h1>
${parts.map((p) => `<div style="margin:0 0 14px;font-size:15px;line-height:1.55">${p}</div>`).join("\n")}
${cta ? `<p style="margin:20px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#0c5c2e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #d8dad5;font-size:12px;color:#66736b">${esc(CONTACT.address)} · ${esc(CONTACT.phone)} · WhatsApp ${esc(CONTACT.whatsapp)} · ${esc(CONTACT.email)}</td></tr>
</table></td></tr></table></body></html>`;
}

function linesTable(lines: { title: string; quantity: number; lineTotal: number }[], total: number): string {
  const rows = lines.map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #edefe9">${esc(l.title)} × ${l.quantity}</td><td style="padding:6px 0;border-bottom:1px solid #edefe9;text-align:right;white-space:nowrap">${formatNaira(l.lineTotal)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}<tr><td style="padding:8px 0;font-weight:700">Total</td><td style="padding:8px 0;font-weight:700;text-align:right">${formatNaira(total)}</td></tr></table>`;
}

function plainLines(lines: { title: string; quantity: number; lineTotal: number }[], total: number): string {
  return `${lines.map((l) => `- ${l.title} x ${l.quantity}: ${formatNaira(l.lineTotal)}`).join("\n")}\nTotal: ${formatNaira(total)}`;
}

/** Kit components are shown under their kit's name, once per kit. */
function orderSummaryLines(o: Order) {
  const out: { title: string; quantity: number; lineTotal: number }[] = [];
  const kits = new Map<string, { title: string; quantity: number; lineTotal: number }>();
  for (const l of o.lines) {
    if (l.kitLabel) {
      const k = kits.get(l.kitLabel) ?? { title: l.kitLabel, quantity: l.kitQuantity ?? 1, lineTotal: 0 };
      k.lineTotal += l.lineTotal;
      if (!kits.has(l.kitLabel)) { kits.set(l.kitLabel, k); out.push(k); }
    } else out.push({ title: l.title, quantity: l.quantity, lineTotal: l.lineTotal });
  }
  return out;
}

export async function orderLink(o: Order): Promise<string> {
  return `${await siteUrl()}/track/${encodeURIComponent(o.number)}?t=${o.accessToken}`;
}

const bankDetails = () => COMPANY.payment.map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join("<br>");

async function alertTeam(kind: string, title: string, body: string, link: string, related: { type: string; id: number }) {
  await addNotification(kind, title, body, link);
  const team = await teamContacts();
  const url = `${await siteUrl()}${link}`;
  await Promise.all([
    team.emails.length ? sendEmail({ to: team.emails, subject: title, html: emailLayout(title, [esc(body).replace(/\n/g, "<br>")], { label: "Open in admin", url }), text: `${body}\n\n${url}`, related }) : null,
    ...team.whatsapp.map((n) => sendWhatsApp(n, `${title}\n${body}\n${url}`, related)),
  ]);
}

// Orders ------------------------------------------------------------------------------------------------

export async function notifyOrderPaid(o: Order, receipt?: Attachment): Promise<void> {
  const lines = orderSummaryLines(o);
  const how = o.fulfilment === "delivery" ? `Delivery to ${o.address ? [o.address.street, o.address.area].filter(Boolean).join(", ") : "Minna"}` : "Pickup at Bosso";
  await alertTeam(
    "order_paid",
    `New paid order ${o.number}: ${formatNaira(o.total)}`,
    `${o.name} (${formatPhone(o.phone)}) paid ${formatNaira(o.total)} for ${lines.length} item${lines.length === 1 ? "" : "s"}. ${how}. Call to confirm.`,
    `/admin/orders/${o.id}`,
    { type: "order", id: o.id },
  );
  const link = await orderLink(o);
  await sendEmail({
    to: o.email,
    subject: `Order ${o.number} is paid. Thank you!`,
    html: emailLayout(`Thank you, ${o.name.split(" ")[0]}! Your order is paid.`, [
      `Order <b>${esc(o.number)}</b>. We'll call you on ${esc(formatPhone(o.phone))} within 1 working day to confirm ${o.fulfilment === "delivery" ? "delivery" : "pickup"}.`,
      linesTable(lines, o.total),
      receipt ? "Your receipt is attached." : "",
    ], { label: "Track your order", url: link }),
    text: `Order ${o.number} is paid.\n\n${plainLines(lines, o.total)}\n\nTrack it: ${link}`,
    attachments: receipt ? [receipt] : undefined,
    related: { type: "order", id: o.id },
  });
}

export async function notifyBankTransferOrder(o: Order): Promise<void> {
  const lines = orderSummaryLines(o);
  await alertTeam(
    "order_bank_transfer",
    `Order ${o.number} waiting for a bank transfer: ${formatNaira(o.total)}`,
    `${o.name} (${formatPhone(o.phone)}) chose to pay ${formatNaira(o.total)} by bank transfer. Mark it paid when the money arrives.`,
    `/admin/orders/${o.id}`,
    { type: "order", id: o.id },
  );
  const link = await orderLink(o);
  await sendEmail({
    to: o.email,
    subject: `Order ${o.number}: how to pay by bank transfer`,
    html: emailLayout("Your order is reserved", [
      `Order <b>${esc(o.number)}</b>. Please transfer <b>${formatNaira(o.total)}</b> to:`,
      bankDetails(),
      `Use <b>${esc(o.number)}</b> as the payment reference. We'll confirm as soon as it arrives and call you to arrange ${o.fulfilment}.`,
      linesTable(lines, o.total),
    ], { label: "View your order", url: link }),
    text: `Order ${o.number}. Transfer ${formatNaira(o.total)} to ${COMPANY.payment.map(([k, v]) => `${k}: ${v}`).join(", ")}. Reference: ${o.number}.\n\n${plainLines(lines, o.total)}\n\n${link}`,
    related: { type: "order", id: o.id },
  });
}

const CUSTOMER_STATUS_TEXT: Partial<Record<OrderStatus, string>> = {
  confirmed: "We've confirmed your order and are getting it ready.",
  sourcing: "We're collecting the parts for your order.",
  ready: "Your order is packed and ready.",
  out_for_delivery: "Your order is on its way to you.",
  ready_for_pickup: "Your order is ready for pickup at Waste2Light, Bosso, Minna.",
  completed: "Your order is complete. Thank you for building with us!",
  cancelled: "Your order has been cancelled. If you paid, we'll refund you.",
  refunded: "Your order has been refunded.",
};

export async function notifyStatusChange(o: Order): Promise<void> {
  const text = CUSTOMER_STATUS_TEXT[o.status];
  if (!text) return;
  const link = await orderLink(o);
  await sendEmail({
    to: o.email,
    subject: `Order ${o.number}: ${STATUS_LABEL[o.status]}`,
    html: emailLayout(STATUS_LABEL[o.status], [`Order <b>${esc(o.number)}</b>. ${esc(text)}`, `Questions? Call ${esc(CONTACT.phone)} or WhatsApp ${esc(CONTACT.whatsapp)}.`], { label: "Track your order", url: link }),
    text: `Order ${o.number}: ${text}\n\nTrack it: ${link}`,
    related: { type: "order", id: o.id },
  });
  if (process.env.WHATSAPP_TEMPLATE) await sendWhatsApp(o.phone, `Waste2Light order ${o.number}: ${text}`, { type: "order", id: o.id });
}

export async function notifyRefund(o: Order, amount: number, reason: string): Promise<void> {
  await sendEmail({
    to: o.email,
    subject: `Refund on order ${o.number}`,
    html: emailLayout("We've refunded part of your order", [
      `Order <b>${esc(o.number)}</b>. We refunded <b>${formatNaira(amount)}</b>${reason ? `: ${esc(reason)}` : ""}.`,
      o.paymentMethod === "paystack" ? "Card and bank refunds usually reach you within 5 to 10 working days." : "We'll send the money back to the account you paid from.",
      `We're sorry about this. Call ${esc(CONTACT.phone)} if you have questions.`,
    ], { label: "View your order", url: await orderLink(o) }),
    text: `Order ${o.number}: we refunded ${formatNaira(amount)}${reason ? ` (${reason})` : ""}.`,
    related: { type: "order", id: o.id },
  });
}

export async function notifyPaymentProblem(o: Order, reason: string): Promise<void> {
  await alertTeam("payment_problem", `Payment problem on ${o.number}`, reason, `/admin/orders/${o.id}`, { type: "order", id: o.id });
}

// Quote requests and quotations ---------------------------------------------------------------------------

export async function notifyQuoteRequest(r: QuoteRequest): Promise<void> {
  await alertTeam(
    "quote_request",
    `New quote request ${r.number} from ${r.organisation}`,
    `${r.contactName}${r.contactRole ? ` (${r.contactRole})` : ""}, ${formatPhone(r.phone)}, ${r.email}. ${r.lines.length} item${r.lines.length === 1 ? "" : "s"}, about ${formatNaira(r.estimatedTotal)}.${r.students ? ` For ${r.students} students.` : ""}${r.message ? `\nMessage: ${r.message}` : ""}`,
    `/admin/quote-requests/${r.id}`,
    { type: "quote_request", id: r.id },
  );
  await sendEmail({
    to: r.email,
    subject: `We received your quote request ${r.number}`,
    html: emailLayout("Request received", [
      `Thank you, ${esc(r.contactName.split(" ")[0])}. Your reference is <b>${esc(r.number)}</b>.`,
      "We'll call you within 1 working day, then send the official quotation by email.",
      linesTable(r.lines, r.estimatedTotal),
      "<small>The total above is an estimate at today's prices.</small>",
    ]),
    text: `Your quote request ${r.number} is in. We'll call you within 1 working day.\n\n${plainLines(r.lines, r.estimatedTotal)}`,
    related: { type: "quote_request", id: r.id },
  });
}

export async function sendQuotationEmail(input: { quoteId: number; number: string; billTo: string; to: string; total: number; validUntil: string | null; link: string; pdf: Buffer; message: string }): Promise<boolean> {
  return sendEmail({
    to: input.to,
    subject: `Quotation ${input.number} from Waste2Light`,
    html: emailLayout(`Your quotation ${input.number}`, [
      `For <b>${esc(input.billTo)}</b>. Total <b>${formatNaira(input.total)}</b>${input.validUntil ? `, valid until ${esc(input.validUntil)}` : ""}. The PDF is attached.`,
      input.message ? esc(input.message).replace(/\n/g, "<br>") : "",
      "You can accept it and pay online, or pay by bank transfer to:",
      bankDetails(),
    ], { label: "View and pay online", url: input.link }),
    text: `Quotation ${input.number} for ${input.billTo}: ${formatNaira(input.total)}.\n${input.message}\n\nView and pay: ${input.link}`,
    attachments: [{ filename: `${input.number}.pdf`, content: input.pdf }],
    related: { type: "quote", id: input.quoteId },
  });
}

// Accounts ----------------------------------------------------------------------------------------------

export async function sendPasswordReset(email: string, link: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Reset your Waste2Light Store password",
    html: emailLayout("Reset your password", ["Someone asked to reset the password for this account. If it was you, use the button below within 2 hours. If not, ignore this email."], { label: "Choose a new password", url: link }),
    text: `Reset your password (valid for 2 hours): ${link}`,
  });
}

export async function sendStaffInvite(email: string, name: string, link: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "You're invited to the Waste2Light Store admin",
    html: emailLayout(`Welcome${name ? `, ${name.split(" ")[0]}` : ""}`, ["You've been added to the Waste2Light Store team. Choose a password to sign in (the link works for 3 days)."], { label: "Set your password", url: link }),
    text: `Set your password for the Waste2Light Store admin (valid 3 days): ${link}`,
  });
}
