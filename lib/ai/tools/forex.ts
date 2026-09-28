/**
 * Forex Trading Tools
 *
 * Tools for fetching forex pair quotes and technical indicators.
 *
 * Phase 0: uses the shared provider client (server-only key, global pacing,
 * typed errors) instead of a local fetch/retry implementation — the last of
 * the four divergent fetch helpers. Indicators route through the indicator
 * service (cached, bounded concurrency). Tool output is bounded before it
 * enters the synthesis prompt.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { twelveDataFetch, twelveDataUrl } from "@/lib/market-data";
import { getIndicators, type IndicatorName } from "@/lib/market-data/indicators";
import { TTLCache } from "@/lib/market-data/cache";

// Cache for API responses (5 minutes)
const cache = new TTLCache(500);
const CACHE_DURATION = 5 * 60 * 1000;

/** Bound tool output so raw provider payloads cannot dominate the prompt. */
function boundedJson(value: Record<string, unknown>): string {
  return JSON.stringify(value).slice(0, 4000);
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
    const cacheKey = `forex_quote_${symbol.toUpperCase()}`;
    const cached = cache.get<Record<string, unknown>>(cacheKey);

    if (cached) {
      return JSON.stringify(cached.value);
    }

    try {
      const data = await twelveDataFetch<any>(twelveDataUrl("quote", { symbol }));

      // Cache the result
      cache.set(cacheKey, data, CACHE_DURATION);

      return boundedJson({
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
      return boundedJson({
        error: `Failed to fetch forex quote: ${error instanceof Error ? error.message : "Unknown error"}`,
        symbol,
      });
    }
  },
});

const FOREX_INDICATOR_MAP: Record<string, IndicatorName> = {
  RSI: "rsi",
  MACD: "macd",
  EMA: "ema20",
  BBANDS: "bbands",
  ATR: "atr",
  ADX: "adx",
};

/**
 * Tool: Get Forex Technical Indicators
 * Fetches technical indicators for forex pair analysis via the shared
 * indicator service (bounded concurrency + 1h cache + typed errors).
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
      const names = indicators
        .map((i) => FOREX_INDICATOR_MAP[i])
        .filter((n): n is IndicatorName => Boolean(n));

      const aggregate = await getIndicators(symbol, names);

      // Preserve the prior response shape (indicator name -> provider data),
      // with per-indicator failures reported instead of silently missing.
      const results: Record<string, unknown> = { ...aggregate.indicators };
      for (const [name, message] of Object.entries(aggregate.errors)) {
        results[name] = { error: message };
      }

      return boundedJson(results);
    } catch (error) {
      // getIndicators only throws when ALL requested indicators failed.
      return boundedJson({
        error: `Failed to fetch indicators: ${error instanceof Error ? error.message : "Unknown error"}`,
        symbol,
      });
    }
  },
});

/**
 * Export all forex tools
 */
export const forexTools = [
  getForexQuoteTool,
  getForexIndicatorsTool,
];
