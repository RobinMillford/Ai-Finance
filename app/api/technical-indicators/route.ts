/**
 * Stock Technical Indicators API
 *
 * Phase 0: replaced 7 sequential provider calls with 15-second artificial
 * delays (~2-minute cold loads) with the shared indicator service — bounded
 * parallel fetch, per-indicator caching (1h), and graceful per-indicator
 * degradation. Response shape is preserved for the existing UI, with the
 * addition of `_meta` freshness info.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { getIndicators, ProviderError } from '@/lib/market-data';
import { validateSymbol } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

async function getIndicatorsHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = validateSymbol(searchParams.get('symbol'));

  if (!symbol) {
    return errorResponse('Symbol parameter is required (alphanumeric, e.g. AAPL)', 400);
  }

  try {
    const aggregate = await getIndicators(symbol, [
      'ema20',
      'ema50',
      'rsi',
      'macd',
      'bbands',
      'adx',
      'atr',
      'aroon',
    ]);

    // Preserve the existing response shape consumed by the UI.
    const indicatorsData = {
      ema: {
        ema20: (aggregate.indicators.ema20 as any) ?? null,
        ema50: (aggregate.indicators.ema50 as any) ?? null,
      },
      rsi: (aggregate.indicators.rsi as any) ?? null,
      macd: (aggregate.indicators.macd as any) ?? null,
      bbands: (aggregate.indicators.bbands as any) ?? null,
      adx: (aggregate.indicators.adx as any) ?? null,
      atr: (aggregate.indicators.atr as any) ?? null,
      aroon: (aggregate.indicators.aroon as any) ?? null,
      // Phase 0 freshness metadata (additive; existing fields untouched).
      _meta: {
        asOf: new Date(aggregate.fetchedAt).toISOString(),
        complete: aggregate.complete,
        errors: aggregate.errors,
      },
    };

    return NextResponse.json(indicatorsData);
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.kind === 'bad_symbol') {
        return errorResponse('Symbol not found or unsupported', 404);
      }
      if (error.kind === 'rate_limited') {
        return errorResponse('Market data provider is rate limited. Please try again shortly.', 429);
      }
      return errorResponse('Market data provider is unavailable. Please try again later.', 502);
    }
    console.error('[Indicators] Error for', symbol, error);
    return errorResponse('Failed to fetch technical indicators', 500);
  }
}

// Phase 0: expensive provider fan-out — rate limited (60/min per client).
export const GET = withRateLimit(getIndicatorsHandler, RATE_LIMITS.MARKET_DATA);
