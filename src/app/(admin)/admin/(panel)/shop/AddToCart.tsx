"use client";
import { useState, useTransition } from "react";
import { addToCartAction } from "./actions";

export default function AddToCart({ productRef, title, inCart, disabled }: { productRef: string; title: string; inCart: number; disabled: boolean }) {
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setStatus(null);
    start(async () => {
      const res = await addToCartAction(productRef, qty);
      if ("error" in res) setStatus({ ok: false, text: res.error });
      else {
        setStatus({ ok: true, text: "Added to cart" });
        setQty(1);
      }
    });
  }

  return (
    <div className="add-to-cart">
      <div className="add-row">
        <input className="qty" type="number" min={1} max={100000} value={qty} disabled={disabled}
          aria-label={`Quantity of ${title}`} onFocus={(e) => e.target.select()} onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))} />
        <button type="button" className="btn primary" onClick={add} disabled={disabled || pending}>
          {pending ? "Adding..." : "Add to cart"}
        </button>
      </div>
      <p className={`small add-status${status && !status.ok ? " error" : ""}`} aria-live="polite">
        {status ? status.text : inCart > 0 ? `${inCart} in cart` : " "}
      </p>
    </div>
  );
}
