/**
 * Candle repository — Phase 1 provider persistence, now on PostgreSQL.
 *
 * Identity + policy are UNCHANGED from the verified Mongo implementation
 * (lib/market-data/candles.ts):
 *   identity: symbol + interval + timestamp + adjustment_mode
 *   write:    canonical provider upserts; non-canonical fills gaps only
 *   read:     storage-first with a trading-day coverage estimate
 *
 * The canonical-source table lives in lib/market-data/registry.ts
 * (CANONICAL_SOURCES) and is passed in — the DB layer stays policy-agnostic.
 */

import { and, eq, gte, sql, asc } from 'drizzle-orm';
import { getDb } from '../client';
import { candles, type CandleInterval, type AdjustmentMode, type ProviderId } from '../schema';

/** Normalized candle shape consumed by market-data services (numeric → number). */
export interface StoredCandle {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  interval: CandleInterval;
  adjustmentMode: AdjustmentMode;
  provider: ProviderId;
}

export async function upsertCandle(
  row: {
    symbol: string;
    timestamp: Date;
    interval: CandleInterval;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
    adjustmentMode: AdjustmentMode;
    sourceProvider: ProviderId;
  },
  isCanonical: boolean
): Promise<'inserted' | 'upserted' | 'skippedNonCanonical'> {
  const db = getDb();
  const values = {
    symbol: row.symbol.toUpperCase(),
    timestamp: row.timestamp,
    interval: row.interval,
    open: row.open.toFixed(6),
    high: row.high.toFixed(6),
    low: row.low.toFixed(6),
    close: row.close.toFixed(6),
    volume: row.volume === null ? null : row.volume.toFixed(2),
    adjustmentMode: row.adjustmentMode,
    sourceProvider: row.sourceProvider,
    retrievedAt: new Date(),
  };

  // Non-canonical providers fill ONLY missing identities (§13): a plain
  // insert that no-ops on conflict — never overwriting canonical data.
  if (!isCanonical) {
    const inserted = await db.insert(candles).values(values).onConflictDoNothing().returning({ id: candles.id });
    return inserted.length > 0 ? 'inserted' : 'skippedNonCanonical';
  }

  // Canonical provider owns the truth for this asset class → upsert.
  await db
    .insert(candles)
    .values(values)
    .onConflictDoUpdate({
      target: [candles.symbol, candles.interval, candles.timestamp, candles.adjustmentMode],
      set: {
        open: values.open,
        high: values.high,
        low: values.low,
        close: values.close,
        volume: values.volume,
        sourceProvider: values.sourceProvider,
        retrievedAt: values.retrievedAt,
        updatedAt: new Date(),
      },
    });
  return 'upserted';
}

export async function readCandles(opts: {
  symbol: string;
  from: Date;
  interval?: CandleInterval;
  adjustmentMode?: AdjustmentMode;
}): Promise<StoredCandle[]> {
  const rows = await getDb()
    .select()
    .from(candles)
    .where(
      and(
        eq(candles.symbol, opts.symbol.toUpperCase()),
        eq(candles.interval, opts.interval ?? '1day'),
        eq(candles.adjustmentMode, opts.adjustmentMode ?? 'unknown'),
        gte(candles.timestamp, opts.from)
      )
    )
    .orderBy(asc(candles.timestamp));

  return rows.map((r) => ({
    symbol: r.symbol,
    timestamp: r.timestamp.toISOString(),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: r.volume === null ? null : Number(r.volume),
    interval: r.interval,
    adjustmentMode: r.adjustmentMode,
    provider: r.sourceProvider,
  }));
}

export async function deleteCandlesForSymbol(symbol: string): Promise<void> {
  await getDb().delete(candles).where(eq(candles.symbol, symbol.toUpperCase()));
}

/** Test/utility hook: clear ALL stored candles (never call in production paths). */
export async function deleteAllCandles(): Promise<void> {
  await getDb().delete(candles);
}

/** Verification helper: count stored rows for one symbol (no payload). */
export async function countCandles(symbol: string): Promise<number> {
  const rows = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(candles)
    .where(eq(candles.symbol, symbol.toUpperCase()));
  return rows[0]?.count ?? 0;
}
