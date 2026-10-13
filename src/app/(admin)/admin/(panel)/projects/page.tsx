import Link from "next/link";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { listProjects } from "@/lib/store/projects";
import { query } from "@/lib/db";
import { SeedDemoButton } from "./SeedDemoButton";

export const metadata = { title: "Projects" };

export default async function AdminProjects() {
  const projects = await listProjects({}, { includeDrafts: true });
  const published = new Map((await query("select id, published, updated_at from projects")).map((r) => [r.id, r]));
  return (
    <>
      <div className="head">
        <div><h1 className="head__title">Projects</h1><p className="head__sub">{projects.length} project{projects.length === 1 ? "" : "s"}. Customers can buy each as a kit or request a quote for a class.</p></div>
        <div className="head__actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SeedDemoButton />
          <Link className="btn btn--primary" href="/admin/projects/new"><Icon name="plus" />New project</Link>
        </div>
      </div>
      <section className="panel" aria-label="Projects">
        {projects.length === 0 ? <p className="adm-empty">No projects yet. Add one, or add the demo projects to start from.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Project</th><th scope="col">Level</th><th scope="col">Age</th><th scope="col" className="num">Parts</th><th scope="col" className="num">Kit price</th><th scope="col">Stock</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/admin/projects/${p.id}`}>{p.title}</Link><br /><small className="muted">/projects/{p.slug}</small></td>
                    <td>{p.level}</td>
                    <td>{p.ageGroup}</td>
                    <td className="num">{p.componentCount}</td>
                    <td className="num price">{naira(p.kitPrice)}</td>
                    <td>{p.unavailable > 0 ? <span className="stock stock--out">{p.unavailable} out</span> : <span className="stock stock--in">All in stock</span>}</td>
                    <td>{published.get(p.id)?.published ? <span className="chip chip--ok">Published</span> : <span className="chip chip--warn">Draft</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
