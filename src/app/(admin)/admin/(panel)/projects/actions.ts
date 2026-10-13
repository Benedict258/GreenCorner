"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { audit } from "@/lib/guard";
import { deleteProject, findProducts, saveMedia, saveProject, seedDemoProjects, setPublished, type ProjectInput } from "@/lib/admin/projects";
import { defaultMarkup } from "@/lib/store/catalog";
import { unitPrice } from "@/lib/pricing";
import { query } from "@/lib/db";

const refresh = (slug?: string) => {
  revalidatePath("/admin/projects", "layout");
  revalidatePath("/projects", "layout");
  revalidatePath("/");
  if (slug) revalidatePath(`/projects/${slug}`);
};

export async function saveProjectAction(id: number | null, input: ProjectInput): Promise<{ id?: number; error?: string }> {
  const s = await requireStaff();
  try {
    const pid = await saveProject(id, input);
    await audit(s.email, id ? "project_saved" : "project_created", "project", pid, { title: input.title, published: input.published });
    refresh(input.slug);
    return { id: pid };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteProjectAction(id: number) {
  const s = await requireStaff();
  await deleteProject(id);
  await audit(s.email, "project_deleted", "project", id);
  refresh();
  redirect("/admin/projects");
}

export async function togglePublishedAction(id: number, published: boolean) {
  const s = await requireStaff();
  await setPublished(id, published);
  await audit(s.email, published ? "project_published" : "project_unpublished", "project", id);
  refresh();
}

export async function seedDemoAction(): Promise<{ added: number }> {
  const s = await requireStaff();
  const added = await seedDemoProjects();
  await audit(s.email, "demo_projects_added", "project", null, { added });
  refresh();
  return { added };
}

/** Product search for the kit list, with today's price on the store. */
export async function findProductsAction(q: string) {
  await requireStaff();
  const def = await defaultMarkup();
  const rows = await findProducts(q);
  const refs = rows.map((r) => r.ref);
  const markups = refs.length
    ? await query(
        `select p.ref, coalesce(ps.markup_pct, c.markup_pct, $2) as markup, coalesce(l.units_per_listing, 1) as units from supplier_products p
         left join product_settings ps on ps.supplier = p.supplier and ps.ref = p.ref
         left join supplier_listings l on l.supplier = p.supplier and l.supplier_ref = p.ref
         left join components c on c.id = l.component_id where p.ref = any($1::text[])`,
        [refs, def],
      )
    : [];
  return rows.map((r) => {
    const m = markups.find((x) => x.ref === r.ref);
    return { ref: r.ref as string, title: r.title as string, price: r.price_ngn !== null ? unitPrice(r.price_ngn, m?.units ?? 1, Number(m?.markup ?? def)) : null, inStock: r.in_stock !== false, hidden: !!r.hidden };
  });
}

export async function uploadMediaAction(form: FormData): Promise<{ url?: string; error?: string }> {
  await requireStaff();
  const f = form.get("file");
  if (!(f instanceof File) || f.size === 0) return { error: "Choose a file." };
  try {
    return { url: await saveMedia(f.name, f.type, Buffer.from(await f.arrayBuffer())) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
