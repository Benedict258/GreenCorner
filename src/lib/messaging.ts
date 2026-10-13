import { query, queryOne } from "./db";

// Email (Resend) and WhatsApp (Meta Cloud API). Each send is recorded in `messages`. When a service is
// not configured the message is recorded as "skipped" and nothing fails: the in-app notice still shows.

type Fetcher = typeof fetch;

export interface Related {
  type: string;
  id: number;
}

async function record(channel: "email" | "whatsapp", recipient: string, subject: string, status: "sent" | "failed" | "skipped", error: string | null, related?: Related) {
  await query(
    "insert into messages (channel, recipient, subject, status, error, related_type, related_id) values ($1, $2, $3, $4, $5, $6, $7)",
    [channel, recipient, subject.slice(0, 300), status, error?.slice(0, 1000) ?? null, related?.type ?? null, related?.id ?? null],
  ).catch(() => undefined); // the log must never break a checkout
}

export interface Attachment {
  filename: string;
  content: Buffer;
}

export interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
  related?: Related;
}

export function emailEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendEmail(input: EmailInput, fetchFn: Fetcher = fetch): Promise<boolean> {
  const to = (Array.isArray(input.to) ? input.to : [input.to]).map((s) => s.trim()).filter(Boolean);
  if (to.length === 0) return false;
  const label = to.join(", ");
  if (!emailEnabled()) {
    await record("email", label, input.subject, "skipped", "Email is not configured (RESEND_API_KEY, MAIL_FROM).", input.related);
    return false;
  }
  try {
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo || process.env.MAIL_REPLY_TO ? { reply_to: input.replyTo ?? process.env.MAIL_REPLY_TO } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await record("email", label, input.subject, "sent", null, input.related);
    return true;
  } catch (e) {
    await record("email", label, input.subject, "failed", (e as Error).message, input.related);
    return false;
  }
}

export function whatsappEnabled(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/** "+234 807 878 7646" -> "2348078787646" (WhatsApp wants digits with the country code). */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("234")) return d;
  if (d.startsWith("0")) return `234${d.slice(1)}`;
  return d;
}

/**
 * Sends a WhatsApp message. Meta only allows free text inside a 24-hour conversation window, so when
 * WHATSAPP_TEMPLATE is set the text goes as the single body parameter of that approved template.
 */
export async function sendWhatsApp(phone: string, text: string, related?: Related, fetchFn: Fetcher = fetch): Promise<boolean> {
  const to = waNumber(phone);
  if (!to) return false;
  if (!whatsappEnabled()) {
    await record("whatsapp", to, text.slice(0, 120), "skipped", "WhatsApp is not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID).", related);
    return false;
  }
  const template = process.env.WHATSAPP_TEMPLATE;
  const body = template
    ? { messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" }, components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }] } }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000) } };
  try {
    const res = await fetchFn(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`WhatsApp HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await record("whatsapp", to, text.slice(0, 120), "sent", null, related);
    return true;
  } catch (e) {
    await record("whatsapp", to, text.slice(0, 120), "failed", (e as Error).message, related);
    return false;
  }
}

/** Where the team's alerts go: Settings first, then the environment. */
export async function teamContacts(): Promise<{ emails: string[]; whatsapp: string[] }> {
  const rows = await query("select key, value from settings where key in ('notify_emails', 'notify_whatsapp')");
  const m = new Map(rows.map((r) => [r.key, r.value as string]));
  const split = (s: string | undefined) => (s ?? "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const emails = split(m.get("notify_emails"));
  const whatsapp = split(m.get("notify_whatsapp"));
  return {
    emails: emails.length ? emails : split(process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL),
    whatsapp: whatsapp.length ? whatsapp : split(process.env.NOTIFY_WHATSAPP),
  };
}

export async function addNotification(kind: string, title: string, body: string, link: string | null): Promise<void> {
  await query("insert into notifications (kind, title, body, link) values ($1, $2, $3, $4)", [kind, title.slice(0, 200), body.slice(0, 1000), link]);
}

export async function unreadNotifications(limit = 10) {
  const [rows, count] = await Promise.all([
    query("select * from notifications order by created_at desc limit $1", [limit]),
    queryOne("select count(*)::int as n from notifications where read_at is null"),
  ]);
  return { items: rows, unread: count?.n ?? 0 };
}

export async function markNotificationsRead(id?: number): Promise<void> {
  if (id) await query("update notifications set read_at = now() where id = $1 and read_at is null", [id]);
  else await query("update notifications set read_at = now() where read_at is null");
}
