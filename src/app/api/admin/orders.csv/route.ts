import { requireStaff } from "@/lib/auth";
import { query } from "@/lib/db";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything; neutralise formulas so a spreadsheet never runs a cell.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Orders as CSV for Excel or Google Sheets, with the same filters as the Orders page. */
export async function GET(req: Request) {
  try {
    await requireStaff();
  } catch {
    return new Response("Not signed in", { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const where: string[] = ["true"];
  const params: unknown[] = [];
  const statuses = (sp.get("status") ?? "").split(",").filter(Boolean);
  if (statuses.length) { params.push(statuses); where.push(`o.status = any($${params.length}::text[])`); }
  const q = sp.get("q");
  if (q) { params.push(`%${q}%`); where.push(`(o.number ilike $${params.length} or o.name ilike $${params.length} or o.phone ilike $${params.length} or o.email ilike $${params.length})`); }
  if (sp.get("from")) { params.push(sp.get("from")); where.push(`o.created_at >= ($${params.length}::date at time zone 'Africa/Lagos')`); }
  if (sp.get("to")) { params.push(sp.get("to")); where.push(`o.created_at < (($${params.length}::date + 1) at time zone 'Africa/Lagos')`); }
  const rows = await query(
    `select o.number, to_char(o.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI') as placed, o.name, o.phone, o.email, o.fulfilment,
       o.address->>'street' as street, o.address->>'area' as area, o.payment_method, o.status, o.subtotal_ngn, o.total_ngn, o.refunded_ngn,
       to_char(o.paid_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI') as paid,
       (select string_agg(l.quantity || ' x ' || l.title, '; ' order by l.position) from order_lines l where l.order_id = o.id) as items
     from orders o where ${where.join(" and ")} order by o.created_at desc limit 5000`,
    params,
  );
  const head = ["Order", "Placed", "Name", "Phone", "Email", "Delivery or pickup", "Street", "Area", "Payment method", "Status", "Subtotal", "Total", "Refunded", "Paid at", "Items"];
  const body = rows.map((r) => [r.number, r.placed, r.name, r.phone, r.email, r.fulfilment, r.street, r.area, r.payment_method, r.status, r.subtotal_ngn, r.total_ngn, r.refunded_ngn, r.paid, r.items].map(cell).join(","));
  return new Response(`﻿${[head.map(cell).join(","), ...body].join("\r\n")}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
