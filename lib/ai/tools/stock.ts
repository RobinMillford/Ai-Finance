/**
 * Stock Market Tools
 *
 * Tools for fetching stock quotes and technical indicators
 * Uses Twelve Data API for US stocks (NASDAQ, NYSE)
 *
 * Phase 0: uses the server-only key via the shared provider client (global
 * pacing + retry + typed errors) instead of a local fetch/retry implementation
 * reading a NEXT_PUBLIC key. Per-tool 5-minute cache preserved.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { twelveDataFetch, twelveDataUrl, ProviderError } from "@/lib/market-data";
import { TTLCache } from "@/lib/market-data/cache";

// Cache for API responses (5 minutes)
const cache = new TTLCache(500);
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Get Stock Quote Tool
 * Fetches real-time stock data including price, volume, and changes
 */
export const getStockQuoteTool = tool(
  async ({ symbol }: { symbol: string }) => {
    const cacheKey = `quote_${symbol.toUpperCase()}`;
    const cached = cache.get<any>(cacheKey);

    if (cached) {
      return JSON.stringify(cached.value);
    }

    try {
      const data = await twelveDataFetch<any>(twelveDataUrl("quote", { symbol }));

      const result = {
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
      };

      cache.set(cacheKey, result, CACHE_DURATION);

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage =
        error instanceof ProviderError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
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
    const cacheKey = `indicators_${symbol.toUpperCase()}`;
    const cached = cache.get<any>(cacheKey);

    if (cached) {
      return JSON.stringify(cached.value);
    }

    try {
      const indicators: any = {};

      const fetchOne = async (name: string, path: string, params: Record<string, string | number>) => {
        try {
          return await twelveDataFetch<any>(twelveDataUrl(path, params));
        } catch {
          console.warn(`[Stock Indicators] ${name} fetch failed for ${symbol}`);
          return null;
        }
      };

      const base = { symbol, interval: "1day", outputsize: 10 };

      // Sequential requests share the provider client's global pacing —
      // no per-tool artificial delays, no quota bursts.
      const rsiData = await fetchOne("RSI", "rsi", { ...base, time_period: 14 });
      if (rsiData?.values?.[0]) {
        indicators.rsi = {
          value: parseFloat(rsiData.values[0].rsi),
          interpretation:
            parseFloat(rsiData.values[0].rsi) > 70
              ? "overbought"
              : parseFloat(rsiData.values[0].rsi) < 30
                ? "oversold"
                : "neutral",
        };
      }

      const macdData = await fetchOne("MACD", "macd", base);
      if (macdData?.values?.[0]) {
        indicators.macd = {
          macd: parseFloat(macdData.values[0].macd),
          signal: parseFloat(macdData.values[0].macd_signal),
          histogram: parseFloat(macdData.values[0].macd_hist),
        };
      }

      const ema20Data = await fetchOne("EMA20", "ema", { ...base, time_period: 20 });
      if (ema20Data?.values?.[0]) indicators.ema20 = parseFloat(ema20Data.values[0].ema);

      const ema50Data = await fetchOne("EMA50", "ema", { ...base, time_period: 50 });
      if (ema50Data?.values?.[0]) indicators.ema50 = parseFloat(ema50Data.values[0].ema);

      const bbandsData = await fetchOne("BBANDS", "bbands", { ...base, time_period: 20 });
      if (bbandsData?.values?.[0]) {
        indicators.bbands = {
          upper: parseFloat(bbandsData.values[0].upper_band),
          middle: parseFloat(bbandsData.values[0].middle_band),
          lower: parseFloat(bbandsData.values[0].lower_band),
        };
      }

      const atrData = await fetchOne("ATR", "atr", { ...base, time_period: 14 });
      if (atrData?.values?.[0]) indicators.atr = parseFloat(atrData.values[0].atr);

      const adxData = await fetchOne("ADX", "adx", { ...base, time_period: 14 });
      if (adxData?.values?.[0]) {
        indicators.adx = {
          value: parseFloat(adxData.values[0].adx),
          interpretation: parseFloat(adxData.values[0].adx) > 25 ? "strong trend" : "weak trend",
        };
      }

      if (Object.keys(indicators).length === 0) {
        throw new Error("No indicators data available");
      }

      cache.set(cacheKey, indicators, CACHE_DURATION);

      return JSON.stringify({
        symbol,
        indicators,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof ProviderError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
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
