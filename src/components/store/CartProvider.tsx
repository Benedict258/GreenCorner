"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { getCartAction, setQuantityAction, type CartResult, type DrawerCart } from "@/app/(store)/cartActions";
import { Icon } from "./Icon";
import { naira } from "./format";

interface CartCtx {
  count: number;
  /** Shows the result of an add: opens the drawer, or a toast with the error. */
  show: (r: CartResult) => void;
  open: () => void;
  toast: (message: string, error?: boolean) => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}

export function CartProvider({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  const [count, setCount] = useState(initialCount);
  const [cart, setCart] = useState<DrawerCart | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [toastMsg, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setCount(initialCount), [initialCount]);

  const toast = useCallback((text: string, error = false) => {
    setToast({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const show = useCallback((r: CartResult) => {
    if (!r.ok) {
      toast(r.error, true);
      return;
    }
    setCart(r.cart);
    setCount(r.cart.count);
    setAdded(r.message ?? null);
    setOpen(true);
  }, [toast]);

  const open = useCallback(() => {
    setAdded(null);
    setOpen(true);
    getCartAction().then((c) => { setCart(c); setCount(c.count); });
  }, []);

  return (
    <Ctx.Provider value={{ count, show, open, toast }}>
      {children}
      {isOpen && <CartDrawer cart={cart} added={added} onClose={() => setOpen(false)} onChange={(c) => { setCart(c); setCount(c.count); }} onError={(e) => toast(e, true)} />}
      {toastMsg && <div className={`toast${toastMsg.error ? " toast--error" : ""}`} role={toastMsg.error ? "alert" : "status"}>{toastMsg.text}</div>}
    </Ctx.Provider>
  );
}

function CartDrawer({ cart, added, onClose, onChange, onError }: { cart: DrawerCart | null; added: string | null; onClose: () => void; onChange: (c: DrawerCart) => void; onError: (e: string) => void }) {
  const [pending, start] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    document.body.classList.add("no-scroll");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("no-scroll"); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const setQty = (lineId: number, qty: number) =>
    start(async () => {
      const r = await setQuantityAction(lineId, qty);
      if (r.ok) onChange(r.cart);
      else onError(r.error);
    });

  return (
    <div className="overlay cart-drawer" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" aria-label="Cart" role="dialog" aria-modal="true" aria-busy={pending}>
        <div className="drawer__head">
          <h2 className="drawer__title">Your cart{cart ? ` (${cart.count})` : ""}</h2>
          <button ref={closeRef} className="drawer__close" type="button" aria-label="Close cart" onClick={onClose}><Icon name="close" /></button>
        </div>
        {added && <p className="added" role="status"><span className="added__tick"><Icon name="check" /></span>{added}</p>}
        {!cart ? (
          <p className="drawer__list">Loading…</p>
        ) : cart.lines.length === 0 ? (
          <div className="drawer__list"><p>Your cart is empty.</p></div>
        ) : (
          <ul className="drawer__list">
            {cart.lines.map((l) => (
              <li key={l.id} className={`dline${l.kind === "kit" ? " dline--kit" : ""}`}>
                <span className="dline__thumb">
                  {l.image ? <img src={l.kind === "product" ? `${l.image}?w=120` : l.image} alt="" width={56} height={56} style={{ objectFit: "contain", width: "100%", height: "100%", borderRadius: 10 }} /> : <Icon name={l.kind === "kit" ? "box" : "chip"} className="" />}
                </span>
                <div>
                  <p className="dline__name"><Link href={l.href} onClick={onClose} style={{ color: "inherit", textDecoration: "none" }}>{l.title}</Link></p>
                  <p className="dline__sub">{l.problem ? <b style={{ color: "var(--color-danger)" }}>{l.problem}</b> : l.sub}</p>
                </div>
                <p className="dline__total">{naira(l.lineTotal)}</p>
                <div className="dline__ctrl">
                  <div className="dstep" role="group" aria-label={`Quantity of ${l.title}`}>
                    <button type="button" aria-label="Decrease" disabled={pending || l.quantity <= 1} onClick={() => setQty(l.id, l.quantity - 1)}><Icon name="minus" /></button>
                    <span>{l.quantity}</span>
                    <button type="button" aria-label="Increase" disabled={pending} onClick={() => setQty(l.id, l.quantity + 1)}><Icon name="plus" /></button>
                  </div>
                  <button className="dline__rm" type="button" disabled={pending} onClick={() => setQty(l.id, 0)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="drawer__foot">
          <div className="sum"><span>Subtotal</span><span>{naira(cart?.subtotal ?? 0)}</span></div>
          <div className="sum"><span>Delivery</span><span>Free (Minna)</span></div>
          <div className="sum sum--total"><span>Total</span><b>{naira(cart?.subtotal ?? 0)}</b></div>
          <p className="note">Prices can change until you pay. Your price is locked when you check out.</p>
          {cart && cart.lines.length > 0 && !cart.blocked && <Link className="btn btn--primary" href="/checkout" onClick={onClose}>Checkout</Link>}
          {cart?.blocked && <p className="note" style={{ color: "var(--color-danger)" }}>Remove the items marked above to check out.</p>}
          {cart && cart.lines.length > 0 && <Link className="btn btn--secondary" href="/quote-request" onClick={onClose}>Request a quote instead</Link>}
          <button className="btn btn--text" type="button" onClick={onClose}>Continue shopping</button>
        </div>
      </aside>
    </div>
  );
}
