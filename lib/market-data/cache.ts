/**
 * Market-data cache with TTL + freshness metadata (Phase 0 foundation).
 *
 * Replaces the scattered per-route `Map` caches with one coherent abstraction.
 *
 * Phase 0 limitation (deliberate, documented): this cache is IN-PROCESS —
 * per server instance, lost on deploy. It is structured so a distributed
 * backing store (Redis etc.) can replace `get/set` later without changing
 * callers. Do not treat it as distributed protection.
 *
 * Freshness: entries know their data timestamp (`dataAsOf`, provider-provided
 * where possible) and are classified live/delayed/eod/stale/unknown by the
 * caller via `freshnessOf`.
 */

export type FreshnessClass = 'live' | 'delayed' | 'eod' | 'stale' | 'unknown';

export interface CacheEntryMeta {
  /** When the underlying data was produced by the provider (best effort). */
  dataAsOf: number;
  /** When we fetched it. */
  fetchedAt: number;
  /** TTL applied for this entry. */
  ttlMs: number;
}

interface CacheEntry {
  value: unknown;
  meta: CacheEntryMeta;
}

/** Data-class TTLs. Quotes must never be treated as day-old data. */
export const TTL = {
  /** Live-ish quotes. */
  QUOTE: 5 * 60 * 1000, // 5 minutes
  /** Quote-like data when the market is closed (EOD). */
  QUOTE_CLOSED: 30 * 60 * 1000, // 30 minutes
  /** Indicator results — derived from daily data. */
  INDICATOR: 60 * 60 * 1000, // 1 hour
  /** Asset catalogs (symbol listings). */
  CATALOG: 24 * 60 * 60 * 1000, // 24 hours
  /** Historical daily time series. */
  HISTORY: 12 * 60 * 60 * 1000, // 12 hours
  /** News/search results. */
  NEWS: 15 * 60 * 1000,
} as const;

export class TTLCache {
  private store = new Map<string, CacheEntry>();
  /** Hard cap so unique-symbol growth cannot grow unbounded (Phase 0). */
  private readonly maxEntries: number;

  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): { value: T; meta: CacheEntryMeta } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.meta.fetchedAt > entry.meta.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry as { value: T; meta: CacheEntryMeta };
  }

  set(key: string, value: unknown, ttlMs: number, dataAsOf: number = Date.now()): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      // Drop the oldest entry (insertion order) — crude but bounded.
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      meta: { dataAsOf, fetchedAt: Date.now(), ttlMs },
    });
  }

  /** Peek at metadata without freshness check (for stale-while-revalidate use). */
  peekMeta(key: string): CacheEntryMeta | undefined {
    return this.store.get(key)?.meta;
  }

  /** Return value even if expired (caller decides how to label stale data). */
  getStale<T>(key: string): { value: T; meta: CacheEntryMeta } | undefined {
    const entry = this.store.get(key);
    return entry ? (entry as { value: T; meta: CacheEntryMeta }) : undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/** Classify how fresh a data timestamp is. */
export function freshnessOf(dataAsOf: number | undefined | null, now = Date.now()): FreshnessClass {
  if (!dataAsOf || Number.isNaN(dataAsOf)) return 'unknown';
  const ageMs = now - dataAsOf;
  if (ageMs < 0) return 'unknown';
  if (ageMs <= 15 * 60 * 1000) return 'live';
  if (ageMs <= 60 * 60 * 1000) return 'delayed';
  if (ageMs <= 24 * 60 * 60 * 1000) return 'eod';
  return 'stale';
}

// Singleton instances per data class (keeps keys from colliding).
export const quoteCache = new TTLCache(3000);
export const indicatorCache = new TTLCache(3000);
export const catalogCache = new TTLCache(100);
export const historyCache = new TTLCache(1000);
export const newsCache = new TTLCache(500);

/** Convenience wrapper: get-or-load through the cache. */
export async function cached<T>(
  cache: TTLCache,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  dataAsOf?: number
): Promise<{ value: T; meta: CacheEntryMeta; cached: boolean }> {
  const hit = cache.get<T>(key);
  if (hit) return { ...hit, cached: true };
  const value = await loader();
  cache.set(key, value, ttlMs, dataAsOf);
  return { value, meta: { dataAsOf: dataAsOf ?? Date.now(), fetchedAt: Date.now(), ttlMs }, cached: false };
}
