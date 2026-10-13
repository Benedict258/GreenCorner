"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** A checkbox or select that submits its form as soon as it changes. */
export function AutoSubmitCheckbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

/** "In stock only": on by default, so unticking must send stock=all (an unticked box sends nothing). */
export function StockToggle({ checked }: { checked: boolean }) {
  const [on, setOn] = useState(checked);
  return (
    <label className="check">
      <input type="hidden" name="stock" value={on ? "in" : "all"} />
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.currentTarget.checked);
          const form = e.currentTarget.form;
          setTimeout(() => form?.requestSubmit(), 0);
        }}
      />{" "}
      In stock only
    </label>
  );
}

export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

/** Phones: the filter column is hidden; this button shows it as a bottom sheet. */
export function FiltersButton({ target }: { target: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = document.getElementById(target);
    el?.classList.toggle("filters--open", open);
    document.body.classList.toggle("no-scroll", open);
    const close = (e: Event) => { if ((e.target as HTMLElement).closest("[data-close-filters]")) setOpen(false); };
    el?.addEventListener("click", close);
    return () => el?.removeEventListener("click", close);
  }, [open, target]);
  return (
    <button className="btn btn--secondary toolbar__filters" type="button" aria-controls={target} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <Icon name="filter" />Filters
    </button>
  );
}
