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
 */

import Candle, { ICandle, CandleInterval, AdjustmentMode } from '@/models/Candle';
import { getCandlesFromProviders, CANONICAL_SOURCES } from './registry';
import type { Candle as DomainCandle } from './domain';

/** Data classes keyed by asset type → canonical candle provider. */
function canonicalFor(assetType: 'stock' | 'crypto' | 'forex'): 'twelvedata' | 'eulerpool' {
  if (assetType === 'stock') return CANONICAL_SOURCES.candles; // eulerpool
  // Crypto/forex candle coverage: Twelve Data is the proven daily source.
  return 'twelvedata';
}

function toDoc(c: DomainCandle): Partial<ICandle> {
  return {
    symbol: c.symbol.toUpperCase(),
    timestamp: new Date(c.timestamp),
    interval: c.interval,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    adjustmentMode: c.adjustmentMode,
    sourceProvider: c.provider,
    retrievedAt: new Date(),
  };
}

function toDomain(doc: ICandle): DomainCandle {
  return {
    symbol: doc.symbol,
    timestamp: doc.timestamp.toISOString(),
    open: doc.open,
    high: doc.high,
    low: doc.low,
    close: doc.close,
    volume: doc.volume,
    interval: doc.interval,
    adjustmentMode: doc.adjustmentMode,
    provider: doc.sourceProvider,
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
    const filter = {
      symbol: candle.symbol.toUpperCase(),
      interval: candle.interval,
      timestamp: new Date(candle.timestamp),
      adjustmentMode: candle.adjustmentMode,
    };

    const existing = await Candle.findOne(filter).lean<ICandle | null>();

    if (existing) {
      if (candle.provider !== canonical && existing.sourceProvider !== candle.provider) {
        // Overlap conflict: canonical source owns the candle — skip silently
        // mixing non-canonical values over it (§9/§13).
        skippedNonCanonical += 1;
        continue;
      }
      await Candle.updateOne(
        { _id: existing._id },
        { $set: { ...toDoc(candle), retrievedAt: new Date() } }
      );
      upserted += 1;
    } else {
      await Candle.create(toDoc(candle));
      inserted += 1;
    }
  }

  return { upserted, inserted, skippedNonCanonical };
}

/**
 * Storage-first read (§39/§40): serve from Mongo when the requested range is
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

  const stored = await Candle.find({
    symbol: sym,
    interval,
    adjustmentMode,
    timestamp: { $gte: from },
  })
    .sort({ timestamp: 1 })
    .lean<ICandle[]>();

  // Trading-day coverage estimate: ~5 trading days per 7 calendar days.
  const expected = Math.floor(days * (5 / 7));
  const coverage = expected > 0 ? stored.length / expected : 0;

  if (coverage >= minCoverage && stored.length > 0) {
    return { candles: stored.map(toDomain), source: 'storage' };
  }

  // Fetch from providers (registry applies the deterministic fallback policy).
  const fetched = await getCandlesFromProviders(sym, { outputsize: Math.max(days, 5000) });
  await persistCandles(fetched, assetType);

  // Merge: stored rows remain authoritative for their identity; fetched rows
  // fill gaps. (persistCandles already enforced the canonical-source rule.)
  if (stored.length > 0) {
    const storedKeys = new Set(stored.map((d) => new Date(d.timestamp).toISOString()));
    const merged = [...stored.map(toDomain)];
    for (const c of fetched) {
      if (!storedKeys.has(c.timestamp)) merged.push(c);
    }
    merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return { candles: merged, source: 'hybrid', provider: fetched[0]?.provider };
  }

  return { candles: fetched, source: 'provider', provider: fetched[0]?.provider };
}

/** Test/utility hook: clear all stored candles (never call in production paths). */
export async function clearCandles(): Promise<void> {
  await Candle.deleteMany({});
}
