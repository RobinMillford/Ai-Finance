/**
 * AI Tools Index
 * 
 * Central export point for all agent tools
 */

export { financialTools, getCryptoPriceTool, getTechnicalIndicatorsTool } from "./financial";
export { socialTools, getRedditSentimentTool } from "./social";
export { searchTools, tavilySearchTool, getMarketIntelligenceTool } from "./search";

// Export all tools as a single array
import { financialTools } from "./financial";
import { socialTools } from "./social";
import { searchTools } from "./search";

export const allTools = [...financialTools, ...socialTools, ...searchTools];
