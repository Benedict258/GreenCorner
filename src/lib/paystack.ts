import { createHmac, timingSafeEqual } from "node:crypto";

// Paystack: the customer pays on Paystack's own page, then Paystack tells our server (signed webhook).
// An order is only marked paid after our server has verified the transaction with Paystack itself.
const API = "https://api.paystack.co";

export function paystackEnabled(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

export function paystackMode(): "live" | "test" | "off" {
  const k = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!k) return "off";
  return k.startsWith("sk_live_") ? "live" : "test";
}

function key(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("Online payment is not switched on yet (PAYSTACK_SECRET_KEY is not set).");
  return k;
}

type Fetcher = typeof fetch;

async function call<T>(path: string, init: RequestInit, fetchFn: Fetcher): Promise<T> {
  const res = await fetchFn(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key()}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) throw new Error(`Paystack: ${body?.message ?? `HTTP ${res.status}`}`);
  return body.data as T;
}

export const toKobo = (naira: number) => Math.round(naira * 100);

export interface InitializeInput {
  email: string;
  amountNgn: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export async function initializeTransaction(input: InitializeInput, fetchFn: Fetcher = fetch): Promise<{ authorizationUrl: string; reference: string }> {
  const data = await call<{ authorization_url: string; reference: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: toKobo(input.amountNgn),
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: ["card", "bank", "ussd", "bank_transfer"],
        metadata: input.metadata ?? {},
      }),
    },
    fetchFn,
  );
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export interface VerifiedTransaction {
  status: "success" | "failed" | "abandoned" | "pending" | string;
  reference: string;
  amountKobo: number;
  currency: string;
  channel: string | null;
  paidAt: string | null;
  raw: unknown;
}

export async function verifyTransaction(reference: string, fetchFn: Fetcher = fetch): Promise<VerifiedTransaction> {
  const d = await call<{ status: string; reference: string; amount: number; currency: string; channel?: string; paid_at?: string | null }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
    fetchFn,
  );
  return { status: d.status, reference: d.reference, amountKobo: d.amount, currency: d.currency, channel: d.channel ?? null, paidAt: d.paid_at ?? null, raw: d };
}

export async function createRefund(reference: string, amountNgn: number | null, note: string, fetchFn: Fetcher = fetch): Promise<{ id: string; status: string }> {
  const d = await call<{ id: number | string; status: string }>(
    "/refund",
    {
      method: "POST",
      body: JSON.stringify({ transaction: reference, ...(amountNgn ? { amount: toKobo(amountNgn) } : {}), merchant_note: note.slice(0, 200), customer_note: note.slice(0, 200) }),
    },
    fetchFn,
  );
  return { id: String(d.id), status: d.status };
}

/** Webhooks are signed with HMAC-SHA512 of the raw body, keyed with the secret key, in x-paystack-signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = process.env.PAYSTACK_SECRET_KEY ?? ""): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
