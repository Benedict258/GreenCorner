import type { Metadata } from "next";
import "@/styles/store.css";
import "@/styles/app.css";

// Unmatched URLs anywhere (the store and the admin area have separate root layouts, so neither can host this).
export const metadata: Metadata = { title: "Page not found | Waste2Light Store" };

export default function GlobalNotFound() {
  return (
    <html lang="en-NG">
      <body>
        <div className="simple" style={{ textAlign: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
          <div className="simple__card">
            <h1 className="simple__title">We couldn&apos;t find that page</h1>
            <p className="simple__sub">It may have moved, or the link is wrong.</p>
            <p><a className="btn btn--primary" href="/" style={{ display: "inline-flex", padding: "12px 22px", borderRadius: 999, background: "#0c5c2e", color: "#fff", textDecoration: "none", fontWeight: 600 }}>Go to the Waste2Light Store</a></p>
          </div>
        </div>
      </body>
    </html>
  );
}
