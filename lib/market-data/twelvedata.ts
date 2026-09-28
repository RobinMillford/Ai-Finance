/**
 * Twelve Data provider client (Phase 0 foundation).
 *
 * Centralizes the divergent fetch/retry implementations that existed across
 * routes and AI tools. Provides:
 *  - bounded global pacing (protects the free-tier ~8 req/min limit across
 *    concurrent users instead of per-route delays)
 *  - retry with backoff on 429 / transient failures
 *  - typed errors so routes map provider failures to honest HTTP codes
 *
 * Singleton module — safe for server-side use only (holds the API key).
 */

import { env } from '@/lib/env';

/** Twelve Data free tier is ~8 requests/minute; default pacing ≈ 7.6s. */
const DEFAULT_MIN_INTERVAL_MS = 7600;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 10_000;

/** Error types callers can branch on without string matching. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: 'rate_limited' | 'not_found' | 'bad_symbol' | 'unavailable' | 'unknown',
    public readonly status: number = 502
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

let lastRequestAt = 0;
let pendingDelay: Promise<void> = Promise.resolve();

/** Serialize + pace requests globally so concurrent callers share the budget. */
function pacedDelay(minIntervalMs: number): Promise<void> {
  const run = async () => {
    const now = Date.now();
    const wait = lastRequestAt + minIntervalMs - now;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  };
  pendingDelay = pendingDelay.then(run, run);
  return pendingDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface FetchOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  minIntervalMs?: number;
}

/**
 * Fetch a Twelve Data endpoint with pacing + retry.
 * Throws ProviderError with a typed kind on failure.
 */
export async function twelveDataFetch<T = any>(
  url: string,
  opts: FetchOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  } = opts;

  if (!env.twelveData.apiKey) {
    throw new ProviderError('Market data provider is not configured', 'unavailable', 503);
  }

  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await pacedDelay(minIntervalMs);
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        lastError = new ProviderError('Market data provider rate limit reached', 'rate_limited', 429);
        if (attempt < maxRetries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const kind = response.status === 404 ? 'not_found' : 'unavailable';
        throw new ProviderError(
          `Provider request failed (${response.status})`,
          kind,
          response.status === 404 ? 404 : 502
        );
      }

      const data = (await response.json()) as T & { status?: string; message?: string; code?: number };

      // Twelve Data signals errors inside a 200 body in several shapes.
      if (data && typeof data === 'object') {
        if (data.status === 'error' || data.code === 429 || data.code === 404) {
          const message = data.message || 'Provider returned an error';
          if (data.code === 429 || /limit/i.test(message)) {
            lastError = new ProviderError(message, 'rate_limited', 429);
            if (attempt < maxRetries) {
              await sleep(retryDelayMs * (attempt + 1));
              continue;
            }
            throw lastError;
          }
          if (data.code === 404 || /not found|invalid|unknown symbol/i.test(message)) {
            throw new ProviderError(message, 'bad_symbol', 404);
          }
          throw new ProviderError(message, 'unavailable', 502);
        }
      }

      return data;
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.kind === 'rate_limited' && attempt < maxRetries) {
          lastError = error;
          continue;
        }
        throw error;
      }
      // Network-level failure — retry, then surface as unavailable.
      lastError = new ProviderError(
        error instanceof Error ? error.message : 'Provider request failed',
        'unavailable',
        502
      );
      if (attempt < maxRetries) {
        await sleep(retryDelayMs);
        continue;
      }
    }
  }

  throw lastError ?? new ProviderError('Provider request failed', 'unavailable', 502);
}

/** Build a provider URL with the server-side key. */
export function twelveDataUrl(path: string, params: Record<string, string | number>): string {
  const search = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    apikey: env.twelveData.apiKey,
  });
  return `https://api.twelvedata.com/${path}?${search.toString()}`;
}

/** Is the US market open right now (heuristic: Mon–Fri 9:30–16:00 ET)? */
export function isUsMarketOpen(now = new Date()): boolean {
  // Approximate ET via UTC-5 (ignores DST by ±1h — adequate for TTL selection).
  const etHour = (now.getUTCHours() - 5 + 24) % 24;
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  return etHour >= 9 && (etHour < 16 || (etHour === 16 && now.getUTCMinutes() === 0));
}

/** Quote TTL depending on market state. */
export function quoteTtl(): number {
  return isUsMarketOpen() ? 5 * 60 * 1000 : 30 * 60 * 1000;
}
