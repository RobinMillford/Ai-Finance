/**
 * Market-data domain services (Phase 0).
 *
 * Thin, normalized operations over the provider client + cache so routes and
 * AI tools stop hand-rolling fetch/retry/cache and stop parsing raw provider
 * payloads differently. Provenance (`asOf`, provider) is preserved.
 *
 * Phase 0 scope: only the operations current features need. The interface is
 * intentionally narrow so Phase 1 can add candle persistence + deterministic
 * computation behind the same boundary.
 */

import { cached, quoteCache, catalogCache, historyCache, TTL, freshnessOf, FreshnessClass } from './cache';
import { twelveDataFetch, twelveDataUrl, quoteTtl } from './twelvedata';

export interface NormalizedQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  change: number | null;
  percentChange: number | null;
  volume: number | null;
  /** Provider data timestamp (ISO string when available). */
  asOf: string | null;
  provider: 'twelvedata';
  freshness: FreshnessClass;
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/** Normalize a Twelve Data /quote payload. */
export function normalizeQuote(raw: any, fallbackSymbol: string): NormalizedQuote {
  const asOf = raw?.datetime ? String(raw.datetime) : null;
  const asOfMs = asOf ? Date.parse(asOf) || null : null;
  return {
    symbol: raw?.symbol || fallbackSymbol,
    name: raw?.name,
    exchange: raw?.exchange,
    price: num(raw?.close ?? raw?.price),
    open: num(raw?.open),
    high: num(raw?.high),
    low: num(raw?.low),
    previousClose: num(raw?.previous_close),
    change: num(raw?.change),
    percentChange: num(raw?.percent_change),
    volume: num(raw?.volume),
    asOf,
    provider: 'twelvedata',
    freshness: freshnessOf(asOfMs),
  };
}

/** Get a normalized quote (cached; TTL respects market hours). */
export async function getQuote(symbol: string): Promise<NormalizedQuote> {
  const key = `quote:${symbol.toUpperCase()}`;
  const { value } = await cached(quoteCache, key, quoteTtl(), async () => {
    const raw = await twelveDataFetch<any>(twelveDataUrl('quote', { symbol }));
    // Wrap raw payload with a stamp so cached() can set dataAsOf correctly.
    return { __raw: raw, asOf: raw?.datetime ?? null };
  });
  const raw = (value as any).__raw;
  const quote = normalizeQuote(raw, symbol);
  if (quote.price === null && quote.change === null) {
    // Provider returned an empty/unknown-symbol-shaped body without an error code.
    throw Object.assign(new Error(`No quote data available for ${symbol}`), { kind: 'bad_symbol' });
  }
  return quote;
}

/** Raw daily time series (cached 12h). Returns provider `values` array. */
export async function getDailyHistory(symbol: string, outputsize = 5000): Promise<any[]> {
  const key = `history:${symbol.toUpperCase()}:${outputsize}`;
  const { value } = await cached(
    historyCache,
    key,
    TTL.HISTORY,
    async () => {
      const raw = await twelveDataFetch<any>(
        twelveDataUrl('time_series', { symbol, interval: '1day', outputsize })
      );
      if (!raw?.values) {
        throw Object.assign(new Error(`No time series data for ${symbol}`), { kind: 'bad_symbol' });
      }
      return raw.values;
    },
    Date.now()
  );
  return value as any[];
}

/** Asset catalogs (24h TTL). */
export async function getStockCatalog(): Promise<any[]> {
  const { value } = await cached(catalogCache, 'stocks:nyse,nasdaq', TTL.CATALOG, async () => {
    const all = new Map<string, any>();
    for (const exchange of ['NYSE', 'NASDAQ']) {
      try {
        const raw = await twelveDataFetch<any>(
          twelveDataUrl('stocks', { exchange, source: 'docs' })
        );
        if (raw?.status === 'ok' && Array.isArray(raw.data)) {
          for (const stock of raw.data) {
            if (!all.has(stock.symbol)) {
              all.set(stock.symbol, {
                symbol: stock.symbol,
                name: stock.name,
                currency: stock.currency,
                exchange: stock.exchange,
                country: stock.country,
                status: stock.type,
              });
            }
          }
        }
      } catch {
        // Continue with whatever other exchanges returned.
      }
    }
    return Array.from(all.values());
  });
  return value as any[];
}

export { freshnessOf } from './cache';
export { ProviderError } from './twelvedata';
