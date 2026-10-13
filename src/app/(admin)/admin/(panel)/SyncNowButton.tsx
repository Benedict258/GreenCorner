"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/store/Icon";

/** Starts a full Microscale sync in the background (same as Sync now on the Sync page). */
export function SyncNowButton() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {msg && <span className="stat__foot" role="status">{msg}</span>}
      <button
        className="btn btn--secondary"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supplier: "microscale" }) });
          const d = await r.json().catch(() => ({}));
          setMsg(r.ok ? "Sync started. It takes a minute or two." : d.error ?? "Could not start the sync.");
          setBusy(false);
          setTimeout(() => router.refresh(), 60_000);
        }}
      >
        <Icon name="sync" />{busy ? "Starting…" : "Sync now"}
      </button>
    </div>
  );
}
