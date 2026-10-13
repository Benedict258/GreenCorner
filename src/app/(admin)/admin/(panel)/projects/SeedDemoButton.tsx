"use client";
import { useState, useTransition } from "react";
import { seedDemoAction } from "./actions";

export function SeedDemoButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      {msg && <span className="stat__foot" role="status">{msg}</span>}
      <button className="btn btn--secondary" type="button" disabled={pending} onClick={() => start(async () => { const r = await seedDemoAction(); setMsg(r.added ? `Added ${r.added} demo project${r.added === 1 ? "" : "s"}.` : "The demo projects are already there."); })}>
        {pending ? "Adding…" : "Add demo projects"}
      </button>
    </span>
  );
}
