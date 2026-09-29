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
 * The PostgreSQL repository boundary is stubbed in-memory (schema identity
 * uniqueness, NUMERIC precision and constraint behavior are exercised by
 * verify:postgres against the real database, not unit time). The stub
 * mirrors the repository contract exactly:
 *   upsertCandle(row, isCanonical) → 'inserted' | 'upserted' | 'skippedNonCanonical'
 *   readCandles({symbol, from, interval, adjustmentMode}) → StoredCandle[]
 *   deleteAllCandles() → void
 */

jest.mock('@/lib/db/repositories/candles', () => {
  type Row = {
    symbol: string;
    timestamp: string; // ISO
    interval: string;
    adjustmentMode: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
    provider: string;
  };

  const rows = new Map<string, Row>();

  const keyOf = (row: {
    symbol: string;
    interval: string;
    timestamp: Date;
    adjustmentMode: string;
  }) => `${row.symbol}|${row.interval}|${new Date(row.timestamp).toISOString()}|${row.adjustmentMode}`;

  const upsertCandle = jest.fn(
    async (
      row: {
        symbol: string;
        timestamp: Date;
        interval: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number | null;
        adjustmentMode: string;
        sourceProvider: string;
      },
      isCanonical: boolean
    ) => {
      const key = keyOf(row);
      const existing = rows.get(key);
      if (existing) {
        // Non-canonical providers fill ONLY missing identities (§13).
        if (!isCanonical) return 'skippedNonCanonical';
        existing.open = row.open;
        existing.high = row.high;
        existing.low = row.low;
        existing.close = row.close;
        existing.volume = row.volume;
        existing.provider = row.sourceProvider;
        return 'upserted';
      }
      rows.set(key, {
        symbol: row.symbol.toUpperCase(),
        timestamp: new Date(row.timestamp).toISOString(),
        interval: row.interval,
        adjustmentMode: row.adjustmentMode,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        provider: row.sourceProvider,
      });
      return 'inserted';
    }
  );

  const readCandles = jest.fn(async (opts: {
    symbol: string;
    from: Date;
    interval?: string;
    adjustmentMode?: string;
  }) =>
    [...rows.values()]
      .filter(
        (r) =>
          r.symbol === opts.symbol.toUpperCase() &&
          r.interval === (opts.interval ?? '1day') &&
          r.adjustmentMode === (opts.adjustmentMode ?? 'unknown') &&
          new Date(r.timestamp) >= opts.from
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  );

  const deleteAllCandles = jest.fn(async () => {
    rows.clear();
  });

  return {
    __esModule: true,
    upsertCandle,
    readCandles,
    deleteAllCandles,
    __rows: rows,
    __keyOf: keyOf,
  };
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

import {
  persistCandles,
  getCandles,
  clearCandles,
} from '@/lib/market-data/candles';
import { getCandlesFromProviders } from '@/lib/market-data/registry';
import type { Candle as DomainCandle } from '@/lib/market-data/domain';

// The jest module factory's extra exports survive the mock registry.
const candlesRepo = jest.requireMock('@/lib/db/repositories/candles') as {
  __rows: Map<string, any>;
  __keyOf: (row: {
    symbol: string;
    interval: string;
    timestamp: Date;
    adjustmentMode: string;
  }) => string;
};

const mockedGetFromProviders = getCandlesFromProviders as jest.Mock;
const rows = candlesRepo.__rows;
const keyOf = candlesRepo.__keyOf;

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
    expect(stored[0].provider).toBe('eulerpool');
  });

  it('non-canonical provider never overwrites canonical rows (skippedNonCanonical)', async () => {
    await persistCandles([candle('AAPL', -5, 111, 'eulerpool')], 'stock');
    const result = await persistCandles([candle('AAPL', -5, 100, 'twelvedata')], 'stock');

    expect(result.skippedNonCanonical).toBe(1);
    const stored = [...rows.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0].close).toBe(111);
    expect(stored[0].provider).toBe('eulerpool');
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
    expect(rows.get(`AAPL|1day|${gapDay}|unknown`).provider).toBe('twelvedata');
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
    expect(rows.get(`NVDA|1day|${dayOffsetIso(-2)}|unknown`).provider).toBe('eulerpool');
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
