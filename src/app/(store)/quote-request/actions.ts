"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { clientIp, FORM_LIMITS, hit } from "@/lib/guard";
import { notifyQuoteRequest } from "@/lib/notify";
import { createQuoteRequest, parseLines } from "@/lib/store/quoteRequests";
import { readContact, summarize, text, type FieldErrors } from "@/lib/store/validate";
import { currentCustomer } from "@/lib/users";

export interface QuoteState {
  error?: string;
  fields?: FieldErrors;
  values?: Record<string, string>;
}

const LABELS: Record<string, string> = { organisation: "school or organisation", name: "contact person", email: "email", phone: "phone number", students: "number of students", needed_by: "date", items: "items" };

export async function quoteRequestAction(_: QuoteState, form: FormData): Promise<QuoteState> {
  const values = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  if (await hit(clientIp(await headers()), FORM_LIMITS).catch(() => null)) return { error: "Too many requests. Please wait a minute and try again.", values };
  const errors: FieldErrors = {};
  const organisation = text(form, "organisation", 200);
  if (organisation.length < 2) errors.organisation = "Enter the school or organisation name.";
  const contact = readContact(form, errors);
  const studentsRaw = text(form, "students", 10);
  const students = studentsRaw ? Math.floor(Number(studentsRaw.replace(/\D/g, ""))) : null;
  if (studentsRaw && (!students || students < 1 || students > 100000)) errors.students = "Enter the number of students as a whole number.";
  const neededBy = text(form, "needed_by", 10) || null;
  if (neededBy && !/^\d{4}-\d{2}-\d{2}$/.test(neededBy)) errors.needed_by = "Pick a date.";
  const lines = parseLines(String(form.get("lines") ?? "[]"));
  const message = text(form, "message", 3000);
  if (lines.length === 0 && message.length < 10) errors.items = "Add at least one item, or tell us what you need in the message.";
  if (Object.keys(errors).length) return { error: summarize(errors, LABELS), fields: errors, values };

  const user = await currentCustomer();
  let req;
  try {
    req = await createQuoteRequest({
      userId: user?.id ?? null,
      organisation,
      contactName: contact.name,
      contactRole: text(form, "role", 120),
      phone: contact.phone,
      email: contact.email,
      students,
      neededBy,
      fulfilment: text(form, "fulfilment") === "pickup" ? "pickup" : "delivery",
      message,
      lines,
    });
  } catch (e) {
    return { error: (e as Error).message, values };
  }
  after(() => notifyQuoteRequest(req));
  redirect(`/quote-request/sent/${encodeURIComponent(req.number)}?t=${req.accessToken}`);
}
