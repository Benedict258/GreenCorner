import { redirect } from "next/navigation";
import { shortDate } from "@/components/store/format";
import { currentStaff } from "@/lib/auth";
import { listStaff } from "@/lib/users";
import { setStaffActiveAction, setStaffRoleAction } from "./actions";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await currentStaff();
  if (me?.role !== "owner") redirect("/admin");
  const staff = await listStaff();
  const envOwner = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  return (
    <>
      <div className="head"><div><h1 className="head__title">Staff</h1><p className="head__sub">Owners can do everything. Staff handle orders, quote requests, projects and stock, but cannot change prices, make refunds or manage staff.</p></div></div>
      <div className="layout">
        <section className="panel" aria-label="Staff accounts">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Last sign-in</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {envOwner && !staff.some((s) => s.email.toLowerCase() === envOwner) && (
                  <tr><td>Main owner</td><td>{envOwner}</td><td>Owner</td><td>–</td><td><span className="chip chip--ok">Active</span></td><td className="muted">Set in the server settings</td></tr>
                )}
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name || "–"}</td>
                    <td>{s.email}</td>
                    <td>{s.role === "owner" ? "Owner" : "Staff"}</td>
                    <td>{s.lastLoginAt ? shortDate(s.lastLoginAt) : s.hasPassword ? "Never" : "Invited"}</td>
                    <td>{s.active ? <span className="chip chip--ok">Active</span> : <span className="chip chip--bad">Deactivated</span>}</td>
                    <td>
                      {s.email.toLowerCase() !== me.email.toLowerCase() && (
                        <div className="adm-table-actions">
                          <form action={setStaffRoleAction.bind(null, s.id, s.role === "owner" ? "staff" : "owner")}><button className="btn btn--sm btn--secondary" type="submit">Make {s.role === "owner" ? "staff" : "owner"}</button></form>
                          <form action={setStaffActiveAction.bind(null, s.id, !s.active)}><button className={`btn btn--sm ${s.active ? "btn--danger" : "btn--secondary"}`} type="submit">{s.active ? "Deactivate" : "Reactivate"}</button></form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="stack">
          <section className="panel" aria-labelledby="inv-title">
            <div className="panel__head"><h2 className="panel__title" id="inv-title">Add a staff member</h2></div>
            <div className="panel__body"><InviteForm /></div>
          </section>
        </aside>
      </div>
    </>
  );
}
