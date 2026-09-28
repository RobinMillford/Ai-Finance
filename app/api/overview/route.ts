/**
 * Overview API (company/crypto logos)
 *
 * Phase 0: migrated to the shared provider client (server-only key, global
 * pacing) and rate-limited. Response shape preserved.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { twelveDataFetch, twelveDataUrl, ProviderError } from '@/lib/market-data';
import { cached, catalogCache, TTL } from '@/lib/market-data/cache';
import { validateSymbol } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = validateSymbol(searchParams.get('symbol'));

  if (!symbol) {
    return errorResponse('Symbol parameter is required', 400);
  }

  try {
    const { value } = await cached(catalogCache, `logo:${symbol}`, TTL.CATALOG, async () => {
      let logoData = { url: null as string | null, logo_base: null as string | null, logo_quote: null as string | null };
      try {
        const raw = await twelveDataFetch<any>(twelveDataUrl('logo', { symbol }));
        if (raw?.url) {
          logoData.url = raw.url;
        } else if (raw?.logo_base && raw?.logo_quote) {
          logoData.logo_base = raw.logo_base;
          logoData.logo_quote = raw.logo_quote;
        }
      } catch {
        // Logos are decorative — absence is not an error condition.
      }
      return logoData;
    });

    return NextResponse.json({
      logo: (value as any).url,
      logo_base: (value as any).logo_base,
      logo_quote: (value as any).logo_quote,
    });
  } catch (error) {
    if (error instanceof ProviderError && error.kind === 'rate_limited') {
      return errorResponse('Market data provider is rate limited. Please try again shortly.', 429);
    }
    console.error('[Overview] Error for', symbol, error);
    return errorResponse('Failed to fetch overview data', 500);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
