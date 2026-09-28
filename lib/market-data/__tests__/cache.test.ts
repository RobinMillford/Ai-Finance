/**
 * Phase 0 tests: TTLCache + freshness classification (spec §16, §32).
 *
 * Covers TTL expiry, entry metadata, max-entries eviction, the cached()
 * get-or-load wrapper, and the freshness classes that back honest data
 * display (live/delayed/eod/stale/unknown).
 */

import {
  TTLCache,
  TTL,
  freshnessOf,
  cached,
  quoteCache,
  indicatorCache,
  catalogCache,
} from '@/lib/market-data/cache';

describe('TTLCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores and retrieves values before TTL expiry', () => {
    const cache = new TTLCache();
    cache.set('k', { a: 1 }, 60_000);
    expect(cache.get('k')?.value).toEqual({ a: 1 });
  });

  it('expires entries after the TTL has elapsed', () => {
    const cache = new TTLCache();
    cache.set('k', 'v', 1_000);
    jest.advanceTimersByTime(1_500);
    expect(cache.get('k')).toBeUndefined();
  });

  it('still returns the value exactly at the TTL boundary', () => {
    const cache = new TTLCache();
    cache.set('k', 'v', 1_000);
    jest.advanceTimersByTime(1_000);
    expect(cache.get('k')?.value).toBe('v');
    jest.advanceTimersByTime(1);
    expect(cache.get('k')).toBeUndefined();
  });

  it('records fetchedAt, ttlMs and dataAsOf metadata per entry', () => {
    jest.setSystemTime(1_000_000);
    const cache = new TTLCache();
    cache.set('k', 'v', 5_000, 900_000);
    const { meta } = cache.get('k')!;
    expect(meta.fetchedAt).toBe(1_000_000);
    expect(meta.ttlMs).toBe(5_000);
    expect(meta.dataAsOf).toBe(900_000);
  });

  it('defaults dataAsOf to fetch time when not provided', () => {
    jest.setSystemTime(1_000_000);
    const cache = new TTLCache();
    cache.set('k', 'v', 5_000);
    const { meta } = cache.get('k')!;
    expect(meta.dataAsOf).toBe(1_000_000);
  });

  it('evicts the oldest entry when maxEntries is exceeded', () => {
    const cache = new TTLCache(2);
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.set('c', 3, 60_000); // 'a' should be evicted (insertion order)
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')?.value).toBe(2);
    expect(cache.get('c')?.value).toBe(3);
  });

  it('does not evict when re-setting an existing key at capacity', () => {
    const cache = new TTLCache(2);
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.set('a', 10, 60_000); // refresh, not insert
    expect(cache.get('a')?.value).toBe(10);
    expect(cache.get('b')?.value).toBe(2);
  });
});

describe('cached() get-or-load wrapper', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads once and serves subsequent reads from cache', async () => {
    jest.useRealTimers();
    const cache = new TTLCache();
    const loader = jest.fn().mockResolvedValue('fresh');
    const first = await cached(cache, 'x', 60_000, loader);
    const second = await cached(cache, 'x', 60_000, loader);
    expect(first.value).toBe('fresh');
    expect(second.value).toBe('fresh');
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the TTL expires', async () => {
    const cache = new TTLCache();
    const loader = jest.fn().mockResolvedValue('fresh');
    await cached(cache, 'x', 1_000, loader);
    jest.advanceTimersByTime(2_000);
    await cached(cache, 'x', 1_000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('propagates a custom dataAsOf into the entry metadata', async () => {
    jest.useRealTimers();
    const cache = new TTLCache();
    const dataAsOf = Date.now() - 120_000;
    const { meta } = await cached(cache, 'x', 60_000, async () => 'v', dataAsOf);
    expect(meta.dataAsOf).toBe(dataAsOf);
  });
});

describe('freshnessOf', () => {
  it('classifies recent data as live', () => {
    const now = Date.now();
    expect(freshnessOf(now - 30_000, now)).toBe('live');
  });

  it('classifies 30-minute-old data as delayed', () => {
    const now = Date.now();
    expect(freshnessOf(now - 30 * 60_000, now)).toBe('delayed');
  });

  it('classifies 10-hour-old data as eod (end of day)', () => {
    const now = Date.now();
    expect(freshnessOf(now - 10 * 60 * 60_000, now)).toBe('eod');
  });

  it('classifies 3-day-old data as stale', () => {
    const now = Date.now();
    expect(freshnessOf(now - 72 * 60 * 60_000, now)).toBe('stale');
  });

  it('classifies missing/invalid or future timestamps as unknown', () => {
    expect(freshnessOf(undefined)).toBe('unknown');
    expect(freshnessOf(null)).toBe('unknown');
    expect(freshnessOf(0)).toBe('unknown');
    expect(freshnessOf(Number.NaN)).toBe('unknown');
    expect(freshnessOf(Date.now() + 1, Date.now())).toBe('unknown');
  });
});

describe('shared cache singletons use data-class TTLs', () => {
  it('exposes distinct caches for quotes, indicators and catalogs', () => {
    expect(quoteCache).not.toBe(indicatorCache);
    expect(indicatorCache).not.toBe(catalogCache);
  });

  it('defines short quote TTL and long catalog TTL', () => {
    expect(TTL.QUOTE).toBeLessThanOrEqual(5 * 60_000);
    expect(TTL.CATALOG).toBeGreaterThanOrEqual(24 * 60 * 60_000);
    expect(TTL.INDICATOR).toBeGreaterThan(TTL.QUOTE);
  });
});
