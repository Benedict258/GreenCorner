import type { Supplier } from "../pricing";
import { microscaleAdapter } from "./microscale";
import type { Fetcher, Observation, Sleep, SupplierSearchHit } from "./types";

export interface ObserveContext {
  fetchFn?: Fetcher;
  sleep?: Sleep;
  log: (s: string) => void;
  /** Allow a recently fetched copy of the supplier data (used right after linking, never by scheduled runs). */
  allowCache?: boolean;
}

/** One adapter per supplier. The sync runner and the UI only talk to this interface. */
export interface SupplierAdapter {
  id: Supplier;
  /** Returns, per ref, an observation or an Error. A ref missing from the map means "not found at the supplier". */
  observe(refs: string[], ctx: ObserveContext): Promise<Map<string, Observation | Error>>;
  search(q: string, fetchFn?: Fetcher): Promise<SupplierSearchHit[]>;
  /** Validates and normalises a ref before it is stored. Returns null if invalid. */
  normalizeRef(input: string): string | null;
  invalidRefMessage: string;
}

export const ADAPTERS: Partial<Record<Supplier, SupplierAdapter>> = {
  microscale: microscaleAdapter,
  // hub360: hub360Adapter  <- lives in ./_deferred/hub360.ts, see README "Re-enabling Hub360"
};
