"use client";
import { useActionState } from "react";
import { saveStoreSettings } from "./storeActions";

export function StoreSettingsForm({ v, owner }: { v: Record<string, string>; owner: boolean }) {
  const [s, action, pending] = useActionState(saveStoreSettings, {});
  return (
    <form className="adm-kv-form" action={action}>
      {s.error && <p className="notice-box notice-box--error" role="alert">{s.error}</p>}
      {s.message && <p className="notice-box" role="status">{s.message}</p>}
      <label>Default markup (%) <span className="hint">For every product without its own markup. Customers see only the final price.</span><input name="default_markup_pct" inputMode="decimal" defaultValue={v.default_markup_pct ?? "10"} required /></label>
      <label>Alert emails <span className="hint">Who gets new orders and quote requests by email. Separate with commas.</span><input name="notify_emails" defaultValue={v.notify_emails ?? ""} placeholder="orders@waste2light.com" /></label>
      <label>Alert WhatsApp numbers <span className="hint">Separate with commas. Needs the WhatsApp Business connection.</span><input name="notify_whatsapp" defaultValue={v.notify_whatsapp ?? ""} placeholder="0807 878 7646" /></label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}><input type="checkbox" name="bank_transfer_enabled" defaultChecked={(v.bank_transfer_enabled ?? "true") !== "false"} style={{ minHeight: 0 }} /> Offer &quot;pay by bank transfer&quot; at checkout</label>
      <label>We call customers within <input name="callback_promise" defaultValue={v.callback_promise ?? "1 working day"} /></label>
      <label>Opening hours, Monday to Friday <span className="hint">Shown on Contact and Delivery. Leave empty to say &quot;call before you visit&quot;.</span><input name="hours_weekday" defaultValue={v.hours_weekday ?? ""} placeholder="8am to 5pm" /></label>
      <label>Opening hours, Saturday<input name="hours_saturday" defaultValue={v.hours_saturday ?? ""} placeholder="10am to 2pm" /></label>
      <button className="btn primary" type="submit" disabled={pending || !owner}>{pending ? "Saving..." : "Save store settings"}</button>
      {!owner && <p className="hint">Only an owner can change these.</p>}
    </form>
  );
}
