import Link from "next/link";

export interface DocSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** The reading layout of the policy pages: a contents list on desktop, a readable column of text. */
export function LegalDoc({ title, lead, sections, updated }: { title: string; lead: string; sections: DocSection[]; updated?: string }) {
  return (
    <div className="container">
      <nav className="crumbs" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li aria-current="page">{title}</li></ol></nav>
      <div className="doc">
        <nav className="toc" aria-label="On this page">
          <p className="toc__title">On this page</p>
          <ol>{sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol>
        </nav>
        <article className="prose">
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
          {sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id}>
              <h2 id={s.id}>{s.title}</h2>
              {s.body}
            </section>
          ))}
          {updated && <p style={{ marginTop: 32, color: "var(--color-muted-strong)", fontSize: 14 }}>Last updated {updated}. Questions? <Link href="/contact">Contact us</Link>.</p>}
        </article>
      </div>
    </div>
  );
}
