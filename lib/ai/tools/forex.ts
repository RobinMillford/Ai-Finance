/**
 * Forex Trading Tools
 * 
 * Tools for fetching forex pair quotes and technical indicators
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { API_KEYS } from "../config";

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Utility: Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429 && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Tool: Get Forex Pair Quote
 * Fetches real-time forex pair data including exchange rate, spread, and daily change
 */
export const getForexQuoteTool = new DynamicStructuredTool({
  name: "get_forex_quote",
  description:
    "Get real-time forex pair quote including exchange rate, bid/ask spread, daily change, and volume. " +
    "Use this for current forex pair prices and basic market data. " +
    "Example pairs: EUR/USD, GBP/JPY, USD/CAD, AUD/USD, etc.",
  schema: z.object({
    symbol: z
      .string()
      .describe("Forex pair symbol (e.g., EUR/USD, GBP/JPY, USD/CHF)"),
  }),
  func: async ({ symbol }) => {
    try {
      // Check cache
      const cacheKey = `forex_quote_${symbol}`;
      const cached = cache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < CACHE_DURATION) {
        return JSON.stringify(cached.data);
      }

      // Fetch from Twelve Data API
      const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${API_KEYS.twelveData}`;
      const data = await fetchWithRetry(url);

      // Cache the result
      cache.set(cacheKey, { data, timestamp: now });

      return JSON.stringify({
        symbol: data.symbol,
        name: data.name,
        exchange_rate: data.close,
        open: data.open,
        high: data.high,
        low: data.low,
        change: data.change,
        percent_change: data.percent_change,
        volume: data.volume,
        timestamp: data.datetime,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to fetch forex quote: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
});

/**
 * Tool: Get Forex Technical Indicators
 * Fetches technical indicators for forex pair analysis
 */
export const getForexIndicatorsTool = new DynamicStructuredTool({
  name: "get_forex_indicators",
  description:
    "Get technical indicators for forex pair analysis. " +
    "Available indicators: RSI (momentum), MACD (trend), EMA (moving average), " +
    "BBANDS (volatility), ATR (volatility), ADX (trend strength). " +
    "Use this for technical analysis and trading signal generation.",
  schema: z.object({
    symbol: z
      .string()
      .describe("Forex pair symbol (e.g., EUR/USD, GBP/JPY)"),
    indicators: z
      .array(z.enum(["RSI", "MACD", "EMA", "BBANDS", "ATR", "ADX"]))
      .describe("List of indicators to fetch"),
  }),
  func: async ({ symbol, indicators }) => {
    try {
      const results: Record<string, any> = {};

      for (const indicator of indicators) {
        const cacheKey = `forex_${indicator}_${symbol}`;
        const cached = cache.get(cacheKey);
        const now = Date.now();

        if (cached && now - cached.timestamp < CACHE_DURATION) {
          results[indicator] = cached.data;
          continue;
        }

        let url = "";
        switch (indicator) {
          case "RSI":
            url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${API_KEYS.twelveData}`;
            break;
          case "MACD":
            url = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&apikey=${API_KEYS.twelveData}`;
            break;
          case "EMA":
            url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&apikey=${API_KEYS.twelveData}`;
            break;
          case "BBANDS":
            url = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&apikey=${API_KEYS.twelveData}`;
            break;
          case "ATR":
            url = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&apikey=${API_KEYS.twelveData}`;
            break;
          case "ADX":
            url = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&apikey=${API_KEYS.twelveData}`;
            break;
        }

        const data = await fetchWithRetry(url);
        cache.set(cacheKey, { data, timestamp: now });
        results[indicator] = data;

        // Small delay between requests to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return JSON.stringify(results);
    } catch (error) {
      return JSON.stringify({
        error: `Failed to fetch indicators: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
});

/**
 * Export all forex tools
 */
export const forexTools = [getForexQuoteTool, getForexIndicatorsTool];
