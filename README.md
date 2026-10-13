# Waste2Light Store

The components and kits branch of Waste2Light: a public store where students, schools and makers buy electronics and renewable-energy parts or complete project kits, pay online (Paystack) or by bank transfer, or send a quote request, with delivery or pickup in Minna. Behind it, an admin area runs orders, quote requests, quotations, products, stock and projects. The original internal quote tool (Microscale sync, Catalog, quote builder, quotation PDF) lives on inside the admin area.

Plan and decisions: the "Waste2Light Components Platform: Plan" document. Design: `UI-UX.md` (brief) and `Designs/` (the Claude Design export the pages are built from).

## The store (public)

| Page | Path |
| --- | --- |
| Home | `/` |
| Shop, with category, stock and price filters and sorting | `/shop` |
| Product (photos, description, price, stock, buy) | `/shop/<id>-<name>` |
| Projects and project kits (buy the kit, buy some parts, request a quote for a class) | `/projects`, `/projects/<slug>` |
| Cart (also a drawer on every page) | `/cart` |
| Checkout: guest or account, delivery in Minna or pickup, Paystack or bank transfer | `/checkout` |
| Order confirmation, receipt PDF, order tracking | `/checkout/success/<number>`, `/track` |
| Request a quote (from the cart, a product or a project), with a draft PDF | `/quote-request` |
| A sent quotation: view, accept and pay | `/quotation/<private link>` |
| Account: orders, quotes, addresses, profile, password reset | `/account` |
| About, Contact, Delivery, Refunds, Terms, Privacy, Cookies | `/about` and so on |

- **Prices.** Customers see one price: Microscale price ÷ units per pack × (1 + markup), whole naira. The markup is set per product in Admin > Products, else on the Catalog component, else the default in Admin > Settings (10%). The supplier's name, price, links, stock codes and image addresses never reach a public page: photos are served from `/img/p/<id>/<n>`, descriptions are cleaned (`src/lib/sanitize.ts`).
- **Stock.** Out-of-stock products are hidden by default but can be shown. What Waste2Light holds itself (Admin > Stock) makes a product buyable even when Microscale is out; paid orders take from it first.
- **Orders.** Prices are locked when the order is placed. The cart is emptied only once the payment is confirmed, so a failed payment loses nothing. Order numbers are `W2L-ORD-1001` onwards; quote requests `W2L-REQ-0001` onwards.
- **Payments.** Paystack: the customer pays on Paystack's page; the order is marked paid only after our server verifies the transaction with Paystack (return page and signed webhook both do this, once). Bank transfer: the order waits until staff click *Mark as paid*. Refunds go back through Paystack's API, or are recorded as manual bank refunds.
- **Notifications.** New paid orders, bank-transfer orders and quote requests: an alert in the admin bell, an email to the team and, if connected, WhatsApp. Customers get emails for confirmation, receipts (PDF attached), status changes, refunds and quotations. Every message is logged (Admin > Activity); if email or WhatsApp is not set up, nothing breaks and the log says "Not set up".
- **Protecting the catalog.** No product feed is exposed; the shop shows 48 products a page. Shop pages and search are rate-limited per visitor (90 a minute, 1,200 an hour); known copying tools and AI crawlers are refused (`src/lib/guard.ts`, `src/proxy.ts`, `src/app/robots.ts`); owners can block addresses in Admin > Traffic. This slows copying a lot; it cannot stop a determined person completely.

## The admin area (`/admin`)

Dashboard (sales, orders to confirm, open requests, items to source, sync health, needs-attention list, 30-day chart), Orders (status steps, mark paid, refunds, unavailable items, our price vs Microscale price and margin, CSV export), Quote requests (call/WhatsApp, notes, make the quotation, email it), Quotations (the existing builder and PDF, plus *Email to customer*), Products (markup, visibility, our stock), Stock, Projects (editor with photos, steps, downloads, kit list and live kit price; *Add demo projects*), Customers, Sync, Settings (store settings and connection status), Staff (owner only: invite, roles), Activity (audit log and every email/WhatsApp), Traffic, and the older quote tools (Quote shop, Catalog, Bundles).

Roles: **Owner** (everything) and **Staff** (orders, quote requests, projects, stock; no prices, refunds or staff). The owner in `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` always works; invite everyone else from Admin > Staff (they set their own password from the invitation link).

## Going live with the platform

