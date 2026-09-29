/**
 * Candle domain service (Phase 1, §12/§13/§39/§40/§41).
 *
 * READ PATH (the point of persistence):
 *   request → storage (enough fresh data?) → provider fetch for MISSING
 *   range only → persist → serve.
 *
 * WRITE POLICY (§13):
 *   - One CANONICAL source per asset class (stocks: Eulerpool per the
 *     documented provider policy; crypto/forex fall back to Twelve Data).
 *   - Overlapping provider data is never blindly merged: a stored candle is
 *     only overwritten when the incoming candle comes from the CANONICAL
 *     provider for that asset class. Non-canonical data can fill gaps only.
 *
 * Provenance (sourceProvider, retrievedAt) is persisted with every candle.
 *
 * Storage is PostgreSQL (lib/db/repositories/candles.ts); this module maps
 * between the provider-agnostic domain candle and the stored row shape.
 */

import {
  upsertCandle,
  readCandles,
  type StoredCandle,
} from '@/lib/db/repositories/candles';
import { getCandlesFromProviders, CANONICAL_SOURCES } from './registry';
import type { Candle as DomainCandle, CandleInterval, AdjustmentMode } from './domain';

/** Data classes keyed by asset type → canonical candle provider. */
function canonicalFor(assetType: 'stock' | 'crypto' | 'forex'): 'twelvedata' | 'eulerpool' {
  if (assetType === 'stock') return CANONICAL_SOURCES.candles; // eulerpool
  // Crypto/forex candle coverage: Twelve Data is the proven daily source.
  return 'twelvedata';
}

function toStored(c: DomainCandle): StoredCandle {
  return {
    symbol: c.symbol.toUpperCase(),
    timestamp: new Date(c.timestamp).toISOString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    interval: c.interval,
    adjustmentMode: c.adjustmentMode,
    provider: c.provider,
  };
}

/**
 * Persist provider candles with canonical-source policy (§13).
 * - Canonical-provider rows upsert (they own the truth for this asset class).
 * - Non-canonical rows fill ONLY missing identities — never overwrite.
 */
export async function persistCandles(
  candles: DomainCandle[],
  assetType: 'stock' | 'crypto' | 'forex'
): Promise<{ upserted: number; inserted: number; skippedNonCanonical: number }> {
  const canonical = canonicalFor(assetType);
  let upserted = 0;
  let inserted = 0;
  let skippedNonCanonical = 0;

  for (const candle of candles) {
    const result = await upsertCandle(
      {
        symbol: candle.symbol,
        timestamp: new Date(candle.timestamp),
        interval: candle.interval,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        adjustmentMode: candle.adjustmentMode,
        sourceProvider: candle.provider,
      },
      candle.provider === canonical
    );

    if (result === 'upserted') upserted += 1;
    else if (result === 'inserted') inserted += 1;
    else skippedNonCanonical += 1;
  }

  return { upserted, inserted, skippedNonCanonical };
}

/**
 * Storage-first read (§39/§40): serve from storage when the requested range is
 * sufficiently covered; fetch from providers only for what is missing.
 *
 * `minCoverage` = fraction of expected trading days that must be present in
 * storage to skip a provider round-trip (default 0.95 — holidays make 100%
 * unsafe, and a suspiciously sparse series would silently mislead analytics).
 */
export async function getCandles(
  symbol: string,
  assetType: 'stock' | 'crypto' | 'forex',
  opts: {
    /** Requested history length in calendar days (default 400 ≈ 1y). */
    days?: number;
    interval?: CandleInterval;
    adjustmentMode?: AdjustmentMode;
    minCoverage?: number;
  } = {}
): Promise<{ candles: DomainCandle[]; source: 'storage' | 'provider' | 'hybrid'; provider?: string }> {
  const { days = 400, interval = '1day', adjustmentMode = 'unknown' as AdjustmentMode, minCoverage = 0.95 } = opts;
  const sym = symbol.toUpperCase();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stored = await readCandles({ symbol: sym, from, interval, adjustmentMode });

  // Trading-day coverage estimate: ~5 trading days per 7 calendar days.
  const expected = Math.floor(days * (5 / 7));
  const coverage = expected > 0 ? stored.length / expected : 0;

  if (coverage >= minCoverage && stored.length > 0) {
    return { candles: stored.map(toDomainFromStored), source: 'storage' };
  }

  // Fetch from providers (registry applies the deterministic fallback policy).
  const fetched = await getCandlesFromProviders(sym, { outputsize: Math.max(days, 5000) });
  await persistCandles(fetched, assetType);

  // Merge: stored rows remain authoritative for their identity; fetched rows
  // fill gaps. (persistCandles already enforced the canonical-source rule.)
  if (stored.length > 0) {
    const storedKeys = new Set(stored.map((d) => d.timestamp));
    const merged: DomainCandle[] = [...stored.map(toDomainFromStored)];
    for (const c of fetched) {
      if (!storedKeys.has(c.timestamp)) merged.push(c);
    }
    merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return { candles: merged, source: 'hybrid', provider: fetched[0]?.provider };
  }

  return { candles: fetched, source: 'provider', provider: fetched[0]?.provider };
}

function toDomainFromStored(row: StoredCandle): DomainCandle {
  return {
    symbol: row.symbol,
    timestamp: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    interval: row.interval,
    adjustmentMode: row.adjustmentMode,
    provider: row.provider,
  };
}

/** Test/utility hook: clear all stored candles (never call in production paths). */
export async function clearCandles(): Promise<void> {
  const { deleteAllCandles } = await import('@/lib/db/repositories/candles');
  await deleteAllCandles();
}
