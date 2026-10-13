import { query, queryOne, tx } from "../db";
import { lagosToday } from "../quoteDocument";
import { saveQuote, type LineInput } from "../quotes";
import { ensureComponent } from "../shop";
import { getProductsByRef, SUPPLIER } from "./catalog";
import { loadCart } from "./cart";
import { getProject } from "./projects";
import { newToken } from "./orders";

export type RequestStatus = "new" | "contacted" | "quoted" | "accepted" | "closed";
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  accepted: "Accepted",
  closed: "Closed",
};

export interface RequestLineInput {
  ref: string | null; // a product
  projectId: number | null; // or a whole kit
  quantity: number;
  note: string;
}

export interface RequestLine {
  id: number;
  ref: string | null;
  projectId: number | null;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string;
}

export interface QuoteRequestInput {
  userId: number | null;
  organisation: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  students: number | null;
  neededBy: string | null;
  fulfilment: "delivery" | "pickup";
  message: string;
  lines: RequestLineInput[];
}

export interface QuoteRequest {
  id: number;
  number: string;
  userId: number | null;
  organisation: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  students: number | null;
  neededBy: string | null;
  fulfilment: "delivery" | "pickup";
  message: string;
  status: RequestStatus;
  estimatedTotal: number;
  quoteId: number | null;
  quoteNumber: string | null;
  quoteSentAt: string | null;
  accessToken: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
  lines: RequestLine[];
}

/** The lines a request starts from: the visitor's cart, or one project kit. */
export async function startingLines(opts: { cartId?: string | null; projectId?: number | null; kits?: number }): Promise<RequestLine[]> {
  if (opts.projectId) {
    const p = await getProject(opts.projectId);
    if (!p || !p.published) return [];
    const kits = Math.max(1, Math.floor(opts.kits ?? 1));
    return [{ id: 0, ref: null, projectId: p.id, title: `${p.title} kit`, quantity: kits, unitPrice: p.kitPrice, lineTotal: p.kitPrice * kits, note: "" }];
  }
  const cart = await loadCart(opts.cartId ?? null);
  return cart.lines
    .filter((l) => !l.missing)
    .map((l, i) => ({ id: -(i + 1), ref: l.ref, projectId: l.projectId, title: l.title, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, note: "" }));
}

