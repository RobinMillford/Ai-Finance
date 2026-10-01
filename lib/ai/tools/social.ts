/**
 * Social Sentiment Tools
 *
 * Phase 0: the tool now calls the Reddit sentiment domain service directly
 * (lib/social/reddit.ts) instead of making an HTTP request to the app's own
 * /api/reddit route — removing the self-HTTP hop, the NEXT_PUBLIC_BASE_URL
 * dependence, and localhost fragility.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getRedditSentiment } from '@/lib/social/reddit';

/**
 * Tool: Get Reddit Sentiment
 * Fetches social sentiment analysis from Reddit for a symbol
 */
export const getRedditSentimentTool = new DynamicStructuredTool({
  name: 'get_reddit_sentiment',
  description:
    'Analyzes social sentiment from Reddit financial communities for a specific asset ' +
    '(crypto, stock, or forex pair). Returns bullish/bearish percentages, post count, ' +
    'and overall sentiment. Use this when users ask about community sentiment, social ' +
    'trends, or FOMO/FUD.',
  schema: z.object({
    symbol: z
      .string()
      .describe(
        "Asset symbol (e.g., 'BTC/USD', 'AAPL', 'EURUSD'). " +
          'Will be normalized to its base form (BTC, AAPL, EURUSD).'
      ),
  }),
  func: async ({ symbol }) => {
    try {
      // Normalize to the service's expected form:
      // - crypto "BTC/USD" → "BTCUSD" (6-char forex-style matching works for pairs)
      // - stocks stay as-is ("AAPL")
      let normalized = symbol.trim().toUpperCase();
      if (normalized.includes('/')) {
        normalized = normalized.split('/').join('');
      }

      const data = await getRedditSentiment(normalized);

      if (data.total_posts === 0) {
        return JSON.stringify({
          symbol: normalized,
          sentiment: 'unavailable',
          message: 'No recent Reddit discussions found for this symbol',
        });
      }

      return JSON.stringify({
        symbol: normalized,
        bullish_percentage: data.bullish_percentage,
        bearish_percentage: data.bearish_percentage,
        neutral_percentage: data.neutral_percentage,
        total_posts: data.total_posts,
        overall_sentiment: data.overall_sentiment,
        confidence: data.confidence,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Return graceful error that won't break the agent
      return JSON.stringify({
        symbol,
        sentiment: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch sentiment',
      });
    }
  },
});

/**
 * Export all social sentiment tools
 */
export const socialTools = [getRedditSentimentTool];
