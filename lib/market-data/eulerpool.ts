/**
 * Eulerpool adapter (Phase 1).
 *
 * HTTP client for the Eulerpool Financial Data API (docs: eulerpool.com/developers).
 * Contract verified from the official docs (September 2026):
 *   - Base URL: https://api.eulerpool.com/api/1
 *   - Auth: `token` query parameter (or Authorization: Bearer header)
 *   - Errors: JSON { error, message, status } with standard HTTP codes
 *     (400 bad request, 401 invalid key, 404 unknown security, 429 rate
 *     limited, 500 server error)
 *   - Rate limits: monthly plan quota; 429 responses carry X-RateLimit-Reset
 *     (UTC timestamp). Response headers X-RateLimit-Limit / -Remaining /
 *     -Reset are captured for provider-health tracking.
 *   - Free-tier real-time equity fields may be delayed (15 min) — freshness
 *     metadata must never claim "live" from delayed plans.
 *
 * Endpoints used in Phase 1 (documented, not invented):
 *   GET /equity/candles/{identifier}?range=1y|2y|5y|max   → OHLCV (array of
 *     { timestamp(ms), open, high, low, close }) — volume often absent
 *   GET /equity/quotes/{identifier}                        → quote
 *   GET /equity/overview/{identifier}                      → profile + key ratios
 *   GET /equity/incomestatement/{identifier}               → income statements
 *   GET /balance sheet + cash flow follow the same {identifier} shape
 *
 * No SDK installed deliberately (§35): a thin internal adapter keeps control
 * of retries, timeouts, normalization, and caching in one place.
 *
 * NOTE: Eulerpool identifiers accept ISIN/ticker/CUSIP/SEDOL/WKN. Plain
 * tickers like "AAPL" are valid; the provider resolves them.
 */

import { env } from '@/lib/env';
import { ProviderError } from './twelvedata';
import type { Candle, Company, FundamentalMetric, ProviderId, Quote } from './domain';
import { freshnessOf } from './cache';

const BASE_URL = 'https://api.eulerpool.com/api/1';
const DEFAULT_TIMEOUT_MS = 15_000;

/** Last captured rate-limit headers (provider-health observability). */
export const eulerpoolRateLimitState = {
  limit: null as number | null,
  remaining: null as number | null,
  reset: null as number | null,
};

export function isEulerpoolConfigured(): boolean {
  return Boolean(env.eulerpool?.apiKey);
}

