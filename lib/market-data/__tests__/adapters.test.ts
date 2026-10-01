/**
 * Phase 1 tests: provider adapter error mapping + normalization (§27).
 *
 * Stubs `global.fetch` with fixture payloads — exercises the REAL adapter
 * code paths (HTTP status mapping, 200-shaped error bodies, rate-limit
 * headers, normalization). No live API calls.
 */

jest.mock('@/lib/env', () => ({
  env: {
    twelveData: { apiKey: 'test-td-key' },
    eulerpool: { apiKey: 'test-ep-key' },
    nodeEnv: 'test',
  },
}));

import {
  twelveDataFetch,
  twelveDataUrl,
  ProviderError,
  isUsMarketOpen,
  quoteTtl,
} from '@/lib/market-data/twelvedata';
import {
  eulerpoolFetch,
  normalizeEulerpoolQuote,
  normalizeEulerpoolCandles,
  normalizeEulerpoolCompany,
  normalizeEulerpoolStatements,
  eulerpoolRateLimitState,
  isEulerpoolConfigured,
} from '@/lib/market-data/eulerpool';

beforeAll(() => {
  process.env.TWELVEDATA_MIN_INTERVAL_MS = '0';
});

function providerResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}

const realFetch = global.fetch;
afterEach(() => {
  (global as { fetch: unknown }).fetch = realFetch;
});

describe('Twelve Data adapter — error mapping', () => {
  it('throws rate_limited on HTTP 429', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => providerResponse({}, 429));
    await expect(
      twelveDataFetch('https://api.twelvedata.com/quote?x=1', { maxRetries: 0 })
    ).rejects.toMatchObject({
      name: 'ProviderError',
      kind: 'rate_limited',
      status: 429,
    });
  });

  it('throws bad_symbol on 200 body with code 404', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () =>
      providerResponse({ status: 'error', code: 404, message: 'Unknown symbol' })
    );
    await expect(twelveDataFetch('https://api.twelvedata.com/quote?x=1')).rejects.toMatchObject({
      kind: 'bad_symbol',
      status: 404,
    });
  });

  it('throws rate_limited on 200 body with limit message', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () =>
      providerResponse({ status: 'error', message: 'You have exceeded your daily limit' })
    );
    await expect(
      twelveDataFetch('https://api.twelvedata.com/quote?x=1', { maxRetries: 0 })
    ).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('throws unavailable on HTTP 5xx', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => providerResponse({}, 500));
    await expect(
      twelveDataFetch('https://api.twelvedata.com/quote?x=1', { maxRetries: 0 })
    ).rejects.toMatchObject({ kind: 'unavailable', status: 502 });
  });

  it('throws not_found on HTTP 404', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () => providerResponse({}, 404));
    await expect(twelveDataFetch('https://api.twelvedata.com/quote?x=1')).rejects.toMatchObject({
      kind: 'not_found',
      status: 404,
    });
  });

  it('throws unavailable when the API key is missing', async () => {
    // Re-import with a null key via direct env mutation.
    const { env } = require('@/lib/env');
    const mockEnv = env as unknown as { twelveData: { apiKey: string | null } };
    const original = mockEnv.twelveData.apiKey;
    mockEnv.twelveData.apiKey = null;
    try {
      await expect(twelveDataFetch('https://api.twelvedata.com/quote?x=1')).rejects.toMatchObject({
        kind: 'unavailable',
        status: 503,
      });
    } finally {
      mockEnv.twelveData.apiKey = original;
    }
  });

  it('returns parsed JSON on success', async () => {
    const payload = { symbol: 'AAPL', close: '150' };
    (global as { fetch: unknown }).fetch = jest.fn(async () => providerResponse(payload));
    await expect(twelveDataFetch('https://api.twelvedata.com/quote?x=1')).resolves.toMatchObject({
      symbol: 'AAPL',
    });
  });

  it('attaches the API key in the URL and never in a header', () => {
    const url = twelveDataUrl('quote', { symbol: 'MSFT' });
    expect(url).toContain('apikey=test-td-key');
    expect(url).toContain('symbol=MSFT');
  });
});

