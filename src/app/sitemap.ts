import type { MetadataRoute } from "next";
import { listProjects } from "@/lib/store/projects";

// The main pages and every project. Product pages are not listed: search engines find them through the
// shop, and a full list of products would hand the whole catalog to anyone who asks.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const pages = ["", "/shop", "/projects", "/about", "/contact", "/quote-request", "/delivery", "/refunds", "/terms", "/privacy"];
  const projects = await listProjects().catch(() => []);
  return [
    ...pages.map((p) => ({ url: `${site}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...projects.map((p) => ({ url: `${site}/projects/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