1. **Migrate Neon first**: `$env:DATABASE_URL='postgresql://...'; npm run migrate` applies `004_platform.sql` (new tables; existing data untouched).
2. **Vercel environment variables** (see `.env.example`): `SITE_URL` (the store's address), Paystack keys, `RESEND_API_KEY` + `MAIL_FROM` (domain verified in Resend), optionally WhatsApp. Redeploy.
3. **Paystack dashboard**: set the webhook URL to `<SITE_URL>/api/paystack/webhook` and the callback URL to `<SITE_URL>/checkout/callback`. Test with test keys first, then swap in live keys.
4. **Admin > Settings**: alert emails and WhatsApp numbers, default markup, bank transfer on or off, opening hours.
5. **Admin > Projects**: *Add demo projects* (or `npm run seed-demo`), then replace them with real ones.
6. Run the sync workflow once with *force* so product descriptions and photos fill in.

## Updating the design

The stylesheets `src/styles/store.css` and `src/styles/admin.css` are generated from `Designs/*.html`: `node scripts/design-css.mjs Designs src/styles/store.css store` (and `... admin.css admin`). Rules every page writes the same way stay global; rules a page styles its own way are scoped to that page with `:where(.pg-<page>)`, keeping each page's original order. `src/styles/app.css` holds what the static designs did not need (overlays, live states, pages without a mockup).

---

# The quote tools (admin)

Originally the internal Green Corner quote tool: it turns a list of components into a priced quote. It reads Microscale prices twice a day, adds a per-item markup (10% default) and totals the quote. Built from the PRD dated 2 Oct 2026. Its pages now live under `/admin` (Quote shop, Catalog, Bundles, Quotations, Sync, Settings).

## Scope: v1 is Microscale only

**Hub360 is deferred.** Its product pages show no stock status and no SKU, the price is plain text with no structured data, and the selectors can't be verified. This overrides the PRD wherever they conflict:

- One supplier: Microscale (Shopify, public `products.json` feed). No Hub360 column, link field or sync button anywhere in the UI, and the scheduled sync does not touch Hub360.
- Unit price = `round(microscale price / units per listing x (1 + markup % / 100))`. Markup is per component, default 10%. Total = sum of line totals, no delivery or other fees.
- No supplier switching on quote lines (FR-13 is "Later"). A quote line shows Microscale price, markup, unit price, quantity and line total, with a warning if the item is out of stock at Microscale or its price is stale. Saved quotes still snapshot prices. Bundles are unchanged.
- The data model and sync code stay supplier-agnostic: `supplier` on listings, one adapter per supplier (`src/lib/sync/adapters.ts`), and `ACTIVE_SUPPLIERS` in `src/lib/suppliers.ts`. Only `microscale` is active. Listings for an inactive supplier stay in the database but are invisible to pricing and the UI.

### Re-enabling Hub360 later

The code is parked, not deleted: `src/lib/sync/_deferred/hub360.ts` (scraper, search, a ready `hub360Adapter`), `tests/_deferred/hub360.test.ts` and `tests/fixtures/_deferred/`. Run `npm run test:deferred` to check it still passes. To turn it on:

1. Capture real Hub360 product pages and check every selector in `parseProductPage` against them. Find where stock is shown, or decide how to treat a page with no stock status.
2. Check Hub360's terms on automated access.
3. In `src/lib/suppliers.ts` add `"hub360"` to `ACTIVE_SUPPLIERS`.
4. In `src/lib/sync/adapters.ts` import `hub360Adapter` and register it.
5. Bring back per-line supplier selection in the quote builder (FR-13); `chooseListing` in `src/lib/pricing.ts` already prefers the lowest in-stock per-unit price across suppliers.

Next.js 16 (TypeScript), PostgreSQL, a Node sync script run by GitHub Actions.

## Run it locally

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL
npm run hash-password       # asks for the password (hidden); put the output in ADMIN_PASSWORD_HASH (single-quote it in .env)
npm run migrate
npm run dev
```

Next.js does not read a plain `.env` for the scripts; export the variables (or use `node --env-file=.env`) before `npm run migrate` / `npm run sync`.

Then: run `npm run sync` once (or **Sync now** in the app) so the **Shop** lists every Microscale product, sign in, and shop: **Add to cart**, then **Create quote** from the cart. The first time a product is added it becomes a Catalog component linked to its Microscale listing, so quotes, bundles and price safeguards treat it like any other component. Components can still be made by hand in **Catalog** (search, or paste a product URL; set *units per listing* for packs).

### The quotation PDF

Each quote page has **Download PDF** (`/api/quotes/<id>/pdf`, signed-in only), laid out like Waste2Light's paper quotation, in the website's colours.

- Fixed on every quotation (`src/lib/quoteDocument.ts`, `COMPANY`): the letterhead with logo, "QUOTATION", Payment Details, "Authorized by (Waste2Light Ltd)" and the "Name, Signature & Date" line.
- Filled in on the quote: Bill To, Attn, Valid Until (required, chosen by hand), notes (one bullet per line), and per line the quantity, the description as printed, and the unit price (calculated from Microscale + markup, or typed by hand). Custom lines that are not in the Catalog are allowed.
- Set automatically on first save and never changed: the quotation number `W2L-<customer initials>-<YYYYMMDD>` (a second one that day gets `-2`) and the date (Lagos). Amount and Amount in words are calculated.
- The PDF is made on the server with `@react-pdf/renderer`, using Inter (it has the ₦ sign) and Manrope from `assets/fonts`. A4; the column headings repeat on continuation pages and the payment/signature block is never split.

### The Shop

- Every full sync (scheduled, **Sync now**, or the workflow) reads the whole `products.json` feed in one pass, as before, and also stores every variant in `supplier_products`. A sync for a single component (right after linking) does not touch the Shop. Products that leave the feed leave the Shop; an empty feed never wipes it.
- Shop prices are the Microscale price plus the component's markup (10% for products not yet in the Catalog), rounded like quotes. The cart prices with the same code as the quote builder, so the cart total is the quote total.
- The cart lives in `cart_items` (one admin, one cart). Saving a quote made from the cart empties it.

## Tests

```bash
npm test                                  # parsers, Shop feed, pricing, safeguards, schedule (no database needed)
npm run test:deferred                     # parked Hub360 code only
TEST_DATABASE_URL=postgres://... npm test # also runs sync + quote integration tests. WIPES that database.
```

## Deploy

The production database is **Neon Postgres** (already migrated, and the sync workflow has run against it).

1. Database: in Neon use the **direct** connection string (Connect → turn off *Connection pooling*; the host has no `-pooler`). The sync holds a Postgres session lock on one connection, which does not work through the pooler. Run `npm run migrate` against it; in PowerShell quote the string, it contains `&`:
   `$env:DATABASE_URL='postgresql://...'; npm run migrate`
2. Deploy this repo as its own app on its own subdomain (for example on Vercel: *Add New → Project*, import the GitHub repo, framework Next.js, no build settings to change). Set:
   - `DATABASE_URL`: the same direct Neon string
   - `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_EMAIL`: the admin login
   - `ADMIN_PASSWORD_HASH`: output of `npm run hash-password` (it asks for the password at a hidden prompt; on Windows don't pass it as an argument, npm mangles `" & % ^ !`), pasted as-is, no quotes
   - `SYNC_CONTACT`: `https://waste2light.com`
3. In the GitHub repo add the secret `GCQ_DATABASE_URL` (the same direct string) and optionally the variable `GCQ_SYNC_CONTACT`. The workflow `.github/workflows/sync.yml` only runs on the **default branch** (`main`).
4. "Sync now" in the app runs in the background of the web request (`maxDuration` 300 s). Hosts that cap request time below that should use the workflow's manual **Run workflow** button with *force* instead.
5. Every release that adds a file to `db/migrations/` needs `npm run migrate` against Neon **before** the new code goes live (Vercel does not run migrations). `002_shop.sql` adds the Shop's `supplier_products` and `cart_items` tables; after it, run the workflow with *force* once so the Shop fills.

## How the rules map to the PRD

| PRD | Where |
| --- | --- |
| Pricing (FR-10) | `src/lib/pricing.ts`, tested in `tests/pricing.test.ts` (includes the ₦98,120 worked example) |
| Safeguards (FR-8) | `src/lib/sync/safeguards.ts` (decisions), `src/lib/sync/run.ts` (applies them) |
| Sync: one pass over the Microscale feed per run, no per-product requests | `src/lib/sync/run.ts`, `src/lib/sync/microscale.ts` |
| Saved quotes keep prices (FR-15) | `src/lib/quotes.ts` snapshots every line; the server re-prices, never the browser |
| Schema | `db/migrations/001_init.sql` |

## Capturing real data (run on a machine that can reach the sites)

Done on 2026-10-02: the captured pages are in `tests/fixtures/real/` and CI runs `tests/real-data.test.ts` on them. To refresh them:

```bash
npm run capture-fixtures   # saves Microscale pages + robots.txt, /.well-known/ucp, /agents.md to tests/fixtures/real/
npm test                   # tests/real-data.test.ts now runs on the captured files
npm run extract-brand      # prints the real colors and fonts of waste2light.com; copy them into src/app/tokens.css
```

Findings from the live feed: many newer variants have no SKU (matched by variant id instead), kits are single products with the contents in the description, and prices are plain decimal strings (two were `0.00` and become "no price"). The UCP endpoint in `well-known-ucp.txt` is built for cart and checkout; `products.json` stays the source because it reads the whole catalog in about 5 requests.

## Deviations from the PRD

- **Schedule.** Twice a day by default, but instead of a fixed cron of `0 5,17 * * *`, the workflow runs hourly and the script runs a sync when a time in Settings is due and not yet handled. This makes the Settings page (FR-19) real, and a delayed GitHub run is caught up instead of lost. Defaults are still 06:00 and 18:00 Lagos.
- Extra columns beyond the PRD's table: `sync_runs.status`, `sync_runs.component_id`, `quote_lines.name/detail/warnings`, a `pending` listing status for never-synced links, `held_changes.decided_at`.
- PDF is the print stylesheet ("Print / save as PDF"), as the PRD prefers.
- Duplicate quote copies the lines and re-prices them at today's prices.
- Editing a saved quote keeps each unchanged line's saved price; use **Reprice** on a line or **Reprice all** to refresh.

## Decisions taken for the PRD's open questions

One admin login, on-screen/print/PDF output only, 10% markup editable per component, whole-naira rounding, Next.js + Postgres. Subdomain is left to you.
