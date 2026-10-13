"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { audit } from "@/lib/guard";
import { sendQuotationEmail, siteUrl } from "@/lib/notify";
import { formatDocDate } from "@/lib/quoteDocument";
import { renderQuotationPdf } from "@/lib/quotePdf";
import { loadQuote } from "@/lib/quotes";
import { markQuotationSent, quotationFromRequest, setRequestNotes, setRequestStatus, type RequestStatus } from "@/lib/store/quoteRequests";
import { isEmail } from "@/lib/users";

const STATUSES: RequestStatus[] = ["new", "contacted", "quoted", "accepted", "closed"];

export async function setRequestStatusAction(id: number, status: string) {
  const s = await requireStaff();
  if (!STATUSES.includes(status as RequestStatus)) return;
  await setRequestStatus(id, status as RequestStatus);
  await audit(s.email, "quote_request_status", "quote_request", id, { status });
  revalidatePath(`/admin/quote-requests/${id}`);
  revalidatePath("/admin/quote-requests");
}

export async function saveRequestNotesAction(id: number, notes: string): Promise<{ ok: string }> {
  await requireStaff();
  await setRequestNotes(id, notes);
  revalidatePath(`/admin/quote-requests/${id}`);
  return { ok: "Notes saved." };
}

/** Makes (or opens) the official quotation for a request in the quote builder. */
export async function createQuotationAction(id: number) {
  const s = await requireStaff();
  const quoteId = await quotationFromRequest(id);
  await audit(s.email, "quotation_from_request", "quote_request", id, { quoteId });
  redirect(`/admin/quotes/${quoteId}`);
}

/** Emails the quotation PDF with a "View and pay online" link. */
export async function sendQuotationAction(quoteId: number, to: string, message: string): Promise<{ ok?: string; error?: string }> {
  const s = await requireStaff();
  const email = to.trim().toLowerCase();
  if (!isEmail(email)) return { error: "Enter the customer's email address." };
  const q = await loadQuote(quoteId);
  if (!q) return { error: "Quotation not found." };
  if (q.lines.length === 0) return { error: "Add at least one line before sending." };
  const token = await markQuotationSent(quoteId, email);
  const link = `${await siteUrl()}/quotation/${token}`;
  const pdf = await renderQuotationPdf(q);
  const sent = await sendQuotationEmail({ quoteId, number: q.quoteNumber, billTo: q.name, to: email, total: q.total, validUntil: q.validUntil ? formatDocDate(q.validUntil) : null, link, pdf, message: message.slice(0, 2000) });
  await audit(s.email, "quotation_sent", "quote", quoteId, { to: email, emailed: sent });
  const req = await queryOne("select id from quote_requests where quote_id = $1", [quoteId]);
  if (req) revalidatePath(`/admin/quote-requests/${req.id}`);
  revalidatePath(`/admin/quotes/${quoteId}/view`);
  return sent
    ? { ok: `Sent to ${email}. The customer can view and pay at the link.` }
    : { ok: `Email is not set up yet, so nothing was emailed. Send the customer this link: ${link}` };
}
