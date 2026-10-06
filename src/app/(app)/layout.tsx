import Link from "next/link";
import { logout } from "../login/actions";
import { Logo } from "@/components/Logo";
import { cartCount } from "@/lib/shop";

const NAV = [
  ["/shop", "Shop"],
  ["/quotes", "Quotes"],
  ["/catalog", "Catalog"],
  ["/bundles", "Bundles"],
  ["/sync", "Sync"],
  ["/settings", "Settings"],
] as const;

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The header must never take every page down with it, so a failed count just shows "Cart".
  const inCart = await cartCount().catch(() => null);
  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link href="/shop" className="brand-mark" aria-label="Green Corner home"><Logo suffix="Green Corner" /></Link>
          <nav aria-label="Main">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </nav>
          <Link className="btn" href="/shop/cart">{inCart === null ? "Cart" : `Cart (${inCart})`}</Link>
          <Link className="btn primary" href="/quotes/new">New quote</Link>
          <form action={logout}><button className="btn small">Sign out</button></form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
