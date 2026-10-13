import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyStaffToken } from "@/lib/auth";
import { clientIp, hit, isBlocked, isScraperAgent, PAGE_LIMITS, SEARCH_LIMITS, type Limit } from "@/lib/guard";

// Admin area: staff session required (each action and API route checks again).
const ADMIN_OPEN = /^\/admin\/(login|invite|reset)(\/|$)/;
const ADMIN = /^\/(admin|api\/(admin|sync|quotes|catalog|search))(\/|$)/;

// Catalog pages and search: no copying tools, and a per-visitor rate limit (one database statement).
// Images only get the copying-tool check: they carry no prices, and a shop page loads dozens of them.
function catalogLimits(pathname: string): Limit[] | null {
  if (pathname === "/shop" || pathname.startsWith("/shop/")) return PAGE_LIMITS;
  if (pathname.startsWith("/api/store/suggest")) return SEARCH_LIMITS;
  if (pathname.startsWith("/img/")) return [];
  return null;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ADMIN.test(pathname) && !ADMIN_OPEN.test(pathname)) {
    const staff = await verifyStaffToken(req.cookies.get(COOKIE)?.value);
    if (staff) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  const limits = catalogLimits(pathname);
  if (limits) {
    // Staff browsing their own shop are never limited.
    if (await verifyStaffToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
    const ua = req.headers.get("user-agent");
    if (isScraperAgent(ua)) return new NextResponse("Automated access to the catalog is not allowed. See /terms.", { status: 403 });
    if (limits.length === 0) return NextResponse.next();
    const ip = clientIp(req.headers);
    try {
      if (await isBlocked(ip)) return new NextResponse("Access from this address is blocked. Contact info@waste2light.com.", { status: 403 });
      const over = await hit(ip, limits);
      if (over) {
        return new NextResponse("Too many requests. Please slow down and try again in a minute.", {
          status: 429,
          headers: { "retry-after": String(over.windowSec) },
        });
      }
    } catch {
      // The database being slow or down must not take the shop down with it.
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"] };
