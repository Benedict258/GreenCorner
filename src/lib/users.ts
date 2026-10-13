import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "./db";
import { customerIdFromCookie } from "./auth";

export type Role = "customer" | "staff" | "owner";

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  hasPassword: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function isEmail(s: string): boolean {
  return EMAIL.test(s.trim()) && s.length <= 254;
}

/** Nigerian numbers in one form: +234XXXXXXXXXX. Returns null when it is not a Nigerian mobile or landline number. */
export function normalizePhone(s: string): string | null {
  const digits = s.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^[1-9]\d{9}$/.test(d) ? `+234${d}` : null;
}

export function formatPhone(p: string): string {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : p;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    role: r.role,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    hasPassword: !!r.password_hash,
  };
}

export async function getUser(id: number): Promise<User | null> {
  const r = await queryOne("select * from users where id = $1", [id]);
  return r ? toUser(r) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const r = await queryOne("select * from users where lower(email) = $1", [normalizeEmail(email)]);
  return r ? toUser(r) : null;
}

/** The signed-in customer, or null. A deactivated account counts as signed out. */
export async function currentCustomer(): Promise<User | null> {
  const id = await customerIdFromCookie();
  if (!id) return null;
  const u = await getUser(id);
  return u && u.active && u.role === "customer" ? u : null;
}

export function checkPassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 200) return "That password is too long.";
  return null;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

// A fixed hash so a login for an unknown email takes as long as a real one.
let dummyHash: string | null = null;
const DUMMY = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 10));

/** Checks a login. Returns the user only when the email exists, is active, has the given role kind, and the password matches. */
export async function verifyLogin(email: string, password: string, kind: "customer" | "staff"): Promise<User | null> {
  const r = await queryOne("select * from users where lower(email) = $1", [normalizeEmail(email)]);
  const ok = await bcrypt.compare(password, r?.password_hash ?? DUMMY());
  if (!r || !ok || !r.active || !r.password_hash) return null;
  const isStaff = r.role === "staff" || r.role === "owner";
  if ((kind === "staff") !== isStaff) return null;
  await query("update users set last_login_at = now() where id = $1", [r.id]);
  return toUser(r);
}

export interface NewCustomer {
  email: string;
  name: string;
  phone: string;
  password: string;
}

/** Creates a customer account. A guest who ordered before with the same email keeps those orders. */
export async function createCustomer(input: NewCustomer): Promise<User> {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) throw new Error("Enter a valid email address.");
  const pwErr = checkPassword(input.password);
  if (pwErr) throw new Error(pwErr);
  const existing = await queryOne("select id, password_hash, role from users where lower(email) = $1", [email]);
  if (existing?.password_hash) throw new Error("An account with this email already exists. Sign in instead.");
  if (existing && existing.role !== "customer") throw new Error("This email belongs to a staff account.");
  const hash = await hashPassword(input.password);
  const row = existing
    ? await queryOne("update users set password_hash = $2, name = $3, phone = $4 where id = $1 returning *", [existing.id, hash, input.name.trim(), input.phone])
    : await queryOne("insert into users (email, name, phone, password_hash, role) values ($1, $2, $3, $4, 'customer') returning *", [email, input.name.trim(), input.phone, hash]);
  // Guest orders and quote requests under this email now show in the account.
  await query("update orders set user_id = $1 where user_id is null and lower(email) = $2", [row.id, email]);
  await query("update quote_requests set user_id = $1 where user_id is null and lower(email) = $2", [row.id, email]);
  return toUser(row);
}

export async function updateProfile(id: number, name: string, phone: string): Promise<void> {
  await query("update users set name = $2, phone = $3 where id = $1", [id, name.trim().slice(0, 120), phone]);
}

export async function changePassword(id: number, current: string, next: string): Promise<void> {
  const r = await queryOne("select password_hash from users where id = $1", [id]);
  if (!r?.password_hash || !(await bcrypt.compare(current, r.password_hash))) throw new Error("Your current password is not right.");
  const err = checkPassword(next);
  if (err) throw new Error(err);
  await query("update users set password_hash = $2 where id = $1", [id, await hashPassword(next)]);
}

