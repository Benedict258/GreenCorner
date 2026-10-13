import { redirect } from "next/navigation";
import { currentCustomer, formatPhone } from "@/lib/users";
import { ProfileForm } from "../../AccountForms";

export const metadata = { title: "Your profile", robots: { index: false } };

export default async function Profile() {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  return (
    <>
      <h1 className="main__title">Profile</h1>
      <section className="panel" aria-label="Profile" style={{ padding: 20, maxWidth: 560 }}>
        <ProfileForm name={user.name} phone={formatPhone(user.phone)} email={user.email} />
      </section>
    </>
  );
}
