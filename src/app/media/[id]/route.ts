import { queryOne } from "@/lib/db";

// Project photos and PDFs uploaded in the admin area. Never change once uploaded, so they cache for a year.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const r = await queryOne("select mime, bytes, name from media where id = $1", [id]);
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(r.bytes), {
    headers: {
      "content-type": r.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      ...(r.mime === "application/pdf" ? { "content-disposition": `inline; filename="${String(r.name).replace(/[^\w.-]+/g, "_") || "file.pdf"}"` } : {}),
    },
  });
}
