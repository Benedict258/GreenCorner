"use client";
import { useState, useTransition } from "react";
import { Icon } from "@/components/store/Icon";
import { createQuotationAction, saveRequestNotesAction, sendQuotationAction, setRequestStatusAction } from "./actions";

export function StatusSelect({ id, value }: { id: number; value: string }) {
  const [pending, start] = useTransition();
  return (
    <div>
      <label className="field__label" htmlFor="qstatus">Status</label>
      <select className="select" id="qstatus" defaultValue={value} disabled={pending} onChange={(e) => { const v = e.target.value; start(() => setRequestStatusAction(id, v)); }}>
        <option value="new">New</option><option value="contacted">Contacted</option><option value="quoted">Quoted</option><option value="accepted">Accepted</option><option value="closed">Closed</option>
      </select>
    </div>
  );
}

export function NotesBox({ id, notes }: { id: number; notes: string }) {
  const [v, setV] = useState(notes);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <label className="sr-only" htmlFor="qnote">Internal note</label>
      <textarea id="qnote" placeholder="Only staff can see notes" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn btn--secondary" type="button" disabled={pending} onClick={() => start(async () => setMsg((await saveRequestNotesAction(id, v)).ok))}>Save note</button>
      {msg && <p className="stat__foot" role="status">{msg}</p>}
    </>
  );
}

export function CreateQuotationButton({ id, existing }: { id: number; existing: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn btn--primary" type="button" disabled={pending} onClick={() => start(() => createQuotationAction(id))}>
      <Icon name="file" />{pending ? "Opening…" : existing ? "Open quotation" : "Create quotation"}
    </button>
  );
}

export function SendQuotation({ quoteId, email, sentAt }: { quoteId: number; email: string; sentAt: string | null }) {
  const [to, setTo] = useState(email);
  const [message, setMessage] = useState("");
  const [res, setRes] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sentAt && <p className="stat__foot">Last sent {sentAt}.</p>}
      <label className="field__label" htmlFor="qto">Customer email</label>
      <input className="field__input" id="qto" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
      <label className="field__label" htmlFor="qmsg">Message <span className="field__opt">(optional)</span></label>
      <textarea id="qmsg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thank you for your call today…" />
      <button className="btn btn--primary btn--block" type="button" disabled={pending} onClick={() => start(async () => setRes(await sendQuotationAction(quoteId, to, message)))}>
        <Icon name="mail" />{pending ? "Sending…" : sentAt ? "Send again" : "Email quotation to customer"}
      </button>
      {res && <p className={`notice-box${res.error ? " notice-box--error" : ""}`} role="status" style={{ wordBreak: "break-word" }}>{res.error ?? res.ok}</p>}
    </div>
  );
}
