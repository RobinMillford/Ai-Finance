/**
 * Market Intelligence API
 *
 * Phase 0: uses the server-only Tavily key via lib/env (was
 * NEXT_PUBLIC_TAVILY_API_KEY), rate-limited, and validates the `type`
 * parameter.
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { env } from '@/lib/env';
import {
  getMarketIntelligence,
  getComprehensiveMarketOverview,
  getLatestNews,
  getGeopoliticalAnalysis,
  getMarketSentiment,
  getFundamentalAnalysis,
  getTechnicalAnalysis,
  getMacroeconomicAnalysis,
  getRegulatoryAnalysis,
  getMarketAlerts,
} from '@/lib/market-intelligence';
import { validateSymbol } from '@/lib/api-helpers';

const VALID_TYPES = new Set([
  'comprehensive',
  'news',
  'geopolitical',
  'sentiment',
  'fundamental',
  'technical',
  'macroeconomic',
  'regulatory',
  'alerts',
  'general',
]);

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = validateSymbol(searchParams.get('symbol'));
  const type = searchParams.get('type') || 'general';

  if (!env.tavily.apiKey) {
    return errorResponse('Market intelligence is not configured (TAVILY_API_KEY missing)', 500);
  }

  if (!symbol) {
    return errorResponse('Symbol is required', 400);
  }

  if (!VALID_TYPES.has(type)) {
    return errorResponse('Invalid type parameter', 400);
  }

  try {
    let result;
    switch (type) {
      case 'comprehensive':
        result = await getComprehensiveMarketOverview(symbol);
        break;
      case 'news':
        result = await getLatestNews(symbol);
        break;
      case 'geopolitical':
        result = await getGeopoliticalAnalysis(symbol);
        break;
      case 'sentiment':
        result = await getMarketSentiment(symbol);
        break;
      case 'fundamental':
        result = await getFundamentalAnalysis(symbol);
        break;
      case 'technical':
        result = await getTechnicalAnalysis(symbol);
        break;
      case 'macroeconomic':
        result = await getMacroeconomicAnalysis(symbol);
        break;
      case 'regulatory':
        result = await getRegulatoryAnalysis(symbol);
        break;
      case 'alerts':
        result = await getMarketAlerts(symbol);
        break;
      default:
        result = await getMarketIntelligence(symbol, type);
        break;
    }

    // Check if the result contains a rate limit error
    if (
      result &&
      typeof result === 'object' &&
      'error' in result &&
      typeof (result as any).error === 'string' &&
      (result as any).error.includes('Rate limit exceeded')
    ) {
      return NextResponse.json(result, { status: 429 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching market intelligence:', error);
    return errorResponse('Failed to fetch market intelligence', 502);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
