"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOwner, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/guard";
import { notifyOrderPaid, notifyRefund, notifyStatusChange } from "@/lib/notify";
import { createRefund } from "@/lib/paystack";
import { addEvent, getOrder, markLineUnavailable, markPaidManually, nextStatus, recordRefund, setAdminNotes, setLineSource, setOrderStatus, type OrderStatus } from "@/lib/store/orders";
import { receiptPdf } from "@/lib/store/payments";

export type ActionResult = { ok?: string; error?: string };

const done = (id: number) => {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
};

export async function moveStatusAction(orderId: number, status: OrderStatus, note: string): Promise<ActionResult> {
  const staff = await requireStaff();
  try {
    const o = await setOrderStatus(orderId, status, staff.email, note);
    await audit(staff.email, "order_status", "order", orderId, { status });
    after(() => notifyStatusChange(o));
    done(orderId);
    return { ok: `Moved to ${status.replace(/_/g, " ")}. The customer has been emailed.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function moveNextAction(orderId: number): Promise<ActionResult> {
  const o = await getOrder(orderId);
  if (!o) return { error: "Order not found." };
  const next = nextStatus(o.status, o.fulfilment);
  if (!next) return { error: "There is no next step for this order." };
  return moveStatusAction(orderId, next, "");
}

export async function markPaidAction(orderId: number, note: string): Promise<ActionResult> {
  const staff = await requireStaff();
  try {
    const o = await markPaidManually(orderId, staff.email, note ? `Bank transfer confirmed: ${note}` : "Bank transfer confirmed.");
    await audit(staff.email, "order_marked_paid", "order", orderId, { note });
    after(async () => {
      const pdf = await receiptPdf(o).catch(() => null);
      await notifyOrderPaid(o, pdf ? { filename: `Receipt-${o.number}.pdf`, content: pdf } : undefined);
    });
    done(orderId);
    return { ok: "Marked as paid. The customer has been emailed a receipt." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addNoteAction(orderId: number, note: string): Promise<ActionResult> {
  const staff = await requireStaff();
  const n = note.trim();
  if (!n) return { error: "Write a note first." };
  await addEvent(null, orderId, staff.email, null, `Note: ${n}`);
  done(orderId);
  return { ok: "Note saved." };
}

export async function saveAdminNotesAction(orderId: number, notes: string): Promise<ActionResult> {
  await requireStaff();
  await setAdminNotes(orderId, notes);
  done(orderId);
  return { ok: "Saved." };
}

export async function setSourceAction(orderId: number, lineId: number, source: "stock" | "supplier"): Promise<void> {
  await requireStaff();
  await setLineSource(lineId, source);
  done(orderId);
}

/** Refunds money: through Paystack when the order was paid there, otherwise recorded as a manual (bank) refund. */
async function refund(orderId: number, lineId: number | null, amount: number, reason: string, actor: string): Promise<ActionResult> {
  const o = await getOrder(orderId);
  if (!o || !o.paidAt) return { error: "This order is not paid, so there is nothing to refund." };
  const left = o.total - o.refunded;
  if (!(amount > 0) || amount > left) return { error: `The refund must be between ₦1 and ₦${left.toLocaleString("en-NG")}.` };
  let provider: { ref: string | null; status: "processed" | "pending" | "failed" | "manual"; error?: string };
  if (o.paymentMethod === "paystack" && o.paystackReference) {
    try {
      const r = await createRefund(o.paystackReference, amount, reason || `Refund on ${o.number}`);
      provider = { ref: r.id, status: r.status === "processed" ? "processed" : "pending" };
    } catch (e) {
      provider = { ref: null, status: "failed", error: (e as Error).message };
    }
  } else {
    provider = { ref: null, status: "manual" };
  }
  const updated = await recordRefund(orderId, lineId, amount, reason, actor, provider);
  await audit(actor, "refund", "order", orderId, { amount, lineId, status: provider.status });
  if (provider.status === "failed") return { error: `Paystack did not accept the refund: ${provider.error}. Nothing was recorded as refunded.` };
  after(() => notifyRefund(updated, amount, reason));
  done(orderId);
  return { ok: provider.status === "manual" ? `Recorded a refund of ₦${amount.toLocaleString("en-NG")}. Send the money by bank transfer.` : `Refund of ₦${amount.toLocaleString("en-NG")} sent to Paystack.` };
}

export async function refundAction(orderId: number, amount: number, reason: string): Promise<ActionResult> {
  const staff = await requireOwner().catch(() => null);
  if (!staff) return { error: "Only an owner can make refunds." };
  return refund(orderId, null, Math.round(amount), reason, staff.email);
}

/** Item unavailable after payment: mark it and refund that line, as agreed. */
export async function unavailableAndRefundAction(orderId: number, lineId: number): Promise<ActionResult> {
  const staff = await requireOwner().catch(() => null);
  if (!staff) return { error: "Only an owner can make refunds." };
  try {
    const { amount } = await markLineUnavailable(lineId, staff.email);
    const o = await getOrder(orderId);
    if (!o?.paidAt) { done(orderId); return { ok: "Marked unavailable." }; }
    const line = o.lines.find((l) => l.id === lineId);
    return refund(orderId, lineId, amount, `${line?.title ?? "An item"} is unavailable`, staff.email);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cancelOrderAction(orderId: number, reason: string): Promise<ActionResult> {
  const staff = await requireStaff();
  const o = await getOrder(orderId);
  if (!o) return { error: "Order not found." };
  if (o.paidAt && o.refunded < o.total) return { error: "Refund the payment first, then cancel." };
  return moveStatusAction(orderId, "cancelled", reason || `Cancelled by ${staff.email}`);
}
