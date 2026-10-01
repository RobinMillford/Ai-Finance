/**
 * Reddit Sentiment API
 *
 * Phase 0: the implementation moved to lib/social/reddit.ts so the domain
 * logic can be reused directly (e.g., by AI tools) without the self-HTTP hop.
 * This route keeps the exact request contract, caching, and response shape
 * it had before. Rate-limited (previously unauthenticated + unlimited).
 */

import { NextResponse } from 'next/server';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { TTLCache } from '@/lib/market-data/cache';
import { getRedditSentiment, emptySentimentResult } from '@/lib/social/reddit';
import { validateSymbol } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

// 5-minute cache, bounded (replaces the unbounded per-route Map).
const redditCache = new TTLCache(500);
const CACHE_DURATION = 5 * 60 * 1000;

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = validateSymbol(searchParams.get('symbol'));

  if (!symbol) {
    return errorResponse('Symbol parameter is required', 400);
  }

  const cacheKey = `reddit_${symbol}`;
  const cachedData = redditCache.get(cacheKey);
  if (cachedData) {
    return NextResponse.json(cachedData.value);
  }

  try {
    const result = await getRedditSentiment(symbol);
    redditCache.set(cacheKey, result, CACHE_DURATION);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Reddit] Error processing data for symbol:', symbol, error);
    // Preserve today's behavior: a valid empty response instead of a hard error.
    const fallback = emptySentimentResult(symbol);
    redditCache.set(cacheKey, fallback, CACHE_DURATION);
    return NextResponse.json(fallback);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.REDDIT);
