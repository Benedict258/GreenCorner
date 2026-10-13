"use client";
import { useActionState } from "react";
import { acceptInviteAction } from "./actions";

export function InviteAcceptForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState(acceptInviteAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>New password again<input name="password2" type="password" autoComplete="new-password" minLength={8} required /></label>
      {s.error && <p className="error" role="alert">{s.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? "Saving..." : "Save and sign in"}</button>
    </form>
  );
}
