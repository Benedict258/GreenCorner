import type { Supplier } from "./pricing";

/**
 * Suppliers that are switched on. v1 is Microscale only (scope change, see README).
 * To re-enable Hub360 see "Re-enabling Hub360" in the README: add "hub360" here and register its adapter in
 * src/lib/sync/adapters.ts.
 */
export const ACTIVE_SUPPLIERS: Supplier[] = ["microscale"];

export function isActiveSupplier(s: unknown): s is Supplier {
  return typeof s === "string" && (ACTIVE_SUPPLIERS as string[]).includes(s);
}
