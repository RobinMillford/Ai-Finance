/**
 * Indicator service (Phase 0).
 *
 * Replaces the 7–8 sequential provider calls with 15s artificial delays that
 * made cold loads take ~2 minutes. Strategy:
 *
 *  - request ALL requested indicators once, in bounded parallel batches
 *    (pacing is enforced globally by the provider client, so concurrency
 *    stays within the provider's rate budget)
 *  - cache each indicator result for an hour (daily data does not change
 *    minute-to-minute)
 *  - per-indicator failure degrades gracefully: the aggregate returns the
 *    indicators that succeeded plus an `errors` map — never a fake success
 *  - the service is provider-shape-aware internally but returns a normal
 *    indicator-name → series shape so Phase 1 can swap the implementation to
 *    stored candles + deterministic math without changing callers
 */

import { TTLCache, TTL } from './cache';
import { twelveDataFetch, twelveDataUrl, ProviderError } from './twelvedata';

export type IndicatorName =
  | 'ema20'
  | 'ema50'
  | 'sma20'
  | 'sma50'
  | 'rsi'
  | 'macd'
  | 'bbands'
  | 'adx'
  | 'atr'
  | 'aroon'
  | 'obv'
  | 'supertrend'
  | 'ichimoku';

interface IndicatorSpec {
  /** Provider endpoint path. */
  path: string;
  params: Record<string, string | number>;
}

function buildSpec(name: IndicatorName, symbol: string): IndicatorSpec {
  const base = { symbol, interval: '1day', outputsize: 100 };
  switch (name) {
    case 'ema20':
      return { path: 'ema', params: { ...base, time_period: 20 } };
    case 'ema50':
      return { path: 'ema', params: { ...base, time_period: 50 } };
    case 'sma20':
      return { path: 'sma', params: { ...base, time_period: 20 } };
    case 'sma50':
      return { path: 'sma', params: { ...base, time_period: 50 } };
    case 'rsi':
      return { path: 'rsi', params: { ...base, time_period: 14 } };
    case 'macd':
      return {
        path: 'macd',
        params: { ...base, fast_period: 12, slow_period: 26, signal_period: 9 },
      };
    case 'bbands':
      return { path: 'bbands', params: { ...base, time_period: 20, sd: 2 } };
    case 'adx':
      return { path: 'adx', params: { ...base, time_period: 14 } };
    case 'atr':
      return { path: 'atr', params: { ...base, time_period: 14 } };
    case 'aroon':
      return { path: 'aroon', params: { ...base, time_period: 14 } };
    case 'obv':
      return { path: 'obv', params: { ...base } };
    case 'supertrend':
      return { path: 'supertrend', params: { ...base, multiplier: 3, period: 10 } };
    case 'ichimoku':
      return {
        path: 'ichimoku',
        params: {
          ...base,
          tenkan_period: 9,
          kijun_period: 26,
          senkou_span_b_period: 52,
          displacement: 26,
        },
      };
  }
}

const indicatorCache = new TTLCache(3000);

/** Bounded parallel map: run at most `limit` tasks at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { ok: true, value: await fn(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface IndicatorAggregate {
  indicators: Record<string, unknown>;
  /** Per-indicator failures that degraded the result. */
  errors: Record<string, string>;
  /** How many indicators are present vs requested. */
  complete: boolean;
  fetchedAt: number;
}

/**
 * Fetch multiple indicators for a symbol with caching + bounded concurrency.
 * Never throws for individual indicator failures — check `errors`/`complete`.
 * Throws ProviderError only if ALL indicators fail (caller decides HTTP code).
 */
export async function getIndicators(
  symbol: string,
  names: IndicatorName[]
): Promise<IndicatorAggregate> {
  const upper = symbol.toUpperCase();
  const indicators: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  // Cache lookups first; only fetch what is missing.
  const missing: IndicatorName[] = [];
  for (const name of names) {
    const key = `${upper}:${name}`;
    const hit = indicatorCache.get<unknown>(key);
    if (hit) {
      indicators[name] = hit.value;
    } else {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    // Concurrency 3 keeps bursts modest while removing the 15s serial waits.
    const results = await mapWithConcurrency(missing, 3, async (name) => {
      const spec = buildSpec(name, upper);
      return twelveDataFetch<any>(twelveDataUrl(spec.path, spec.params));
    });

    for (let i = 0; i < missing.length; i++) {
      const name = missing[i];
      const result = results[i];
      if (result.ok) {
        const data = result.value;
        // Provider returns {values: [...]} on success; error bodies were
        // already converted to ProviderError by the client.
        const values = data?.values ?? data ?? null;
        indicatorCache.set(`${upper}:${name}`, values, TTL.INDICATOR);
        indicators[name] = values;
      } else {
        const err = result.error;
        errors[name] =
          err instanceof ProviderError
            ? `${err.kind}: ${err.message}`
            : err instanceof Error
              ? err.message
              : 'unknown error';
      }
    }
  }

  const complete = names.every((n) => n in indicators);

  // Total failure: surface a typed error so the route can respond honestly.
  if (!complete && Object.keys(indicators).length === 0 && names.length > 0) {
    const first = Object.values(errors)[0] ?? 'no indicator data available';
    throw new ProviderError(`No indicators available for ${upper}: ${first}`, 'unavailable', 502);
  }

  return {
    indicators,
    errors,
    complete,
    fetchedAt: Date.now(),
  };
}

/**
 * Invalidate the indicator cache (ops hook: also usable by tests and a future
 * admin endpoint — cache invalidation support per the Phase 0 cache spec).
 */
export function clearIndicatorCache(): void {
  indicatorCache.clear();
}

/** Check cache state without fetching (used by routes for fast stale paths). */
export function peekIndicator(symbol: string, names: IndicatorName[]): boolean {
  const upper = symbol.toUpperCase();
  return names.every((n) => indicatorCache.get(`${upper}:${n}`) !== undefined);
}
