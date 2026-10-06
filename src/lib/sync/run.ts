import type { PoolClient } from "pg";
import { getPool } from "../db";
import { getSettings, type AppSettings } from "../settings";
import type { Supplier } from "../pricing";
import { decide } from "./safeguards";
import { ACTIVE_SUPPLIERS } from "../suppliers";
import { ADAPTERS } from "./adapters";
import type { Fetcher, Observation, ShopProduct, Sleep } from "./types";

export interface RunOptions {
  supplier: Supplier;
  trigger: "schedule" | "manual";
  componentId?: number;
  fetchFn?: Fetcher;
  sleep?: Sleep;
  /** Accept a feed fetched in the last few minutes (set after linking a listing; scheduled runs never do). */
  allowCache?: boolean;
  /** Pre-created run row (the web app creates it first so the page can show "running"). */
  runId?: number;
}

export interface RunResult {
  runId: number;
  status: "success" | "partial" | "failed" | "skipped";
  updated: number;
  unchanged: number;
  failed: number;
}

interface ListingRow {
  id: number;
  component_id: number;
  supplier: Supplier;
  supplier_ref: string;
  price_ngn: number | null;
  in_stock: boolean;
}

const LOCK_NS = 7731;
const lockKey = (s: Supplier) => (s === "microscale" ? 1 : 2);

/** Creates the run row. Returns the id so callers can hand it to runSync. */
export async function createRun(supplier: Supplier, trigger: "schedule" | "manual", componentId?: number): Promise<number> {
  const { rows } = await getPool().query(
    "insert into sync_runs (supplier, trigger, component_id) values ($1, $2, $3) returning id",
    [supplier, trigger, componentId ?? null],
  );
  return rows[0].id;
}

export async function runSync(opts: RunOptions): Promise<RunResult> {
  const { supplier } = opts;
  const runId = opts.runId ?? (await createRun(supplier, opts.trigger, opts.componentId));
  const lines: string[] = [];
  const log = (s: string) => lines.push(`${new Date().toISOString()} ${s}`);
  const counts = { updated: 0, unchanged: 0, failed: 0 };

  const client = await getPool().connect();
  let locked = false;
  try {
    // One run per supplier at a time. Session lock lives on this dedicated connection.
    const lock = await client.query("select pg_try_advisory_lock($1, $2) as ok", [LOCK_NS, lockKey(supplier)]);
    locked = lock.rows[0].ok;
    if (!locked) {
      log("Skipped: another sync for this supplier is still running.");
      await finish(client, runId, "skipped", counts, lines);
      return { runId, status: "skipped", ...counts };
    }

    const adapter = ADAPTERS[supplier];
    if (!adapter || !ACTIVE_SUPPLIERS.includes(supplier)) {
      log(`Supplier ${supplier} is not enabled in this version. Nothing was synced.`);
      await finish(client, runId, "failed", counts, lines);
      return { runId, status: "failed", ...counts };
    }

    const settings = await getSettings();
    const params: unknown[] = [supplier];
    let sql = `select l.id, l.component_id, l.supplier, l.supplier_ref, l.price_ngn, l.in_stock
               from supplier_listings l join components c on c.id = l.component_id
               where l.supplier = $1 and c.active`;
    if (opts.componentId) {
      params.push(opts.componentId);
      sql = sql.replace("and c.active", "") + " and l.component_id = $2";
    }
    const listings: ListingRow[] = (await client.query(sql + " order by l.id", params)).rows;
    log(`${supplier}: ${listings.length} mapped listing(s) to sync.`);

    // A full run reads the feed even with nothing linked yet, so the Shop lists every product.
    const fullRun = !opts.componentId;
    const shop: { products?: ShopProduct[] } = {};
    if (listings.length > 0 || fullRun) {
      const results = await adapter.observe(listings.map((l) => l.supplier_ref), {
        fetchFn: opts.fetchFn, sleep: opts.sleep, log, allowCache: opts.allowCache,
        onProducts: fullRun ? (p) => { shop.products = p; } : undefined,
      });
      for (const l of listings) {
        const r = results.get(l.supplier_ref);
        if (!r) await recordError(client, l, "Not found at the supplier. Re-link this listing.", counts, log);
        else if (r instanceof Error) await recordError(client, l, r.message, counts, log);
        else await applyObservation(client, l, r, settings, counts, log);
      }
    }
    if (shop.products) await storeShopProducts(client, supplier, shop.products, log);

    const staleRes = await client.query(
      `update supplier_listings set status = 'stale'
       where supplier = $1 and status = 'ok' and last_synced_at < now() - ($2 || ' hours')::interval`,
      [supplier, String(settings.staleAfterHours)],
    );
    if (staleRes.rowCount) log(`Marked ${staleRes.rowCount} listing(s) stale.`);

    const status = counts.failed === 0 ? "success" : counts.updated + counts.unchanged > 0 ? "partial" : "failed";
    log(`Done: ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.failed} failed.`);
    await finish(client, runId, status, counts, lines);
    return { runId, status, ...counts };
  } catch (e) {
    log(`Run failed: ${(e as Error).message}`);
    await finish(client, runId, "failed", counts, lines).catch(() => undefined);
    return { runId, status: "failed", ...counts };
  } finally {
    if (locked) await client.query("select pg_advisory_unlock($1, $2)", [LOCK_NS, lockKey(supplier)]).catch(() => undefined);
    client.release();
  }
}

