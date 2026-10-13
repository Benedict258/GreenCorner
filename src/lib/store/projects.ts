import { query, queryOne } from "../db";
import { getProductsByRef, SUPPLIER, type StoreProduct } from "./catalog";

export interface ProjectStep {
  title: string;
  text: string;
  image?: string | null;
}

export interface ProjectDownload {
  label: string;
  url: string;
}

export interface ProjectSummary {
  id: number;
  slug: string;
  title: string;
  summary: string;
  level: string;
  ageGroup: string;
  topics: string[];
  buildTime: string;
  imageUrl: string | null;
  kitPrice: number;
  componentCount: number;
  unavailable: number; // kit items out of stock or no longer sold
}

export interface KitItem {
  ref: string;
  quantity: number;
  product: StoreProduct | null; // null when the product is hidden or no longer sold
  lineTotal: number;
}

export interface ProjectDetail extends ProjectSummary {
  description: string;
  learn: string[];
  videoUrl: string | null;
  steps: ProjectStep[];
  safety: string;
  downloads: ProjectDownload[];
  published: boolean;
  items: KitItem[];
}

export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export const AGE_GROUPS = ["Primary", "Secondary", "University", "Adult"] as const;
export const TOPICS = ["Solar", "Wind", "Sensors", "Robotics", "Lighting", "Recycling", "IoT"] as const;

/** Prices every kit item at today's price. A kit's price is the sum of its components, nothing added. */
export async function priceKits(projectIds: number[]): Promise<Map<number, KitItem[]>> {
  const out = new Map<number, KitItem[]>();
  if (projectIds.length === 0) return out;
  const rows = await query(
    "select project_id, ref, quantity from project_items where project_id = any($1::int[]) and supplier = $2 order by project_id, position, ref",
    [projectIds, SUPPLIER],
  );
  const products = await getProductsByRef([...new Set(rows.map((r) => r.ref as string))]);
  for (const id of projectIds) out.set(id, []);
  for (const r of rows) {
    const product = products.get(r.ref) ?? null;
    out.get(r.project_id)!.push({ ref: r.ref, quantity: r.quantity, product, lineTotal: product ? product.price * r.quantity : 0 });
  }
  return out;
}

export function kitTotals(items: KitItem[]): { kitPrice: number; componentCount: number; unavailable: number } {
  return {
    kitPrice: items.reduce((n, i) => n + i.lineTotal, 0),
    componentCount: items.length,
    unavailable: items.filter((i) => !i.product || i.product.availability === "out").length,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summary(r: any, items: KitItem[]): ProjectSummary {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    level: r.level,
    ageGroup: r.age_group,
    topics: r.topics ?? [],
    buildTime: r.build_time,
    imageUrl: r.image_url,
    ...kitTotals(items),
  };
}

export interface ProjectFilter {
  level?: string;
  age?: string;
  topic?: string;
}

export async function listProjects(f: ProjectFilter = {}, opts: { includeDrafts?: boolean; limit?: number } = {}): Promise<ProjectSummary[]> {
  const where = opts.includeDrafts ? ["true"] : ["published"];
  const params: unknown[] = [];
  if (f.level) { params.push(f.level); where.push(`level = $${params.length}`); }
  if (f.age) { params.push(`%${f.age}%`); where.push(`age_group ilike $${params.length}`); }
  if (f.topic) { params.push(f.topic); where.push(`$${params.length} = any(topics)`); }
  const rows = await query(
    `select * from projects where ${where.join(" and ")} order by position, id ${opts.limit ? `limit ${Math.floor(opts.limit)}` : ""}`,
    params,
  );
  const kits = await priceKits(rows.map((r) => r.id));
  return rows.map((r) => summary(r, kits.get(r.id) ?? []));
}

export async function getProjectBySlug(slug: string, opts: { includeDrafts?: boolean } = {}): Promise<ProjectDetail | null> {
  const r = await queryOne(`select * from projects where slug = $1 ${opts.includeDrafts ? "" : "and published"}`, [slug]);
  return r ? detail(r) : null;
}

export async function getProject(id: number): Promise<ProjectDetail | null> {
  const r = await queryOne("select * from projects where id = $1", [id]);
  return r ? detail(r) : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function detail(r: any): Promise<ProjectDetail> {
  const items = (await priceKits([r.id])).get(r.id) ?? [];
  return {
    ...summary(r, items),
    description: r.description,
    learn: Array.isArray(r.learn) ? r.learn : [],
    videoUrl: r.video_url,
    steps: Array.isArray(r.steps) ? r.steps : [],
    safety: r.safety,
    downloads: Array.isArray(r.downloads) ? r.downloads : [],
    published: r.published,
    items,
  };
}

/** Published projects that use a product, for "Used in these projects". */
export async function projectsUsing(ref: string, limit = 3): Promise<ProjectSummary[]> {
  const rows = await query(
    `select p.* from projects p join project_items i on i.project_id = p.id
     where p.published and i.supplier = $1 and i.ref = $2 order by p.position limit $3`,
    [SUPPLIER, ref, limit],
  );
  const kits = await priceKits(rows.map((r) => r.id));
  return rows.map((r) => summary(r, kits.get(r.id) ?? []));
}

export function projectPath(p: { slug: string }): string {
  return `/projects/${p.slug}`;
}
