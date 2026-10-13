import { query, queryOne } from "./db";

// Slows down bulk copying of the catalog. A person browsing never gets near these limits; a script
// walking every product page does. Counters live in Postgres so every server instance shares them.

export interface Limit {
  name: string;
  max: number;
  windowSec: number;
}

/** Shop pages and product pages: 90 a minute, 1,200 an hour per visitor address. */
export const PAGE_LIMITS: Limit[] = [
  { name: "page-m", max: 90, windowSec: 60 },
  { name: "page-h", max: 1200, windowSec: 3600 },
];
/** Product images: 400 a minute, 4,000 an hour. */
export const IMAGE_LIMITS: Limit[] = [
  { name: "img-m", max: 400, windowSec: 60 },
  { name: "img-h", max: 4000, windowSec: 3600 },
];
/** Search suggestions as you type. */
export const SEARCH_LIMITS: Limit[] = [{ name: "search-m", max: 60, windowSec: 60 }];
/** Forms that send email or create records: checkout, quote requests, sign-up, password reset. */
export const FORM_LIMITS: Limit[] = [
  { name: "form-m", max: 10, windowSec: 60 },
  { name: "form-h", max: 60, windowSec: 3600 },
];

/** Tools that copy websites announce themselves; real browsers do not send these. */
const SCRAPER_UA = /(python-requests|python-urllib|aiohttp|httpx|scrapy|curl\/|wget|go-http-client|okhttp|java\/|libwww-perl|node-fetch|axios\/|undici|headlesschrome|phantomjs|puppeteer|playwright|selenium|httrack|webcopier|sitesucker|offline explorer|teleport|gptbot|ccbot|claudebot|anthropic-ai|bytespider|petalbot|amazonbot|diffbot|dataforseo|ahrefsbot|semrushbot|mj12bot|dotbot|blexbot|serpstatbot|imagesiftbot|omgili|scrapinghub|zyte|apify)/i;

export function isScraperAgent(ua: string | null): boolean {
  if (!ua || ua.length < 10) return true; // every real browser sends a user agent
  return SCRAPER_UA.test(ua);
}

export function clientIp(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** Counts one hit against each limit in one statement; returns the first limit that is now over, or null. */
export async function hit(ip: string, limits: Limit[]): Promise<Limit | null> {
  if (limits.length === 0) return null;
  const rows = await query(
    `insert into rate_limits (key, window_start, hits)
     select k, to_timestamp(floor(extract(epoch from now()) / w) * w), 1 from unnest($1::text[], $2::int[]) as u(k, w)
     on conflict (key, window_start) do update set hits = rate_limits.hits + 1
     returning key, hits`,
    [limits.map((l) => `${l.name}:${ip}`), limits.map((l) => l.windowSec)],
  );
  let over: Limit | null = null;
  for (const l of limits) {
    const r = rows.find((x) => x.key === `${l.name}:${ip}`);
    if (!over && r && r.hits > l.max) over = l;
  }
  // Old windows are cleared now and then, not on every request.
  if (Math.random() < 0.01) await query("delete from rate_limits where window_start < now() - interval '2 hours'").catch(() => undefined);
  return over;
}

// The block list is small and rarely changes, so each server instance keeps it for a minute.
let blockedCache: { at: number; ips: Set<string> } | null = null;

export async function isBlocked(ip: string): Promise<boolean> {
  if (!blockedCache || Date.now() - blockedCache.at > 60_000) {
    blockedCache = { at: Date.now(), ips: new Set((await query("select ip from blocked_ips")).map((r) => r.ip)) };
  }
  return blockedCache.ips.has(ip);
}

export async function blockIp(ip: string, reason: string): Promise<void> {
  await query("insert into blocked_ips (ip, reason) values ($1, $2) on conflict (ip) do update set reason = excluded.reason", [ip, reason]);
  blockedCache = null;
}

export async function unblockIp(ip: string): Promise<void> {
  await query("delete from blocked_ips where ip = $1", [ip]);
  blockedCache = null;
}

/** The busiest visitor addresses in the last hour, for the admin's traffic view. */
export async function busiestVisitors(limit = 15): Promise<{ ip: string; hits: number; blocked: boolean }[]> {
  const rows = await query(
    `select split_part(key, ':', 2) as ip, sum(hits)::int as hits from rate_limits
     where key like 'page-m:%' and window_start > now() - interval '1 hour'
     group by 1 order by 2 desc limit $1`,
    [limit],
  );
  const blocked = new Set((await query("select ip from blocked_ips")).map((r) => r.ip));
  return rows.map((r) => ({ ip: r.ip, hits: r.hits, blocked: blocked.has(r.ip) }));
}

export async function audit(actor: string, action: string, targetType: string | null, targetId: string | number | null, detail?: unknown): Promise<void> {
  await query(
    "insert into audit_log (actor, action, target_type, target_id, detail) values ($1, $2, $3, $4, $5)",
    [actor, action, targetType, targetId === null ? null : String(targetId), detail === undefined ? null : JSON.stringify(detail)],
  ).catch(() => undefined);
}
