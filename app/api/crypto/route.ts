/**
 * Crypto Detail API
 *
 * Returns quote + price + EOD + short time series for a crypto pair.
 * Phase 0: migrated to the shared provider client (server-only key, global
 * pacing, typed errors). The four payloads now fetch without artificial
 * delays; quote goes through the normalized domain service. Response shape
 * preserved for the existing UI, plus `_meta` freshness.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import {
  twelveDataFetch,
  twelveDataUrl,
  ProviderError,
  getQuote,
  getDailyHistory,
} from '@/lib/market-data';
import { validateSymbol } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = validateSymbol(searchParams.get('symbol'));

  if (!symbol) {
    return errorResponse('Symbol parameter is required (e.g. BTC/USD)', 400);
  }

  try {
    // The quote is mandatory (provider/quote failure fails the request); the
    // other payloads degrade gracefully via `_meta.partial`.
    const [quote, priceResult, eodResult, historyResult] = await Promise.all([
      getQuote(symbol),
      twelveDataFetch<any>(twelveDataUrl('price', { symbol })).catch(() => null),
      twelveDataFetch<any>(twelveDataUrl('eod', { symbol })).catch(() => null),
      getDailyHistory(symbol, 10).catch(() => []),
    ]);

    if (!quote) {
      throw new ProviderError('No quote data available', 'unavailable', 502);
    }

    const normalizedQuote = quote;
    const priceData = priceResult;
    const eodData = eodResult;
    const historyValues = historyResult;

    // Preserve the existing response shape.
    const response = {
      timeSeries: {
        meta: {
          symbol: normalizedQuote.symbol,
          interval: '1day',
          currency_base: symbol.split('/')[0] || symbol,
          currency_quote: symbol.split('/')[1] || '',
          type: 'crypto',
        },
        values: historyValues,
        status: 'ok',
      },
      quote: {
        symbol: normalizedQuote.symbol,
        name: normalizedQuote.name || 'Unknown',
        currency_base: symbol.split('/')[0] || symbol,
        currency_quote: symbol.split('/')[1] || '',
        datetime: normalizedQuote.asOf || new Date().toISOString().split('T')[0],
        open: normalizedQuote.open ?? '0',
        high: normalizedQuote.high ?? '0',
        low: normalizedQuote.low ?? '0',
        close: normalizedQuote.price ?? '0',
        previous_close: normalizedQuote.previousClose ?? '0',
        change: normalizedQuote.change ?? '0',
        percent_change: normalizedQuote.percentChange ?? '0',
        volume: normalizedQuote.volume ?? '0',
      },
      price: {
        price: (priceData as any)?.price || '0',
      },
      eod: {
        symbol,
        currency_base: symbol.split('/')[0] || symbol,
        currency_quote: symbol.split('/')[1] || '',
        datetime: (eodData as any)?.datetime || new Date().toISOString().split('T')[0],
        close: (eodData as any)?.close || '0',
      },
      _meta: {
        asOf: normalizedQuote.asOf,
        freshness: normalizedQuote.freshness,
        partial:
          priceData === null || eodData === null || historyValues.length === 0,
      },
    };

    return NextResponse.json(response);
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
    console.error('[Crypto] Error for', symbol, error);
    return errorResponse('Failed to fetch crypto data', 500);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
