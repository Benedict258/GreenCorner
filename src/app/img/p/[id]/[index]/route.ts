import { productImageSource } from "@/lib/store/catalog";

// Product photos are served from our own address, so pages never show where they come from.
// Sizes are fixed to a few widths so the CDN cache stays small.
const WIDTHS = [80, 120, 160, 360, 800, 1600];

export async function GET(req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const pid = Number(id);
  const idx = Number(index);
  if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(idx) || idx < 0 || idx > 20) return new Response("Not found", { status: 404 });
  const asked = Number(new URL(req.url).searchParams.get("w")) || 800;
  const width = WIDTHS.find((w) => w >= asked) ?? 1600;

  const src = await productImageSource(pid, idx);
  if (!src) return new Response("Not found", { status: 404 });
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (url.protocol !== "https:") return new Response("Not found", { status: 404 });
  if (/(^|\.)cdn\.shopify\.com$/i.test(url.hostname)) url.searchParams.set("width", String(width));

  const upstream = await fetch(url, { headers: { accept: "image/avif,image/webp,image/*" } }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) return new Response("Image unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  const type = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) return new Response("Not found", { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    },
  });
}
