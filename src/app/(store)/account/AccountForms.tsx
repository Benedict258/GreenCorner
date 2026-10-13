"use client";
import Link from "next/link";
import { useActionState } from "react";
import { addAddressAction, forgotAction, profileAction, resetAction, signInAction, signUpAction, type FormState } from "./actions";

function Feedback({ s }: { s: FormState }) {
  if (s.error) return <p className="notice-box notice-box--error" role="alert">{s.error}</p>;
  if (s.ok) return <p className="notice-box" role="status">{s.ok}</p>;
  return null;
}

export function SignInForm({ next }: { next: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(signInAction, {});
  return (
    <form className="stack-form" action={action}>
      <Feedback s={s} />
      <input type="hidden" name="next" value={next} />
      <label>Email<input name="email" type="email" autoComplete="email" required defaultValue={s.values?.email} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="simple__foot"><Link href="/account/forgot">Forgot your password?</Link></p>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(signUpAction, {});
  return (
    <form className="stack-form" action={action}>
      <Feedback s={s} />
      <input type="hidden" name="next" value={next} />
      <label>Full name<input name="name" autoComplete="name" required defaultValue={s.values?.name} /></label>
      <label>Phone number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0802 555 0148" required defaultValue={s.values?.phone} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required defaultValue={s.values?.email} /></label>
      <label>Password <span className="hint">At least 8 characters.</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
      <p className="simple__foot">Orders you placed before with this email will show in your account.</p>
    </form>
  );
}

export function ForgotForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(forgotAction, {});
  return (
    <form className="stack-form" action={action}>
      <Feedback s={s} />
      <label>Email<input name="email" type="email" autoComplete="email" required defaultValue={s.values?.email} /></label>
      <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(resetAction, {});
  return (
    <form className="stack-form" action={action}>
      <Feedback s={s} />
      <input type="hidden" name="token" value={token} />
      <label>New password <span className="hint">At least 8 characters.</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>New password again<input name="password2" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={pending}>{pending ? "Saving…" : "Save password"}</button>
    </form>
  );
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(profileAction, {});
  return (
    <form className="stack-form" action={action}>
      <Feedback s={s} />
      <label>Email<input value={email} disabled readOnly /></label>
      <label>Full name<input name="name" autoComplete="name" required defaultValue={s.values?.name ?? name} /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" required defaultValue={s.values?.phone ?? phone} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack-form">
        <legend style={{ font: "700 16px var(--font-head)", marginBottom: 8 }}>Change password <span className="hint">(optional)</span></legend>
        <label>Current password<input name="current_password" type="password" autoComplete="current-password" /></label>
        <label>New password<input name="new_password" type="password" autoComplete="new-password" minLength={8} /></label>
      </fieldset>
      <button className="btn btn--primary btn--lg" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

export function AddressForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(addAddressAction, {});
  return (
    <form className="stack-form" action={action}>
      <Feedback s={s} />
      <label>Label <span className="hint">(optional, e.g. School or Home)</span><input name="label" defaultValue={s.values?.label} /></label>
      <label>Street address<input name="street" autoComplete="street-address" required defaultValue={s.values?.street} /></label>
      <label>Area in Minna<input name="area" required defaultValue={s.values?.area} /></label>
      <label>Landmark <span className="hint">(optional)</span><input name="landmark" defaultValue={s.values?.landmark} /></label>
      <button className="btn btn--secondary" type="submit" disabled={pending}>{pending ? "Saving…" : "Add address"}</button>
    </form>
  );
}
