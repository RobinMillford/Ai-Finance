/**
 * Phase 1 tests: candle persistence policies (§12/§13/§39/§40/§41).
 *
 * Covers the two behaviors the spec calls out explicitly:
 *  - WRITE conflict policy: non-canonical providers never overwrite canonical
 *    rows; canonical rows upsert; non-canonical rows fill only gaps.
 *  - Storage-first read: enough stored coverage → no provider round-trip;
 *    hybrid merge keeps stored rows authoritative.
 *
 * Fixtures use day OFFSETS from today (the storage window in getCandles is
 * relative to `now`, so absolute dates would silently fall outside it).
 *
 * The Mongo layer is stubbed in-memory (schema identity index and validators
 * are exercised by integration/staging, not unit time).
 */

jest.mock('@/models/Candle', () => {
  type Row = {
    _id: string;
    symbol: string;
    interval: string;
    timestamp: Date;
    adjustmentMode: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
    sourceProvider: string;
    retrievedAt: Date;
  };

  const rows = new Map<string, Row>();
  let seq = 0;

  const keyOf = (f: { symbol: string; interval: string; timestamp: Date; adjustmentMode: string }) =>
    `${f.symbol}|${f.interval}|${new Date(f.timestamp).toISOString()}|${f.adjustmentMode}`;

  const Candle: any = function (doc: any) {
    return doc;
  };

  Candle.findOne = jest.fn((filter: any) => {
    const key = keyOf(filter);
    return { lean: async () => rows.get(key) ?? null };
  });

  Candle.updateOne = jest.fn(async (filter: any, update: any) => {
    // candles.ts updates either by identity key or by _id.
    const existing = filter._id
      ? [...rows.values()].find((r) => r._id === filter._id)
      : rows.get(keyOf(filter));
    if (!existing) return { modifiedCount: 0 };
    Object.assign(existing, update.$set, {
      timestamp: new Date(update.$set.timestamp),
      retrievedAt: new Date(update.$set.retrievedAt ?? Date.now()),
    });
    return { modifiedCount: 1 };
  });

  Candle.create = jest.fn(async (doc: any) => {
    const key = keyOf(doc);
    rows.set(key, { _id: `id-${seq++}`, ...doc, timestamp: new Date(doc.timestamp) });
    return doc;
  });

  Candle.find = jest.fn((filter: any) => {
    const from = new Date(filter.timestamp.$gte);
    const matches = () =>
      [...rows.values()]
        .filter(
          (r) =>
            r.symbol === filter.symbol &&
            r.interval === filter.interval &&
            r.adjustmentMode === filter.adjustmentMode &&
            r.timestamp >= from
        )
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    // Mimic the mongoose query chain used by candles.ts: find().sort().lean()
    return {
      sort: () => ({ lean: async () => matches() }),
      lean: async () => matches(),
    };
  });

  Candle.deleteMany = jest.fn(async () => {
    rows.clear();
    return { deletedCount: 0 };
  });

  (Candle as any).__rows = rows;

  return { __esModule: true, default: Candle };
});

jest.mock('@/lib/market-data/registry', () => ({
  getCandlesFromProviders: jest.fn(),
  CANONICAL_SOURCES: {
    quote: 'twelvedata',
    candles: 'eulerpool',
    company: 'eulerpool',
    fundamentals: 'eulerpool',
    valuation: 'eulerpool',
  },
}));

import Candle from '@/models/Candle';
import { persistCandles, getCandles, clearCandles } from '@/lib/market-data/candles';
import { getCandlesFromProviders } from '@/lib/market-data/registry';
import type { Candle as DomainCandle } from '@/lib/market-data/domain';

const mockedGetFromProviders = getCandlesFromProviders as jest.Mock;
const rows = (Candle as any).__rows as Map<string, any>;

