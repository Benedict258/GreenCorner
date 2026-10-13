"use client";
import { useActionState } from "react";
import { contactAction, type ContactState } from "./actions";

export function ContactForm() {
  const [s, action, pending] = useActionState<ContactState, FormData>(contactAction, {});
  if (s.ok) {
    return (
      <div className="card">
        <h2 className="card__title">Message sent</h2>
        <p>Thank you. We&apos;ll get back to you soon. For anything urgent, call or WhatsApp us.</p>
      </div>
    );
  }
  return (
    <form className="card" action={action} noValidate>
      <h2 className="card__title">Send us a message</h2>
      <div className="form">
        {s.error && <p className="form-error" role="alert">{s.error}</p>}
        <div className="field"><label className="field__label" htmlFor="cname">Name</label><input className="field__input" id="cname" name="name" autoComplete="name" required /></div>
        <div className="field"><label className="field__label" htmlFor="cmail">Email or phone</label><input className="field__input" id="cmail" name="reach" required /></div>
        <div className="field"><label className="field__label" htmlFor="cmsg">Message</label><textarea className="field__input" id="cmsg" name="message" required /></div>
        <div aria-hidden="true" style={{ position: "absolute", left: -9999 }}><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <button className="btn btn--primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
      </div>
    </form>
  );
}
