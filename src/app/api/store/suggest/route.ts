import { suggest } from "@/lib/store/catalog";

/** Header search suggestions: at most 6 products (rate limited in the proxy). */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  const items = await suggest(q).catch(() => []);
  return Response.json({ items }, { headers: { "cache-control": "private, max-age=60" } });
}
