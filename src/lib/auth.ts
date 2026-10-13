import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Two separate sessions: the team (admin area) and customers (shop accounts). A customer cookie never
// opens the admin area, and the admin cookie is not a customer login.
export const COOKIE = "gcq_session";
export const CUSTOMER_COOKIE = "w2l_session";
const MAX_AGE = 60 * 60 * 24 * 7;
const CUSTOMER_MAX_AGE = 60 * 60 * 24 * 30;

export type StaffRole = "owner" | "staff";

export interface StaffSession {
  email: string;
  role: StaffRole;
  userId: number | null; // null for the owner account set in environment variables
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

async function sign(claims: Record<string, unknown>, sub: string, maxAge: number): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuedAt().setExpirationTime(`${maxAge}s`).sign(secret());
}

async function verify(token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function signSession(email: string, role: StaffRole = "owner", userId: number | null = null): Promise<string> {
  return sign({ kind: "staff", role, uid: userId }, email, MAX_AGE);
}

/** The staff session in a token. Tokens made before roles existed belong to the owner. */
export async function verifyStaffToken(token: string | undefined): Promise<StaffSession | null> {
  const p = await verify(token);
  if (!p || typeof p.sub !== "string") return null;
  if (p.kind !== undefined && p.kind !== "staff") return null;
  const role: StaffRole = p.role === "staff" ? "staff" : "owner";
  return { email: p.sub, role, userId: typeof p.uid === "number" ? p.uid : null };
}

/** Kept for the proxy and older callers: the signed-in staff email, or null. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  return (await verifyStaffToken(token))?.email ?? null;
}

export async function setSessionCookie(email: string, role: StaffRole = "owner", userId: number | null = null): Promise<void> {
  (await cookies()).set(COOKIE, await signSession(email, role, userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function currentStaff(): Promise<StaffSession | null> {
  return verifyStaffToken((await cookies()).get(COOKIE)?.value);
}

/** Every admin server action and API route calls this; the proxy alone is not enough. */
export async function requireStaff(): Promise<StaffSession> {
  const s = await currentStaff();
  if (!s) throw new Error("Not signed in");
  return s;
}

/** Owner-only actions: prices, staff accounts, settings, refunds. */
export async function requireOwner(): Promise<StaffSession> {
  const s = await requireStaff();
  if (s.role !== "owner") throw new Error("Only an owner can do that.");
  return s;
}

/** The signed-in staff email. Same check as requireStaff. */
export async function requireAdmin(): Promise<string> {
  return (await requireStaff()).email;
}

// Customers ---------------------------------------------------------------------------------------

export async function setCustomerCookie(userId: number): Promise<void> {
  (await cookies()).set(CUSTOMER_COOKIE, await sign({ kind: "customer" }, String(userId), CUSTOMER_MAX_AGE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_MAX_AGE,
  });
}

export async function clearCustomerCookie(): Promise<void> {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/** The signed-in customer's user id from the cookie (the account itself is checked by the caller). */
export async function customerIdFromCookie(): Promise<number | null> {
  const p = await verify((await cookies()).get(CUSTOMER_COOKIE)?.value);
  if (!p || p.kind !== "customer" || typeof p.sub !== "string") return null;
  const id = Number(p.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
}
