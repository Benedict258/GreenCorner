import { isEmail, normalizeEmail, normalizePhone } from "../users";

export type FieldErrors = Record<string, string>;

/** Reads a trimmed text field, cut to a sane length. */
export function text(form: FormData, name: string, max = 200): string {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

export interface Contact {
  name: string;
  email: string;
  phone: string; // +234XXXXXXXXXX
}

export function readContact(form: FormData, errors: FieldErrors): Contact {
  const name = text(form, "name", 120);
  const email = normalizeEmail(text(form, "email", 254));
  const rawPhone = text(form, "phone", 40);
  const phone = normalizePhone(rawPhone) ?? "";
  if (name.length < 2) errors.name = "Enter your full name.";
  if (!isEmail(email)) errors.email = "Enter an email address like name@example.com.";
  if (!phone) errors.phone = "Enter a Nigerian phone number with 10 digits after +234, for example 802 555 0148.";
  return { name, email, phone };
}

export const MINNA_NOTE = "We deliver in Minna, Niger State only for now.";

/** A delivery address is required for delivery; it must be in Minna. */
export function readAddress(form: FormData, errors: FieldErrors) {
  const street = text(form, "street", 200);
  const area = text(form, "area", 120);
  const landmark = text(form, "landmark", 200);
  if (street.length < 3) errors.street = "Enter the street address in Minna.";
  if (area.length < 2) errors.area = "Enter the area in Minna, for example Bosso or Tunga.";
  return { street, area, landmark, city: "Minna", state: "Niger" };
}

/** The message at the top of a form: "There is 1 problem" plus a link to the first field. */
export function summarize(errors: FieldErrors, labels: Record<string, string>): string {
  const n = Object.keys(errors).length;
  return n === 0 ? "" : `There ${n === 1 ? "is 1 problem" : `are ${n} problems`} with your details. Fix the ${Object.keys(errors).map((k) => labels[k] ?? k).join(", ")} to continue.`;
}
