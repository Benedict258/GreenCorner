import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { query, queryOne, tx } from "../db";
import { loadCart } from "./cart";
import { getProductsByRef, SUPPLIER } from "./catalog";

export type OrderStatus =
  | "pending_payment" | "paid" | "confirmed" | "sourcing" | "ready"
  | "out_for_delivery" | "ready_for_pickup" | "completed" | "cancelled" | "refunded";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  confirmed: "Confirmed",
  sourcing: "Sourcing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  ready_for_pickup: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Chip colour per status in the designs. */
export const STATUS_TONE: Record<OrderStatus, "neutral" | "warn" | "info" | "ok" | "bad"> = {
  pending_payment: "warn",
  paid: "info",
  confirmed: "info",
  sourcing: "warn",
  ready: "info",
  out_for_delivery: "info",
  ready_for_pickup: "info",
  completed: "ok",
  cancelled: "bad",
  refunded: "bad",
};

/** The steps a customer sees, in order. The last two differ for delivery and pickup. */
export function timelineSteps(fulfilment: "delivery" | "pickup"): OrderStatus[] {
  return ["paid", "confirmed", "sourcing", "ready", fulfilment === "delivery" ? "out_for_delivery" : "ready_for_pickup", "completed"];
}

/** The status the admin moves an order to next with one click. */
export function nextStatus(status: OrderStatus, fulfilment: "delivery" | "pickup"): OrderStatus | null {
  if (status === "pending_payment") return null; // only a confirmed payment moves it on
  const steps = timelineSteps(fulfilment);
  const i = steps.indexOf(status);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

export interface Address {
  street: string;
  area: string;
  landmark: string;
  city: string;
  state: string;
}

export interface CheckoutInput {
  cartId: string;
  userId: number | null;
  name: string;
  email: string;
  phone: string;
  fulfilment: "delivery" | "pickup";
  address: Address | null;
  notes: string;
  paymentMethod: "paystack" | "bank_transfer";
}

export interface OrderLine {
  id: number;
  kitProjectId: number | null;
  kitLabel: string | null;
  kitQuantity: number | null;
  supplier: string | null;
  ref: string | null;
  title: string;
  quantity: number;
  supplierPrice: number | null;
  unitsPerListing: number;
  markupPct: number | null;
  unitPrice: number;
  lineTotal: number;
  source: "stock" | "supplier" | null;
  status: "ok" | "unavailable" | "refunded";
  refunded: number;
}

export interface OrderEvent {
  at: string;
  actor: string;
  status: OrderStatus | null;
  note: string;
}

export interface Order {
  id: number;
  number: string;
  userId: number | null;
  email: string;
  name: string;
  phone: string;
  fulfilment: "delivery" | "pickup";
  address: Address | null;
  notes: string;
  paymentMethod: "paystack" | "bank_transfer";
  status: OrderStatus;
  subtotal: number;
  delivery: number;
  total: number;
  refunded: number;
  paystackReference: string | null;
  quoteId: number | null;
  accessToken: string;
  adminNotes: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
  events: OrderEvent[];
}

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
export const newToken = () => randomBytes(24).toString("base64url");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOrder(r: any, lines: any[] = [], events: any[] = []): Order {
  return {
    id: r.id,
    number: r.number,
    userId: r.user_id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    fulfilment: r.fulfilment,
    address: r.address,
    notes: r.notes,
    paymentMethod: r.payment_method,
    status: r.status,
    subtotal: r.subtotal_ngn,
    delivery: r.delivery_ngn,
    total: r.total_ngn,
    refunded: r.refunded_ngn,
    paystackReference: r.paystack_reference,
    quoteId: r.quote_id,
    accessToken: r.access_token,
    adminNotes: r.admin_notes,
    paidAt: iso(r.paid_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    lines: lines.map((l) => ({
      id: l.id,
      kitProjectId: l.kit_project_id,
      kitLabel: l.kit_label,
      kitQuantity: l.kit_quantity,
      supplier: l.supplier,
      ref: l.ref,
      title: l.title,
      quantity: l.quantity,
      supplierPrice: l.supplier_price_ngn,
      unitsPerListing: l.units_per_listing,
      markupPct: l.markup_pct,
      unitPrice: l.unit_price_ngn,
      lineTotal: l.line_total_ngn,
      source: l.source,
      status: l.status,
      refunded: l.refunded_ngn,
    })),
    events: events.map((e) => ({ at: iso(e.at)!, actor: e.actor, status: e.status, note: e.note })),
  };
}

async function nextNumber(c: PoolClient): Promise<string> {
  return `W2L-ORD-${(await c.query("select nextval('order_number_seq') as n")).rows[0].n}`;
}

export async function addEvent(c: PoolClient | null, orderId: number, actor: string, status: OrderStatus | null, note: string): Promise<void> {
  const sql = "insert into order_events (order_id, actor, status, note) values ($1, $2, $3, $4)";
  const params = [orderId, actor, status, note.slice(0, 2000)];
  if (c) await c.query(sql, params);
  else await query(sql, params);
}

/**
 * Turns the cart into an order at today's prices (the prices are locked from here on). The cart is kept
 * until the payment is confirmed, so a failed payment loses nothing.
 */
export async function placeOrder(input: CheckoutInput): Promise<Order> {
  const cart = await loadCart(input.cartId);
  if (cart.lines.length === 0) throw new Error("Your cart is empty.");
  const bad = cart.lines.find((l) => l.missing || l.availability === "out");
  if (bad) throw new Error(`${bad.title} is no longer available. Remove it from your cart to continue.`);

  // Rows to store: products as they are; kits as their components, grouped under the kit's name.
  type Row = Omit<OrderLine, "id" | "source" | "status" | "refunded">;
  const rows: Row[] = [];
  const productRefs = cart.lines.filter((l) => l.kind === "product").map((l) => l.ref!);
  const kitRefs = cart.lines.flatMap((l) => l.kitItems?.map((i) => i.ref) ?? []);
  const priced = await getProductsByRef([...new Set([...productRefs, ...kitRefs])]);
  for (const l of cart.lines) {
    if (l.kind === "product") {
      const p = priced.get(l.ref!)!;
      rows.push({ kitProjectId: null, kitLabel: null, kitQuantity: null, supplier: SUPPLIER, ref: l.ref, title: p.title, quantity: l.quantity, supplierPrice: p.supplierPrice, unitsPerListing: p.units, markupPct: p.markupPct, unitPrice: p.price, lineTotal: p.price * l.quantity });
    } else {
      for (const item of l.kitItems ?? []) {
        const p = priced.get(item.ref);
        if (!p) throw new Error(`Part of the ${l.title} is no longer available.`);
        const qty = item.quantity * l.quantity;
        rows.push({ kitProjectId: l.projectId, kitLabel: l.title, kitQuantity: l.quantity, supplier: SUPPLIER, ref: item.ref, title: p.title, quantity: qty, supplierPrice: p.supplierPrice, unitsPerListing: p.units, markupPct: p.markupPct, unitPrice: p.price, lineTotal: p.price * qty });
      }
    }
  }
  const subtotal = rows.reduce((n, r) => n + r.lineTotal, 0);
  if (subtotal <= 0) throw new Error("This order has no total. Contact us to complete it.");

  const id = await tx(async (c) => {
    const number = await nextNumber(c);
    const o = (await c.query(
      `insert into orders (number, user_id, email, name, phone, fulfilment, address, notes, payment_method, subtotal_ngn, delivery_ngn, total_ngn, cart_id, access_token)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $10, $11, $12) returning id`,
      [number, input.userId, input.email, input.name, input.phone, input.fulfilment, input.address ? JSON.stringify(input.address) : null, input.notes, input.paymentMethod, subtotal, input.cartId, newToken()],
    )).rows[0];
    await insertLines(c, o.id, rows);
    await addEvent(c, o.id, "customer", "pending_payment", input.paymentMethod === "bank_transfer" ? "Order placed; paying by bank transfer." : "Order placed; sent to Paystack to pay.");
    return o.id as number;
  });
  return (await getOrder(id))!;
}

async function insertLines(c: PoolClient, orderId: number, rows: Omit<OrderLine, "id" | "source" | "status" | "refunded">[]) {
  let pos = 0;
  for (const r of rows) {
    await c.query(
      `insert into order_lines (order_id, position, kit_project_id, kit_label, kit_quantity, supplier, ref, title, quantity, supplier_price_ngn, units_per_listing, markup_pct, unit_price_ngn, line_total_ngn)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [orderId, pos++, r.kitProjectId, r.kitLabel, r.kitQuantity, r.supplier, r.ref, r.title, r.quantity, r.supplierPrice, r.unitsPerListing, r.markupPct, r.unitPrice, r.lineTotal],
    );
  }
}

/** An accepted quotation becomes an order with the quotation's own lines and prices. */
export async function orderFromQuote(quoteId: number, contact: { name: string; email: string; phone: string; userId: number | null; fulfilment: "delivery" | "pickup"; address: Address | null }, paymentMethod: "paystack" | "bank_transfer"): Promise<Order> {
  const existing = await queryOne("select id from orders where quote_id = $1 and status <> 'cancelled' order by id desc limit 1", [quoteId]);
  if (existing) return (await getOrder(existing.id))!;
  const q = await queryOne("select * from quotes where id = $1", [quoteId]);
  if (!q) throw new Error("That quotation no longer exists.");
  const lines = await query(
    `select ql.*, l.supplier_ref from quote_lines ql
     left join supplier_listings l on l.component_id = ql.component_id and l.supplier = ql.supplier_used
     where ql.quote_id = $1 order by ql.position, ql.id`,
    [quoteId],
  );
  const rows = lines.map((l) => ({
    kitProjectId: null, kitLabel: null, kitQuantity: null,
    supplier: l.supplier_used ?? null, ref: l.supplier_ref ?? null,
    title: l.description || l.name, quantity: l.quantity,
    supplierPrice: l.supplier_price_ngn, unitsPerListing: 1, markupPct: l.markup_pct,
    unitPrice: l.unit_price_ngn, lineTotal: l.line_total_ngn,
  }));
  const subtotal = rows.reduce((n, r) => n + r.lineTotal, 0);
  const id = await tx(async (c) => {
    const number = await nextNumber(c);
    const o = (await c.query(
      `insert into orders (number, user_id, email, name, phone, fulfilment, address, payment_method, subtotal_ngn, delivery_ngn, total_ngn, quote_id, access_token)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $9, $10, $11) returning id`,
      [number, contact.userId, contact.email, contact.name, contact.phone, contact.fulfilment, contact.address ? JSON.stringify(contact.address) : null, paymentMethod, subtotal, quoteId, newToken()],
    )).rows[0];
    await insertLines(c, o.id, rows);
    await c.query("update quotes set accepted_at = coalesce(accepted_at, now()) where id = $1", [quoteId]);
    await c.query("update quote_requests set status = 'accepted', updated_at = now() where quote_id = $1 and status <> 'closed'", [quoteId]);
    await addEvent(c, o.id, "customer", "pending_payment", `Quotation ${q.quote_number} accepted.`);
    return o.id as number;
  });
  return (await getOrder(id))!;
}

export async function getOrder(id: number): Promise<Order | null> {
  const r = await queryOne("select * from orders where id = $1", [id]);
  if (!r) return null;
  const [lines, events] = await Promise.all([
    query("select * from order_lines where order_id = $1 order by position, id", [id]),
    query("select * from order_events where order_id = $1 order by at, id", [id]),
  ]);
  return toOrder(r, lines, events);
}

export async function getOrderByNumber(number: string): Promise<Order | null> {
  const r = await queryOne("select id from orders where upper(number) = upper($1)", [number.trim()]);
  return r ? getOrder(r.id) : null;
}

/** For the customer's order link and Track order: the order number with its token, or with its email. */
export async function findOrderForCustomer(number: string, proof: { token?: string; email?: string }): Promise<Order | null> {
  const o = await getOrderByNumber(number);
  if (!o) return null;
  if (proof.token && proof.token === o.accessToken) return o;
  if (proof.email && proof.email.trim().toLowerCase() === o.email.toLowerCase()) return o;
  return null;
}

export async function listOrdersForUser(userId: number): Promise<Order[]> {
  const rows = await query("select * from orders where user_id = $1 order by created_at desc limit 100", [userId]);
  const lines = rows.length ? await query("select * from order_lines where order_id = any($1::int[]) order by position", [rows.map((r) => r.id)]) : [];
  return rows.map((r) => toOrder(r, lines.filter((l) => l.order_id === r.id)));
}

// Payments ------------------------------------------------------------------------------------------

/** Each payment attempt gets its own reference, so a retried payment never clashes with a failed one. */
export async function startPayment(orderId: number, provider: "paystack" | "bank_transfer"): Promise<string> {
  const o = await queryOne("select number, total_ngn, status from orders where id = $1", [orderId]);
  if (!o) throw new Error("Order not found.");
  if (o.status !== "pending_payment") throw new Error("This order is already paid or closed.");
  const reference = `${o.number}-${randomBytes(3).toString("hex")}`;
  await query("insert into payments (order_id, provider, reference, amount_ngn) values ($1, $2, $3, $4)", [orderId, provider, reference, o.total_ngn]);
  await query("update orders set paystack_reference = $2, payment_method = $3, updated_at = now() where id = $1", [orderId, provider === "paystack" ? reference : null, provider]);
  return reference;
}

export type PaymentOutcome = { kind: "paid"; order: Order; firstTime: boolean } | { kind: "failed"; order: Order | null; reason: string } | { kind: "pending"; order: Order | null };

/**
 * Applies a verified Paystack result. Safe to call any number of times (callback page and webhook both do):
 * the order is marked paid once, and only when the amount and currency match what we asked for.
 */
export async function applyPaystackResult(v: { reference: string; status: string; amountKobo: number; currency: string; channel: string | null; paidAt: string | null; raw: unknown }): Promise<PaymentOutcome> {
  const result = await tx(async (c): Promise<{ kind: "paid" | "failed" | "pending"; orderId: number | null; firstTime?: boolean; reason?: string }> => {
    const pay = (await c.query("select * from payments where reference = $1 for update", [v.reference])).rows[0];
    if (!pay) return { kind: "failed", orderId: null, reason: "Unknown payment reference." };
    const order = (await c.query("select * from orders where id = $1 for update", [pay.order_id])).rows[0];
    if (v.status !== "success") {
      if (pay.status === "pending") await c.query("update payments set status = $2, raw = $3, updated_at = now() where id = $1", [pay.id, v.status === "abandoned" ? "abandoned" : v.status === "failed" ? "failed" : "pending", JSON.stringify(v.raw)]);
      return v.status === "failed" || v.status === "abandoned" ? { kind: "failed", orderId: order.id, reason: "The payment did not go through." } : { kind: "pending", orderId: order.id };
    }
    const expectedKobo = Math.round(Number(pay.amount_ngn) * 100);
    if (v.currency !== "NGN" || v.amountKobo !== expectedKobo) {
      await c.query("update payments set status = 'failed', raw = $2, updated_at = now() where id = $1", [pay.id, JSON.stringify(v.raw)]);
      await addEvent(c, order.id, "paystack", null, `Payment ${v.reference} rejected: received ${v.currency} ${(v.amountKobo / 100).toFixed(2)}, expected NGN ${(expectedKobo / 100).toFixed(2)}.`);
      return { kind: "failed", orderId: order.id, reason: "The amount paid does not match the order. We will contact you." };
    }
    if (pay.status === "success") return { kind: "paid", orderId: order.id, firstTime: false };
    await c.query("update payments set status = 'success', channel = $2, paid_at = coalesce($3::timestamptz, now()), raw = $4, updated_at = now() where id = $1", [pay.id, v.channel, v.paidAt, JSON.stringify(v.raw)]);
    if (order.status !== "pending_payment") {
      // Paid twice (e.g. two tabs): keep the order as it is and flag it for a refund.
      await addEvent(c, order.id, "paystack", null, `A second payment ${v.reference} arrived for an order already paid. Refund it from Paystack.`);
      return { kind: "paid", orderId: order.id, firstTime: false };
    }
    await markPaid(c, order, v.reference, "paystack", `Paid on Paystack${v.channel ? ` (${v.channel})` : ""}.`);
    return { kind: "paid", orderId: order.id, firstTime: true };
  });
  const order = result.orderId ? await getOrder(result.orderId) : null;
  if (result.kind === "paid") return { kind: "paid", order: order!, firstTime: !!result.firstTime };
  if (result.kind === "pending") return { kind: "pending", order };
  return { kind: "failed", order, reason: result.reason ?? "The payment did not go through." };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markPaid(c: PoolClient, order: any, reference: string, actor: string, note: string) {
  await c.query("update orders set status = 'paid', paid_at = now(), updated_at = now() where id = $1", [order.id]);
  await addEvent(c, order.id, actor, "paid", note);
  // Lines we hold in stock are taken from it now; the rest are bought from the supplier.
  const lines = (await c.query("select id, supplier, ref, quantity from order_lines where order_id = $1 and ref is not null order by position", [order.id])).rows;
  for (const l of lines) {
    const taken = (await c.query(
      "update stock set quantity = quantity - $3, updated_at = now() where supplier = $1 and ref = $2 and quantity >= $3 returning quantity",
      [l.supplier, l.ref, l.quantity],
    )).rows[0];
    await c.query("update order_lines set source = $2 where id = $1", [l.id, taken ? "stock" : "supplier"]);
  }
  if (order.cart_id) await c.query("delete from cart_lines where cart_id = $1", [order.cart_id]);
  void reference;
}

/** Bank transfer confirmed by the team. */
export async function markPaidManually(orderId: number, actor: string, note: string): Promise<Order> {
  await tx(async (c) => {
    const order = (await c.query("select * from orders where id = $1 for update", [orderId])).rows[0];
    if (!order) throw new Error("Order not found.");
    if (order.status !== "pending_payment") throw new Error("This order is not waiting for payment.");
    const reference = `${order.number}-bank`;
    await c.query(
      `insert into payments (order_id, provider, reference, amount_ngn, status, paid_at) values ($1, 'bank_transfer', $2, $3, 'success', now())
       on conflict (reference) do update set status = 'success', paid_at = now()`,
      [orderId, reference, order.total_ngn],
    );
    await markPaid(c, order, reference, actor, note || "Bank transfer confirmed.");
  });
  return (await getOrder(orderId))!;
}

// Admin changes -------------------------------------------------------------------------------------

export async function setOrderStatus(orderId: number, status: OrderStatus, actor: string, note = ""): Promise<Order> {
  const o = await getOrder(orderId);
  if (!o) throw new Error("Order not found.");
  if (o.status === status) return o;
  if (status === "paid" || status === "pending_payment") throw new Error("Payment status changes only when a payment is confirmed.");
  if (o.status === "pending_payment" && status !== "cancelled") throw new Error("This order is not paid yet.");
  if (["cancelled", "refunded", "completed"].includes(o.status) && status !== "refunded") throw new Error(`This order is ${STATUS_LABEL[o.status].toLowerCase()}.`);
  await tx(async (c) => {
    await c.query("update orders set status = $2, updated_at = now() where id = $1", [orderId, status]);
    await addEvent(c, orderId, actor, status, note);
  });
  return (await getOrder(orderId))!;
}

export async function setAdminNotes(orderId: number, notes: string): Promise<void> {
  await query("update orders set admin_notes = $2, updated_at = now() where id = $1", [orderId, notes.slice(0, 5000)]);
}

export async function setLineSource(lineId: number, source: "stock" | "supplier"): Promise<void> {
  await query("update order_lines set source = $2 where id = $1", [lineId, source]);
}

/** Records a refund. Paystack refunds go through the API; bank-transfer refunds are marked done by hand. */
export async function recordRefund(orderId: number, lineId: number | null, amount: number, reason: string, actor: string, provider: { ref: string | null; status: "processed" | "pending" | "failed" | "manual"; error?: string }): Promise<Order> {
  await tx(async (c) => {
    await c.query(
      "insert into refunds (order_id, order_line_id, amount_ngn, reason, provider_ref, status, error, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [orderId, lineId, amount, reason, provider.ref, provider.status, provider.error ?? null, actor],
    );
    if (provider.status === "failed") return;
    if (lineId) await c.query("update order_lines set status = 'refunded', refunded_ngn = refunded_ngn + $2 where id = $1", [lineId, amount]);
    const o = (await c.query("update orders set refunded_ngn = refunded_ngn + $2, updated_at = now() where id = $1 returning total_ngn, refunded_ngn", [orderId, amount])).rows[0];
    const full = Number(o.refunded_ngn) >= Number(o.total_ngn);
    if (full) await c.query("update orders set status = 'refunded' where id = $1", [orderId]);
    await addEvent(c, orderId, actor, full ? "refunded" : null, `Refunded ₦${amount.toLocaleString("en-NG")}${reason ? `: ${reason}` : ""}.`);
  });
  return (await getOrder(orderId))!;
}

export async function markLineUnavailable(lineId: number, actor: string): Promise<{ orderId: number; amount: number }> {
  const l = await queryOne("update order_lines set status = 'unavailable' where id = $1 and status = 'ok' returning order_id, line_total_ngn, title", [lineId]);
  if (!l) throw new Error("That line was already marked.");
  await addEvent(null, l.order_id, actor, null, `${l.title} is unavailable.`);
  return { orderId: l.order_id, amount: Number(l.line_total_ngn) };
}

export interface OrderListFilter {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
}

export interface OrderRow {
  id: number;
  number: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  items: number;
  total: number;
  paymentMethod: string;
  paid: boolean;
  status: OrderStatus;
  fulfilment: "delivery" | "pickup";
}

export async function listOrders(f: OrderListFilter, pageSize = 25): Promise<{ rows: OrderRow[]; total: number; page: number; pages: number; counts: Record<string, number> }> {
  const where: string[] = ["true"];
  const params: unknown[] = [];
  if (f.status && f.status !== "all") {
    if (f.status === "open") where.push("o.status in ('paid', 'confirmed', 'sourcing', 'ready', 'out_for_delivery', 'ready_for_pickup')");
    else { params.push(f.status); where.push(`o.status = $${params.length}`); }
  }
  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    where.push(`(o.number ilike $${params.length} or o.name ilike $${params.length} or o.email ilike $${params.length} or o.phone ilike $${params.length})`);
  }
  if (f.from) { params.push(f.from); where.push(`o.created_at >= ($${params.length}::date at time zone 'Africa/Lagos')`); }
  if (f.to) { params.push(f.to); where.push(`o.created_at < (($${params.length}::date + 1) at time zone 'Africa/Lagos')`); }
  const w = where.join(" and ");
  const total = (await queryOne(`select count(*)::int as n from orders o where ${w}`, params))?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  const rows = await query(
    `select o.*, (select coalesce(sum(quantity), 0)::int from order_lines l where l.order_id = o.id) as items
     from orders o where ${w} order by o.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`,
    params,
  );
  const countRows = await query("select status, count(*)::int as n from orders group by status");
  const counts: Record<string, number> = {};
  for (const r of countRows) counts[r.status] = r.n;
  return {
    rows: rows.map((r) => ({ id: r.id, number: r.number, createdAt: iso(r.created_at)!, name: r.name, phone: r.phone, email: r.email, items: r.items, total: r.total_ngn, paymentMethod: r.payment_method, paid: !!r.paid_at, status: r.status, fulfilment: r.fulfilment })),
    total, page, pages, counts,
  };
}
