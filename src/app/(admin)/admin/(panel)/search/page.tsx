import Link from "next/link";
import { adminSearch } from "@/lib/admin/dashboard";

export const metadata = { title: "Search" };

const TYPE = { order: "Order", request: "Quote request", customer: "Customer", product: "Product" } as const;

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const hits = await adminSearch(q);
  return (
    <>
      <div className="head"><div><h1 className="head__title">Search</h1><p className="head__sub">{q ? `${hits.length} result${hits.length === 1 ? "" : "s"} for “${q}”` : "Type in the search box above."}</p></div></div>
      <section className="panel" aria-label="Results">
        {hits.length === 0 ? <p className="adm-empty">{q ? "Nothing found." : ""}</p> : (
          <ul className="attn">
            {hits.map((h, i) => (
              <li key={i}>
                <span className="attn__icon" style={{ fontSize: 11, fontWeight: 700 }}>{TYPE[h.type].slice(0, 1)}</span>
                <div><p className="attn__title"><Link href={h.href}>{h.title}</Link></p><p className="attn__sub">{TYPE[h.type]} · {h.sub}</p></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
