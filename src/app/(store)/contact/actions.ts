"use server";
import { headers } from "next/headers";
import { clientIp, FORM_LIMITS, hit } from "@/lib/guard";
import { addNotification, sendEmail, teamContacts } from "@/lib/messaging";
import { emailLayout } from "@/lib/notify";
import { text } from "@/lib/store/validate";

export interface ContactState {
  error?: string;
  ok?: boolean;
}

export async function contactAction(_: ContactState, form: FormData): Promise<ContactState> {
  if (await hit(clientIp(await headers()), FORM_LIMITS).catch(() => null)) return { error: "Too many messages. Please wait a minute." };
  // A hidden field people never fill in; simple bots do.
  if (text(form, "website")) return { ok: true };
  const name = text(form, "name", 120);
  const reach = text(form, "reach", 200);
  const message = text(form, "message", 4000);
  if (name.length < 2 || reach.length < 5 || message.length < 5) return { error: "Fill in your name, an email or phone number, and your message." };
  await addNotification("contact", `Message from ${name}`, `${reach}\n${message}`, null);
  const team = await teamContacts();
  if (team.emails.length) {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    await sendEmail({
      to: team.emails,
      subject: `Website message from ${name}`,
      html: emailLayout(`Message from ${name}`, [`Reply to: <b>${esc(reach)}</b>`, esc(message).replace(/\n/g, "<br>")]),
      text: `From ${name} (${reach}):\n\n${message}`,
      replyTo: /@/.test(reach) ? reach : undefined,
    });
  }
  return { ok: true };
}
