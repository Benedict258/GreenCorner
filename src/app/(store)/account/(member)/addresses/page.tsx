import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { currentCustomer } from "@/lib/users";
import { deleteAddressAction } from "../../actions";
import { AddressForm } from "../../AccountForms";

export const metadata = { title: "Your addresses", robots: { index: false } };

export default async function Addresses() {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  const rows = await query("select * from addresses where user_id = $1 order by id desc", [user.id]);
  return (
    <>
      <h1 className="main__title">Addresses</h1>
      <section className="panel" aria-label="Saved addresses" style={{ padding: 20 }}>
        {rows.length === 0 ? <p>No saved addresses yet. Your delivery address is saved when you check out.</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {rows.map((a) => (
              <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderBottom: "1px solid #edefe9", paddingBottom: 12 }}>
                <span>{a.label && <b>{a.label}: </b>}{a.street}, {a.area}{a.landmark ? ` (${a.landmark})` : ""}, Minna</span>
                <form action={deleteAddressAction.bind(null, a.id)}><button className="btn btn--text" type="submit">Remove</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel" aria-label="Add an address" style={{ padding: 20, marginTop: 20 }}>
        <h2 className="panel__title" style={{ marginBottom: 12 }}>Add an address</h2>
        <p style={{ marginBottom: 12, color: "var(--color-muted-strong)" }}>We deliver in Minna, Niger State only for now.</p>
        <AddressForm />
      </section>
    </>
  );
}
