/**
 * Phase 0 tests: indicator service (spec §18, §19, §32).
 *
 * The provider client is mocked; these tests verify the service's own
 * contract: bounded concurrency, per-indicator graceful degradation,
 * caching, and the all-failed error path.
 */

jest.mock('@/lib/market-data/twelvedata', () => {
  const actualErrors = jest.requireActual('@/lib/market-data/twelvedata');
  return {
    ...actualErrors,
    twelveDataFetch: jest.fn(),
    twelveDataUrl: jest.fn((path: string, params: Record<string, unknown>) => {
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      return `https://api.twelvedata.com/${path}?${qs}`;
    }),
  };
});

import { twelveDataFetch, ProviderError } from '@/lib/market-data/twelvedata';
import { getIndicators, clearIndicatorCache } from '@/lib/market-data/indicators';

const mockedFetch = twelveDataFetch as jest.Mock;

beforeEach(() => {
  mockedFetch.mockReset();
  clearIndicatorCache();
});

describe('getIndicators', () => {
  it('fetches all requested indicators and returns them keyed by name', async () => {
    mockedFetch.mockImplementation(async (url: string) => {
      const path = url.match(/api\.twelvedata\.com\/(\w+)/)?.[1] ?? '';
      return { values: [{ datetime: '2026-01-01', [path]: '1.23' }] };
    });

    const result = await getIndicators('aapl', ['rsi', 'atr']);
    expect(result.complete).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.indicators.rsi).toBeDefined();
    expect(result.indicators.atr).toBeDefined();
  });

  it('runs missing indicators concurrently (bounded), not strictly serially', async () => {
    let inFlight = 0;
    let peakInFlight = 0;

    mockedFetch.mockImplementation(async () => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { values: [] };
    });

    await getIndicators('AAPL', ['ema20', 'ema50', 'rsi', 'macd', 'bbands', 'adx']);

    // Concurrency bound is 3 — peak must never exceed it, but with 6 tasks it
    // must exceed 1 (i.e. work is actually parallelized, not sequential).
    expect(peakInFlight).toBeGreaterThan(1);
    expect(peakInFlight).toBeLessThanOrEqual(3);
  });

  it('degrades gracefully when one indicator fails (no throw)', async () => {
    mockedFetch.mockImplementation(async (url: string) => {
      const path = url.match(/api\.twelvedata\.com\/(\w+)/)?.[1] ?? '';
      if (path === 'rsi') {
        throw new ProviderError('bad symbol', 'bad_symbol', 404);
      }
      return { values: [{ datetime: '2026-01-01' }] };
    });

    const result = await getIndicators('AAPL', ['rsi', 'atr']);
    expect(result.complete).toBe(false);
    expect(result.indicators.atr).toBeDefined();
    expect(result.errors.rsi).toMatch(/bad_symbol/);
  });

  it('serves cached indicators without hitting the provider again', async () => {
    mockedFetch.mockResolvedValue({ values: [{ datetime: '2026-01-01' }] });

    await getIndicators('MSFT', ['rsi']);
    const callsAfterFirst = mockedFetch.mock.calls.length;
    await getIndicators('MSFT', ['rsi']);
    expect(mockedFetch.mock.calls.length).toBe(callsAfterFirst);
  });

  it('only fetches indicators missing from cache on partial hits', async () => {
    mockedFetch.mockResolvedValue({ values: [{ datetime: '2026-01-01' }] });

    await getIndicators('TSLA', ['rsi', 'atr']);
    const callsAfterFirst = mockedFetch.mock.calls.length;

    // Second call adds a new indicator: only that one should be fetched.
    await getIndicators('TSLA', ['rsi', 'atr', 'bbands']);
    expect(mockedFetch.mock.calls.length).toBe(callsAfterFirst + 1);
  });

  it('throws ProviderError when ALL requested indicators fail', async () => {
    mockedFetch.mockRejectedValue(new ProviderError('provider down', 'unavailable', 502));

    await expect(getIndicators('AAPL', ['rsi', 'atr'])).rejects.toThrow(ProviderError);
  });

  it('normalizes the symbol to upper case for cache keys and params', async () => {
    mockedFetch.mockResolvedValue({ values: [] });

    await getIndicators('aapl', ['rsi']);
    const url = mockedFetch.mock.calls[0][0] as string;
    expect(url).toContain('symbol=AAPL');
  });
});
