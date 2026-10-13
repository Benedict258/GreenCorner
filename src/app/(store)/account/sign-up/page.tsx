import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/users";
import { SignUpForm } from "../AccountForms";

export const metadata = { title: "Create an account", robots: { index: false } };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/account" } = await searchParams;
  if (await currentCustomer()) redirect("/account");
  return (
    <div className="simple">
      <div className="simple__card">
        <h1 className="simple__title">Create an account</h1>
        <p className="simple__sub">Track orders, keep your quotes and check out faster.</p>
        <SignUpForm next={next} />
        <p className="simple__foot">Already have an account? <Link href={`/account/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
      </div>
    </div>
  );
}
