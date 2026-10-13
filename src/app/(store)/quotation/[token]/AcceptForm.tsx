"use client";
import { useActionState, useState } from "react";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { acceptQuotationAction, type AcceptState } from "./actions";

export function AcceptForm({ token, total, defaults, paystack, bankTransfer }: { token: string; total: number; defaults: { name: string; email: string; phone: string; fulfilment: string }; paystack: boolean; bankTransfer: boolean }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptQuotationAction.bind(null, token), {});
  const [fulfilment, setFulfilment] = useState(defaults.fulfilment);
  const [payment, setPayment] = useState(paystack ? "paystack" : "bank_transfer");
  const err = state.fields ?? {};
  const fe = (k: string) => err[k] ? <p className="form-error">{err[k]}</p> : null;
  return (
    <form className="stack-form" action={action}>
      {state.error && <p className="notice-box notice-box--error" role="alert">{state.error}</p>}
      <label>Full name<input name="name" defaultValue={defaults.name} autoComplete="name" required />{fe("name")}</label>
      <label>Phone number<input name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" required />{fe("phone")}</label>
      <label>Email<input name="email" type="email" defaultValue={defaults.email} autoComplete="email" required />{fe("email")}</label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ font: "600 14px var(--font-body)", marginBottom: 6 }}>Delivery or pickup</legend>
        <label className="check" style={{ flexDirection: "row", alignItems: "center" }}><input type="radio" name="fulfilment" value="delivery" checked={fulfilment === "delivery"} onChange={() => setFulfilment("delivery")} style={{ minHeight: 0 }} /> Delivery in Minna (free)</label>
        <label className="check" style={{ flexDirection: "row", alignItems: "center" }}><input type="radio" name="fulfilment" value="pickup" checked={fulfilment === "pickup"} onChange={() => setFulfilment("pickup")} style={{ minHeight: 0 }} /> Pickup at Bosso, Minna</label>
      </fieldset>
      {fulfilment === "delivery" && (
        <>
          <label>Street address<input name="street" autoComplete="street-address" />{fe("street")}</label>
          <label>Area in Minna<input name="area" />{fe("area")}</label>
          <label>Landmark <span className="hint">(optional)</span><input name="landmark" /></label>
        </>
      )}
      {paystack && bankTransfer ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend style={{ font: "600 14px var(--font-body)", marginBottom: 6 }}>Payment</legend>
          <label className="check" style={{ flexDirection: "row", alignItems: "center" }}><input type="radio" name="payment" value="paystack" checked={payment === "paystack"} onChange={() => setPayment("paystack")} style={{ minHeight: 0 }} /> Pay online with Paystack (card, transfer, USSD)</label>
          <label className="check" style={{ flexDirection: "row", alignItems: "center" }}><input type="radio" name="payment" value="bank_transfer" checked={payment === "bank_transfer"} onChange={() => setPayment("bank_transfer")} style={{ minHeight: 0 }} /> Bank transfer to Waste2Light</label>
        </fieldset>
      ) : <input type="hidden" name="payment" value={payment} />}
      {fe("payment")}
      <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={pending || (!paystack && !bankTransfer)}>
        <Icon name="lock" />{pending ? "Please wait…" : payment === "paystack" ? `Accept and pay ${naira(total)}` : `Accept and pay ${naira(total)} by transfer`}
      </button>
    </form>
  );
}
