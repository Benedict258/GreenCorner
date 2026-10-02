# Green Corner Quote Tool

Internal Waste2Light tool that turns a list of components into a priced quote. It reads Microscale prices twice a day, adds a per-item markup (10% default) and totals the quote. Built from the PRD dated 2 Oct 2026.

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
npm run hash-password -- 'a password of 10+ chars'   # put the output in ADMIN_PASSWORD_HASH (single-quote it)
npm run migrate
npm run dev
```

Next.js does not read a plain `.env` for the scripts; export the variables (or use `node --env-file=.env`) before `npm run migrate` / `npm run sync`.

Then: sign in, add components in **Catalog**, link supplier listings on each component's page (search, or paste a product URL; set *units per listing* for packs), and build quotes.

## Tests

```bash
npm test                                  # parsers, pricing, safeguards, schedule (no database needed)
npm run test:deferred                     # parked Hub360 code only
TEST_DATABASE_URL=postgres://... npm test # also runs sync + quote integration tests. WIPES that database.
```

## Deploy

1. Create a Postgres database (Neon, Supabase). Run `npm run migrate` against it.
2. Deploy this repo as its own app on its own subdomain (for example on Vercel). Set `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SYNC_CONTACT`.
3. In the GitHub repo add the secret `GCQ_DATABASE_URL` (same database) and optionally the variable `GCQ_SYNC_CONTACT`. The workflow `.github/workflows/sync.yml` only runs on the **default branch**, so merge before expecting scheduled runs.
4. "Sync now" in the app runs in the background of the web request (`maxDuration` 300 s). Hosts that cap request time below that should use the workflow's manual **Run workflow** button with *force* instead.

## How the rules map to the PRD

| PRD | Where |
| --- | --- |
| Pricing (FR-10) | `src/lib/pricing.ts`, tested in `tests/pricing.test.ts` (includes the ₦98,120 worked example) |
| Safeguards (FR-8) | `src/lib/sync/safeguards.ts` (decisions), `src/lib/sync/run.ts` (applies them) |
| Sync: one pass over the Microscale feed per run, no per-product requests | `src/lib/sync/run.ts`, `src/lib/sync/microscale.ts` |
| Saved quotes keep prices (FR-15) | `src/lib/quotes.ts` snapshots every line; the server re-prices, never the browser |
| Schema | `db/migrations/001_init.sql` |

## Capturing real data (run on a machine that can reach the sites)

The build sandbox's network policy blocked `www.microscale.net` and `waste2light.com`, so these two steps have to be run on your own machine:

```bash
npm run capture-fixtures   # saves Microscale pages + robots.txt, /.well-known/ucp, /agents.md to tests/fixtures/real/
npm test                   # tests/real-data.test.ts now runs on the captured files
npm run extract-brand      # prints the real colors and fonts of waste2light.com; copy them into src/app/tokens.css
```

`capture-fixtures` reports whether the feed contains a kit/bundle product and an unavailable product. Read the saved `agents.md` and `well-known-ucp.txt`: `products.json` stays the default unless that catalog endpoint is clearly better.

Until these have run: the parser tests use hand-written Shopify-shaped samples, the colors and fonts in `src/app/tokens.css` are placeholders, and the logo is a text wordmark.

## Deviations from the PRD

- **Schedule.** Twice a day by default, but instead of a fixed cron of `0 5,17 * * *`, the workflow runs hourly and the script runs a sync when a time in Settings is due and not yet handled. This makes the Settings page (FR-19) real, and a delayed GitHub run is caught up instead of lost. Defaults are still 06:00 and 18:00 Lagos.
- Extra columns beyond the PRD's table: `sync_runs.status`, `sync_runs.component_id`, `quote_lines.name/detail/warnings`, a `pending` listing status for never-synced links, `held_changes.decided_at`.
- PDF is the print stylesheet ("Print / save as PDF"), as the PRD prefers.
- Duplicate quote copies the lines and re-prices them at today's prices.
- Editing a saved quote keeps each unchanged line's saved price; use **Reprice** on a line or **Reprice all** to refresh.

## Decisions taken for the PRD's open questions

One admin login, on-screen/print/PDF output only, 10% markup editable per component, whole-naira rounding, Next.js + Postgres. Subdomain is left to you.
