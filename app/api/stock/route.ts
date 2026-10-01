/**
 * Stock Data API
 *
 * Returns time series + quote + price + EOD for a symbol.
 * Phase 0: migrated to the shared market-data domain service (server-only
 * key, paced provider access, cached history) instead of a local
 * fetch/retry implementation reading a NEXT_PUBLIC key.
 * Response shape is preserved for the existing UI.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { twelveDataFetch, twelveDataUrl, ProviderError, getQuote, getDailyHistory } from '@/lib/market-data';
import { validateSymbol } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

async function getStockData(symbol: string) {
  // History is the long pole; fetch it via the cached domain service and the
  // remaining small payloads in parallel afterwards.
  const timeSeriesValues = await getDailyHistory(symbol, 5000);

  const [quoteResult, priceResult, eodResult] = await Promise.allSettled([
    getQuote(symbol),
    twelveDataFetch<any>(twelveDataUrl('price', { symbol })),
    twelveDataFetch<any>(twelveDataUrl('eod', { symbol })),
  ]);

  const quoteRaw = quoteResult.status === 'fulfilled' ? (quoteResult.value as any) : null;
  const priceData = priceResult.status === 'fulfilled' ? priceResult.value : null;
  const eodData = eodResult.status === 'fulfilled' ? eodResult.value : null;

  // Preserve the raw provider shape the UI expects (timeSeries.values etc.),
  // while normalizing the quote portion and adding freshness metadata.
  return {
    timeSeries: {
      meta: { symbol: quoteRaw?.symbol || symbol, interval: '1day' },
      values: timeSeriesValues,
      status: 'ok',
    },
    quote: quoteRaw
      ? {
          ...quoteRaw,
          price: quoteRaw.price ?? quoteRaw.close ?? null,
          freshness: (quoteRaw as any).freshness,
          asOf: (quoteRaw as any).asOf,
        }
      : null,
    price: priceData,
    eod: eodData,
    _meta: {
      asOf: (quoteRaw as any)?.asOf ?? new Date().toISOString(),
      partial: quoteResult.status !== 'fulfilled' || priceResult.status !== 'fulfilled' || eodResult.status !== 'fulfilled',
    },
  };
}

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = validateSymbol(searchParams.get('symbol'));

  if (!symbol) {
    return errorResponse('Symbol parameter is required', 400);
  }

  try {
    const stockData = await getStockData(symbol);
    return NextResponse.json(stockData);
  } catch (error) {
    if ((error as any)?.kind === 'bad_symbol') {
      return errorResponse('Symbol not found or unsupported', 404);
    }
    if (error instanceof ProviderError) {
      if (error.kind === 'bad_symbol') {
        return errorResponse('Symbol not found or unsupported', 404);
      }
      if (error.kind === 'rate_limited') {
        return errorResponse('Market data provider is rate limited. Please try again shortly.', 429);
      }
      return errorResponse('Market data provider is unavailable. Please try again later.', 502);
    }
    console.error('[Stock] Error for', symbol, error);
    return errorResponse('Failed to fetch stock data', 500);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
