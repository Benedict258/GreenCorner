"use server";
import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/guard";
import { consumePasswordToken } from "@/lib/users";

export async function acceptInviteAction(_: unknown, form: FormData): Promise<{ error?: string }> {
  if (String(form.get("password")) !== String(form.get("password2"))) return { error: "The two passwords are not the same." };
  let user;
  try {
    user = await consumePasswordToken(String(form.get("token") ?? ""), String(form.get("password") ?? ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (user.role === "customer") return { error: "This link is not a staff invitation." };
  await setSessionCookie(user.email, user.role === "owner" ? "owner" : "staff", user.id);
  await audit(user.email, "staff_joined", "user", user.id);
  redirect("/admin");
}
