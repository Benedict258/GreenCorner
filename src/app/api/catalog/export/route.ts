import { requireAdmin } from "@/lib/auth";
import { loadComponents } from "@/lib/catalog";
import { priceComponent } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { ACTIVE_SUPPLIERS } from "@/lib/suppliers";

const esc = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return new Response("Not signed in", { status: 401 });
  }
  const [comps, settings] = await Promise.all([loadComponents(), getSettings()]);
  const now = new Date();
  const header = [
    "id", "name", "category", "unit_label", "markup_pct", "active",
    ...ACTIVE_SUPPLIERS.flatMap((s) => [`${s}_price`, `${s}_units`, `${s}_in_stock`, `${s}_synced_at`]),
    "supplier_used", "unit_price_ngn",
  ];
  const rows = comps.map((c) => {
    const p = priceComponent(c.listings, c.markupPct, 1, { now, staleAfterHours: settings.staleAfterHours });
    return [
      c.id, c.name, c.category, c.unitLabel, c.markupPct, c.active,
      ...ACTIVE_SUPPLIERS.flatMap((s) => {
        const l = c.listings.find((x) => x.supplier === s);
        return [l?.price, l?.unitsPerListing, l?.inStock, l?.lastSyncedAt];
      }),
      p.supplierUsed, p.supplierUsed ? p.unitPrice : "",
    ];
  });
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="catalog-${now.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
