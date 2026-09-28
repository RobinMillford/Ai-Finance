/**
 * Forex Catalog API
 *
 * Phase 0: migrated to the shared provider client (server-only key, global
 * pacing, typed errors). Provider failures no longer return HTTP 200 with an
 * empty payload — clients get honest error codes. Filtering/pagination and
 * response shape preserved (with a 24h cache keyed on the filter combo).
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { twelveDataFetch, twelveDataUrl, ProviderError } from '@/lib/market-data';
import { cached, catalogCache, TTL } from '@/lib/market-data/cache';

export const dynamic = 'force-dynamic';

interface ForexPair {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  base_currency: string;
  quote_currency: string;
}

async function loadForexPairs(): Promise<ForexPair[]> {
  const { value } = await cached(catalogCache, 'forex_pairs_all', TTL.CATALOG, async () => {
    const raw = await twelveDataFetch<any>(twelveDataUrl('forex_pairs', {}));
    const arr = Array.isArray(raw?.data) ? raw.data : [];
    return arr.map((pair: any) => ({
      symbol: pair.symbol,
      name: `${pair.currency_base} to ${pair.currency_quote}`,
      exchange: 'FOREX',
      status: pair.currency_group || 'Forex Pair',
      base_currency: pair.currency_base,
      quote_currency: pair.currency_quote,
    }));
  });
  return value as ForexPair[];
}

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = Math.min(parseInt(searchParams.get('perPage') || '50', 10), 500);
  const currencyGroup = searchParams.get('currencyGroup') || 'All';
  const searchQuery = searchParams.get('searchQuery') || '';

  try {
    let forexPairs = await loadForexPairs();

    // Server-side filters (existing behavior).
    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      forexPairs = forexPairs.filter(
        (pair) =>
          pair.symbol.toLowerCase().includes(lowerQuery) ||
          pair.name.toLowerCase().includes(lowerQuery) ||
          (pair.base_currency && pair.base_currency.toLowerCase().includes(lowerQuery)) ||
          (pair.quote_currency && pair.quote_currency.toLowerCase().includes(lowerQuery))
      );
    }
    if (currencyGroup !== 'All') {
      forexPairs = forexPairs.filter((pair) => pair.status === currencyGroup);
    }

    const totalCount = forexPairs.length;
    const start = (page - 1) * perPage;
    const paginatedPairs = forexPairs.slice(start, start + perPage);

    return NextResponse.json({ pairs: paginatedPairs, totalCount });
  } catch (error) {
    if (error instanceof ProviderError && error.kind === 'rate_limited') {
      return errorResponse('Market data provider is rate limited. Please try again shortly.', 429);
    }
    console.error('[Forexs] Error:', error);
    return errorResponse('Failed to fetch forex pairs', 502);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
