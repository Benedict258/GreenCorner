import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/users";
import { SignInForm } from "../AccountForms";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/account" } = await searchParams;
  if (await currentCustomer()) redirect(next.startsWith("/") ? next : "/account");
  return (
    <div className="simple">
      <div className="simple__card">
        <h1 className="simple__title">Sign in</h1>
        <p className="simple__sub">See your orders, quotes and saved addresses.</p>
        <SignInForm next={next} />
        <p className="simple__foot">New here? <Link href={`/account/sign-up?next=${encodeURIComponent(next)}`}>Create an account</Link>. You can also check out as a guest.</p>
      </div>
    </div>
  );
}
