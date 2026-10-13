"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/guard";
import { sendStaffInvite, siteUrl } from "@/lib/notify";
import { inviteStaff, setStaffActive, setStaffRole } from "@/lib/users";

export async function inviteStaffAction(_: unknown, form: FormData): Promise<{ ok?: string; error?: string; link?: string }> {
  const s = await requireOwner().catch(() => null);
  if (!s) return { error: "Only an owner can add staff." };
  const role = form.get("role") === "owner" ? "owner" : "staff";
  try {
    const { user, token } = await inviteStaff(String(form.get("email") ?? ""), String(form.get("name") ?? ""), role);
    const link = `${await siteUrl()}/admin/invite/${token}`;
    const emailed = await sendStaffInvite(user.email, user.name, link);
    await audit(s.email, "staff_invited", "user", user.id, { email: user.email, role });
    revalidatePath("/admin/staff");
    return emailed ? { ok: `Invitation emailed to ${user.email}.` } : { ok: "Email is not set up yet. Send this link to the new staff member (it works for 3 days):", link };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setStaffActiveAction(id: number, active: boolean) {
  const s = await requireOwner();
  await setStaffActive(id, active);
  await audit(s.email, active ? "staff_activated" : "staff_deactivated", "user", id);
  revalidatePath("/admin/staff");
}

export async function setStaffRoleAction(id: number, role: "staff" | "owner") {
  const s = await requireOwner();
  await setStaffRole(id, role);
  await audit(s.email, "staff_role", "user", id, { role });
  revalidatePath("/admin/staff");
}
