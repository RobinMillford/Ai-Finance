/**
 * Provider registry + deterministic fallback (Phase 1).
 *
 * Domain code calls `getQuoteFor` / `getCandlesFor` and NEVER names a
 * provider. The registry encodes the canonical-source policy per data class:
 *
 *   | Data class        | Canonical     | Fallback    | Then           |
 *   |-------------------|---------------|-------------|----------------|
 *   | quote (equity)    | Twelve Data   | Eulerpool   | cached stale   |
 *   | candles (equity)  | Eulerpool     | Twelve Data | persisted/db   |
 *   | company profile   | Eulerpool     | Twelve Data | —              |
 *   | fundamentals      | Eulerpool     | Twelve Data | —              |
 *   | crypto/forex      | Twelve Data   | Eulerpool   | cached stale   |
 *
 * Fallback is DETERMINISTIC per data class (never random), provenance is
 * always preserved, and providers are never silently mixed: the returned
 * object states which provider produced it.
 */

import { ProviderError, twelveDataFetch, twelveDataUrl, quoteTtl } from './twelvedata';
import {
  eulerpoolFetch,
  eulerpoolGetCandles,
  eulerpoolGetQuote,
  eulerpoolGetCompany,
  isEulerpoolConfigured,
} from './eulerpool';
import { cached, quoteCache, TTL, freshnessOf } from './cache';
import { normalizeQuote } from './service';
import type { Candle, Company, Quote, DataClass } from './domain';

export { ProviderError };

/** Lightweight provider health tracking (§26) — no full observability stack. */
export const providerHealth = {
  twelvedata: { success: 0, failure: 0, rateLimited: 0, fallbacksUsed: 0, totalLatencyMs: 0 },
  eulerpool: { success: 0, failure: 0, rateLimited: 0, fallbacksUsed: 0, totalLatencyMs: 0 },
} as const;

type HealthKey = keyof typeof providerHealth;

function recordHealth(
  provider: HealthKey,
  outcome: 'success' | 'failure' | 'rate_limited',
  startedAt: number
): void {
  const entry = providerHealth[provider] as unknown as {
    success: number; failure: number; rateLimited: number; totalLatencyMs: number;
  };
  if (outcome === 'success') entry.success += 1;
  else if (outcome === 'rate_limited') entry.rateLimited += 1;
  else entry.failure += 1;
  entry.totalLatencyMs += Date.now() - startedAt;
}

function isProviderErrorWithKind(error: unknown, ...kinds: string[]): boolean {
  return (
    error instanceof ProviderError &&
    kinds.includes(error.kind)
  );
}

/**
 * Run an operation against Twelve Data, then Eulerpool on failure.
 * Falls back ONLY for transient/unavailability errors — a bad symbol is
 * genuinely a bad symbol on both providers for the same data class, so
 * bad_symbol propagates immediately (avoids pointless double quota spend).
 */
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: (() => Promise<T>) | null,
  context: string
): Promise<T> {
  const started = Date.now();
  try {
    const result = await primary();
    recordHealth('twelvedata', 'success', started);
    return result;
  } catch (error) {
    if (isProviderErrorWithKind(error, 'bad_symbol', 'not_found')) {
      recordHealth('twelvedata', 'failure', started);
      throw error;
    }
    recordHealth(
      'twelvedata',
      isProviderErrorWithKind(error, 'rate_limited') ? 'rate_limited' : 'failure',
      started
    );
    if (!fallback || !isEulerpoolConfigured()) {
      throw error;
    }
    const fbStarted = Date.now();
    try {
      const result = await fallback();
      recordHealth('eulerpool', 'success', fbStarted);
      (providerHealth.twelvedata as unknown as { fallbacksUsed: number }).fallbacksUsed += 1;
      return result;
    } catch (fallbackError) {
      recordHealth(
        'eulerpool',
        isProviderErrorWithKind(fallbackError, 'rate_limited') ? 'rate_limited' : 'failure',
        fbStarted
      );
      // Surface the PRIMARY failure; fallback failure adds context.
      if (fallbackError instanceof ProviderError && fallbackError.kind === 'rate_limited') {
        throw new ProviderError(
          `${context}: primary failed and fallback is rate limited`,
          'rate_limited',
          429
        );
      }
      throw error;
    }
  }
}

/** Run an Eulerpool-primary operation with optional Twelve Data fallback. */
async function withEulerpoolPrimary<T>(
  primary: () => Promise<T>,
  fallback: (() => Promise<T>) | null,
  context: string
): Promise<T> {
  if (!isEulerpoolConfigured()) {
    // Eulerpool not configured → straight to Twelve Data (deterministic).
    if (!fallback) throw new ProviderError(`${context}: no provider configured`, 'unavailable', 503);
    const started = Date.now();
    try {
      const result = await fallback();
      recordHealth('twelvedata', 'success', started);
      return result;
    } catch (error) {
      recordHealth('twelvedata', 'failure', started);
      throw error;
    }
  }
  const started = Date.now();
  try {
    const result = await primary();
    recordHealth('eulerpool', 'success', started);
    return result;
  } catch (error) {
    if (isProviderErrorWithKind(error, 'bad_symbol', 'not_found')) {
      recordHealth('eulerpool', 'failure', started);
      throw error;
    }
    recordHealth(
      'eulerpool',
      isProviderErrorWithKind(error, 'rate_limited') ? 'rate_limited' : 'failure',
      started
    );
    if (!fallback) throw error;
    const fbStarted = Date.now();
    try {
      const result = await fallback();
      recordHealth('twelvedata', 'success', fbStarted);
      (providerHealth.eulerpool as unknown as { fallbacksUsed: number }).fallbacksUsed += 1;
      return result;
    } catch (fallbackError) {
      recordHealth(
        'twelvedata',
        isProviderErrorWithKind(fallbackError, 'rate_limited') ? 'rate_limited' : 'failure',
        fbStarted
      );
      throw error;
    }
  }
}

