import Link from "next/link";
import { peekPasswordToken } from "@/lib/users";
import { ResetForm } from "../../AccountForms";

export const metadata = { title: "Choose a new password", robots: { index: false } };

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await peekPasswordToken(token);
  return (
    <div className="simple">
      <div className="simple__card">
        <h1 className="simple__title">Choose a new password</h1>
        {user ? (
          <>
            <p className="simple__sub">For {user.email}.</p>
            <ResetForm token={token} />
          </>
        ) : (
          <p className="notice-box notice-box--warn">This link has expired or was already used. <Link href="/account/forgot">Ask for a new one</Link>.</p>
        )}
      </div>
    </div>
  );
}
