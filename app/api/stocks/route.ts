/**
 * Stock Catalog API
 *
 * Phase 0: migrated to the shared catalog service (24h cache, server-only
 * key, rate-limited). Response shape preserved.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { getStockCatalog, ProviderError } from '@/lib/market-data';

export const dynamic = 'force-dynamic';

async function handler() {
  try {
    const stocks = await getStockCatalog();
    if (stocks.length === 0) {
      return errorResponse('No stock listings available from the provider', 502);
    }
    return NextResponse.json(stocks);
  } catch (error) {
    if (error instanceof ProviderError && error.kind === 'rate_limited') {
      return errorResponse('Market data provider is rate limited. Please try again shortly.', 429);
    }
    console.error('[Stocks] Catalog error:', error);
    return errorResponse('Failed to fetch stock listings', 502);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
