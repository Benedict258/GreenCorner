// Formatting shared by server and client components.

/** ₦25,800 — whole naira, thousands separated. */
export function naira(n: number): string {
  return `${n < 0 ? "-" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
}

const LAGOS = "Africa/Lagos";

/** "13 Oct 2026" */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: LAGOS }).format(new Date(iso));
}

/** "13 Oct 2026, 14:05" */
export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: LAGOS }).format(new Date(iso));
}

/** "14:05" */
export function timeOnly(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: LAGOS }).format(new Date(iso));
}

/** "5 min ago", "3 h ago", "2 days ago" */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