// Reset and invite links ----------------------------------------------------------------------------

const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

/** A one-time link token. Only its hash is stored. */
export async function createPasswordToken(userId: number, purpose: "reset" | "invite", hours: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await query("delete from password_tokens where user_id = $1 and purpose = $2", [userId, purpose]);
  await query("insert into password_tokens (token_hash, user_id, purpose, expires_at) values ($1, $2, $3, now() + ($4 || ' hours')::interval)", [tokenHash(token), userId, purpose, String(hours)]);
  return token;
}

export async function consumePasswordToken(token: string, password: string): Promise<User> {
  const err = checkPassword(password);
  if (err) throw new Error(err);
  const r = await queryOne("select * from password_tokens where token_hash = $1 and used_at is null and expires_at > now()", [tokenHash(token)]);
  if (!r) throw new Error("This link has expired or was already used. Ask for a new one.");
  await query("update password_tokens set used_at = now() where token_hash = $1", [tokenHash(token)]);
  const u = await queryOne("update users set password_hash = $2, active = true where id = $1 returning *", [r.user_id, await hashPassword(password)]);
  return toUser(u);
}

export async function peekPasswordToken(token: string): Promise<User | null> {
  const r = await queryOne("select user_id from password_tokens where token_hash = $1 and used_at is null and expires_at > now()", [tokenHash(token)]);
  return r ? getUser(r.user_id) : null;
}

// Staff ------------------------------------------------------------------------------------------------

export async function listStaff(): Promise<User[]> {
  return (await query("select * from users where role in ('staff', 'owner') order by role desc, lower(name), lower(email)")).map(toUser);
}

export async function inviteStaff(email: string, name: string, role: "staff" | "owner"): Promise<{ user: User; token: string }> {
  const e = normalizeEmail(email);
  if (!isEmail(e)) throw new Error("Enter a valid email address.");
  const existing = await queryOne("select * from users where lower(email) = $1", [e]);
  if (existing && existing.role === "customer") throw new Error("That email is a customer account. Use a different email for staff.");
  const row = existing
    ? await queryOne("update users set role = $2, name = coalesce(nullif($3, ''), name), active = true where id = $1 returning *", [existing.id, role, name.trim()])
    : await queryOne("insert into users (email, name, role) values ($1, $2, $3) returning *", [e, name.trim(), role]);
  const token = await createPasswordToken(row.id, "invite", 72);
  return { user: toUser(row), token };
}

export async function setStaffActive(id: number, active: boolean): Promise<void> {
  await query("update users set active = $2 where id = $1 and role in ('staff', 'owner')", [id, active]);
}

export async function setStaffRole(id: number, role: "staff" | "owner"): Promise<void> {
  await query("update users set role = $2 where id = $1 and role in ('staff', 'owner')", [id, role]);
}

export interface CustomerRow extends User {
  orders: number;
  spent: number;
  quotes: number;
  lastOrderAt: string | null;
}

export async function listCustomers(q = "", limit = 100): Promise<CustomerRow[]> {
  const params: unknown[] = [];
  let where = "u.role = 'customer'";
  if (q.trim()) {
    params.push(`%${q.trim()}%`);
    where += ` and (u.email ilike $1 or u.name ilike $1 or u.phone ilike $1)`;
  }
  const rows = await query(
    `select u.*,
       (select count(*)::int from orders o where o.user_id = u.id and o.status not in ('pending_payment', 'cancelled')) as orders,
       (select coalesce(sum(o.total_ngn - o.refunded_ngn), 0) from orders o where o.user_id = u.id and o.paid_at is not null) as spent,
       (select count(*)::int from quote_requests r where r.user_id = u.id) as quotes,
       (select max(o.created_at) from orders o where o.user_id = u.id) as last_order_at
     from users u where ${where} order by u.created_at desc limit ${limit}`,
    params,
  );
  return rows.map((r) => ({ ...toUser(r), orders: r.orders, spent: Number(r.spent), quotes: r.quotes, lastOrderAt: r.last_order_at ? new Date(r.last_order_at).toISOString() : null }));
}
