"use client";
import { useState, useTransition } from "react";
import { setFeaturedAction, setMarkupAction, setStockAction, setVisibilityAction } from "./actions";

function useSave() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ ok?: string; error?: string } | null>(null);
  return { pending, state, save: (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setState(await fn())) };
}

/** Markup %, saved when the field loses focus or Enter is pressed. Empty = default. */
export function MarkupInput({ refId, value, label, isDefault, disabled }: { refId: string; value: number; label: string; isDefault: boolean; disabled: boolean }) {
  const [v, setV] = useState(isDefault ? "" : String(value));
  const { pending, state, save } = useSave();
  const commit = () => { if (v !== (isDefault ? "" : String(value))) save(() => setMarkupAction(refId, v)); };
  return (
    <>
      <label className="sr-only" htmlFor={`mk-${refId}`}>Markup percent for {label}</label>
      <input
        className="markup"
        id={`mk-${refId}`}
        inputMode="decimal"
        value={v}
        placeholder={isDefault ? String(value) : ""}
        title={isDefault ? `Default markup (${value}%). Type a number to set this product's own markup.` : "Clear to go back to the default markup"}
        disabled={disabled || pending}
        aria-invalid={!!state?.error}
        onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
      {state?.error && <span className="sr-only" role="alert">{state.error}</span>}
    </>
  );
}

export function VisibleSwitch({ refId, visible, label }: { refId: string; visible: boolean; label: string }) {
  const [on, setOn] = useState(visible);
  const { pending, save } = useSave();
  return (
    <label className="switch">
      <span className="sr-only">Visible on store: {label}</span>
      <input type="checkbox" checked={on} disabled={pending} onChange={(e) => { const v = e.target.checked; setOn(v); save(() => setVisibilityAction(refId, v)); }} />
      <span className="switch__track" />
    </label>
  );
}

export function FeaturedSwitch({ refId, featured }: { refId: string; featured: boolean }) {
  const [on, setOn] = useState(featured);
  const { pending, save } = useSave();
  return (
    <label className="switch">
      <span className="sr-only">Show on the home page</span>
      <input type="checkbox" checked={on} disabled={pending} onChange={(e) => { const v = e.target.checked; setOn(v); save(() => setFeaturedAction(refId, v)); }} />
      <span className="switch__track" />
    </label>
  );
}

export function StockInput({ refId, value, label }: { refId: string; value: number; label: string }) {
  const [v, setV] = useState(String(value));
  const { pending, state, save } = useSave();
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <label className="sr-only" htmlFor={`st-${refId}`}>Our stock of {label}</label>
      <input className="markup" id={`st-${refId}`} inputMode="numeric" value={v} disabled={pending} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} onBlur={() => { if (v !== String(value)) save(() => setStockAction(refId, v)); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      {state?.ok && <span className="stat__foot">✓</span>}
      {state?.error && <span className="form-error">{state.error}</span>}
    </span>
  );
}
