"use client";
import { usePathname } from "next/navigation";

// Each page's design styles some shared class names in its own way; those rules are scoped to a
// page class (see src/styles/store.css). This picks the class for the current page.
export function pageGroup(path: string): string {
  if (path === "/") return "home";
  if (path === "/shop") return "shop";
  if (path.startsWith("/shop/")) return "product";
  if (path === "/projects") return "projects";
  if (path.startsWith("/projects/")) return "project";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/checkout/failed")) return "payfail";
  if (path.startsWith("/checkout/success")) return "success";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/quote-request/sent")) return "quoteok";
  if (path.startsWith("/quote-request")) return "quote";
  if (path.startsWith("/track")) return "track";
  if (path.startsWith("/quotation")) return "track";
  if (path.startsWith("/account")) return "account";
  if (path.startsWith("/about")) return "about";
  if (path.startsWith("/contact")) return "contact";
  return "legal";
}

export function PageClass({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  return (
    <div className={`pg-${pageGroup(path)}`}>
      <div className="w2l">{children}</div>
    </div>
  );
}
