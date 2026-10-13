"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/guard";
import { setSetting } from "@/lib/store/storeSettings";
import { isEmail, normalizePhone } from "@/lib/users";

export async function saveStoreSettings(_: unknown, form: FormData): Promise<{ message?: string; error?: string }> {
  const s = await requireOwner().catch(() => null);
  if (!s) return { error: "Only an owner can change store settings." };
  const markup = Number(form.get("default_markup_pct"));
  if (!Number.isFinite(markup) || markup < 0 || markup > 500) return { error: "Default markup must be between 0 and 500%." };
  const emails = String(form.get("notify_emails") ?? "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const bad = emails.find((e) => !isEmail(e));
  if (bad) return { error: `"${bad}" is not an email address.` };
  const phones = String(form.get("notify_whatsapp") ?? "").split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
  const normalized: string[] = [];
  for (const p of phones) {
    const n = normalizePhone(p);
    if (!n) return { error: `"${p}" is not a Nigerian phone number.` };
    normalized.push(n);
  }
  const rows: [string, string][] = [
    ["default_markup_pct", String(markup)],
    ["notify_emails", emails.join(", ")],
    ["notify_whatsapp", normalized.join(", ")],
    ["bank_transfer_enabled", form.get("bank_transfer_enabled") === "on" ? "true" : "false"],
    ["callback_promise", String(form.get("callback_promise") ?? "").trim().slice(0, 60) || "1 working day"],
    ["hours_weekday", String(form.get("hours_weekday") ?? "").trim().slice(0, 80)],
    ["hours_saturday", String(form.get("hours_saturday") ?? "").trim().slice(0, 80)],
  ];
  for (const [k, v] of rows) await setSetting(k, v);
  await audit(s.email, "settings", null, null, Object.fromEntries(rows));
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { message: "Store settings saved." };
}
