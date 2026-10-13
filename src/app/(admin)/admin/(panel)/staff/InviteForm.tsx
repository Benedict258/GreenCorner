"use client";
import { useActionState } from "react";
import { inviteStaffAction } from "./actions";

export function InviteForm() {
  const [s, action, pending] = useActionState(inviteStaffAction, {});
  return (
    <form className="adm-kv-form" action={action}>
      {s.error && <p className="notice-box notice-box--error" role="alert">{s.error}</p>}
      {s.ok && <p className="notice-box" role="status">{s.ok}{s.link && <><br /><code style={{ wordBreak: "break-all" }}>{s.link}</code></>}</p>}
      <label>Name<input name="name" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Role
        <select name="role" defaultValue="staff">
          <option value="staff">Staff: orders, quote requests, projects, stock</option>
          <option value="owner">Owner: everything, including prices, refunds and staff</option>
        </select>
      </label>
      <button className="btn btn--primary" type="submit" disabled={pending}>{pending ? "Inviting…" : "Send invitation"}</button>
    </form>
  );
}
