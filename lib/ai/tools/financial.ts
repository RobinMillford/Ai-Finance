/**
 * Financial Tools
 * 
 * Tools for fetching cryptocurrency prices and technical indicators
 * from Twelve Data API
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { API_KEYS } from "../config";

// Cache for API responses (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Utility: Fetch with retry logic for rate limits
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  retryDelayMs: number = 10000
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const text = await response.text();
        
        // Handle rate limit (429)
        if (response.status === 429) {
          if (attempt === maxRetries) {
            throw new Error("Rate limit exceeded after maximum retries");
          }
          console.warn(`Rate limit hit. Retrying (${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }
        
        throw new Error(`API error: ${response.status} - ${text}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      console.warn(`Fetch attempt ${attempt} failed. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  throw new Error("Unexpected error in fetchWithRetry");
}

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
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    // Return cached data if valid
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return JSON.stringify({
        cached: true,
        ...cached.data,
      });
    }
    
    try {
      const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${API_KEYS.twelveData}`;
      const data = await fetchWithRetry(url);
      
      // Cache the response
      cache.set(cacheKey, { data, timestamp: now });
      
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
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    // Return cached data if valid
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return JSON.stringify({
        cached: true,
        ...cached.data,
      });
    }
    
    try {
      // Build URL based on indicator type
      const baseUrl = "https://api.twelvedata.com";
      const params = new URLSearchParams({
        symbol,
        interval: "1day",
        outputsize: "10",
        apikey: API_KEYS.twelveData,
      });
      
      // Add indicator-specific parameters
      switch (indicator) {
        case "rsi":
          params.append("time_period", "14");
          break;
        case "ema":
          params.append("time_period", "20");
          break;
        case "macd":
          params.append("fast_period", "12");
          params.append("slow_period", "26");
          params.append("signal_period", "9");
          break;
        case "bbands":
          params.append("time_period", "20");
          params.append("sd", "2");
          break;
        case "atr":
        case "adx":
          params.append("time_period", "14");
          break;
        case "supertrend":
          params.append("multiplier", "3");
          params.append("period", "10");
          break;
      }
      
      const url = `${baseUrl}/${indicator}?${params.toString()}`;
      const data = await fetchWithRetry(url);
      
      // Cache the response
      cache.set(cacheKey, { data, timestamp: now });
      
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
