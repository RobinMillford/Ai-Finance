/**
 * Crypto Technical Indicators API
 *
 * Phase 0: replaced 8 sequential provider calls with 16-second artificial
 * delays with the shared indicator service — bounded parallel fetch,
 * per-indicator caching (1h), and graceful per-indicator degradation.
 * Response shape is preserved for the existing UI, plus `_meta` freshness.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { getIndicators, ProviderError } from '@/lib/market-data';
import { validateSymbol } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const INDICATORS = [
  'ema20',
  'ema50',
  'rsi',
  'macd',
  'bbands',
  'adx',
  'atr',
  'obv',
  'supertrend',
] as const;

async function getCryptoIndicatorsHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = validateSymbol(searchParams.get('symbol'));

  if (!symbol) {
    return errorResponse('Symbol parameter is required (e.g. BTC/USD)', 400);
  }

  try {
    const aggregate = await getIndicators(symbol, [...INDICATORS]);

    const indicatorsData = {
      ema: {
        ema20: (aggregate.indicators.ema20 as any) ?? null,
        ema50: (aggregate.indicators.ema50 as any) ?? null,
      },
      rsi: (aggregate.indicators.rsi as any) ?? null,
      macd: (aggregate.indicators.macd as any) ?? null,
      bbands: (aggregate.indicators.bbands as any) ?? null,
      atr: (aggregate.indicators.atr as any) ?? null,
      obv: (aggregate.indicators.obv as any) ?? null,
      supertrend: (aggregate.indicators.supertrend as any) ?? null,
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
    console.error('[CryptoIndicators] Error for', symbol, error);
    return errorResponse('Failed to fetch technical indicators', 500);
  }
}

// Phase 0: expensive provider fan-out — rate limited (60/min per client).
export const GET = withRateLimit(getCryptoIndicatorsHandler, RATE_LIMITS.MARKET_DATA);
