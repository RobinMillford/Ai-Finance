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
 * Endpoints used in Phase 1 (VERIFIED against the live API + its OpenAPI spec
 * at GET /api/1/documentation/yaml — the live API is the arbiter, not prose docs):
 *   GET /equity/candles/{identifier}?range=1m..max   → OHLCV array of
 *     { timestamp(ms), open, high, low, close } — volume often absent
 *   GET /equity/quotes/{identifier}                  → HISTORICAL {timestamp,
 *     price} series (often empty for plain tickers) — NOT a current quote
 *   GET /equity/overview/{identifier}                → profile + ratios,
 *     including a current `price` field (corroborates the candle close)
 *   GET /equity/incomestatement/{identifier}         → income statements
 *   (balance sheet + cash flow follow the same {identifier} shape)
 *
 * The current quote for a symbol is therefore derived from the LATEST candle:
 * real OHLC + a provider timestamp, so asOf/freshness stay honest.
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

      // Some Eulerpool plans return Twelve-Data-shaped error bodies on HTTP 200
      // ({ code, message, status: 'error' }) — notably when a per-minute quota
      // is exhausted. Classify them like the Twelve Data client does (§12).
      const errBody = data as { code?: number | string; message?: string; status?: unknown };
      if (errBody && typeof errBody === 'object' && errBody.status === 'error') {
        const message = String(errBody.message || 'Provider returned an error');
        if (errBody.code === 429 || /limit/i.test(message)) {
          lastError = new ProviderError(message, 'rate_limited', 429);
          if (attempt < maxRetries) continue;
          throw lastError;
        }
        if (errBody.code === 404 || /not found|invalid|unknown symbol/i.test(message)) {
          throw new ProviderError(message, 'bad_symbol', 404);
        }
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

/** ISO string for a parseable date, else null — never throws (§18: no invention). */
function safeIso(value: unknown): string | null {
  const ms = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
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
  // Provider timestamps vary (epoch ms, ISO, date-only) and can be junk — an
  // unparsable value means asOf is UNKNOWN, never a thrown error.
  const asOf = raw?.timestamp !== undefined && raw?.timestamp !== null ? safeIso(raw.timestamp) : null;
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
    // Periods can arrive in unexpected formats on live data — null beats a
    // thrown `Invalid time value` that would lose the WHOLE statement (§18).
    const period = safeIso(row?.period);
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

/**
 * Fetch the normalized current quote for a ticker/ISIN.
 *
 * Verified against the live API (2026-09): `/equity/quotes/{id}` is a
 * historical {timestamp, price} series (and frequently EMPTY for plain
 * tickers), so the quote is derived from the latest daily candle — real
 * OHLC, real provider timestamp, real previous close. `overview.price`
 * independently corroborates this value.
 */
export async function eulerpoolGetQuote(symbol: string, retrievedAt = new Date().toISOString()) {
  const candles = await eulerpoolGetCandles(symbol, '1m');
  const last = candles[candles.length - 1];
  if (!last) {
    throw new ProviderError(`No quote data for ${symbol}`, 'bad_symbol', 404);
  }
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
  return normalizeEulerpoolQuote(
    {
      ticker: symbol,
      price: last.close,
      open: last.open,
      high: last.high,
      low: last.low,
      previousClose: prev?.close,
      change: prev ? last.close - prev.close : undefined,
      changePercent:
        prev && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : undefined,
      volume: last.volume,
      timestamp: Date.parse(last.timestamp),
    },
    symbol,
    retrievedAt
  );
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
