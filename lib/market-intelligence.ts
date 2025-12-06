// Market Intelligence - Temporarily Disabled
// TODO: Fix Tavily import path issues

import { ChatGroq } from "@langchain/groq";

/**
 * Market intelligence features are temporarily disabled
 * All functions return a disabled message
 */

const DISABLED_MESSAGE = {
  error: "Market intelligence features are temporarily disabled. Please check back later.",
  timestamp: new Date().toISOString()
};

export async function getMarketIntelligence(symbol: string, queryType: string = "general") {
  return {
    symbol,
    queryType,
    ...DISABLED_MESSAGE
  };
}

export async function getComprehensiveMarketOverview(symbol: string) {
  return {
    symbol,
    ...DISABLED_MESSAGE
  };
}

export async function getMarketSentiment(symbol: string) {
  return {
    symbol,
    queryType: "sentiment",
    ...DISABLED_MESSAGE
  };
}

export async function getLatestNews(symbol: string) {
  return {
    symbol,
    queryType: "news",
    ...DISABLED_MESSAGE
  };
}

export async function getGeopoliticalAnalysis(symbol: string) {
  return {
    symbol,
    queryType: "geopolitical",
    ...DISABLED_MESSAGE
  };
}

export async function getFundamentalAnalysis(symbol: string) {
  return {
    symbol,
    queryType: "fundamental",
    ...DISABLED_MESSAGE
  };
}

export async function getTechnicalAnalysis(symbol: string) {
  return {
    symbol,
    queryType: "technical",
    ...DISABLED_MESSAGE
  };
}

export async function getMacroeconomicAnalysis(symbol: string) {
  return {
    symbol,
    queryType: "macroeconomic",
    ...DISABLED_MESSAGE
  };
}

export async function getRegulatoryAnalysis(symbol: string) {
  return {
    symbol,
    queryType: "regulatory",
    ...DISABLED_MESSAGE
  };
}

export async function getMarketAlerts(symbol: string) {
  return {
    symbol,
    ...DISABLED_MESSAGE
  };
}