import { query, queryOne } from "../db";

/** Badges in the admin menu: paid orders not yet confirmed, and new quote requests. */
export async function navCounts(): Promise<{ orders: number; requests: number }> {
  const r = await queryOne(
    `select (select count(*)::int from orders where status = 'paid') as orders,
            (select count(*)::int from quote_requests where status = 'new') as requests`,
  );
  return { orders: r?.orders ?? 0, requests: r?.requests ?? 0 };
}

export interface DashboardStats {
  salesToday: number;
  paidToday: number;
  salesMonth: number;
  ordersToConfirm: number;
  openRequests: number;
  itemsToSource: number;
  ordersToSource: number;
  lowStock: number;
  lastSync: { at: string; status: string } | null;
  heldChanges: number;
  awaitingTransfer: number;
}

// "Today" and "this month" are Lagos days.
const LAGOS_TODAY = "(now() at time zone 'Africa/Lagos')::date";

export async function dashboardStats(): Promise<DashboardStats> {
  const r = await queryOne(
    `select
       (select coalesce(sum(total_ngn - refunded_ngn), 0) from orders where paid_at is not null and (paid_at at time zone 'Africa/Lagos')::date = ${LAGOS_TODAY}) as sales_today,
       (select count(*)::int from orders where paid_at is not null and (paid_at at time zone 'Africa/Lagos')::date = ${LAGOS_TODAY}) as paid_today,
       (select coalesce(sum(total_ngn - refunded_ngn), 0) from orders where paid_at is not null and date_trunc('month', paid_at at time zone 'Africa/Lagos') = date_trunc('month', now() at time zone 'Africa/Lagos')) as sales_month,
       (select count(*)::int from orders where status = 'paid') as to_confirm,
       (select count(*)::int from quote_requests where status in ('new', 'contacted')) as open_requests,
       (select coalesce(sum(l.quantity), 0)::int from order_lines l join orders o on o.id = l.order_id
          where o.status in ('paid', 'confirmed', 'sourcing') and l.source = 'supplier' and l.status = 'ok') as to_source,
       (select count(distinct o.id)::int from order_lines l join orders o on o.id = l.order_id
          where o.status in ('paid', 'confirmed', 'sourcing') and l.source = 'supplier' and l.status = 'ok') as orders_to_source,
       (select count(*)::int from stock where quantity between 1 and 3) as low_stock,
       (select count(*)::int from held_changes where decision = 'pending') as held,
       (select count(*)::int from orders where status = 'pending_payment' and payment_method = 'bank_transfer' and created_at > now() - interval '14 days') as awaiting_transfer`,
  );
  const sync = await queryOne("select finished_at, started_at, status from sync_runs where component_id is null order by started_at desc limit 1");
  return {
    salesToday: Number(r?.sales_today ?? 0),
    paidToday: r?.paid_today ?? 0,
    salesMonth: Number(r?.sales_month ?? 0),
    ordersToConfirm: r?.to_confirm ?? 0,
    openRequests: r?.open_requests ?? 0,
    itemsToSource: r?.to_source ?? 0,
    ordersToSource: r?.orders_to_source ?? 0,
    lowStock: r?.low_stock ?? 0,
    lastSync: sync ? { at: new Date(sync.finished_at ?? sync.started_at).toISOString(), status: sync.status } : null,
    heldChanges: r?.held ?? 0,
    awaitingTransfer: r?.awaiting_transfer ?? 0,
  };
}

export interface AttentionItem {
  kind: "request" | "order" | "unavailable" | "held" | "transfer";
  title: string;
  sub: string;
  href: string;
  since: string;
  tone: "bad" | "warn" | "";
}

