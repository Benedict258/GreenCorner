import { notifyOrderPaid, notifyPaymentProblem } from "../notify";
import { verifyTransaction } from "../paystack";
import { renderQuotationPdf, type DocData } from "../quotePdf";
import { formatDocDate, lagosToday } from "../quoteDocument";
import { applyPaystackResult, type Order, type PaymentOutcome } from "./orders";

/**
 * Checks a Paystack reference with Paystack itself and applies the result. Used by the return page and
 * the webhook; whichever arrives first marks the order paid, the other finds it already done.
 * Returns what to do after the response (notifications) so callers can run it with after().
 */
export async function settlePaystack(reference: string): Promise<{ outcome: PaymentOutcome; followUp: () => Promise<void> }> {
  const v = await verifyTransaction(reference);
  const outcome = await applyPaystackResult(v);
  const followUp = async () => {
    if (outcome.kind === "paid" && outcome.firstTime) {
      const pdf = await receiptPdf(outcome.order).catch(() => null);
      await notifyOrderPaid(outcome.order, pdf ? { filename: `Receipt-${outcome.order.number}.pdf`, content: pdf } : undefined);
    } else if (outcome.kind === "failed" && outcome.order && /does not match/.test(outcome.reason)) {
      await notifyPaymentProblem(outcome.order, outcome.reason);
    }
  };
  return { outcome, followUp };
}

/** The order as a receipt in the quotation layout. Kits are shown as one line each. */
export function receiptData(o: Order): DocData {
  const lines: DocData["lines"] = [];
  const kits = new Map<string, DocData["lines"][number]>();
  for (const l of o.lines) {
    if (l.kitLabel) {
      let k = kits.get(l.kitLabel);
      if (!k) {
        const qty = l.kitQuantity ?? 1;
        k = { id: l.id, quantity: qty, description: `${l.kitLabel} (complete kit)`, unitPrice: 0, lineTotal: 0 };
        kits.set(l.kitLabel, k);
        lines.push(k);
      }
      k.lineTotal += l.lineTotal;
      k.unitPrice = Math.round(k.lineTotal / k.quantity);
    } else {
      lines.push({ id: l.id, quantity: l.quantity, description: l.title, unitPrice: l.unitPrice, lineTotal: l.lineTotal });
    }
  }
  const paidOn = o.paidAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(o.paidAt)) : lagosToday();
  const how = o.fulfilment === "delivery" && o.address ? `Delivery to ${[o.address.street, o.address.area].filter(Boolean).join(", ")}, Minna` : "Pickup at Waste2Light, Bosso, Minna";
  return {
    name: o.name,
    attn: `${o.phone} · ${o.email}`,
    notes: [how, o.refunded > 0 ? `Refunded so far: ₦${o.refunded.toLocaleString("en-NG")}` : ""].filter(Boolean).join("\n"),
    quoteNumber: o.number,
    quoteDate: o.createdAt.slice(0, 10),
    validUntil: null,
    total: o.total,
    lines,
    receiptLines: [
      ["Paid on", formatDocDate(paidOn)],
      ["Paid by", o.paymentMethod === "paystack" ? "Paystack" : "Bank transfer"],
    ],
  };
}

export async function receiptPdf(o: Order): Promise<Buffer> {
  return renderQuotationPdf(receiptData(o), "receipt");
}