/** Prices request lines at today's prices (the estimate shown to the customer and to the team). */
export async function priceLines(lines: RequestLineInput[]): Promise<Omit<RequestLine, "id">[]> {
  const products = await getProductsByRef(lines.filter((l) => l.ref).map((l) => l.ref!));
  const out: Omit<RequestLine, "id">[] = [];
  for (const l of lines) {
    const qty = Math.floor(Number(l.quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > 100000) throw new Error("Each quantity must be a whole number of at least 1.");
    if (l.ref) {
      const p = products.get(l.ref);
      if (!p) continue; // gone from the shop; dropped from the request
      out.push({ ref: l.ref, projectId: null, title: p.title, quantity: qty, unitPrice: p.price, lineTotal: p.price * qty, note: l.note.slice(0, 500) });
    } else if (l.projectId) {
      const p = await getProject(l.projectId);
      if (!p) continue;
      out.push({ ref: null, projectId: p.id, title: `${p.title} kit`, quantity: qty, unitPrice: p.kitPrice, lineTotal: p.kitPrice * qty, note: l.note.slice(0, 500) });
    }
  }
  return out;
}

export async function createQuoteRequest(input: QuoteRequestInput): Promise<QuoteRequest> {
  const lines = await priceLines(input.lines);
  if (lines.length === 0 && input.message.trim().length < 10) throw new Error("Add at least one item, or tell us what you need in the message.");
  const total = lines.reduce((n, l) => n + l.lineTotal, 0);
  const id = await tx(async (c) => {
    const r = (await c.query(
      `insert into quote_requests (user_id, organisation, contact_name, contact_role, phone, email, students, needed_by, fulfilment, message, estimated_total_ngn, access_token)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [input.userId, input.organisation, input.contactName, input.contactRole, input.phone, input.email, input.students, input.neededBy, input.fulfilment, input.message, total, newToken()],
    )).rows[0];
    await c.query("update quote_requests set number = 'W2L-REQ-' || lpad(id::text, 4, '0') where id = $1", [r.id]);
    let pos = 0;
    for (const l of lines) {
      await c.query(
        `insert into quote_request_lines (request_id, position, supplier, ref, project_id, title, quantity, unit_price_ngn, line_total_ngn, note)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [r.id, pos++, l.ref ? SUPPLIER : null, l.ref, l.projectId, l.title, l.quantity, l.unitPrice, l.lineTotal, l.note],
      );
    }
    return r.id as number;
  });
  return (await getQuoteRequest(id))!;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRequest(r: any, lines: any[]): QuoteRequest {
  return {
    id: r.id,
    number: r.number,
    userId: r.user_id,
    organisation: r.organisation,
    contactName: r.contact_name,
    contactRole: r.contact_role,
    phone: r.phone,
    email: r.email,
    students: r.students,
    neededBy: r.needed_by,
    fulfilment: r.fulfilment,
    message: r.message,
    status: r.status,
    estimatedTotal: r.estimated_total_ngn,
    quoteId: r.quote_id,
    quoteNumber: r.quote_number ?? null,
    quoteSentAt: r.sent_at ? new Date(r.sent_at).toISOString() : null,
    accessToken: r.access_token,
    adminNotes: r.admin_notes,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    lines: lines.map((l) => ({ id: l.id, ref: l.ref, projectId: l.project_id, title: l.title, quantity: l.quantity, unitPrice: l.unit_price_ngn, lineTotal: l.line_total_ngn, note: l.note })),
  };
}

const SELECT = "select r.*, q.quote_number, q.sent_at from quote_requests r left join quotes q on q.id = r.quote_id";

export async function getQuoteRequest(id: number): Promise<QuoteRequest | null> {
  const r = await queryOne(`${SELECT} where r.id = $1`, [id]);
  if (!r) return null;
  return toRequest(r, await query("select * from quote_request_lines where request_id = $1 order by position, id", [id]));
}

export async function findRequestForCustomer(number: string, token: string): Promise<QuoteRequest | null> {
  const r = await queryOne("select id, access_token from quote_requests where upper(number) = upper($1)", [number]);
  return r && r.access_token === token ? getQuoteRequest(r.id) : null;
}

export async function listQuoteRequests(f: { status?: string; q?: string } = {}, limit = 100): Promise<QuoteRequest[]> {
  const where = ["true"];
  const params: unknown[] = [];
  if (f.status && f.status !== "all") { params.push(f.status); where.push(`r.status = $${params.length}`); }
  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    where.push(`(r.number ilike $${params.length} or r.organisation ilike $${params.length} or r.contact_name ilike $${params.length} or r.email ilike $${params.length} or r.phone ilike $${params.length})`);
  }
  const rows = await query(`${SELECT} where ${where.join(" and ")} order by (r.status = 'new') desc, r.created_at desc limit ${limit}`, params);
  const lines = rows.length ? await query("select * from quote_request_lines where request_id = any($1::int[]) order by position", [rows.map((r) => r.id)]) : [];
  return rows.map((r) => toRequest(r, lines.filter((l) => l.request_id === r.id)));
}

export async function listRequestsForUser(userId: number): Promise<QuoteRequest[]> {
  const rows = await query(`${SELECT} where r.user_id = $1 order by r.created_at desc limit 50`, [userId]);
  const lines = rows.length ? await query("select * from quote_request_lines where request_id = any($1::int[]) order by position", [rows.map((r) => r.id)]) : [];
  return rows.map((r) => toRequest(r, lines.filter((l) => l.request_id === r.id)));
}

export async function setRequestStatus(id: number, status: RequestStatus): Promise<void> {
  await query("update quote_requests set status = $2, updated_at = now() where id = $1", [id, status]);
}

export async function setRequestNotes(id: number, notes: string): Promise<void> {
  await query("update quote_requests set admin_notes = $2, updated_at = now() where id = $1", [id, notes.slice(0, 5000)]);
}

/**
 * Makes the official quotation from a request in the quote builder's own format: each product becomes a
 * Catalog line (so prices, safeguards and snapshots work as usual), each kit one line with its contents.
 * If the request already has a quotation, that one is returned.
 */
export async function quotationFromRequest(id: number): Promise<number> {
  const req = await getQuoteRequest(id);
  if (!req) throw new Error("Request not found.");
  if (req.quoteId) {
    const exists = await queryOne("select id from quotes where id = $1", [req.quoteId]);
    if (exists) return req.quoteId;
  }
  const inputs: LineInput[] = [];
  for (const l of req.lines) {
    if (l.ref) {
      const { componentId } = await tx((c) => ensureComponent(c, l.ref!));
      inputs.push({ kind: "component", refId: componentId, quantity: l.quantity });
    } else if (l.projectId) {
      const p = await getProject(l.projectId);
      const contents = p?.items.map((i) => `${i.product?.title ?? i.ref}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ");
      inputs.push({ kind: "custom", refId: null, quantity: l.quantity, description: `${l.title}${contents ? `. Includes: ${contents}` : ""}`.slice(0, 2000), unitPrice: l.unitPrice });
    }
  }
  const valid = new Date(`${lagosToday()}T00:00:00Z`);
  valid.setUTCDate(valid.getUTCDate() + 14);
  const notes = [
    req.students ? `Prepared for ${req.students} students.` : "",
    req.fulfilment === "delivery" ? "Delivery in Minna, Niger State, at no extra cost." : "For pickup at Waste2Light, Bosso, Minna.",
    "This quotation is valid for 14 days from the date above.",
  ].filter(Boolean).join("\n");
  const quoteId = await saveQuote(null, { billTo: req.organisation, attn: req.contactName + (req.contactRole ? `, ${req.contactRole}` : ""), notes, validUntil: valid.toISOString().slice(0, 10) }, inputs);
  await query(
    "update quotes set request_id = $2, customer_email = $3, customer_phone = $4 where id = $1",
    [quoteId, id, req.email, req.phone],
  );
  await query("update quote_requests set quote_id = $2, status = case when status in ('new', 'contacted') then 'quoted' else status end, updated_at = now() where id = $1", [id, quoteId]);
  return quoteId;
}

/** Marks a quotation as sent to the customer and gives it a private link token. */
export async function markQuotationSent(quoteId: number, email: string): Promise<string> {
  const q = await queryOne("select access_token from quotes where id = $1", [quoteId]);
  if (!q) throw new Error("Quotation not found.");
  const token = q.access_token ?? newToken();
  await query("update quotes set access_token = $2, sent_at = now(), customer_email = $3 where id = $1", [quoteId, token, email]);
  await query("update quote_requests set status = 'quoted', updated_at = now() where quote_id = $1 and status in ('new', 'contacted')", [quoteId]);
  return token;
}

/** The items travel as JSON in a hidden field; only refs, kit ids, quantities and notes are trusted. */
export function parseLines(raw: string): RequestLineInput[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 100).map((l) => ({
      ref: typeof l.ref === "string" ? l.ref.slice(0, 200) : null,
      projectId: Number.isInteger(l.projectId) ? l.projectId : null,
      quantity: Math.max(1, Math.min(100000, Math.floor(Number(l.quantity)) || 1)),
      note: typeof l.note === "string" ? l.note.slice(0, 500) : "",
    })).filter((l) => l.ref || l.projectId);
  } catch {
    return [];
  }
}
