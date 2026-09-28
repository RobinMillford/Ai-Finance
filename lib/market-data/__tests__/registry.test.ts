/**
 * Phase 1 tests: provider registry fallback + provenance + conflict policy.
 *
 * Stubs `global.fetch` (the real seam both provider clients use) so ALL real
 * code runs — normalizers, fallback policy, caching, provenance. Fixtures are
 * provider-shaped payloads; no live API calls (§27/§28/§29).
 */

jest.mock('@/lib/env', () => ({
  env: {
    twelveData: { apiKey: 'test-td-key' },
    eulerpool: { apiKey: 'test-ep-key' },
    nodeEnv: 'test',
  },
}));

import { getQuoteFor, getCandlesFromProviders, clearQuoteCache, CANONICAL_SOURCES } from '@/lib/market-data/registry';
import { env } from '@/lib/env';

/** Writable view of the mocked env (real types mark keys readonly). */
const mockEnv = env as unknown as {
  twelveData: { apiKey: string | null };
  eulerpool: { apiKey: string | null };
};

// Test-fast pacing (default is the free-tier 7.6s; plan-configurable per §4).
beforeAll(() => {
  process.env.TWELVEDATA_MIN_INTERVAL_MS = '0';
});

// jsdom lacks `Response` (known from Phase 0) — minimal Response-like object.
function providerResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}

type Impl = (url: string) => { ok: boolean; status: number; headers: { get(n: string): string | null }; json(): Promise<unknown> };

/** Stub global.fetch, routing by provider host so each side gets its fixture. */
function stubFetch(td: Impl, ep: Impl): void {
  (global as { fetch: unknown }).fetch = jest.fn(async (url: unknown) => {
    const u = String(url);
    return u.includes('eulerpool.com') ? ep(u) : td(u);
  });
}

const realFetch = global.fetch;
afterAll(() => {
  (global as { fetch: unknown }).fetch = realFetch;
});

// ── Fixtures (provider-shaped payloads, NOT normalized objects) ─────────────

const TD_QUOTE_FIXTURE = {
  symbol: 'AAPL',
  name: 'Apple Inc',
  exchange: 'NASDAQ',
  currency: 'USD',
  open: '148',
  high: '151',
  low: '147.5',
  close: '150.25',
  previous_close: '149',
  change: '1.25',
  percent_change: '0.83893',
  volume: '52319500',
  datetime: new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
};

const EP_QUOTE_FIXTURE = {
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
  volume: 52_000_000,
  timestamp: Date.now() - 5 * 60 * 1000,
};

const EP_CANDLES_FIXTURE = [
  { timestamp: 1705276800000, open: 178.5, high: 182, low: 177.8, close: 181.2 },
  { timestamp: 1705363200000, open: 181.2, high: 184.1, low: 180.9, close: 183.5 },
];

const TD_TIMESERIES_FIXTURE = {
  values: [
    { datetime: '2024-01-16', open: '181', high: '184', low: '180', close: '183.9', volume: '80000000' },
    { datetime: '2024-01-15', open: '180', high: '183', low: '178', close: '182', volume: '82000000' },
  ],
};

const tdOk: Impl = () => providerResponse(TD_QUOTE_FIXTURE);
const tdDown: Impl = () => providerResponse({ message: 'upstream unavailable' }, 503);
const epOkQuote: Impl = () => providerResponse(EP_QUOTE_FIXTURE);
const epDown: Impl = () => providerResponse({ error: 'server error' }, 503);

beforeEach(() => {
  mockEnv.twelveData.apiKey = 'test-td-key';
  mockEnv.eulerpool.apiKey = 'test-ep-key';
  clearQuoteCache();
  stubFetch(tdOk, epOkQuote);
});

describe('CANONICAL_SOURCES policy (§8/§42)', () => {
  it('declares exactly one canonical source per data class', () => {
    expect(CANONICAL_SOURCES.quote).toBe('twelvedata');
    expect(CANONICAL_SOURCES.candles).toBe('eulerpool');
    expect(CANONICAL_SOURCES.company).toBe('eulerpool');
    expect(CANONICAL_SOURCES.fundamentals).toBe('eulerpool');
    expect(CANONICAL_SOURCES.valuation).toBe('eulerpool');
  });
});