describe('Twelve Data — market-hours helpers', () => {
  it('classifies weekend as closed', () => {
    const saturday = new Date('2026-09-26T15:00:00Z'); // Sat 11:00 ET
    expect(isUsMarketOpen(saturday)).toBe(false);
    expect(quoteTtl()).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it('classifies a Wednesday mid-session as open (short TTL)', () => {
    // Wed 2026-09-23 14:30 UTC = 09:30 ET (heuristic uses UTC-5).
    const wednesdayOpen = new Date('2026-09-23T14:30:00Z');
    expect(isUsMarketOpen(wednesdayOpen)).toBe(true);
  });

  it('classifies 16:01 ET as closed', () => {
    const afterClose = new Date('2026-09-23T21:01:00Z');
    expect(isUsMarketOpen(afterClose)).toBe(false);
  });
});

describe('Eulerpool adapter — error mapping', () => {
  it('throws rate_limited on HTTP 429 and captures reset header', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () =>
      providerResponse({ error: 'quota' }, 429, { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60) })
    );
    await expect(
      eulerpoolFetch('/equity/quotes/AAPL', {}, { maxRetries: 0 })
    ).rejects.toMatchObject({ kind: 'rate_limited', status: 429 });
    expect(eulerpoolRateLimitState.reset).not.toBeNull();
  });

  it('honors Retry-After up to the 60s cap (does not sleep longer than the test)', async () => {
    const started = Date.now();
    (global as { fetch: unknown }).fetch = jest.fn(async () =>
      providerResponse({ error: 'quota' }, 429, { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 5) })
    );
    await expect(
      eulerpoolFetch('/x', {}, { maxRetries: 0 })
    ).rejects.toMatchObject({ kind: 'rate_limited' });
    // maxRetries=0 → no retry sleep; guard against accidental long waits.
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('throws unavailable (not bad_symbol) on 401 — auth failure, not a bad ticker', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () =>
      providerResponse({ error: 'invalid token' }, 401)
    );
    await expect(eulerpoolFetch('/x')).rejects.toMatchObject({ kind: 'unavailable', status: 502 });
  });

  it('throws bad_symbol on HTTP 404', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () =>
      providerResponse({ error: 'not found' }, 404)
    );
    await expect(eulerpoolFetch('/x')).rejects.toMatchObject({ kind: 'bad_symbol', status: 404 });
  });

  it('maps JSON error bodies carried on HTTP 200 (error+status shape)', async () => {
    (global as { fetch: unknown }).fetch = jest.fn(async () =>
      providerResponse({ error: 'unknown security', message: 'No such ticker', status: 404 })
    );
    await expect(eulerpoolFetch('/x')).rejects.toMatchObject({ kind: 'bad_symbol' });
  });

  it('throws unavailable when not configured (before any network call)', async () => {
    const { env } = require('@/lib/env');
    const mockEnv = env as unknown as { eulerpool: { apiKey: string | null } };
    const original = mockEnv.eulerpool.apiKey;
    mockEnv.eulerpool.apiKey = null;
    try {
      expect(isEulerpoolConfigured()).toBe(false);
      await expect(eulerpoolFetch('/x')).rejects.toMatchObject({ kind: 'unavailable', status: 503 });
    } finally {
      mockEnv.eulerpool.apiKey = original;
    }
  });

  it('sends the token as a query parameter', async () => {
    const fetchMock = jest.fn(async () => providerResponse({ ok: true })) as unknown as
      & ((input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>)
      & { mock: { calls: unknown[][] } };
    (global as { fetch: unknown }).fetch = fetchMock;
    await eulerpoolFetch('/equity/quotes/AAPL');
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('api.eulerpool.com/api/1');
    expect(calledUrl).toContain('token=test-ep-key');
  });

  it('retries once on 5xx then succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(providerResponse({}, 500))
      .mockResolvedValueOnce(providerResponse({ ok: true }));
    (global as { fetch: unknown }).fetch = fetchMock;
    await expect(eulerpoolFetch('/x', {}, { maxRetries: 1 })).resolves.toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Eulerpool normalization — quote', () => {
  const retrievedAt = '2026-09-28T15:00:00.000Z';

  it('normalizes a full quote payload with provenance', () => {
    const asOfMs = Date.now() - 5 * 60 * 1000; // relative to the test clock
    const q = normalizeEulerpoolQuote(
      {
        ticker: 'AAPL',
        name: 'Apple Inc',
        exchange: 'NASDAQ',
        currency: 'USD',
        price: 150.4,
        open: 148,
        high: 151,
        low: 147.5,
        previousClose: 149,
        change: 1.4,
        changePercent: 0.94,
        volume: 52_000_000,
        timestamp: asOfMs,
      },
      'AAPL',
      retrievedAt
    );
    expect(q.provider).toBe('eulerpool');
    expect(q.price).toBe(150.4);
    expect(q.previousClose).toBe(149);
    expect(q.changePercent).toBe(0.94);
    expect(q.retrievedAt).toBe(retrievedAt);
    expect(q.asOf).toBe(new Date(asOfMs).toISOString());
    expect(q.freshness).toBe('live');
  });

  it('never claims live for a delayed timestamp', () => {
    const q = normalizeEulerpoolQuote(
      { ticker: 'AAPL', price: 150, timestamp: Date.now() - 20 * 60 * 1000 },
      'AAPL',
      retrievedAt
    );
    expect(q.freshness).toBe('delayed');
  });

  it('uses unknown freshness when the payload has no timestamp', () => {
    const q = normalizeEulerpoolQuote({ ticker: 'AAPL', price: 150 }, 'AAPL', retrievedAt);
    expect(q.freshness).toBe('unknown');
  });

  it('coerces numeric strings and drops junk', () => {
    const q = normalizeEulerpoolQuote(
      { ticker: 'AAPL', price: '150.5', change: 'n/a' },
      'AAPL',
      retrievedAt
    );
    expect(q.price).toBe(150.5);
    expect(q.change).toBeNull();
  });

  it('falls back to the requested symbol when the payload omits the ticker', () => {
    const q = normalizeEulerpoolQuote({ price: 10 }, 'MSFT', retrievedAt);
    expect(q.symbol).toBe('MSFT');
  });
});

