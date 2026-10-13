import LoginForm from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="legacy">
      <main className="login">
        <div className="card login-card">
          <p className="brand-mark"><Logo suffix="Admin" /></p>
          <h1>Waste2Light Store admin</h1>
          <p className="muted">Staff only. Power. Learn. Build.</p>
          <LoginForm next={next && next.startsWith("/admin") ? next : "/admin"} />
        </div>
      </main>
    </div>
  );
}
