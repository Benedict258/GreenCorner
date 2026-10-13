"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LogoMark } from "@/components/Logo";
import { Icon } from "@/components/store/Icon";
import { ago } from "@/components/store/format";
import { markNotificationsReadAction } from "@/app/(admin)/admin/(panel)/chromeActions";
import { logout } from "@/app/(admin)/admin/login/actions";

interface Note { id: number; title: string; body: string; link: string | null; at: string; read: boolean; kind: string }

const NAV: { href: string; label: string; icon: string; count?: "orders" | "requests"; ownerOnly?: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: "dash" },
  { href: "/admin/orders", label: "Orders", icon: "bag", count: "orders" },
  { href: "/admin/quote-requests", label: "Quote requests", icon: "quote", count: "requests" },
  { href: "/admin/quotes", label: "Quotations", icon: "file" },
  { href: "/admin/products", label: "Products", icon: "box" },
  { href: "/admin/stock", label: "Stock", icon: "stock" },
  { href: "/admin/projects", label: "Projects", icon: "folder" },
  { href: "/admin/customers", label: "Customers", icon: "customers" },
  { href: "/admin/sync", label: "Sync", icon: "sync" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
  { href: "/admin/staff", label: "Staff", icon: "shield", ownerOnly: true },
  { href: "/admin/activity", label: "Activity", icon: "activity" },
];
// The older quote tools, kept under "More".
const MORE: [string, string][] = [["/admin/shop", "Quote shop"], ["/admin/catalog", "Catalog"], ["/admin/bundles", "Bundles"], ["/admin/traffic", "Traffic"]];

/** Admin pages scope some design rules per page (src/styles/admin.css). */
export function adminGroup(path: string): string {
  if (/^\/admin\/orders\/\d+/.test(path)) return "ad-order";
  if (path.startsWith("/admin/orders") || path.startsWith("/admin/customers")) return "ad-orders";
  if (path.startsWith("/admin/quote-requests")) return "ad-quote";
  if (path.startsWith("/admin/products") || path.startsWith("/admin/stock")) return "ad-products";
  if (path.startsWith("/admin/projects")) return "ad-project";
  return "ad-dash";
}

function active(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
}

export function AdminChrome({ staff, counts, notifications, unread, children }: { staff: { email: string; role: string }; counts: { orders: number; requests: number }; notifications: Note[]; unread: number; children: React.ReactNode }) {
  const path = usePathname() ?? "/admin";
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("w2l-admin-collapsed") === "1"); } catch { /* blocked */ } }, []);
  useEffect(() => setMoreOpen(false), [path]);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem("w2l-admin-collapsed", c ? "0" : "1"); } catch { /* blocked */ } return !c; });
  const initials = staff.email.slice(0, 2).toUpperCase();

  return (
    <div className={`pg-${adminGroup(path)}`}>
      <div className={`admin${collapsed ? " admin--collapsed" : ""}`}>
        <aside className="side" aria-label="Admin navigation">
          <Link className="brand" href="/admin"><LogoMark /><span><span className="brand__word">Waste<b>2</b>Light</span><span className="brand__tag">Admin</span></span></Link>
          <nav aria-label="Admin">
            <ul className="nav">
              {NAV.filter((n) => !n.ownerOnly || staff.role === "owner").map((n) => (
                <li key={n.href}>
                  <Link className={`nav__link${active(path, n.href) ? " nav__link--on" : ""}`} href={n.href} aria-current={active(path, n.href) ? "page" : undefined}>
                    <Icon name={n.icon} />{n.label}{n.count && counts[n.count] > 0 && <span className="nav__count">{counts[n.count]}</span>}
                  </Link>
                </li>
              ))}
              <li><p className="nav__more-label">Quote tools</p></li>
              {MORE.map(([href, label]) => (
                <li key={href}><Link className={`nav__link${active(path, href) ? " nav__link--on" : ""}`} href={href}><Icon name="more" />{label}</Link></li>
              ))}
            </ul>
          </nav>
          <button className="collapse" type="button" onClick={toggle}><Icon name="collapse" />{collapsed ? "Expand menu" : "Collapse menu"}</button>
        </aside>
        <nav className="tabbar" aria-label="Admin quick navigation">
          <Link href="/admin" aria-current={path === "/admin" ? "page" : undefined}><Icon name="dash" />Dashboard</Link>
          <Link href="/admin/orders" aria-current={active(path, "/admin/orders") ? "page" : undefined}><Icon name="bag" />Orders</Link>
          <Link href="/admin/quote-requests" aria-current={active(path, "/admin/quote-requests") ? "page" : undefined}><Icon name="quote" />Quotes</Link>
          <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}><Icon name="more" />More</button>
        </nav>
        {moreOpen && (
          <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}>
            <div className="adm-more-sheet" role="dialog" aria-label="More admin pages">
              {[...NAV.slice(3), ...MORE.map(([href, label]) => ({ href, label, icon: "more" }))].map((n) => <Link key={n.href} href={n.href}><Icon name={n.icon} />{n.label}</Link>)}
            </div>
          </div>
        )}
        <div className="admin__main">
          <header className="top">
            <AdminSearch />
            <div className="right">
              <Bell notifications={notifications} unread={unread} />
              <UserMenu email={staff.email} role={staff.role} initials={initials} />
            </div>
          </header>
          <main className="content" id="main">{children}</main>
        </div>
      </div>
    </div>
  );
}

function AdminSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); const q = ref.current?.value.trim(); if (q) router.push(`/admin/search?q=${encodeURIComponent(q)}`); }}>
      <Icon name="search" />
      <label className="sr-only" htmlFor="adm-q">Search orders, customers and products</label>
      <input ref={ref} id="adm-q" type="search" placeholder="Search orders, customers, products" />
      <kbd>/</kbd>
    </form>
  );
}

function Bell({ notifications, unread }: { notifications: Note[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  // New orders arrive while the dashboard is open: refresh the counts every minute.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 60_000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="bell" ref={box}>
      <button className="bell__btn" type="button" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" />{unread > 0 && <span className="bell__count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="menu" role="region" aria-label="Notifications">
          <div className="menu__head">
            <h2 className="menu__title">Notifications</h2>
            {unread > 0 && <button className="menu__mark" type="button" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })}>Mark all as read</button>}
          </div>
          {notifications.length === 0 ? <p style={{ padding: 16 }}>Nothing yet.</p> : (
            <ul className="note">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "/admin/notifications"} onClick={() => { setOpen(false); if (!n.read) void markNotificationsReadAction(n.id); }}>
                    <span className={`note__dot${n.read ? " note__dot--read" : ""}`} />
                    <span>
                      <p className="note__title">{/problem|sync/.test(n.kind) && <span className="note__warn">Attention: </span>}{n.title}</p>
                      <p className="note__text">{n.body.split("\n")[0].slice(0, 120)}</p>
                      <p className="note__time">{ago(n.at)}</p>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="menu__foot" href="/admin/notifications" onClick={() => setOpen(false)}>View all notifications</Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ email, role, initials }: { email: string; role: string; initials: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className="user" type="button" aria-label={`Account menu, ${email}, ${role}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="user__av">{initials}</span>
        <span className="user__name">{email}<span className="user__role">{role === "owner" ? "Owner" : "Staff"}</span></span>
        <Icon name="chevron" />
      </button>
      {open && (
        <div className="adm-user-menu">
          <a href="/" target="_blank" rel="noreferrer">Open the store</a>
          <form action={logout}><button type="submit">Sign out</button></form>
        </div>
      )}
    </div>
  );
}