/** Replaces the supplier's Shop rows with this feed, in one transaction. Products gone from the feed are removed. */
export async function storeShopProducts(client: PoolClient, supplier: Supplier, rows: ShopProduct[], log: Log) {
  if (rows.length === 0) {
    log("Shop: the feed listed no products, so the Shop was left as it was.");
    return;
  }
  const seenAt = new Date();
  await client.query("begin");
  try {
    for (let i = 0; i < rows.length; i += 500) {
      const b = rows.slice(i, i + 500);
      await client.query(
        `insert into supplier_products (supplier, ref, handle, title, category, image_url, price_ngn, in_stock, position, seen_at)
         select $1, u.*, $10 from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::numeric[], $8::boolean[], $9::int[]) as u
         on conflict (supplier, ref) do update set handle = excluded.handle, title = excluded.title, category = excluded.category,
           image_url = excluded.image_url, price_ngn = excluded.price_ngn, in_stock = excluded.in_stock,
           position = excluded.position, seen_at = excluded.seen_at`,
        [supplier, b.map((r) => r.ref), b.map((r) => r.handle), b.map((r) => r.title), b.map((r) => r.category),
          b.map((r) => r.imageUrl), b.map((r) => r.price), b.map((r) => r.inStock), b.map((r) => r.position), seenAt],
      );
    }
    const gone = await client.query("delete from supplier_products where supplier = $1 and seen_at < $2", [supplier, seenAt]);
    await client.query("commit");
    log(`Shop: ${rows.length} products listed${gone.rowCount ? `, ${gone.rowCount} no longer in the feed removed` : ""}.`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}

async function finish(client: PoolClient, runId: number, status: string, c: { updated: number; unchanged: number; failed: number }, lines: string[]) {
  await client.query(
    `update sync_runs set status = $2, finished_at = now(), updated_count = $3, unchanged_count = $4, failed_count = $5, log = $6 where id = $1`,
    [runId, status, c.updated, c.unchanged, c.failed, lines.join("\n")],
  );
}

type Counts = { updated: number; unchanged: number; failed: number };
type Log = (s: string) => void;

async function recordError(client: PoolClient, l: ListingRow, reason: string, counts: Counts, log: Log) {
  counts.failed++;
  log(`FAIL listing ${l.id} (${l.supplier_ref}): ${reason}`);
  // Price and stock stay as they were; last_synced_at is not touched so staleness keeps counting.
  await client.query("update supplier_listings set status = 'error', last_error = $2 where id = $1", [l.id, reason]);
}

export async function applyObservation(client: PoolClient, l: ListingRow, obs: Observation, settings: AppSettings, counts: Counts, log: Log) {
  const d = decide(l.price_ngn, obs.price, settings.priceJumpThresholdPct);
  const inStock = obs.inStock ?? l.in_stock;
  if (d.kind === "error") return recordError(client, l, d.reason, counts, log);

  if (d.kind === "hold") {
    // A price the admin already rejected does not come back to the queue every sync.
    const rejected = await client.query(
      "select 1 from held_changes where listing_id = $1 and decision = 'rejected' and new_price_ngn = $2 and old_price_ngn = $3 limit 1",
      [l.id, d.newPrice, d.oldPrice],
    );
    if (rejected.rows[0]) {
      await client.query("update supplier_listings set in_stock = $2, last_synced_at = now(), last_error = null where id = $1", [l.id, inStock]);
      counts.unchanged++;
      return;
    }
    const pending = await client.query("select id from held_changes where listing_id = $1 and decision = 'pending'", [l.id]);
    if (pending.rows[0]) {
      await client.query("update held_changes set new_price_ngn = $2, detected_at = now() where id = $1", [pending.rows[0].id, d.newPrice]);
    } else {
      await client.query("insert into held_changes (listing_id, old_price_ngn, new_price_ngn) values ($1, $2, $3)", [l.id, d.oldPrice, d.newPrice]);
    }
    await client.query(
      "update supplier_listings set status = 'held', in_stock = $2, last_synced_at = now(), last_error = null, title = coalesce($3, title) where id = $1",
      [l.id, inStock, obs.title || null],
    );
    counts.unchanged++;
    log(`HELD listing ${l.id}: ${d.oldPrice} -> ${d.newPrice} (${d.changePct.toFixed(1)}% change). Waiting for review.`);
    return;
  }

  const priceChanged = d.kind === "first" || d.kind === "update";
  const stockChanged = inStock !== l.in_stock;
  const price = priceChanged ? d.price : (l.price_ngn as number);
  await client.query(
    `update supplier_listings set price_ngn = $2, in_stock = $3, status = 'ok', last_synced_at = now(), last_error = null,
       last_changed_at = case when $4 or $5 then now() else last_changed_at end, title = coalesce($6, title) where id = $1`,
    [l.id, price, inStock, priceChanged, stockChanged, obs.title || null],
  );
  if (priceChanged || stockChanged) {
    await client.query("insert into price_history (listing_id, price_ngn, in_stock) values ($1, $2, $3)", [l.id, price, inStock]);
  }
  if (priceChanged || stockChanged) {
    counts.updated++;
    log(`OK listing ${l.id}: ${l.price_ngn ?? "none"} -> ${price}${stockChanged ? `, stock ${inStock ? "in" : "out"}` : ""}.`);
  } else {
    counts.unchanged++;
  }
}

/** Approve or reject a held change (FR-9). Approve makes the new price live. */
export async function decideHeldChange(id: number, decision: "approved" | "rejected"): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query("select * from held_changes where id = $1 and decision = 'pending' for update", [id]);
    const h = rows[0];
    if (!h) {
      await client.query("rollback");
      return;
    }
    await client.query("update held_changes set decision = $2, decided_at = now() where id = $1", [id, decision]);
    if (decision === "approved") {
      const l = (await client.query("select in_stock from supplier_listings where id = $1", [h.listing_id])).rows[0];
      await client.query(
        "update supplier_listings set price_ngn = $2, status = 'ok', last_changed_at = now() where id = $1",
        [h.listing_id, Number(h.new_price_ngn)],
      );
      await client.query("insert into price_history (listing_id, price_ngn, in_stock) values ($1, $2, $3)", [h.listing_id, Number(h.new_price_ngn), l?.in_stock ?? true]);
    } else {
      await client.query("update supplier_listings set status = 'ok' where id = $1 and status = 'held'", [h.listing_id]);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
