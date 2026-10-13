"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { clearSessionCookie, currentStaff, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/guard";
import { readPasswordHash } from "@/lib/passwordHash";
import { verifyLogin } from "@/lib/users";

// Simple in-process throttle: 10 failures per 15 minutes, then locked until the window passes.
const fails: number[] = [];
const WINDOW = 15 * 60_000;

/**
 * Staff sign-in. Staff accounts live in the users table (invited from Admin > Staff); the owner set in
 * ADMIN_EMAIL / ADMIN_PASSWORD_HASH always works too, so the first sign-in needs no database row.
 */
export async function login(_: { error?: string; email?: string } | undefined, form: FormData): Promise<{ error?: string; email?: string }> {
  const now = Date.now();
  while (fails.length && now - fails[0] > WINDOW) fails.shift();
  if (fails.length >= 10) return { error: "Too many attempts. Try again in a few minutes.", email: String(form.get("email") ?? "") };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const nextRaw = String(form.get("next") ?? "/admin");
  const next = nextRaw.startsWith("/admin") && !nextRaw.startsWith("//") ? nextRaw : "/admin";

  const staff = await verifyLogin(email, password, "staff").catch(() => null);
  if (staff) {
    await setSessionCookie(staff.email, staff.role === "owner" ? "owner" : "staff", staff.id);
    await audit(staff.email, "signed_in", null, null);
    redirect(next);
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const hash = readPasswordHash(process.env.ADMIN_PASSWORD_HASH ?? "");
  if (!adminEmail || !hash) {
    fails.push(now);
    return { error: "Wrong email or password.", email: String(form.get("email") ?? "") };
  }
  // Always run the comparison so timing does not reveal whether the email matched.
  const passwordOk = await bcrypt.compare(password, hash);
  if (email !== adminEmail || !passwordOk) {
    fails.push(now);
    return { error: "Wrong email or password.", email: String(form.get("email") ?? "") };
  }
  await setSessionCookie(adminEmail, "owner", null);
  await audit(adminEmail, "signed_in", null, null);
  redirect(next);
}

export async function logout() {
  const s = await currentStaff();
  if (s) await audit(s.email, "signed_out", null, null);
  await clearSessionCookie();
  redirect("/admin/login");
}
