// Sync entry point. Used by GitHub Actions and by hand.
//   npm run sync -- --scheduled            run only if a configured sync time is due (hourly cron safe)
//   npm run sync -- --supplier=microscale  force one supplier now
//   npm run sync                           force every enabled supplier now (Microscale only in v1)
import { closePool, query } from "../src/lib/db";
import { getSettings } from "../src/lib/settings";
import { latestDueSlot } from "../src/lib/time";
import { runSync } from "../src/lib/sync/run";
import type { Supplier } from "../src/lib/pricing";
import { ACTIVE_SUPPLIERS } from "../src/lib/suppliers";

async function main() {
  const args = process.argv.slice(2);
  const scheduled = args.includes("--scheduled");
  const only = args.find((a) => a.startsWith("--supplier="))?.split("=")[1] as Supplier | undefined;
  if (only && !ACTIVE_SUPPLIERS.includes(only)) throw new Error(`Supplier ${only} is not enabled.`);
  const suppliers: Supplier[] = only ? [only] : ACTIVE_SUPPLIERS;

  if (scheduled) {
    const settings = await getSettings();
    const slot = latestDueSlot(settings.syncTimes, new Date());
    if (!slot) return console.log("No sync times configured.");
    const [recent] = await query(
      "select count(*)::int as n from sync_runs where trigger = 'schedule' and started_at >= $1 and status <> 'skipped'",
      [slot],
    );
    if (recent.n > 0) return console.log(`Slot ${slot.toISOString()} already handled. Nothing to do.`);
    console.log(`Running scheduled sync for slot ${slot.toISOString()}.`);
  }

  let failed = false;
  for (const supplier of suppliers) {
    const r = await runSync({ supplier, trigger: scheduled ? "schedule" : "manual" });
    console.log(`${supplier}: ${r.status} (${r.updated} updated, ${r.unchanged} unchanged, ${r.failed} failed) run #${r.runId}`);
    if (r.status === "failed") failed = true;
  }
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closePool);
