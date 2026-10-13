"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/store/Icon";
import { signOutAction } from "../actions";

const LINKS: [string, string, string][] = [
  ["/account", "Orders", "bag"],
  ["/account/quotes", "Quotes", "file"],
  ["/account/addresses", "Addresses", "pin"],
  ["/account/profile", "Profile", "user"],
];

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const path = usePathname();
  return (
    <nav className="menu" aria-label="Account">
      <div className="menu__who"><p className="menu__name">{name || "Your account"}</p><p className="menu__mail">{email}</p></div>
      {LINKS.map(([href, label, icon]) => (
        <Link key={href} className={`menu__link${path === href ? " menu__link--on" : ""}`} href={href} aria-current={path === href ? "page" : undefined}><Icon name={icon} />{label}</Link>
      ))}
      <form action={signOutAction}>
        <button className="menu__link" type="submit" style={{ width: "100%", border: 0, background: "none", cursor: "pointer", font: "inherit", textAlign: "left" }}><Icon name="out" />Sign out</button>
      </form>
    </nav>
  );
}
