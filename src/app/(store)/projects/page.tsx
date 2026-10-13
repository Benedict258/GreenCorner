import Link from "next/link";
import { ProjectCard } from "@/components/store/Cards";
import { Icon } from "@/components/store/Icon";
import { AGE_GROUPS, LEVELS, listProjects, TOPICS } from "@/lib/store/projects";

export const metadata = {
  title: "Projects",
  description: "Ready-made electronics and renewable-energy projects. Pick one and get every part in one kit, delivered in Minna.",
};

type Params = { level?: string; age?: string; topic?: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const level = LEVELS.find((l) => l === sp.level);
  const age = AGE_GROUPS.find((a) => a === sp.age);
  const topic = TOPICS.find((t) => t === sp.topic);
  const projects = await listProjects({ level, age, topic });

  const href = (p: Partial<Params>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ level, age, topic, ...p })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/projects?${s}` : "/projects";
  };
  const row = (label: string, id: string, key: keyof Params, options: readonly string[], current?: string) => (
    <div className="filter-row">
      <span className="filter-row__label" id={id}>{label}</span>
      <div className="filter-row__chips" role="group" aria-labelledby={id}>
        <Link className="fchip" href={href({ [key]: undefined })} aria-pressed={!current} scroll={false}>All</Link>
        {options.map((o) => <Link key={o} className="fchip" href={href({ [key]: o })} aria-pressed={current === o} scroll={false}>{o}</Link>)}
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">Projects</h1>
        <p className="page-head__sub">Pick a project. We&apos;ll send every part you need in one kit.</p>
      </div>
      <div className="filters" role="group" aria-label="Filter projects">
        {row("Level", "f-level", "level", LEVELS, level)}
        {row("Age group", "f-age", "age", AGE_GROUPS, age)}
        {row("Topic", "f-topic", "topic", TOPICS, topic)}
      </div>
      {projects.length === 0 ? (
        <div className="empty" style={{ padding: "48px 0 72px", textAlign: "center" }}>
          <p className="empty__title" style={{ fontWeight: 700, fontSize: 20 }}>No projects match these filters yet.</p>
          <p style={{ margin: "8px 0 16px" }}><Link className="btn btn--secondary" href="/projects">Show all projects</Link></p>
          <p><a href="https://wa.me/2348078787646"><Icon name="whatsapp" /> Tell us what you want to build</a></p>
        </div>
      ) : (
        <div className="grid">{projects.map((p) => <ProjectCard key={p.id} p={p} heading="h2" showTime />)}</div>
      )}
    </div>
  );
}
