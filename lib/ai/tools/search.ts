/**
 * Search & Research Tools
 * 
 * Tools for web search and market intelligence using Tavily API
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { API_KEYS } from "../config";

/**
 * Tool: Web Search for Crypto News
 * Simplified web search tool for market intelligence
 */
export const tavilySearchTool = new DynamicStructuredTool({
  name: "tavily_search_results_json",
  description:
    "Searches the web for cryptocurrency news, articles, and updates. " +
    "Use this to find recent news, regulatory changes, or market events.",
  schema: z.object({
    query: z.string().describe("Search query for cryptocurrency news and updates"),
  }),
  func: async ({ query }) => {
    try {
      // Call Tavily API directly
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: API_KEYS.tavily,
          query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
          include_raw_content: false,
          include_domains: [
            "coindesk.com",
            "cointelegraph.com",
            "decrypt.co",
            "bloomberg.com",
            "reuters.com",
            "forbes.com",
          ],
        }),
      });

      if (!response.ok) {
        return JSON.stringify({
          error: "Failed to fetch search results",
          query,
        });
      }

      const data = await response.json();
      
      // Format results
      return JSON.stringify({
        query,
        answer: data.answer || "",
        results: data.results?.slice(0, 5).map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content?.slice(0, 200) + "...",
        })) || [],
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Search failed",
        query,
      });
    }
  },
});

/**
 * Tool: Get Market Intelligence
 * Fetches comprehensive market intelligence including news and alerts
 */
export const getMarketIntelligenceTool = new DynamicStructuredTool({
  name: "get_market_intelligence",
  description:
    "Fetches comprehensive market intelligence for a cryptocurrency including: " +
    "recent news, regulatory updates, geopolitical events, market alerts, and macro analysis. " +
    "Use this for broader market context, news, or when analyzing external factors affecting crypto.",
  schema: z.object({
    symbol: z.string().describe("Cryptocurrency symbol (e.g., 'BTC/USD', 'ETH/USD')"),
    type: z.enum(["comprehensive", "alerts", "news"]).default("comprehensive").describe(
      "Type of intelligence: 'comprehensive' (full analysis), 'alerts' (urgent warnings), 'news' (recent updates)"
    ),
  }),
  func: async ({ symbol, type = "comprehensive" }) => {
    try {
      const baseCurrency = symbol.split("/")[0].toUpperCase();
      
      // Call internal market intelligence API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/market-intelligence?symbol=${baseCurrency}&type=${type}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Handle rate limits gracefully
        if (response.status === 429) {
          return JSON.stringify({
            symbol: baseCurrency,
            type,
            status: "rate_limited",
            message: "Market intelligence temporarily rate limited. Using cached data.",
          });
        }
        
        return JSON.stringify({
          symbol: baseCurrency,
          type,
          status: "unavailable",
          message: "Market intelligence temporarily unavailable",
        });
      }
      
      const data = await response.json();
      
      // Return optimized data structure
      return JSON.stringify({
        symbol: baseCurrency,
        type,
        status: "success",
        analysis: data.synthesizedAnalysis || data.analysis || "",
        alerts: data.alerts || [],
        news_count: data.results?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return JSON.stringify({
          symbol: symbol.split("/")[0],
          type,
          status: "timeout",
          message: "Market intelligence request timed out. Proceeding with other data.",
        });
      }
      
      return JSON.stringify({
        symbol: symbol.split("/")[0],
        type,
        status: "error",
        message: error instanceof Error ? error.message : "Failed to fetch market intelligence",
      });
    }
  },
});

/**
 * Export all search and research tools
 */
export const searchTools = [
  tavilySearchTool,
  getMarketIntelligenceTool,
];