describe('getQuoteFor — deterministic fallback (§8/§28)', () => {
  it('uses Twelve Data when it succeeds (canonical for quotes)', async () => {
    const quote = await getQuoteFor('AAPL');
    expect(quote.provider).toBe('twelvedata');
    expect(quote.price).toBeCloseTo(150.25, 6);
    expect(quote.changePercent).toBeCloseTo(0.83893, 6);
    expect(quote.retrievedAt).toBeTruthy();
    // Only the quote endpoint was hit — no fallback provider call (§41).
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to Eulerpool when Twelve Data is unavailable (5xx)', async () => {
    // Eulerpool's current quote is derived from its latest daily candle
    // (verified live: /equity/quotes is a historical series, not a quote).
    stubFetch(tdDown, () => providerResponse(EP_CANDLES_FIXTURE));
    const quote = await getQuoteFor('AAPL');
    expect(quote.provider).toBe('eulerpool');
    expect(quote.price).toBe(183.5); // latest candle close (1705363200000)
  });

  it('returns an explicitly STALE cached quote when both providers fail', async () => {
    // Prime the cache through a successful Twelve Data call.
    await getQuoteFor('MSFT');

    stubFetch(tdDown, epDown);
    const quote = await getQuoteFor('MSFT');
    expect(quote.freshness).toBe('stale');
    expect(quote.provider).toBe('twelvedata'); // provenance of the cached data
    expect(quote.price).toBeCloseTo(150.25, 6);
    expect(quote.retrievedAt).toBeTruthy();
  });

  it('throws when both providers fail and nothing is cached', async () => {
    stubFetch(tdDown, epDown);
    await expect(getQuoteFor('TSLA')).rejects.toThrow();
  });

  it('skips the fallback when Eulerpool is not configured', async () => {
    mockEnv.eulerpool.apiKey = null;
    stubFetch(tdDown, epOkQuote);
    await expect(getQuoteFor('AAPL')).rejects.toThrow();
    // Only the Twelve Data attempt happened — Eulerpool was never called.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('twelvedata.com');
  });
});

describe('getQuoteFor — provenance, no silent mixing (§9/§24/§29)', () => {
  it('reports exactly the provider that produced the data', async () => {
    stubFetch(
      tdDown,
      () =>
        providerResponse([
          { timestamp: 1705276800000, open: 178.5, high: 182, low: 177.8, close: 998 },
          { timestamp: 1705363200000, open: 181.2, high: 184.1, low: 180.9, close: 999 },
        ])
    );
    const quote = await getQuoteFor('AAPL');
    expect(quote.provider).toBe('eulerpool');
    expect(quote.price).toBe(999); // single-source value — never averaged/merged
    expect(quote.asOf).toBeTruthy();
  });
});

describe('getCandlesFromProviders — Eulerpool primary (§7/§8)', () => {
  it('uses Eulerpool when it succeeds (canonical for candles)', async () => {
    stubFetch(tdOk, () => providerResponse(EP_CANDLES_FIXTURE));
    const candles = await getCandlesFromProviders('AAPL');
    expect(candles).toHaveLength(2);
    expect(candles[0].provider).toBe('eulerpool');
    expect(candles[0].close).toBe(181.2);
    expect(candles[0].interval).toBe('1day');
    expect(candles[0].timestamp).toBe(new Date(1705276800000).toISOString());
    expect(candles[0].symbol).toBe('AAPL');
  });

  it('falls back to Twelve Data time_series when Eulerpool fails', async () => {
    stubFetch(
      (url) =>
        String(url).includes('time_series')
          ? providerResponse(TD_TIMESERIES_FIXTURE)
          : providerResponse(TD_QUOTE_FIXTURE),
      epDown
    );
    const candles = await getCandlesFromProviders('AAPL');
    expect(candles[0].provider).toBe('twelvedata');
    expect(candles[0].close).toBe(183.9);
    expect(candles[0].interval).toBe('1day');
  });

  it('treats missing volume in Eulerpool candles as null (not zero)', async () => {
    stubFetch(tdOk, () => providerResponse(EP_CANDLES_FIXTURE));
    const candles = await getCandlesFromProviders('AAPL');
    expect(candles[0].volume).toBeNull();
  });

  it('propagates failure when both providers fail', async () => {
    stubFetch(tdDown, epDown);
    await expect(getCandlesFromProviders('AAPL')).rejects.toThrow();
  });
});
