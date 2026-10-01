/**
 * AI Tools Index
 *
 * Central export point for agent tools.
 *
 * Phase 0: removed the unused `allTools` aggregate and the default `searchTools`
 * export — search tools must be built per advisor domain via `createSearchTools`
 * (with an explicit include-domains allowlist and market-intelligence decision)
 * rather than via a shared default that risked domain bleed (e.g. the stock
 * advisor previously receiving the crypto-flavored market-intelligence tool).
 */

export { financialTools, getCryptoPriceTool, getTechnicalIndicatorsTool } from "./financial";
export { socialTools, getRedditSentimentTool } from "./social";
export { createSearchTools, createTavilySearchTool, getMarketIntelligenceTool } from "./search";
