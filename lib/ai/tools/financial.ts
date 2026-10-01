/**
 * Financial Tools
 *
 * Tools for fetching cryptocurrency prices and technical indicators
 * from Twelve Data API.
 *
 * Phase 0: uses the shared provider client (server-only key, global pacing,
 * typed errors) instead of a local fetch/retry implementation. Per-tool
 * 5-minute cache preserved.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { twelveDataFetch, twelveDataUrl } from "@/lib/market-data";
import { TTLCache } from "@/lib/market-data/cache";

// Cache for API responses (5 minutes)
const cache = new TTLCache(500);
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Tool: Get Cryptocurrency Price
 * Fetches real-time quote data for a crypto symbol
 */
export const getCryptoPriceTool = new DynamicStructuredTool({
  name: "get_crypto_price",
  description: 
    "Fetches real-time cryptocurrency price data including current price, " +
    "change, change percentage, and volume. Use this for price queries.",
  schema: z.object({
    symbol: z.string().describe(
      "Cryptocurrency symbol (e.g., 'BTC/USD', 'ETH/USD', 'ADA/USD')"
    ),
  }),
  func: async ({ symbol }) => {
    const cacheKey = `quote_${symbol.toUpperCase()}`;
    const cached = cache.get<any>(cacheKey);

    // Return cached data if valid
    if (cached) {
      return JSON.stringify({
        cached: true,
        ...cached.value,
      });
    }

    try {
      const data = await twelveDataFetch<any>(twelveDataUrl("quote", { symbol }));

      // Cache the response
      cache.set(cacheKey, data, CACHE_DURATION);

      return JSON.stringify({
        symbol: data.symbol,
        name: data.name,
        price: data.close || data.price,
        change: data.change,
        change_percent: data.percent_change,
        volume: data.volume,
        timestamp: data.datetime,
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch price data",
        symbol,
      });
    }
  },
});

/**
 * Tool: Get Technical Indicators
 * Fetches technical analysis indicators (RSI, MACD, EMA, etc.)
 */
export const getTechnicalIndicatorsTool = new DynamicStructuredTool({
  name: "get_technical_indicators",
  description:
    "Fetches technical indicators for cryptocurrency analysis. Supports: " +
    "RSI (momentum), MACD (trend), EMA (moving average), BBANDS (volatility), " +
    "ATR (volatility), OBV (volume), ADX (trend strength). " +
    "Use this for technical analysis queries.",
  schema: z.object({
    symbol: z.string().describe("Cryptocurrency symbol (e.g., 'BTC/USD')"),
    indicator: z.enum([
      "rsi",
      "macd",
      "ema",
      "bbands",
      "atr",
      "obv",
      "supertrend",
      "stoch",
      "adx",
    ]).describe("Technical indicator to fetch"),
  }),
  func: async ({ symbol, indicator }) => {
    const cacheKey = `${indicator}_${symbol.toUpperCase()}`;
    const cached = cache.get<any>(cacheKey);

    // Return cached data if valid
    if (cached) {
      return JSON.stringify({
        cached: true,
        ...cached.value,
      });
    }

    try {
      // Build indicator-specific parameters
      const params: Record<string, string | number> = {
        symbol,
        interval: "1day",
        outputsize: 10,
      };
      
      // Add indicator-specific parameters
      switch (indicator) {
        case "rsi":
          params.time_period = 14;
          break;
        case "ema":
          params.time_period = 20;
          break;
        case "macd":
          params.fast_period = 12;
          params.slow_period = 26;
          params.signal_period = 9;
          break;
        case "bbands":
          params.time_period = 20;
          params.sd = 2;
          break;
        case "atr":
        case "adx":
          params.time_period = 14;
          break;
        case "supertrend":
          params.multiplier = 3;
          params.period = 10;
          break;
      }

      const data = await twelveDataFetch<any>(twelveDataUrl(indicator, params));

      // Cache the response
      cache.set(cacheKey, data, CACHE_DURATION);
      
      // Return simplified data structure
      return JSON.stringify({
        symbol: data.meta?.symbol || symbol,
        indicator,
        values: data.values ? data.values.slice(0, 3) : [], // Only latest 3 values
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch indicator data",
        symbol,
        indicator,
      });
    }
  },
});

/**
 * Export all financial tools
 */
export const financialTools = [
  getCryptoPriceTool,
  getTechnicalIndicatorsTool,
];
