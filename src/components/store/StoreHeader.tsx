"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { useCart } from "./CartProvider";
import { Icon } from "./Icon";
import { naira } from "./format";

const NAV: [string, string][] = [
  ["/shop", "Shop"],
  ["/projects", "Projects"],
  ["/#schools", "For schools"],
  ["/about", "About"],
  ["/contact", "Contact"],
];

const WHATSAPP = "https://wa.me/2348078787646";

function isActive(path: string, href: string): boolean {
  if (href.includes("#")) return false;
  return path === href || path.startsWith(`${href}/`);
}

export function StoreHeader({ signedIn }: { signedIn: boolean }) {
  const path = usePathname() ?? "/";
  const { count, open } = useCart();
  const [menu, setMenu] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState(false);
  const [strip, setStrip] = useState(true);

  useEffect(() => {
    try { if (localStorage.getItem("w2l-strip") === "hidden") setStrip(false); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { setMenu(false); setPhoneSearch(false); }, [path]);

  const hideStrip = () => {
    setStrip(false);
    try { localStorage.setItem("w2l-strip", "hidden"); } catch { /* storage blocked */ }
  };

  return (
    <>
      <header className="site-header">
        <a className="skip-link" href="#main">Skip to content</a>
        {strip && (
          <div className="strip">
            <div className="strip__in">
              <p>Delivery and pickup in Minna, Niger State. Free delivery on every order.</p>
              <button className="strip__close" type="button" aria-label="Dismiss announcement" onClick={hideStrip}><Icon name="close" /></button>
            </div>
          </div>
        )}
        <div className="bar">
          <Link className="logo" href="/" aria-label="Waste2Light Store, home">
            <LogoMark className="logo__mark" />
            <span className="logo__word">Waste<b>2</b>Light</span>
            <span className="logo__tag">Store</span>
          </Link>
          <nav aria-label="Main">
            <div className="nav">
              {NAV.map(([href, label]) => (
                <Link key={href} className={`nav__link${isActive(path, href) ? " nav__link--active" : ""}`} href={href} aria-current={isActive(path, href) ? "page" : undefined}>{label}</Link>
              ))}
            </div>
          </nav>
          <SearchBox id="hdr-q" className="search" />
          <div className="actions">
            <button className="icon-btn icon-btn--phone" type="button" aria-label="Search" aria-expanded={phoneSearch} onClick={() => setPhoneSearch((v) => !v)}><Icon name="search" /></button>
            <Link className="icon-btn icon-btn--account" href={signedIn ? "/account" : "/account/sign-in"} aria-label={signedIn ? "Your account" : "Sign in"}><Icon name="user" /></Link>
            <button className="icon-btn" type="button" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`} onClick={open}>
              <Icon name="cart" />
              {count > 0 && <span className="icon-btn__badge">{count}</span>}
            </button>
            <button className="icon-btn icon-btn--phone" type="button" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}><Icon name="menu" /></button>
          </div>
        </div>
        {phoneSearch && (
          <div className="phone-search">
            <SearchBox id="phone-q" className="" autoFocus />
          </div>
        )}
      </header>
      {menu && <MenuSheet path={path} signedIn={signedIn} onClose={() => setMenu(false)} />}
    </>
  );
}

interface Hit { id: number; slug: string; title: string; price: number; image: string | null }

function SearchBox({ id, className, autoFocus }: { id: string; className: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [show, setShow] = useState(false);
  const [sel, setSel] = useState(-1);
  const box = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/store/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => { setHits(d.items ?? []); setSel(-1); })
        .catch(() => undefined);
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setShow(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    setShow(false);
    if (sel >= 0 && hits[sel]) router.push(`/shop/${hits[sel].id}-${hits[sel].slug}`);
    else router.push(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : "/shop");
  };

  return (
    <form ref={box} className={className} role="search" onSubmit={go} style={className ? undefined : { position: "relative" }}>
      {className && <Icon name="search" />}
      <label className="sr-only" htmlFor={id}>Search components</label>
      <input
        id={id}
        type="search"
        placeholder="Search components"
        value={q}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={show && hits.length > 0}
        aria-controls={`${id}-list`}
        onChange={(e) => { setQ(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, -1)); }
          else if (e.key === "Escape") setShow(false);
        }}
      />
      {!className && <button className="btn btn--primary" type="submit">Search</button>}
      {show && hits.length > 0 && (
        <ul className="suggest" id={`${id}-list`} role="listbox">
          {hits.map((h, i) => (
            <li key={h.id}>
              <Link href={`/shop/${h.id}-${h.slug}`} role="option" aria-selected={i === sel} onClick={() => setShow(false)} prefetch={false}>
                {h.image ? <img src={`${h.image}?w=80`} alt="" /> : <span className="suggest__ph" />}
                <span className="suggest__name">{h.title}</span>
                <span className="suggest__price">{naira(h.price)}</span>
              </Link>
            </li>
          ))}
          <li><Link className="suggest__all" href={`/shop?q=${encodeURIComponent(q.trim())}`} onClick={() => setShow(false)}>See all results for “{q.trim()}”</Link></li>
        </ul>
      )}
    </form>
  );
}

function MenuSheet({ path, signedIn, onClose }: { path: string; signedIn: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    document.body.classList.add("no-scroll");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("no-scroll"); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="overlay overlay--left menu-sheet" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="sheet__head">
          <Link className="logo" href="/" aria-label="Waste2Light Store, home" onClick={onClose}><LogoMark />Waste<b>2</b>Light</Link>
          <button ref={closeRef} className="close" type="button" aria-label="Close menu" onClick={onClose}><Icon name="close" /></button>
        </div>
        <ul className="sheet__nav">
          {NAV.map(([href, label]) => (
            <li key={href}><Link href={href} onClick={onClose} aria-current={isActive(path, href) ? "page" : undefined}>{label}<Icon name="chevron-right" /></Link></li>
          ))}
        </ul>
        <ul className="sheet__more">
          <li><Link href="/track" onClick={onClose}><Icon name="truck" />Track order</Link></li>
          <li><a href={WHATSAPP}><Icon name="whatsapp" />WhatsApp us</a></li>
        </ul>
        <div className="sheet__foot">
          <Link className="btn btn--primary" href={signedIn ? "/account" : "/account/sign-in"} onClick={onClose}>{signedIn ? "Your account" : "Sign in"}</Link>
          <Link className="btn btn--secondary" href="/quote-request" onClick={onClose}>Request a quote</Link>
        </div>
      </div>
    </div>
  );
}
