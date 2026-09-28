/**
 * Crypto Catalog API
 *
 * Phase 0: migrated to the shared provider client (server-only key, global
 * pacing, typed errors) with a 24h catalog cache; symbol lookup path reuses
 * the domain quote service. Debug logging of full payloads removed.
 * Response shape preserved.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { twelveDataFetch, twelveDataUrl, ProviderError, getQuote, getStockCatalog } from '@/lib/market-data';
import { cached, catalogCache, TTL } from '@/lib/market-data/cache';
import { validateSymbol } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

interface CryptoPair {
  symbol: string;
  available_exchanges: string[];
  currency_base: string;
  currency_quote: string;
}

/** Extract the pair array from any of the provider's response shapes. */
function extractPairs(data: any): CryptoPair[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.values)) return data.values;
    const firstKey = Object.keys(data)[0];
    if (firstKey && Array.isArray(data[firstKey]) && firstKey !== 'count' && firstKey !== 'status') {
      return data[firstKey];
    }
  }
  throw new Error('Unexpected cryptocurrency catalog response shape');
}

async function loadCryptoCatalog(): Promise<CryptoPair[]> {
  const { value } = await cached(catalogCache, 'crypto_list', TTL.CATALOG, async () => {
    const raw = await twelveDataFetch<any>(twelveDataUrl('cryptocurrencies', {}));
    const pairs = extractPairs(raw);
    const seen = new Set<string>();
    return pairs.filter((pair: CryptoPair) => {
      if (seen.has(pair.symbol)) return false;
      seen.add(pair.symbol);
      return true;
    });
  });
  return value as CryptoPair[];
}

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    const cryptoPairs = await loadCryptoCatalog();

    // Symbol detail path: validate against the catalog, then live quote.
    if (symbol) {
      const trimmed = validateSymbol(symbol);
      if (!trimmed) {
        return errorResponse('Invalid symbol parameter', 400);
      }
      const pair = cryptoPairs.find((p) => p.symbol.toUpperCase() === trimmed);
      if (!pair) {
        return errorResponse(`Cryptocurrency pair ${symbol} is not supported`, 404);
      }

      const quote = await getQuote(trimmed);
      return NextResponse.json({
        symbol: pair.symbol,
        currency_base: pair.currency_base,
        currency_quote: pair.currency_quote,
        available_exchanges: pair.available_exchanges,
        price: quote.price,
        percent_change: quote.percentChange,
        asOf: quote.asOf,
        freshness: quote.freshness,
      });
    }

    return NextResponse.json(cryptoPairs);
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.kind === 'rate_limited') {
        return errorResponse('Market data provider is rate limited. Please try again shortly.', 429);
      }
      if (error.kind === 'bad_symbol') {
        return errorResponse('Symbol not found or unsupported', 404);
      }
      return errorResponse('Market data provider is unavailable. Please try again later.', 502);
    }
    console.error('[Cryptos] Error:', error);
    return errorResponse('Failed to fetch cryptocurrency pairs', 502);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
