/**
 * Social Sentiment Tools
 * 
 * Tools for analyzing social sentiment from Reddit and other platforms
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Tool: Get Reddit Sentiment
 * Fetches social sentiment analysis from Reddit for a cryptocurrency
 */
export const getRedditSentimentTool = new DynamicStructuredTool({
  name: "get_reddit_sentiment",
  description:
    "Analyzes social sentiment from Reddit crypto communities for a specific cryptocurrency. " +
    "Returns bullish/bearish percentages, post count, and overall sentiment. " +
    "Use this when users ask about community sentiment, social trends, or FOMO/FUD.",
  schema: z.object({
    symbol: z.string().describe(
      "Cryptocurrency symbol (e.g., 'BTC/USD', 'ETH/USD'). " +
      "Will be normalized to base currency (BTC, ETH, etc.)"
    ),
  }),
  func: async ({ symbol }) => {
    try {
      // Normalize symbol to base currency (BTC/USD -> BTC)
      const baseCurrency = symbol.split("/")[0].toUpperCase();
      
      // Call internal API endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/reddit?symbol=${baseCurrency}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      
      if (!response.ok) {
        // Graceful degradation if Reddit API fails
        return JSON.stringify({
          symbol: baseCurrency,
          sentiment: "unavailable",
          message: "Reddit sentiment data temporarily unavailable",
        });
      }
      
      const data = await response.json();
      
      return JSON.stringify({
        symbol: baseCurrency,
        bullish_percentage: data.bullish_percentage || 0,
        bearish_percentage: data.bearish_percentage || 0,
        neutral_percentage: data.neutral_percentage || 0,
        total_posts: data.total_posts || 0,
        overall_sentiment: data.overall_sentiment || "neutral",
        confidence: data.confidence || "low",
        analysis: data.analysis || "No detailed analysis available",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Return graceful error that won't break the agent
      return JSON.stringify({
        symbol: symbol.split("/")[0],
        sentiment: "error",
        message: error instanceof Error ? error.message : "Failed to fetch sentiment",
      });
    }
  },
});

/**
 * Export all social sentiment tools
 */
export const socialTools = [
  getRedditSentimentTool,
];
