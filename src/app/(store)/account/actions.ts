"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearCustomerCookie, setCustomerCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { clientIp, FORM_LIMITS, hit } from "@/lib/guard";
import { sendPasswordReset, siteUrl } from "@/lib/notify";
import { attachCartToUser, currentCartId } from "@/lib/store/cart";
import { text } from "@/lib/store/validate";
import { changePassword, createCustomer, createPasswordToken, currentCustomer, getUserByEmail, isEmail, normalizePhone, updateProfile, consumePasswordToken, verifyLogin } from "@/lib/users";

export interface FormState {
  error?: string;
  ok?: string;
  values?: Record<string, string>;
}

const keep = (form: FormData) => Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$") && !/password/.test(k)).map(([k, v]) => [k, String(v)]));
const safeNext = (s: string) => (s.startsWith("/") && !s.startsWith("//") ? s : "/account");

async function limited(): Promise<boolean> {
  return !!(await hit(clientIp(await headers()), FORM_LIMITS).catch(() => null));
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  if (await limited()) return { error: "Too many attempts. Wait a minute and try again.", values: keep(form) };
  const user = await verifyLogin(text(form, "email", 254), String(form.get("password") ?? ""), "customer");
  if (!user) return { error: "Wrong email or password.", values: keep(form) };
  await setCustomerCookie(user.id);
  await attachCartToUser(await currentCartId(), user.id);
  redirect(safeNext(text(form, "next", 200)));
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  if (await limited()) return { error: "Too many attempts. Wait a minute and try again.", values: keep(form) };
  const phone = normalizePhone(text(form, "phone", 40));
  if (!phone) return { error: "Enter a Nigerian phone number with 10 digits after +234.", values: keep(form) };
  const name = text(form, "name", 120);
  if (name.length < 2) return { error: "Enter your full name.", values: keep(form) };
  try {
    const user = await createCustomer({ email: text(form, "email", 254), name, phone, password: String(form.get("password") ?? "") });
    await setCustomerCookie(user.id);
    await attachCartToUser(await currentCartId(), user.id);
  } catch (e) {
    return { error: (e as Error).message, values: keep(form) };
  }
  redirect(safeNext(text(form, "next", 200)));
}

export async function signOutAction() {
  await clearCustomerCookie();
  redirect("/");
}

/** Always answers the same way, so it never tells anyone which emails have accounts. */
export async function forgotAction(_: FormState, form: FormData): Promise<FormState> {
  if (await limited()) return { error: "Too many attempts. Wait a minute and try again." };
  const email = text(form, "email", 254);
  if (!isEmail(email)) return { error: "Enter the email address of your account.", values: keep(form) };
  const user = await getUserByEmail(email);
  if (user && user.active && user.role === "customer") {
    const token = await createPasswordToken(user.id, "reset", 2);
    await sendPasswordReset(user.email, `${await siteUrl()}/account/reset/${token}`);
  }
  return { ok: "If that email has an account, we've sent a link to reset the password. It works for 2 hours." };
}

export async function resetAction(_: FormState, form: FormData): Promise<FormState> {
  if (String(form.get("password")) !== String(form.get("password2"))) return { error: "The two passwords are not the same." };
  try {
    const user = await consumePasswordToken(text(form, "token", 100), String(form.get("password") ?? ""));
    if (user.role === "customer") await setCustomerCookie(user.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect("/account");
}

export async function profileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  const phone = normalizePhone(text(form, "phone", 40));
  if (!phone) return { error: "Enter a Nigerian phone number with 10 digits after +234.", values: keep(form) };
  await updateProfile(user.id, text(form, "name", 120), phone);
  const current = String(form.get("current_password") ?? "");
  const next = String(form.get("new_password") ?? "");
  if (next) {
    try {
      await changePassword(user.id, current, next);
    } catch (e) {
      return { error: (e as Error).message, values: keep(form) };
    }
  }
  revalidatePath("/account", "layout");
  return { ok: next ? "Saved. Your password is changed." : "Saved." };
}

export async function addAddressAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  const street = text(form, "street", 200);
  const area = text(form, "area", 120);
  if (street.length < 3 || area.length < 2) return { error: "Enter the street and the area in Minna.", values: keep(form) };
  await query("insert into addresses (user_id, label, street, area, landmark) values ($1, $2, $3, $4, $5)", [user.id, text(form, "label", 60), street, area, text(form, "landmark", 200)]);
  revalidatePath("/account/addresses");
  return { ok: "Address saved." };
}

export async function deleteAddressAction(id: number) {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  await query("delete from addresses where id = $1 and user_id = $2", [id, user.id]);
  revalidatePath("/account/addresses");
}
