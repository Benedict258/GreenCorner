import { Logo } from "@/components/Logo";
import { peekPasswordToken } from "@/lib/users";
import { InviteAcceptForm } from "./InviteAcceptForm";

export const metadata = { title: "Set your password" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await peekPasswordToken(token);
  return (
    <div className="legacy">
      <main className="login">
        <div className="card login-card">
          <p className="brand-mark"><Logo suffix="Admin" /></p>
          <h1>Set your password</h1>
          {user && user.role !== "customer" ? (
            <>
              <p className="muted">For {user.email}. At least 8 characters.</p>
              <InviteAcceptForm token={token} />
            </>
          ) : <p className="error">This link has expired or was already used. Ask an owner for a new invitation.</p>}
        </div>
      </main>
    </div>
  );
}