// ── Public registry API ──────────────────────────────────────────────────────

/** Canonical policy lookup (documented in PROVIDER_POLICY.md). */
export const CANONICAL_SOURCES: Record<DataClass, 'twelvedata' | 'eulerpool'> = {
  quote: 'twelvedata',
  candles: 'eulerpool',
  company: 'eulerpool',
  fundamentals: 'eulerpool',
  valuation: 'eulerpool',
};

/** Twelve Data quote attempt (normalized). */
async function twelveDataQuote(symbol: string): Promise<Quote> {
  const raw = await twelveDataFetch<any>(twelveDataUrl('quote', { symbol }));
  const quote = normalizeQuote(raw, symbol);
  if (quote.price === null && quote.change === null) {
    throw new ProviderError(`No quote data for ${symbol}`, 'bad_symbol', 404);
  }
  return {
    ...quote,
    changePercent: quote.percentChange,
    currency: (raw as any)?.currency,
    retrievedAt: new Date().toISOString(),
  } as Quote;
}

/** Eulerpool quote attempt (normalized to the same Quote shape). */
async function eulerpoolQuote(symbol: string): Promise<Quote> {
  const retrievedAt = new Date().toISOString();
  const q = await eulerpoolGetQuote(symbol, retrievedAt);
  if (q.price === null && q.change === null) {
    throw new ProviderError(`No quote data for ${symbol}`, 'bad_symbol', 404);
  }
  return q as Quote;
}

/**
 * Current quote with policy: Twelve Data → Eulerpool → cached-stale.
 * Cross-provider differences are NOT merged — provenance says who won.
 */
export async function getQuoteFor(symbol: string): Promise<Quote> {
  const key = `quote:${symbol.toUpperCase()}`;
  try {
    const quote = await withFallback(
      () => twelveDataQuote(symbol),
      () => eulerpoolQuote(symbol),
      `quote:${symbol}`
    );
    // Persist for the cached-stale last resort (policy step 3). Store the
    // normalized Quote with its provenance — never raw provider payloads.
    quoteCache.set(key, quote, quoteTtl(), quote.asOf ? Date.parse(quote.asOf) || Date.now() : Date.now());
    return quote;
  } catch (error) {
    // Last resort per policy: cached data, explicitly labeled stale.
    const stale = quoteCache.getStale<Quote>(key);
    if (stale?.value) {
      return { ...stale.value, freshness: 'stale', retrievedAt: new Date().toISOString() };
    }
    throw error;
  }
}

/** Twelve Data candles attempt (daily time series → Candle[]). */
async function twelveDataCandles(symbol: string, outputsize: number): Promise<Candle[]> {
  const raw = await twelveDataFetch<any>(
    twelveDataUrl('time_series', { symbol, interval: '1day', outputsize })
  );
  if (!raw?.values?.length) {
    throw new ProviderError(`No time series for ${symbol}`, 'bad_symbol', 404);
  }
  return (raw.values as any[]).map((row) => ({
    symbol: symbol.toUpperCase(),
    timestamp: new Date(row.datetime).toISOString(),
    open: parseFloat(row.open),
    high: parseFloat(row.high),
    low: parseFloat(row.low),
    close: parseFloat(row.close),
    volume: row.volume !== undefined && row.volume !== '' ? parseInt(row.volume, 10) : null,
    interval: '1day' as const,
    adjustmentMode: 'unknown' as const,
    provider: 'twelvedata' as const,
  }));
}

/**
 * Historical candles with policy: Eulerpool → Twelve Data.
 * Persisted storage is layered ON TOP by the candle service (Phase 1 §39):
 * callers should prefer `candles.ts` `getCandles` which consults storage first.
 */
export async function getCandlesFromProviders(
  symbol: string,
  opts: { outputsize?: number; range?: '1m' | '3m' | '6m' | '1y' | '2y' | '5y' | 'max' } = {}
): Promise<Candle[]> {
  const { outputsize = 5000, range = '1y' } = opts;
  return withEulerpoolPrimary(
    () => eulerpoolGetCandles(symbol, range),
    () => twelveDataCandles(symbol, outputsize),
    `candles:${symbol}`
  );
}

/** Company profile with policy: Eulerpool → Twelve Data (symbol catalog fallback). */
export async function getCompanyFor(symbol: string): Promise<Company> {
  return withEulerpoolPrimary(
    async () => {
      const retrievedAt = new Date().toISOString();
      return eulerpoolGetCompany(symbol, retrievedAt);
    },
    async () => {
      // Twelve Data /profile equivalent: use quote payload metadata (name,
      // exchange) as a minimal Company — sufficient for fallback rendering.
      const quote = await twelveDataQuote(symbol);
      const retrievedAt = new Date().toISOString();
      return {
        symbol: quote.symbol,
        name: quote.name || quote.symbol,
        exchange: quote.exchange,
        currency: quote.currency,
        asOf: quote.asOf,
        retrievedAt,
        provider: 'twelvedata',
      };
    },
    `company:${symbol}`
  );
}

/** Test hook: clear quote cache between tests. */
export function clearQuoteCache(): void {
  quoteCache.clear();
}

export { freshnessOf, TTL };
