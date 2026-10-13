import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/users";
import { AccountMenu } from "./AccountMenu";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await currentCustomer();
  if (!user) redirect("/account/sign-in");
  return (
    <div className="container account">
      <AccountMenu name={user.name} email={user.email} />
      <div className="main">{children}</div>
    </div>
  );
}
