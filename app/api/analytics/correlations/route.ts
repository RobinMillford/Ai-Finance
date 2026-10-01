import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { getCandles } from '@/lib/market-data/candles';
import { correlationBetweenPrices } from '@/lib/analytics/engine';
import type { PricePoint } from '@/lib/analytics/engine';

/**
 * GET /api/analytics/correlations?symbols=AAPL,MSFT&days=180
 *
 * REAL pairwise correlations computed from persisted daily candles via the
 * deterministic analytics engine. No synthetic data: a pair with insufficient
 * overlap returns `correlation: null` (explicitly unavailable, never a guess).
 */
async function getCorrelations(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols') ?? '';
    const days = Math.min(Math.max(Number(searchParams.get('days')) || 180, 30), 400);

    const symbols = [
      ...new Set(
        symbolsParam
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^[A-Z0-9.\-=:]{1,20}$/.test(s))
      ),
    ].slice(0, 12); // cap cost: 12 symbols → ≤66 pairs

    if (symbols.length < 2) {
      return errorResponse('At least 2 valid symbols required', 400);
    }

    // Fetch series per symbol (storage-first; registry handles providers).
    const seriesMap = new Map<string, PricePoint[]>();
    await Promise.all(
      symbols.map(async (symbol) => {
        const assetType: 'stock' | 'crypto' | 'forex' = symbol.includes('-') || symbol.includes('=')
          ? symbol.includes(':')
            ? 'forex'
            : 'crypto'
          : 'stock';
        try {
          const { candles } = await getCandles(symbol, assetType, { days });
          seriesMap.set(
            symbol,
            candles.map((c) => ({ timestamp: c.timestamp, price: c.close }))
          );
        } catch {
          // Leave the symbol out — pairs involving it report unavailable.
        }
      })
    );

    const correlations: {
      a: string;
      b: string;
      correlation: number | null;
      observations: number;
    }[] = [];

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const a = seriesMap.get(symbols[i]);
        const b = seriesMap.get(symbols[j]);
        if (!a || !b) {
          correlations.push({
            a: symbols[i],
            b: symbols[j],
            correlation: null,
            observations: 0,
          });
          continue;
        }
        const r = correlationBetweenPrices(a, b);
        correlations.push({
          a: symbols[i],
          b: symbols[j],
          correlation: r.correlation,
          observations: r.observations,
        });
      }
    }

    return NextResponse.json({
      symbols,
      correlations,
      seriesAvailable: [...seriesMap.keys()],
      seriesMissing: symbols.filter((s) => !seriesMap.has(s)),
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error computing correlations:', error);
    return errorResponse('Failed to compute correlations', 500);
  }
}

export const GET = withRateLimit(getCorrelations, RATE_LIMITS.API_DEFAULT);
