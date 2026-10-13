"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { checkoutAction, type CheckoutState } from "./actions";

interface Props {
  total: number;
  signedIn: boolean;
  defaults: { name: string; email: string; phone: string; street: string; area: string; landmark: string };
  paystack: boolean;
  bankTransfer: boolean;
}

export function CheckoutForm({ total, signedIn, defaults, paystack, bankTransfer }: Props) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkoutAction, {});
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [fulfilment, setFulfilment] = useState(v("fulfilment", "delivery"));
  const [account, setAccount] = useState(v("create_account") === "on");
  const [payment, setPayment] = useState(v("payment", paystack ? "paystack" : "bank_transfer"));
  const err = state.fields ?? {};
  const fieldErr = (k: string) => err[k] ? <p className="field__error" id={`${k}-help`}><Icon name="alert" />{err[k]}</p> : null;
  const inv = (k: string) => (err[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-help` } : {});
  const payLabel = payment === "paystack" ? `Pay ${naira(total)} with Paystack` : `Place order and pay ${naira(total)} by transfer`;

  return (
    <form className="form" action={action} noValidate id="checkout-form">
      {state.error && (
        <div className="alert alert--error" role="alert">
          <Icon name="alert" />
          <div>
            <p><b>{state.error}</b></p>
            {Object.keys(err)[0] && <p><a href={`#${Object.keys(err)[0]}`}>Go to the first problem</a></p>}
          </div>
        </div>
      )}
      <fieldset className="card">
        <legend className="sr-only">Contact details</legend>
        <h2 className="card__title"><span className="card__num">1</span>Contact</h2>
        {!signedIn && <p className="signin">Already have an account? <Link href="/account/sign-in?next=/checkout">Sign in</Link></p>}
        <div className={`field${err.name ? " field--error" : ""}`}>
          <label className="field__label" htmlFor="name">Full name</label>
          <input className="field__input" id="name" name="name" autoComplete="name" defaultValue={v("name", defaults.name)} required {...inv("name")} />
          {fieldErr("name")}
        </div>
        <div className="grid-2">
          <div className={`field${err.phone ? " field--error" : ""}`}>
            <label className="field__label" htmlFor="phone">Phone number</label>
            <div className="phone">
              <span className="phone__prefix">+234</span>
              <input className="field__input" id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" defaultValue={v("phone", defaults.phone.replace(/^\+234/, ""))} required {...inv("phone")} />
            </div>
            {fieldErr("phone")}
          </div>
          <div className={`field${err.email ? " field--error" : ""}`}>
            <label className="field__label" htmlFor="email">Email</label>
            <input className="field__input" id="email" name="email" type="email" autoComplete="email" defaultValue={v("email", defaults.email)} required {...inv("email")} />
            {fieldErr("email")}
          </div>
        </div>
        {!signedIn && (
          <>
            <label className="check"><input type="checkbox" name="create_account" checked={account} onChange={(e) => setAccount(e.target.checked)} /> Create an account with these details</label>
            {account && (
              <div className={`field${err.password ? " field--error" : ""}`}>
                <label className="field__label" htmlFor="password">Choose a password <span className="field__opt">(at least 8 characters)</span></label>
                <input className="field__input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} {...inv("password")} />
                {fieldErr("password")}
              </div>
            )}
          </>
        )}
      </fieldset>

      <fieldset className="card">
        <legend className="sr-only">Delivery</legend>
        <h2 className="card__title"><span className="card__num">2</span>Delivery</h2>
        <div className="radio-cards" role="radiogroup" aria-label="Delivery method">
          <label className={`rcard${fulfilment === "delivery" ? " rcard--on" : ""}`}>
            <input type="radio" name="fulfilment" value="delivery" checked={fulfilment === "delivery"} onChange={() => setFulfilment("delivery")} />
            <span><span className="rcard__title">Delivery in Minna</span><br /><span className="rcard__text">We bring it to your door.</span></span>
            <span className="rcard__tag">Free</span>
          </label>
          <label className={`rcard${fulfilment === "pickup" ? " rcard--on" : ""}`}>
            <input type="radio" name="fulfilment" value="pickup" checked={fulfilment === "pickup"} onChange={() => setFulfilment("pickup")} />
            <span><span className="rcard__title">Pickup at Waste2Light</span><br /><span className="rcard__text">Bosso, Minna, Niger State. We call you when it is ready.</span></span>
            <span className="rcard__tag">Free</span>
          </label>
        </div>
        {fulfilment === "delivery" && (
          <div className="addr">
            <div className={`field${err.street ? " field--error" : ""}`}>
              <label className="field__label" htmlFor="street">Street address</label>
              <input className="field__input" id="street" name="street" autoComplete="street-address" defaultValue={v("street", defaults.street)} {...inv("street")} />
              {fieldErr("street")}
            </div>
            <div className="grid-2">
              <div className={`field${err.area ? " field--error" : ""}`}>
                <label className="field__label" htmlFor="area">Area in Minna</label>
                <input className="field__input" id="area" name="area" defaultValue={v("area", defaults.area)} {...inv("area")} />
                {fieldErr("area")}
              </div>
              <div className="field">
                <label className="field__label" htmlFor="landmark">Landmark</label>
                <input className="field__input" id="landmark" name="landmark" defaultValue={v("landmark", defaults.landmark)} />
              </div>
            </div>
          </div>
        )}
        <div className="field">
          <label className="field__label" htmlFor="notes">{fulfilment === "delivery" ? "Delivery notes" : "Notes"} <span className="field__opt">(optional)</span></label>
          <textarea className="field__input" id="notes" name="notes" defaultValue={v("notes")} />
        </div>
        <p className="note"><Icon name="info" />We deliver in Minna, Niger State only for now. For large orders we&apos;ll agree delivery or pickup with you when we call.</p>
      </fieldset>

      <div className="card">
        <h2 className="card__title"><span className="card__num">3</span>Payment</h2>
        {paystack && bankTransfer && (
          <div className="radio-cards" role="radiogroup" aria-label="Payment method">
            <label className={`rcard${payment === "paystack" ? " rcard--on" : ""}`}>
              <input type="radio" name="payment" value="paystack" checked={payment === "paystack"} onChange={() => setPayment("paystack")} />
              <span><span className="rcard__title">Pay online with Paystack</span><br /><span className="rcard__text">Card, bank transfer or USSD on Paystack&apos;s secure page.</span></span>
            </label>
            <label className={`rcard${payment === "bank_transfer" ? " rcard--on" : ""}`}>
              <input type="radio" name="payment" value="bank_transfer" checked={payment === "bank_transfer"} onChange={() => setPayment("bank_transfer")} />
              <span><span className="rcard__title">Bank transfer to Waste2Light</span><br /><span className="rcard__text">We show our account details; we confirm when the money arrives.</span></span>
            </label>
          </div>
        )}
        {(!paystack || !bankTransfer) && <input type="hidden" name="payment" value={payment} />}
        {!paystack && !bankTransfer && <p className="note"><Icon name="alert" />Online ordering is paused. Please request a quote and we&apos;ll call you.</p>}
        {fieldErr("payment")}
        <label className={`check${err.agree ? " field--error" : ""}`} id="agree">
          <input type="checkbox" name="agree" defaultChecked={v("agree") === "on"} {...inv("agree")} /> <span>I agree to the <Link href="/terms" target="_blank">Terms</Link> and the <Link href="/refunds" target="_blank">Refund policy</Link>.</span>
        </label>
        {fieldErr("agree")}
        <div className="form-pay">
          <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={pending || (!paystack && !bankTransfer)} aria-busy={pending}>{pending ? "Please wait…" : payLabel}</button>
          <p className="pay-note"><Icon name="lock" /><span>{payment === "paystack" ? "Card, bank transfer or USSD. You'll be taken to Paystack's secure page." : "Your order is reserved; transfer the total and we confirm by phone."}</span></p>
        </div>
        <p className="note"><Icon name="lock" />Prices can change until you pay. Your price is locked when you check out.</p>
      </div>
      <div className="sticky-bar">
        <div><p className="sticky-bar__label">Total</p><p className="price sticky-bar__price">{naira(total)}</p></div>
        <button className="btn btn--primary" type="submit" disabled={pending || (!paystack && !bankTransfer)}>{payment === "paystack" ? "Pay with Paystack" : "Place order"}</button>
      </div>
    </form>
  );
}
