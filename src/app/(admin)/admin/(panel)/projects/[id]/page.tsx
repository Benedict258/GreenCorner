import { notFound } from "next/navigation";
import { dateTime } from "@/components/store/format";
import { queryOne } from "@/lib/db";
import { getProject } from "@/lib/store/projects";
import { findProductsAction } from "../actions";
import { ProjectEditor, type EditorItem, type EditorProject } from "../ProjectEditor";

export const metadata = { title: "Edit project" };

const EMPTY: EditorProject = {
  id: null, title: "", slug: "", summary: "", description: "", learn: "", level: "Beginner", ageGroup: "Secondary", topics: [], buildTime: "",
  imageUrl: "", videoUrl: "", steps: [], safety: "", downloads: [], published: false, position: 0, items: [], updatedAt: null,
};

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") {
    const pos = (await queryOne("select coalesce(max(position), 0) + 1 as p from projects"))?.p ?? 1;
    return <ProjectEditor initial={{ ...EMPTY, position: pos }} />;
  }
  const p = await getProject(Number(id));
  if (!p) notFound();
  const row = await queryOne("select updated_at from projects where id = $1", [p.id]);
  // Kit parts that are hidden or unpriced are not in the public price list; look them up for the editor.
  const missing = p.items.filter((i) => !i.product);
  const extra = new Map<string, EditorItem>();
  for (const m of missing) {
    const hit = (await findProductsAction(m.ref)).find((h) => h.ref === m.ref);
    if (hit) extra.set(m.ref, { ...hit, quantity: m.quantity });
  }
  const initial: EditorProject = {
    id: p.id, title: p.title, slug: p.slug, summary: p.summary, description: p.description, learn: p.learn.join("\n"),
    level: p.level, ageGroup: p.ageGroup, topics: p.topics, buildTime: p.buildTime, imageUrl: p.imageUrl ?? "", videoUrl: p.videoUrl ?? "",
    steps: p.steps.map((s) => ({ title: s.title, text: s.text, image: s.image ?? "" })), safety: p.safety, downloads: p.downloads,
    published: p.published, position: (await queryOne("select position from projects where id = $1", [p.id]))?.position ?? 0,
    items: p.items.map((i) => i.product
      ? { ref: i.ref, title: i.product.title, quantity: i.quantity, price: i.product.price, inStock: i.product.availability !== "out" }
      : extra.get(i.ref) ?? { ref: i.ref, title: `${i.ref} (no longer in the feed)`, quantity: i.quantity, price: null, inStock: false }),
    updatedAt: row ? dateTime(new Date(row.updated_at).toISOString()) : null,
  };
  return <ProjectEditor initial={initial} />;
}
