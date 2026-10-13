import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectCard } from "@/components/store/Cards";
import { Icon } from "@/components/store/Icon";
import { KitBuyBox, KitProvider, KitTable, type KitRow } from "@/components/store/Kit";
import { categoryIcon, productPath } from "@/lib/store/catalog";
import { getProjectBySlug, listProjects } from "@/lib/store/projects";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const p = await getProjectBySlug((await params).slug);
  return p ? { title: `${p.title} kit`, description: p.summary } : { title: "Project not found" };
}

/** YouTube and Vimeo links become an embed; anything else is shown as a link. */
function videoEmbed(url: string): string | null {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/.exec(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = /vimeo\.com\/(\d+)/.exec(url);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default async function ProjectPage({ params }: Props) {
  const p = await getProjectBySlug((await params).slug);
  if (!p) notFound();
  const related = (await listProjects({}, { limit: 4 })).filter((r) => r.id !== p.id).slice(0, 3);
  const rows: KitRow[] = p.items.map((i) => ({
    ref: i.ref,
    quantity: i.quantity,
    title: i.product?.title ?? null,
    href: i.product ? productPath(i.product) : null,
    image: i.product?.image ?? null,
    icon: i.product ? categoryIcon(i.product.category) : "box",
    unitPrice: i.product?.price ?? 0,
    out: i.product?.availability === "out",
  }));
  const outCount = rows.filter((r) => r.title && r.out).length;
  const missing = rows.some((r) => !r.title) || rows.length === 0;
  const embed = p.videoUrl ? videoEmbed(p.videoUrl) : null;

  return (
    <KitProvider>
      <div className="container">
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol><li><Link href="/projects">Projects</Link></li><li aria-current="page">{p.title}</li></ol>
        </nav>
        <section className="hero" aria-labelledby="proj-title">
          <div className="hero__media photo" role="img" aria-label={p.imageUrl || embed ? `${p.title}` : `${p.title} (photo coming soon)`}>
            {embed ? (
              <iframe src={embed} title={`${p.title} video`} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" style={{ width: "100%", height: "100%", border: 0, borderRadius: "inherit" }} />
            ) : p.imageUrl ? <img className="photo__img" src={p.imageUrl} alt="" /> : <Icon name="box" className="product-card__glyph" />}
          </div>
          <div>
            <h1 className="hero__title" id="proj-title">{p.title}</h1>
            <p className="hero__summary">{p.summary}</p>
            <div className="hero__chips">
              <span className="chip">{p.level}</span>
              <span className="chip">{p.ageGroup}</span>
              {p.buildTime && <span className="chip">{p.buildTime} to build</span>}
            </div>
            <KitBuyBox projectId={p.id}kitPrice={p.kitPrice} outCount={outCount} missing={missing} />
          </div>
        </section>

        {(p.description || p.learn.length > 0) && (
          <section className="block two" aria-label="About this project">
            {p.description && (
              <div className="prose">
                <h2 className="block__title">What you&apos;ll build</h2>
                {p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
            )}
            {p.learn.length > 0 && (
              <div>
                <h2 className="block__title">What you&apos;ll learn</h2>
                <ul className="learn">{p.learn.map((l, i) => <li key={i}><span className="learn__tick"><Icon name="check" /></span>{l}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        <section className="block" aria-labelledby="kit-title">
          <h2 className="block__title" id="kit-title">What&apos;s in the kit</h2>
          <KitTable projectId={p.id} title={p.title} rows={rows} total={p.kitPrice} />
        </section>

        {p.steps.length > 0 && (
          <section className="block" aria-labelledby="guide-title">
            <h2 className="block__title" id="guide-title">Step-by-step guide</h2>
            <ol className="steps">
              {p.steps.map((s, i) => (
                <li key={i}>
                  <details className="gstep" open={i === 0}>
                    <summary><span className="gstep__num">{i + 1}</span>{s.title}</summary>
                    <div className="gstep__body">
                      {s.image && <div className="gstep__photo photo"><img className="photo__img" src={s.image} alt="" loading="lazy" /></div>}
                      {s.text.split(/\n{2,}/).map((para, j) => <p key={j}>{para}</p>)}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        )}

        {p.safety && (
          <section className="block" aria-label="Safety notes">
            <div className="safety" role="note">
              <Icon name="alert" />
              <div>
                <h3>Safety notes</h3>
                <ul>{p.safety.split(/\n+/).filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
          </section>
        )}

        {(p.downloads.length > 0 || (p.videoUrl && !embed)) && (
          <section className="block" aria-labelledby="dl-title">
            <h2 className="block__title" id="dl-title">Downloads</h2>
            <ul className="downloads">
              {p.downloads.map((d, i) => (
                <li key={i}>
                  <a className="download" href={d.url} target="_blank" rel="noreferrer">
                    <span className="download__icon"><Icon name="file" /></span>
                    <span><span className="download__name">{d.label}</span><br /><span className="download__meta">{/\.pdf($|\?)/i.test(d.url) ? "PDF" : "Link"}</span></span>
                  </a>
                </li>
              ))}
              {p.videoUrl && !embed && (
                <li><a className="download" href={p.videoUrl} target="_blank" rel="noreferrer"><span className="download__icon"><Icon name="download" /></span><span><span className="download__name">Project video</span><br /><span className="download__meta">Video</span></span></a></li>
              )}
            </ul>
          </section>
        )}

        {related.length > 0 && (
          <section className="block" aria-labelledby="rel-title">
            <h2 className="block__title" id="rel-title">Related projects</h2>
            <div className="related">{related.map((r) => <ProjectCard key={r.id} p={r} />)}</div>
          </section>
        )}
      </div>
      <div className="end-space" />
    </KitProvider>
  );
}
