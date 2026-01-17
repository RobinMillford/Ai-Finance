/**
 * Stock Market Tools
 * 
 * Tools for fetching stock quotes and technical indicators
 * Uses Twelve Data API for US stocks (NASDAQ, NYSE)
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Cache for API responses (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

// Rate limiting
const REQUEST_DELAY_MS = 7500; // 8 requests/minute
let lastRequestTime = 0;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY_MS) {
    await delay(REQUEST_DELAY_MS - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Rate limit hit. Retrying (${attempt}/${maxRetries})...`);
          if (attempt === maxRetries) {
            throw new Error("Rate limit exceeded after max retries");
          }
          await delay(10000);
          continue;
        }
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.message || "Unknown error"}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.warn(`Attempt ${attempt} failed. Retrying...`);
      await delay(5000);
    }
  }
}

/**
 * Get Stock Quote Tool
 * Fetches real-time stock data including price, volume, and changes
 */
export const getStockQuoteTool = tool(
  async ({ symbol }: { symbol: string }) => {
    const cacheKey = `quote_${symbol}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log(`[Stock Quote] Using cached data for ${symbol}`);
      return JSON.stringify(cached.data);
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
      if (!apiKey) {
        throw new Error("NEXT_PUBLIC_TWELVEDATA_API_KEY not configured");
      }

      const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`;
      const data = await fetchWithRetry(url);

      if (!data || data.status === "error") {
        throw new Error(data?.message || "Failed to fetch stock quote");
      }

      cache.set(cacheKey, { data, timestamp: now });
      console.log(`[Stock Quote] Fetched quote for ${symbol}: ${data.close}`);

      return JSON.stringify({
        symbol: data.symbol,
        name: data.name,
        exchange: data.exchange,
        price: parseFloat(data.close),
        open: parseFloat(data.open),
        high: parseFloat(data.high),
        low: parseFloat(data.low),
        volume: parseInt(data.volume),
        change: parseFloat(data.change),
        percent_change: parseFloat(data.percent_change),
        previous_close: parseFloat(data.previous_close),
        timestamp: data.timestamp,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Stock Quote] Error fetching ${symbol}:`, errorMessage);
      return JSON.stringify({ error: errorMessage, symbol });
    }
  },
  {
    name: "get_stock_quote",
    description:
      "Get real-time stock quote data including current price, volume, daily change, and trading range. " +
      "Use this for: price queries, volume analysis, daily performance, opening/closing prices. " +
      "Works for US stocks (NASDAQ, NYSE). Example symbols: AAPL, TSLA, MSFT, GOOGL, AMZN",
    schema: z.object({
      symbol: z.string().describe("Stock symbol (e.g., AAPL, TSLA, MSFT)"),
    }),
  }
);

/**
 * Get Stock Technical Indicators Tool
 * Fetches multiple technical indicators for stock analysis
 */
export const getStockIndicatorsTool = tool(
  async ({ symbol }: { symbol: string }) => {
    const cacheKey = `indicators_${symbol}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log(`[Stock Indicators] Using cached data for ${symbol}`);
      return JSON.stringify(cached.data);
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
      if (!apiKey) {
        throw new Error("NEXT_PUBLIC_TWELVEDATA_API_KEY not configured");
      }

      const indicators: any = {};

      // RSI (Relative Strength Index)
      try {
        const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
        const rsiData = await fetchWithRetry(rsiUrl);
        if (rsiData?.values?.[0]) {
          indicators.rsi = {
            value: parseFloat(rsiData.values[0].rsi),
            interpretation: parseFloat(rsiData.values[0].rsi) > 70 ? "overbought" : parseFloat(rsiData.values[0].rsi) < 30 ? "oversold" : "neutral",
          };
        }
      } catch (error) {
        console.warn(`[Stock Indicators] RSI fetch failed for ${symbol}`);
      }

      // MACD
      try {
        const macdUrl = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&apikey=${apiKey}`;
        const macdData = await fetchWithRetry(macdUrl);
        if (macdData?.values?.[0]) {
          indicators.macd = {
            macd: parseFloat(macdData.values[0].macd),
            signal: parseFloat(macdData.values[0].macd_signal),
            histogram: parseFloat(macdData.values[0].macd_hist),
          };
        }
      } catch (error) {
        console.warn(`[Stock Indicators] MACD fetch failed for ${symbol}`);
      }

      // EMA (20-day and 50-day)
      try {
        const ema20Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&apikey=${apiKey}`;
        const ema20Data = await fetchWithRetry(ema20Url);
        if (ema20Data?.values?.[0]) {
          indicators.ema20 = parseFloat(ema20Data.values[0].ema);
        }

        const ema50Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=50&apikey=${apiKey}`;
        const ema50Data = await fetchWithRetry(ema50Url);
        if (ema50Data?.values?.[0]) {
          indicators.ema50 = parseFloat(ema50Data.values[0].ema);
        }
      } catch (error) {
        console.warn(`[Stock Indicators] EMA fetch failed for ${symbol}`);
      }

      // Bollinger Bands
      try {
        const bbandsUrl = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&apikey=${apiKey}`;
        const bbandsData = await fetchWithRetry(bbandsUrl);
        if (bbandsData?.values?.[0]) {
          indicators.bbands = {
            upper: parseFloat(bbandsData.values[0].upper_band),
            middle: parseFloat(bbandsData.values[0].middle_band),
            lower: parseFloat(bbandsData.values[0].lower_band),
          };
        }
      } catch (error) {
        console.warn(`[Stock Indicators] BBANDS fetch failed for ${symbol}`);
      }

      // ATR (Average True Range)
      try {
        const atrUrl = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
        const atrData = await fetchWithRetry(atrUrl);
        if (atrData?.values?.[0]) {
          indicators.atr = parseFloat(atrData.values[0].atr);
        }
      } catch (error) {
        console.warn(`[Stock Indicators] ATR fetch failed for ${symbol}`);
      }

      // ADX (Average Directional Index)
      try {
        const adxUrl = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
        const adxData = await fetchWithRetry(adxUrl);
        if (adxData?.values?.[0]) {
          indicators.adx = {
            value: parseFloat(adxData.values[0].adx),
            interpretation: parseFloat(adxData.values[0].adx) > 25 ? "strong trend" : "weak trend",
          };
        }
      } catch (error) {
        console.warn(`[Stock Indicators] ADX fetch failed for ${symbol}`);
      }

      if (Object.keys(indicators).length === 0) {
        throw new Error("No indicators data available");
      }

      cache.set(cacheKey, { data: indicators, timestamp: now });
      console.log(`[Stock Indicators] Fetched ${Object.keys(indicators).length} indicators for ${symbol}`);

      return JSON.stringify({
        symbol,
        indicators,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Stock Indicators] Error fetching ${symbol}:`, errorMessage);
      return JSON.stringify({ error: errorMessage, symbol });
    }
  },
  {
    name: "get_stock_indicators",
    description:
      "Get technical indicators for stock analysis including RSI, MACD, EMA (20/50), Bollinger Bands, ATR, and ADX. " +
      "Use this for: technical analysis, trend identification, momentum assessment, volatility analysis, overbought/oversold conditions. " +
      "Indicators returned: RSI (momentum), MACD (trend), EMA (moving averages), BBANDS (volatility), ATR (volatility), ADX (trend strength)",
    schema: z.object({
      symbol: z.string().describe("Stock symbol (e.g., AAPL, TSLA, MSFT)"),
    }),
  }
);

export const stockTools = [getStockQuoteTool, getStockIndicatorsTool];