/** UTC midnight `offsetDays` from today — always inside the read window. */
function dayOffsetIso(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

function candle(
  symbol: string,
  offsetDays: number,
  close: number,
  provider: 'twelvedata' | 'eulerpool'
): DomainCandle {
  return {
    symbol,
    timestamp: dayOffsetIso(offsetDays),
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 1000,
    interval: '1day',
    adjustmentMode: 'unknown',
    provider,
  };
}

beforeEach(async () => {
  await clearCandles();
  mockedGetFromProviders.mockReset();
});

describe('persistCandles — canonical-source conflict policy (§13)', () => {
  it('canonical provider (eulerpool for stocks) upserts existing rows', async () => {
    await persistCandles([candle('AAPL', -5, 100, 'twelvedata')], 'stock'); // fills a gap
    await persistCandles([candle('AAPL', -5, 111, 'eulerpool')], 'stock'); // canonical wins

    const stored = [...rows.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0].close).toBe(111);
    expect(stored[0].sourceProvider).toBe('eulerpool');
  });

  it('non-canonical provider never overwrites canonical rows (skippedNonCanonical)', async () => {
    await persistCandles([candle('AAPL', -5, 111, 'eulerpool')], 'stock');
    const result = await persistCandles([candle('AAPL', -5, 100, 'twelvedata')], 'stock');

    expect(result.skippedNonCanonical).toBe(1);
    const stored = [...rows.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0].close).toBe(111);
    expect(stored[0].sourceProvider).toBe('eulerpool');
  });

  it('non-canonical provider fills gaps but never mixes values (insert, not overwrite)', async () => {
    await persistCandles([candle('AAPL', -5, 111, 'eulerpool')], 'stock');
    const result = await persistCandles(
      [candle('AAPL', -5, 100, 'twelvedata'), candle('AAPL', -4, 112, 'twelvedata')],
      'stock'
    );

    expect(result.skippedNonCanonical).toBe(1); // −5 conflict → skipped
    expect(result.inserted).toBe(1); // −4 gap → filled
    expect(result.upserted).toBe(0);
    expect(rows.size).toBe(2);
    const conflictDay = dayOffsetIso(-5);
    const gapDay = dayOffsetIso(-4);
    expect(rows.get(`AAPL|1day|${conflictDay}|unknown`).close).toBe(111);
    expect(rows.get(`AAPL|1day|${gapDay}|unknown`).sourceProvider).toBe('twelvedata');
  });

  it('same-provider re-persist upserts (refresh, not duplicate)', async () => {
    await persistCandles([candle('MSFT', -7, 300, 'eulerpool')], 'stock');
    const result = await persistCandles([candle('MSFT', -7, 305, 'eulerpool')], 'stock');

    expect(result.upserted).toBe(1);
    expect(rows.size).toBe(1);
    expect(rows.get(`MSFT|1day|${dayOffsetIso(-7)}|unknown`).close).toBe(305);
  });

  it('crypto/forex canonical source is twelvedata (per policy table)', async () => {
    await persistCandles([candle('BTC/USD', -5, 50000, 'twelvedata')], 'crypto');
    const result = await persistCandles([candle('BTC/USD', -5, 49000, 'eulerpool')], 'crypto');

    expect(result.skippedNonCanonical).toBe(1);
    expect(rows.get(`BTC/USD|1day|${dayOffsetIso(-5)}|unknown`).close).toBe(50000);
  });
});

describe('getCandles — storage-first read (§39/§40)', () => {
  it('serves from storage alone when coverage ≥ minCoverage (no provider call)', async () => {
    // 42 weekdays within the last 60 calendar days → coverage ≥ 0.95 of
    // expected = floor(60×5/7) = 42, even if one boundary row falls outside
    // the read window (41/42 = 0.976 still passes).
    const fixtures: DomainCandle[] = [];
    let close = 100;
    for (let offset = -1; fixtures.length < 42 && offset > -61; offset--) {
      const dow = new Date(dayOffsetIso(offset)).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      fixtures.push(candle('AAPL', offset, close++, 'eulerpool'));
    }
    await persistCandles(fixtures, 'stock');

    const { candles, source } = await getCandles('AAPL', 'stock', { days: 60 });
    expect(source).toBe('storage');
    expect(candles.length).toBeGreaterThanOrEqual(41);
    expect(mockedGetFromProviders).not.toHaveBeenCalled();
  });

  it('hybrid merge: canonical provider supersedes non-canonical fillers, gaps are filled', async () => {
    // Storage holds a non-canonical (twelvedata) gap-filler row.
    await persistCandles([candle('NVDA', -2, 200, 'twelvedata')], 'stock');
    const providerRows = [
      candle('NVDA', -2, 999, 'eulerpool'), // canonical same-date → supersedes
      candle('NVDA', -3, 201, 'eulerpool'), // gap → filled
    ];
    mockedGetFromProviders.mockResolvedValue(providerRows);

    const { candles, source } = await getCandles('NVDA', 'stock', { days: 46 });
    expect(source).toBe('hybrid');
    expect(mockedGetFromProviders).toHaveBeenCalledTimes(1);

    const byDate = new Map(candles.map((c) => [c.timestamp.slice(0, 10), c.close]));
    expect(byDate.get(dayOffsetIso(-2).slice(0, 10))).toBe(999); // canonical won
    expect(byDate.get(dayOffsetIso(-3).slice(0, 10))).toBe(201); // gap filled
    // Storage was updated to the canonical value (no duplicate rows).
    expect(rows.size).toBe(2);
    expect(rows.get(`NVDA|1day|${dayOffsetIso(-2)}|unknown`).sourceProvider).toBe('eulerpool');
  });

  it('pure provider path when storage is empty', async () => {
    mockedGetFromProviders.mockResolvedValue([candle('TSLA', -2, 250, 'eulerpool')]);

    const { candles, source } = await getCandles('TSLA', 'stock', { days: 46 });
    expect(source).toBe('provider');
    expect(candles).toHaveLength(1);
  });

  it('throws when no provider data is available (never fabricates)', async () => {
    mockedGetFromProviders.mockRejectedValue(new Error('all providers down'));
    await expect(getCandles('XXX', 'stock', { days: 46 })).rejects.toThrow('all providers down');
    expect(rows.size).toBe(0);
  });
});

