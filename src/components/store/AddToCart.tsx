"use client";
import { useState, useTransition } from "react";
import { addKitAction, addToCartAction } from "@/app/(store)/cartActions";
import { useCart } from "./CartProvider";
import { Icon } from "./Icon";

/** The product card's button: adds one and opens the cart drawer. */
export function AddToCartButton({ productId, title, out, className = "btn btn--primary btn--block" }: { productId: number; title: string; out: boolean; className?: string }) {
  const { show } = useCart();
  const [pending, start] = useTransition();
  if (out) return <button className="btn btn--block" type="button" disabled>Out of stock</button>;
  return (
    <button
      className={className}
      type="button"
      aria-busy={pending}
      aria-label={`Add ${title} to cart`}
      disabled={pending}
      onClick={() => start(async () => show(await addToCartAction(productId, 1)))}
    >
      {pending ? "Adding…" : "Add to cart"}
    </button>
  );
}

/** Product page: quantity, Add to cart, Buy now, Add to a quote request, and the phone sticky bar. */
export function ProductBuy({ productId, price, out }: { productId: number; price: string; out: boolean }) {
  const { show } = useCart();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const add = (thenCheckout: boolean) =>
    start(async () => {
      const r = await addToCartAction(productId, qty);
      if (thenCheckout && r.ok) window.location.assign("/checkout");
      else show(r);
    });
  return (
    <>
      {!out && (
        <div className="buy__qty">
          <span className="buy__label" id="qty-label">Quantity</span>
          <Stepper value={qty} onChange={setQty} labelledBy="qty-label" />
        </div>
      )}
      <div className="buy__actions">
        {out ? (
          <div className="buy__actions-row">
            <button className="btn btn--lg btn--block" type="button" disabled>Out of stock</button>
            <a className="btn btn--secondary btn--lg btn--block" href="https://wa.me/2348078787646">Ask us to source it</a>
          </div>
        ) : (
          <div className="buy__actions-row">
            <button className="btn btn--primary btn--lg btn--block" type="button" disabled={pending} aria-busy={pending} onClick={() => add(false)}>{pending ? "Adding…" : "Add to cart"}</button>
            <button className="btn btn--secondary btn--lg btn--block" type="button" disabled={pending} onClick={() => add(true)}>Buy now</button>
          </div>
        )}
        <a className="btn btn--text buy__quote" href={`/quote-request?product=${productId}&qty=${qty}`}>Add to a quote request</a>
      </div>
      {!out && (
        <div className="sticky-bar">
          <span className="price sticky-bar__price">{price}</span>
          <button className="btn btn--primary" type="button" disabled={pending} onClick={() => add(false)}>Add to cart</button>
        </div>
      )}
    </>
  );
}

export function Stepper({ value, onChange, label, labelledBy, min = 1, max = 9999 }: { value: number; onChange: (n: number) => void; label?: string; labelledBy?: string; min?: number; max?: number }) {
  return (
    <div className="stepper" role="group" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}>
      <button className="stepper__btn" type="button" aria-label="Decrease quantity" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" /></button>
      <input
        className="stepper__input"
        type="text"
        inputMode="numeric"
        value={value}
        aria-label={label ?? "Quantity"}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value.replace(/\D/g, "")));
          if (Number.isFinite(n) && n > 0) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button className="stepper__btn" type="button" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" /></button>
    </div>
  );
}

/** "Buy the kit" with the number of kits. */
export function BuyKit({ projectId, disabled, kits, className = "btn btn--primary btn--lg btn--block" }: { projectId: number; disabled: boolean; kits: number; className?: string }) {
  const { show } = useCart();
  const [pending, start] = useTransition();
  return (
    <button className={className} type="button" disabled={disabled || pending} aria-busy={pending} onClick={() => start(async () => show(await addKitAction(projectId, kits)))}>
      <Icon name="cart" />{pending ? "Adding…" : "Buy the kit"}
    </button>
  );
}
