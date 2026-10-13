"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setQuantityAction } from "@/app/(store)/cartActions";
import { useCart } from "./CartProvider";
import { Icon } from "./Icon";

/** Quantity stepper and Remove for one cart line on the cart page. */
export function CartLineControls({ lineId, quantity, kind, name }: { lineId: number; quantity: number; kind: "product" | "kit"; name: string }) {
  const router = useRouter();
  const { toast } = useCart();
  const [qty, setQty] = useState(quantity);
  const [pending, start] = useTransition();
  const save = (n: number) => {
    setQty(n);
    start(async () => {
      const r = await setQuantityAction(lineId, n);
      if (!r.ok) { toast(r.error, true); setQty(quantity); }
      router.refresh();
    });
  };
  const kit = kind === "kit";
  return (
    <div className={kit ? "kit-group__controls" : "line__controls"} aria-busy={pending}>
      <div className="stepper" role="group" aria-label={kit ? "Kit quantity" : `Quantity of ${name}`}>
        <button className="stepper__btn" type="button" aria-label={kit ? "Fewer kits" : "Decrease quantity"} disabled={pending || qty <= 1} onClick={() => save(qty - 1)}><Icon name="minus" /></button>
        <input
          className="stepper__input"
          type="text"
          inputMode="numeric"
          aria-label={kit ? "Number of kits" : "Quantity"}
          value={qty}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value.replace(/\D/g, ""))) || 1))}
          onBlur={() => { if (qty !== quantity) save(qty); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
        <button className="stepper__btn" type="button" aria-label={kit ? "More kits" : "Increase quantity"} disabled={pending} onClick={() => save(qty + 1)}><Icon name="plus" /></button>
      </div>
      <button className="line__remove" type="button" disabled={pending} onClick={() => save(0)}><Icon name="trash" />{kit ? "Remove kit" : "Remove"}</button>
    </div>
  );
}