/** Things someone should act on, oldest first. */
export async function needsAttention(limit = 8): Promise<AttentionItem[]> {
  const [requests, toConfirm, unavailable, transfers, held] = await Promise.all([
    query("select id, number, organisation, created_at, status from quote_requests where status = 'new' order by created_at limit 10"),
    query("select id, number, name, total_ngn, paid_at from orders where status = 'paid' order by paid_at limit 10"),
    query(`select distinct on (o.id) o.id, o.number, o.name, l.title, o.updated_at from orders o join order_lines l on l.order_id = o.id
           where l.status = 'unavailable' and o.status not in ('cancelled', 'refunded') order by o.id, l.id limit 10`),
    query("select id, number, name, total_ngn, created_at from orders where status = 'pending_payment' and payment_method = 'bank_transfer' and created_at > now() - interval '14 days' order by created_at limit 10"),
    queryOne("select count(*)::int as n, min(detected_at) as since from held_changes where decision = 'pending'"),
  ]);
  const n = (v: unknown) => `₦${Math.round(Number(v)).toLocaleString("en-NG")}`;
  const items: AttentionItem[] = [
    ...requests.map((r) => ({ kind: "request" as const, title: `Quote request ${r.number}`, sub: `${r.organisation} · not contacted yet`, href: `/admin/quote-requests/${r.id}`, since: new Date(r.created_at).toISOString(), tone: "bad" as const })),
    ...toConfirm.map((o) => ({ kind: "order" as const, title: `Order ${o.number}`, sub: `${o.name} · paid ${n(o.total_ngn)}, waiting to be confirmed`, href: `/admin/orders/${o.id}`, since: new Date(o.paid_at).toISOString(), tone: "warn" as const })),
    ...unavailable.map((o) => ({ kind: "unavailable" as const, title: `Order ${o.number}`, sub: `${o.name} · ${o.title} unavailable, refund the item`, href: `/admin/orders/${o.id}`, since: new Date(o.updated_at).toISOString(), tone: "bad" as const })),
    ...transfers.map((o) => ({ kind: "transfer" as const, title: `Order ${o.number}`, sub: `${o.name} · waiting for a bank transfer of ${n(o.total_ngn)}`, href: `/admin/orders/${o.id}`, since: new Date(o.created_at).toISOString(), tone: "" as const })),
    ...(held?.n ? [{ kind: "held" as const, title: "Held price changes", sub: `${held.n} change${held.n === 1 ? "" : "s"} above the safe limit need approval`, href: "/admin/sync", since: new Date(held.since).toISOString(), tone: "warn" as const }] : []),
  ];
  return items.sort((a, b) => a.since.localeCompare(b.since)).slice(0, limit);
}

/** Paid sales per Lagos day for the last `days` days, oldest first (days with no sales are 0). */
export async function dailySales(days = 30): Promise<{ day: string; total: number }[]> {
  const rows = await query(
    `select d::date as day, coalesce(sum(o.total_ngn - o.refunded_ngn), 0) as total
     from generate_series(${LAGOS_TODAY} - ($1::int - 1), ${LAGOS_TODAY}, interval '1 day') d
     left join orders o on o.paid_at is not null and (o.paid_at at time zone 'Africa/Lagos')::date = d::date
     group by d order by d`,
    [days],
  );
  return rows.map((r) => ({ day: String(r.day).slice(0, 10), total: Number(r.total) }));
}

export interface SearchHit {
  type: "order" | "request" | "customer" | "product";
  title: string;
  sub: string;
  href: string;
}

export async function adminSearch(q: string): Promise<SearchHit[]> {
  const like = `%${q.trim()}%`;
  if (q.trim().length < 2) return [];
  const [orders, requests, customers, products] = await Promise.all([
    query("select id, number, name, phone, total_ngn, status from orders where number ilike $1 or name ilike $1 or email ilike $1 or phone ilike $1 order by created_at desc limit 10", [like]),
    query("select id, number, organisation, contact_name, status from quote_requests where number ilike $1 or organisation ilike $1 or contact_name ilike $1 or email ilike $1 or phone ilike $1 order by created_at desc limit 10", [like]),
    query("select id, name, email, phone from users where role = 'customer' and (name ilike $1 or email ilike $1 or phone ilike $1) order by created_at desc limit 10", [like]),
    query("select id, title, ref, category from supplier_products where title ilike $1 or ref ilike $1 order by position limit 10", [like]),
  ]);
  return [
    ...orders.map((o) => ({ type: "order" as const, title: `Order ${o.number}`, sub: `${o.name} · ${o.phone} · ${o.status}`, href: `/admin/orders/${o.id}` })),
    ...requests.map((r) => ({ type: "request" as const, title: `Quote request ${r.number}`, sub: `${r.organisation} · ${r.contact_name} · ${r.status}`, href: `/admin/quote-requests/${r.id}` })),
    ...customers.map((c) => ({ type: "customer" as const, title: c.name || c.email, sub: `${c.email} · ${c.phone}`, href: `/admin/customers/${c.id}` })),
    ...products.map((p) => ({ type: "product" as const, title: p.title, sub: `${p.category} · ${p.ref}`, href: `/admin/products/${p.id}` })),
  ];
}
