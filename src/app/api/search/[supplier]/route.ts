import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ADAPTERS } from "@/lib/sync/adapters";
import { isActiveSupplier } from "@/lib/suppliers";

export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ supplier: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { supplier } = await params;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [] });
  try {
    const adapter = isActiveSupplier(supplier) ? ADAPTERS[supplier] : undefined;
    if (!adapter) return NextResponse.json({ error: "Unknown supplier" }, { status: 404 });
    const hits = await adapter.search(q);
    return NextResponse.json({ hits });
  } catch (e) {
    return NextResponse.json({ error: `Search failed: ${(e as Error).message}. You can paste a product URL instead.` }, { status: 502 });
  }
}
