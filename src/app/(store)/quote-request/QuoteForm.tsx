"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Stepper } from "@/components/store/AddToCart";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { quoteRequestAction, type QuoteState } from "./actions";

export interface QItem {
  key: string;
  ref: string | null;
  projectId: number | null;
  title: string;
  sub: string;
  unitPrice: number;
  quantity: number;
  note: string;
  kit: boolean;
}

export function QuoteForm({ items: initial, defaults }: { items: QItem[]; defaults: { organisation: string; name: string; email: string; phone: string } }) {
  const [state, action, pending] = useActionState<QuoteState, FormData>(quoteRequestAction, {});
  const [items, setItems] = useState(initial);
  const [fulfilment, setFulfilment] = useState(state.values?.fulfilment ?? "delivery");
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const err = state.fields ?? {};
  const fe = (k: string) => err[k] ? <p className="field__error" id={`${k}-help`}><Icon name="alert" />{err[k]}</p> : null;
  const inv = (k: string) => (err[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-help` } : {});
  const total = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
  const linesJson = JSON.stringify(items.map((i) => ({ ref: i.ref, projectId: i.projectId, quantity: i.quantity, note: i.note })));
  const update = (key: string, patch: Partial<QItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const draft = async (form: HTMLFormElement | null) => {
    if (!form) return;
    setDraftBusy(true);
    setDraftErr("");
    try {
      const fd = new FormData(form);
      const res = await fetch("/api/quote-request/draft", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()) || "Could not make the draft.");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Waste2Light-draft-quotation.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      setDraftErr((e as Error).message);
    } finally {
      setDraftBusy(false);
    }
  };

  return (
    <div className="quote">
      <form className="form" action={action} noValidate id="quote-form">
        <input type="hidden" name="lines" value={linesJson} />
        {state.error && (
          <div className="alert alert--error" role="alert"><Icon name="alert" /><div><p><b>{state.error}</b></p></div></div>
        )}
        <fieldset className="card">
          <legend className="sr-only">Your details</legend>
          <h2 className="card__title">About you</h2>
          <div className={`field${err.organisation ? " field--error" : ""}`}>
            <label className="field__label" htmlFor="org">School or organisation name</label>
            <input className="field__input" id="org" name="organisation" autoComplete="organization" defaultValue={v("organisation", defaults.organisation)} {...inv("organisation")} />
            {fe("organisation")}
          </div>
          <div className="grid-2">
            <div className={`field${err.name ? " field--error" : ""}`}>
              <label className="field__label" htmlFor="contact">Contact person</label>
              <input className="field__input" id="contact" name="name" autoComplete="name" defaultValue={v("name", defaults.name)} {...inv("name")} />
              {fe("name")}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="role">Role <span className="field__opt">(optional)</span></label>
              <input className="field__input" id="role" name="role" defaultValue={v("role")} />
            </div>
          </div>
          <div className="grid-2">
            <div className={`field${err.phone ? " field--error" : ""}`}>
              <label className="field__label" htmlFor="qphone">Phone number</label>
              <div className="phone"><span className="phone__prefix">+234</span><input className="field__input" id="qphone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" defaultValue={v("phone", defaults.phone.replace(/^\+234/, ""))} {...inv("phone")} /></div>
              {fe("phone")}
            </div>
            <div className={`field${err.email ? " field--error" : ""}`}>
              <label className="field__label" htmlFor="qemail">Email</label>
              <input className="field__input" id="qemail" name="email" type="email" autoComplete="email" defaultValue={v("email", defaults.email)} {...inv("email")} />
              {fe("email")}
            </div>
          </div>
        </fieldset>
        <fieldset className="card">
          <legend className="sr-only">Your request</legend>
          <h2 className="card__title">Your request</h2>
          <div className="grid-2">
            <div className={`field${err.students ? " field--error" : ""}`}>
              <label className="field__label" htmlFor="students">Number of students <span className="field__opt">(optional)</span></label>
              <input className="field__input" id="students" name="students" inputMode="numeric" defaultValue={v("students")} {...inv("students")} />
              <p className="field__help">We use this to check the number of kits.</p>
              {fe("students")}
            </div>
            <div className={`field${err.needed_by ? " field--error" : ""}`}>
              <label className="field__label" htmlFor="needed">Needed by <span className="field__opt">(optional)</span></label>
              <input className="field__input" id="needed" name="needed_by" type="date" defaultValue={v("needed_by")} {...inv("needed_by")} />
              {fe("needed_by")}
            </div>
          </div>
          <div role="radiogroup" aria-label="Delivery or pickup" className="radios">
            <label className={`rcard${fulfilment === "delivery" ? " rcard--on" : ""}`}><input type="radio" name="fulfilment" value="delivery" checked={fulfilment === "delivery"} onChange={() => setFulfilment("delivery")} />Delivery in Minna</label>
            <label className={`rcard${fulfilment === "pickup" ? " rcard--on" : ""}`}><input type="radio" name="fulfilment" value="pickup" checked={fulfilment === "pickup"} onChange={() => setFulfilment("pickup")} />Pickup at Bosso, Minna</label>
          </div>
          <div className={`field${err.items ? " field--error" : ""}`}>
            <label className="field__label" htmlFor="msg">Message <span className="field__opt">{items.length ? "(optional)" : "(tell us what you need)"}</span></label>
            <textarea className="field__input" id="msg" name="message" defaultValue={v("message")} {...inv("items")} />
            {fe("items")}
          </div>
        </fieldset>
        <div className="actions">
          <button className="btn btn--primary btn--lg" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Sending…" : "Send quote request"}</button>
          <button className="btn btn--secondary btn--lg" type="button" disabled={draftBusy || items.length === 0} aria-busy={draftBusy} onClick={(e) => draft(e.currentTarget.form)}><Icon name="file" />{draftBusy ? "Preparing…" : "Download draft PDF"}</button>
        </div>
        {draftErr && <p className="form-error" role="alert">{draftErr}</p>}
        <p className="draft-note"><Icon name="file" />The draft PDF is clearly marked &quot;DRAFT, not an official quotation&quot;. Our team sends the official quotation after we call you.</p>
      </form>
      <aside className="card items" aria-label="Items in your request">
        <h2 className="card__title">Items in this request</h2>
        {items.length === 0 && <p className="total-note">No items yet. Add parts from the <Link href="/shop">shop</Link> or a <Link href="/projects">project kit</Link>, or describe what you need in the message.</p>}
        {items.map((i) => (
          <div className="qline" key={i.key}>
            <div className="qline__top"><div><p className="qline__name">{i.title}</p><p className="qline__sub">{i.sub} · {naira(i.unitPrice)} each</p></div></div>
            <div className="qline__row">
              <Stepper value={i.quantity} onChange={(n) => update(i.key, { quantity: n })} label={i.kit ? "Number of kits" : "Quantity"} max={100000} />
              <span className="price">{naira(i.unitPrice * i.quantity)}</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`note-${i.key}`}>Note for this item <span className="field__opt">(optional)</span></label>
              <input className="field__input" id={`note-${i.key}`} value={i.note} maxLength={500} onChange={(e) => update(i.key, { note: e.target.value })} />
            </div>
            <button className="link-btn" type="button" onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}>Remove item</button>
          </div>
        ))}
        <div className="total"><span>Estimated total</span><span className="price">{naira(total)}</span></div>
        <p className="total-note">This is an estimate. The official quotation may change if we add delivery details or swap a part.</p>
        <Link href="/shop">Add more items</Link>
      </aside>
    </div>
  );
}