function assertConfigured(): void {
  if (!env.eulerpool?.apiKey) {
    throw new ProviderError('Eulerpool provider is not configured', 'unavailable', 503);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch an Eulerpool endpoint with typed error mapping and Retry-After honor.
 * Retries only transient failures (429, 5xx, network); auth/symbol errors fail fast.
 */
export async function eulerpoolFetch<T = any>(
  path: string,
  params: Record<string, string> = {},
  opts: { maxRetries?: number; timeoutMs?: number } = {}
): Promise<T> {
  assertConfigured();
  const { maxRetries = 1, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  const search = new URLSearchParams({ ...params, token: env.eulerpool.apiKey });
  const url = `${BASE_URL}${path}?${search.toString()}`;
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      // Capture rate-limit headers when present (§4, §11).
      const limitHeader = response.headers.get('x-ratelimit-limit');
      const remainingHeader = response.headers.get('x-ratelimit-remaining');
      const resetHeader = response.headers.get('x-ratelimit-reset');
      if (limitHeader) eulerpoolRateLimitState.limit = parseInt(limitHeader, 10) || null;
      if (remainingHeader) eulerpoolRateLimitState.remaining = parseInt(remainingHeader, 10) || null;
      if (resetHeader) {
        const asNumber = Number(resetHeader);
        eulerpoolRateLimitState.reset = Number.isFinite(asNumber) ? asNumber : null;
      }

      if (response.status === 429) {
        const resetHeaderTs = eulerpoolRateLimitState.reset;
        const waitMs =
          resetHeaderTs && resetHeaderTs * 1000 > Date.now()
            ? Math.min(resetHeaderTs * 1000 - Date.now(), 60_000)
            : 30_000;
        lastError = new ProviderError('Eulerpool rate limit reached', 'rate_limited', 429);
        if (attempt < maxRetries) {
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }

      if (response.status === 401) {
        // Invalid/missing API key — retrying is pointless.
        throw new ProviderError('Eulerpool authentication failed', 'unavailable', 502);
      }

      if (response.status === 404) {
        throw new ProviderError('Symbol not found on Eulerpool', 'bad_symbol', 404);
      }

      if (!response.ok) {
        lastError = new ProviderError(
          `Eulerpool request failed (${response.status})`,
          'unavailable',
          502
        );
        if (attempt < maxRetries && response.status >= 500) {
          await sleep(2_000);
          continue;
        }
        throw lastError;
      }

      const data = (await response.json()) as T & { error?: string; message?: string; status?: number };
      // Eulerpool also returns JSON error bodies on some 200-shaped paths.
      if (data && typeof data === 'object' && data.error && data.status) {
        const message = data.message || data.error;
        if (data.status === 404) throw new ProviderError(message, 'bad_symbol', 404);
        if (data.status === 429) {
          lastError = new ProviderError(message, 'rate_limited', 429);
          if (attempt < maxRetries) continue;
          throw lastError;
        }
        if (data.status === 401) throw new ProviderError(message, 'unavailable', 502);
        throw new ProviderError(message, 'unavailable', 502);
      }

      return data;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      lastError = new ProviderError(
        error instanceof Error && error.name === 'AbortError'
          ? 'Eulerpool request timed out'
          : 'Eulerpool request failed',
        'unavailable',
        502
      );
      if (attempt < maxRetries) {
        await sleep(2_000);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new ProviderError('Eulerpool request failed', 'unavailable', 502);
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/** Normalize an Eulerpool quote-ish payload (equity/quotes or latest-quotes row). */
export function normalizeEulerpoolQuote(
  raw: any,
  symbol: string,
  retrievedAt: string
): Quote {
  const price = num(raw?.price ?? raw?.close ?? raw?.last);
  const asOf =
    raw?.timestamp
      ? new Date(typeof raw.timestamp === 'number' ? raw.timestamp : Date.parse(raw.timestamp)).toISOString()
      : null;
  return {
    symbol: raw?.ticker || raw?.symbol || symbol,
    name: raw?.name,
    exchange: raw?.exchange,
    price,
    open: num(raw?.open),
    high: num(raw?.high),
    low: num(raw?.low),
    previousClose: num(raw?.previousClose ?? raw?.prevClose),
    change: raw?.change !== undefined ? num(raw.change) : null,
    changePercent: num(raw?.changePercent ?? raw?.percentChange),
    volume: num(raw?.volume),
    currency: raw?.currency,
    asOf,
    retrievedAt,
    provider: 'eulerpool' as ProviderId,
    // Free tier delays real-time fields; classify by data timestamp age.
    freshness: freshnessOf(asOf ? Date.parse(asOf) : undefined),
  };
}

/**
 * Normalize Eulerpool candles. Provider timestamps are epoch milliseconds.
 * `volume` is frequently absent from the documented schema — null is valid.
 */
export function normalizeEulerpoolCandles(
  raw: any,
  symbol: string
): Candle[] {
  const rows: any[] = Array.isArray(raw) ? raw : raw?.data ?? raw?.candles ?? [];
  const out: Candle[] = [];
  for (const row of rows) {
    const ts = row?.timestamp;
    if (!ts) continue;
    const open = num(row.open);
    const high = num(row.high);
    const low = num(row.low);
    const close = num(row.close ?? row.price);
    if (open === null || high === null || low === null || close === null) continue;
    out.push({
      symbol: symbol.toUpperCase(),
      timestamp: new Date(Number(ts)).toISOString(),
      open,
      high,
      low,
      close,
      volume: num(row.volume),
      interval: '1day',
      adjustmentMode: 'unknown',
      provider: 'eulerpool',
    });
  }
  return out;
}

/** Normalize an Eulerpool overview/profile payload into a Company. */
export function normalizeEulerpoolCompany(raw: any, symbol: string, retrievedAt: string): Company {
  return {
    symbol: raw?.ticker || symbol.toUpperCase(),
    name: raw?.name || symbol.toUpperCase(),
    exchange: raw?.exchange,
    country: raw?.country,
    sector: raw?.sector,
    industry: raw?.industry,
    currency: raw?.currency,
    identifiers: raw?.isin ? { isin: raw.isin } : undefined,
    description: raw?.description,
    website: raw?.website,
    employees: num(raw?.employees),
    marketCap: num(raw?.marketCap),
    asOf: null,
    retrievedAt,
    provider: 'eulerpool',
  };
}

/**
 * Normalize income statements into fundamental metrics.
 * Balance sheet / cash flow statements share the same { period, numeric fields }
 * shape, so the same flattening applies (minus a few text fields).
 */
const TEXT_FIELDS = new Set(['period', 'ticker', 'currency', 'fiscalYear', 'fiscalPeriod']);

export function normalizeEulerpoolStatements(
  raw: any,
  symbol: string,
  periodType: FundamentalMetric['periodType'],
  retrievedAt: string
): FundamentalMetric[] {
  const rows: any[] = Array.isArray(raw) ? raw : raw?.data ?? [];
  const metrics: FundamentalMetric[] = [];
  for (const row of rows) {
    const period = row?.period ? new Date(row.period).toISOString() : null;
    for (const [key, value] of Object.entries(row ?? {})) {
      if (TEXT_FIELDS.has(key)) continue;
      const numValue = num(value);
      if (numValue === null) continue;
      metrics.push({
        symbol: symbol.toUpperCase(),
        metric: key,
        value: numValue,
        unit: 'USD',
        currency: typeof row?.currency === 'string' ? row.currency : undefined,
        period,
        periodType,
        reportDate: period,
        asOf: period,
        retrievedAt,
        provider: 'eulerpool',
      });
    }
  }
  return metrics;
}

// ── Provider operations ──────────────────────────────────────────────────────

/** Fetch OHLCV candles for a ticker/ISIN. Range: 1m..max (documented). */
export async function eulerpoolGetCandles(
  identifier: string,
  range: '1m' | '3m' | '6m' | '1y' | '2y' | '5y' | 'max' = '1y'
): Promise<Candle[]> {
  const raw = await eulerpoolFetch<any>(`/equity/candles/${encodeURIComponent(identifier)}`, { range });
  return normalizeEulerpoolCandles(raw, identifier);
}

/** Fetch the normalized quote for a ticker/ISIN. */
export async function eulerpoolGetQuote(symbol: string, retrievedAt = new Date().toISOString()) {
  const raw = await eulerpoolFetch<any>(`/equity/quotes/${encodeURIComponent(symbol)}`);
  return normalizeEulerpoolQuote(raw, symbol, retrievedAt);
}

/** Fetch the normalized company overview/profile. */
export async function eulerpoolGetCompany(symbol: string, retrievedAt = new Date().toISOString()): Promise<Company> {
  const raw = await eulerpoolFetch<any>(`/equity/overview/${encodeURIComponent(symbol)}`);
  return normalizeEulerpoolCompany(raw, symbol, retrievedAt);
}

/** Fetch income-statement fundamental metrics (annual). */
export async function eulerpoolGetIncomeStatement(
  symbol: string,
  retrievedAt = new Date().toISOString()
): Promise<FundamentalMetric[]> {
  const raw = await eulerpoolFetch<any>(`/equity/incomestatement/${encodeURIComponent(symbol)}`);
  return normalizeEulerpoolStatements(raw, symbol, 'annual', retrievedAt);
}
