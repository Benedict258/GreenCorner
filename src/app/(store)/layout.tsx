import type { Metadata, Viewport } from "next";
import "@/styles/store.css";
import "@/styles/app.css";
import { CartProvider } from "@/components/store/CartProvider";
import { PageClass } from "@/components/store/PageClass";
import { StoreFooter } from "@/components/store/StoreFooter";
import { StoreHeader } from "@/components/store/StoreHeader";
import { cartCount, currentCartId } from "@/lib/store/cart";
import { listCategories } from "@/lib/store/catalog";
import { listProjects } from "@/lib/store/projects";
import { currentCustomer } from "@/lib/users";

export const metadata: Metadata = {
  title: { default: "Waste2Light Store: components and kits for Nigeria's builders", template: "%s | Waste2Light Store" },
  description: "Buy electronics and renewable-energy components, or a complete project kit, delivered in Minna, Niger State. Pay online or request a quote for your school.",
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  openGraph: { siteName: "Waste2Light Store", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0c4a23", width: "device-width", initialScale: 1 };

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // The header and footer must never take a page down with them, so each lookup falls back quietly.
  const [count, customer, categories, projects] = await Promise.all([
    currentCartId().then(cartCount).catch(() => 0),
    currentCustomer().catch(() => null),
    listCategories().catch(() => []),
    listProjects({}, { limit: 4 }).catch(() => []),
  ]);
  return (
    <html lang="en-NG">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <CartProvider initialCount={count}>
          <PageClass>
            <StoreHeader signedIn={!!customer} />
            <main id="main">{children}</main>
            <StoreFooter categories={categories.map((c) => c.name)} projects={projects.map((p) => ({ slug: p.slug, title: p.title }))} />
          </PageClass>
        </CartProvider>
      </body>
    </html>
  );
}