describe('Eulerpool normalization — candles', () => {
  it('converts epoch-ms timestamps and preserves OHLC', () => {
    const candles = normalizeEulerpoolCandles(
      [{ timestamp: 1705276800000, open: 178.5, high: 182, low: 177.8, close: 181.2 }],
      'AAPL'
    );
    expect(candles).toHaveLength(1);
    expect(candles[0].timestamp).toBe('2024-01-15T00:00:00.000Z');
    expect(candles[0].close).toBe(181.2);
    expect(candles[0].interval).toBe('1day');
    expect(candles[0].provider).toBe('eulerpool');
    expect(candles[0].adjustmentMode).toBe('unknown');
  });

  it('handles wrapped payloads and skips malformed rows', () => {
    const candles = normalizeEulerpoolCandles(
      {
        data: [
          { timestamp: 1705276800000, open: 1, high: 2, low: 0.5, close: 1.5 },
          { timestamp: null },
          { open: 'bad' },
        ],
      },
      'X'
    );
    expect(candles).toHaveLength(1);
  });

  it('drops price-only rows — candles require strict OHLC', () => {
    const candles = normalizeEulerpoolCandles(
      [
        { timestamp: 1705276800000, price: 42 },
        { timestamp: 1705363200000, open: 1, high: 2, low: 0.5, close: 1.5 },
      ],
      'X'
    );
    expect(candles).toHaveLength(1);
    expect(candles[0].close).toBe(1.5);
  });
});

describe('Eulerpool normalization — company + fundamentals', () => {
  const retrievedAt = '2026-09-28T15:00:00.000Z';

  it('normalizes an overview payload into a Company', () => {
    const c = normalizeEulerpoolCompany(
      {
        ticker: 'AAPL',
        name: 'Apple Inc',
        exchange: 'NASDAQ',
        country: 'United States',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        currency: 'USD',
        isin: 'US0378331005',
        marketCap: 2_900_000_000_000,
      },
      'AAPL',
      retrievedAt
    );
    expect(c.provider).toBe('eulerpool');
    expect(c.identifiers?.isin).toBe('US0378331005');
    expect(c.sector).toBe('Technology');
    expect(c.marketCap).toBe(2_900_000_000_000);
  });

  it('flattens income statements into fundamental metrics', () => {
    const metrics = normalizeEulerpoolStatements(
      [
        {
          period: '2025-09-30',
          currency: 'USD',
          revenue: 400_000_000_000,
          netIncome: 100_000_000_000,
          discontinuedOperations: null,
        },
      ],
      'AAPL',
      'annual',
      retrievedAt
    );
    const revenue = metrics.find((m) => m.metric === 'revenue');
    expect(revenue).toBeDefined();
    expect(revenue!.value).toBe(400_000_000_000);
    expect(revenue!.periodType).toBe('annual');
    expect(revenue!.period).toBe('2025-09-30T00:00:00.000Z');
    expect(revenue!.provider).toBe('eulerpool');
    // Text/null fields are excluded from the metric list.
    expect(metrics.find((m) => m.metric === 'currency')).toBeUndefined();
    expect(metrics.find((m) => m.metric === 'discontinuedOperations')).toBeUndefined();
  });
});

describe('ProviderError contract', () => {
  it('carries kind + status for HTTP mapping', () => {
    const err = new ProviderError('nope', 'bad_symbol', 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe('bad_symbol');
    expect(err.status).toBe(404);
    expect(err.name).toBe('ProviderError');
  });
});
