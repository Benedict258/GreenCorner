import Link from "next/link";
import { ForgotForm } from "../AccountForms";

export const metadata = { title: "Forgot password", robots: { index: false } };

export default function Forgot() {
  return (
    <div className="simple">
      <div className="simple__card">
        <h1 className="simple__title">Forgot your password?</h1>
        <p className="simple__sub">Enter your email and we&apos;ll send you a link to choose a new one.</p>
        <ForgotForm />
        <p className="simple__foot"><Link href="/account/sign-in">Back to sign in</Link> · No email? <a href="https://wa.me/2348078787646">WhatsApp us</a></p>
      </div>
    </div>
  );
}
