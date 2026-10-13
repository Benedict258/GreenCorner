"use client";
import { useState, useTransition } from "react";
import { Icon } from "@/components/store/Icon";
import { addNoteAction, cancelOrderAction, markPaidAction, moveNextAction, moveStatusAction, refundAction, setSourceAction, unavailableAndRefundAction, type ActionResult } from "../actions";
import type { OrderStatus } from "@/lib/store/orders";

function useAct() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult | void>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => setRes((await fn()) ?? null));
  };
  const msg = res ? <p className={`notice-box${res.error ? " notice-box--error" : ""} adm-flash`} role={res.error ? "alert" : "status"}>{res.error ?? res.ok}</p> : null;
  return { pending, run, msg };
}

export function NextStatusButton({ orderId, label }: { orderId: number; label: string }) {
  const { pending, run, msg } = useAct();
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
      <button className="btn btn--primary" type="button" disabled={pending} onClick={() => run(() => moveNextAction(orderId))}>{pending ? "Saving…" : <>Move to next status: {label} <Icon name="arrow" /></>}</button>
      {msg}
    </div>
  );
}

export function StatusPicker({ orderId, options }: { orderId: number; options: [OrderStatus, string][] }) {
  const { pending, run, msg } = useAct();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label className="field__label" htmlFor="setstatus">Set status</label>
      <select className="field__input" id="setstatus" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
        <option value="">Choose…</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input className="field__input" placeholder="Note for the history (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn--secondary btn--block" type="button" disabled={!status || pending} onClick={() => run(() => moveStatusAction(orderId, status as OrderStatus, note))}>Update status</button>
      {msg}
    </div>
  );
}

export function MarkPaid({ orderId, total }: { orderId: number; total: string }) {
  const { pending, run, msg } = useAct();
  const [note, setNote] = useState("");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p>Only mark it paid once {total} is in the Waste2Light account.</p>
      <input className="field__input" placeholder="Transfer details, e.g. sender name (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn--primary btn--block" type="button" disabled={pending} onClick={() => run(() => markPaidAction(orderId, note), `Confirm that ${total} has arrived in the bank account?`)}>Mark as paid</button>
      {msg}
    </div>
  );
}

export function UnavailableButton({ orderId, lineId, amount }: { orderId: number; lineId: number; amount: string }) {
  const { pending, run, msg } = useAct();
  return (
    <>
      <button className="adm-link-danger" type="button" disabled={pending} onClick={() => run(() => unavailableAndRefundAction(orderId, lineId), `Mark this item unavailable and refund ${amount} to the customer?`)}>{pending ? "Working…" : "Unavailable: refund item"}</button>
      {msg}
    </>
  );
}

export function SourceSelect({ orderId, lineId, value }: { orderId: number; lineId: number; value: "stock" | "supplier" | null }) {
  const { pending, run } = useAct();
  return (
    <select className="field__input" aria-label="Source" value={value ?? "supplier"} disabled={pending} onChange={(e) => run(() => setSourceAction(orderId, lineId, e.target.value as "stock" | "supplier"))} style={{ minHeight: 32, padding: "0 8px" }}>
      <option value="supplier">Microscale</option>
      <option value="stock">Our stock</option>
    </select>
  );
}

export function RefundForm({ orderId, max }: { orderId: number; max: number }) {
  const { pending, run, msg } = useAct();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input className="field__input" inputMode="numeric" placeholder={`Amount, up to ₦${max.toLocaleString("en-NG")}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input className="field__input" placeholder="Reason (the customer sees this)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn btn--secondary btn--block" type="button" disabled={pending || !amount} onClick={() => run(() => refundAction(orderId, Number(amount.replace(/[^\d]/g, "")), reason), `Refund ₦${Number(amount.replace(/[^\d]/g, "")).toLocaleString("en-NG")}?`)}>Refund</button>
      {msg}
    </div>
  );
}

export function NoteForm({ orderId }: { orderId: number }) {
  const { pending, run, msg } = useAct();
  const [note, setNote] = useState("");
  return (
    <>
      <label className="sr-only" htmlFor="newnote">Internal note</label>
      <textarea id="newnote" placeholder="Only staff can see notes" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn--secondary btn--block" type="button" disabled={pending || !note.trim()} onClick={() => run(async () => { const r = await addNoteAction(orderId, note); if (r.ok) setNote(""); return r; })}>Save note</button>
      {msg}
    </>
  );
}

export function CancelButton({ orderId }: { orderId: number }) {
  const { pending, run, msg } = useAct();
  return (
    <>
      <button className="btn btn--danger btn--block" type="button" disabled={pending} onClick={() => { const reason = window.prompt("Why is this order cancelled? (the customer is emailed)") ?? ""; if (reason) run(() => cancelOrderAction(orderId, reason)); }}>Cancel order</button>
      {msg}
    </>
  );
}
