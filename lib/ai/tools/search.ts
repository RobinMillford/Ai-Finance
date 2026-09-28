/**
 * Search & Research Tools
 *
 * Tools for web search and market intelligence using the Tavily API.
 *
 * Phase 0 changes:
 *  - external search content is wrapped as UNTRUSTED DATA (fenced + bounded)
 *    before entering any prompt context — see lib/ai/content-boundary.ts
 *  - get_market_intelligence calls the market-intelligence domain functions
 *    directly instead of making an HTTP request to the app's own API route
 *  - stock-domain advisors no longer receive the crypto-flavored
 *    market-intelligence tool; createSearchTools can exclude it per domain
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { env } from '@/lib/env';
import {
  fenceExternalContent,
  untrustedContentPolicy,
  MAX_EXTERNAL_CONTENT_CHARS,
} from '../content-boundary';
import {
  getMarketIntelligence,
  getComprehensiveMarketOverview,
  getLatestNews,
  getMarketAlerts,
} from '@/lib/market-intelligence';

const MAX_RESULTS = 5;
const SNIPPET_CHARS = 300;

/**
 * Tool: Web Search for Market News
 * Search domains are configurable per advisor domain (crypto/stock/forex).
 */
export function createTavilySearchTool(includeDomains?: string[]) {
  return new DynamicStructuredTool({
    name: 'tavily_search_results_json',
    description:
      'Searches the web for market news, articles, and updates. ' +
      'Use this to find recent news, regulatory changes, or market events.',
    schema: z.object({
      query: z.string().describe('Search query for market news and updates'),
    }),
    func: async ({ query }) => {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: env.tavily.apiKey,
            query,
            search_depth: 'advanced',
            max_results: MAX_RESULTS,
            include_answer: true,
            include_raw_content: false,
            ...(includeDomains?.length ? { include_domains: includeDomains } : {}),
          }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: 'Failed to fetch search results',
            query,
          });
        }

        const data = await response.json();

        // Format results — external content is fenced and bounded so it can
        // never be treated as instructions by downstream prompts.
        const fencedResults = (data.results || [])
          .slice(0, MAX_RESULTS)
          .map(
            (r: any) =>
              fenceExternalContent(
                `${r.title || 'untitled'} (${r.url || 'no url'})`,
                r.content || '',
                SNIPPET_CHARS
              )
          )
          .join('\n');

        const fencedAnswer = data.answer
          ? fenceExternalContent('tavily_answer', data.answer, MAX_EXTERNAL_CONTENT_CHARS)
          : '';

        return JSON.stringify({
          query,
          policy: untrustedContentPolicy(),
          answer: fencedAnswer,
          results: fencedResults,
          sources: (data.results || []).slice(0, MAX_RESULTS).map((r: any) => ({
            title: r.title,
            url: r.url,
          })),
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : 'Search failed',
          query,
        });
      }
    },
  });
}

/**
 * Tool: Get Market Intelligence
 * Fetches market intelligence including news, alerts, and broader analysis.
 * Calls the domain functions directly (no self-HTTP).
 */
export const getMarketIntelligenceTool = new DynamicStructuredTool({
  name: 'get_market_intelligence',
  description:
    'Fetches market intelligence for a symbol including: ' +
    'recent news, regulatory updates, geopolitical events, market alerts, and macro analysis. ' +
    'Use this for broader market context, news, or when analyzing external factors.',
  schema: z.object({
    symbol: z
      .string()
      .describe("Asset symbol (e.g., 'BTC/USD', 'AAPL', 'EURUSD')"),
    type: z
      .enum(['comprehensive', 'alerts', 'news'])
      .default('comprehensive')
      .describe(
        "Type of intelligence: 'comprehensive' (full analysis), 'alerts' (urgent warnings), 'news' (recent updates)"
      ),
  }),
  func: async ({ symbol, type = 'comprehensive' }) => {
    const baseSymbol = symbol.split('/')[0].toUpperCase();
    try {
      const result = await (type === 'news'
        ? getLatestNews(baseSymbol)
        : type === 'alerts'
          ? getMarketAlerts(baseSymbol)
          : getComprehensiveMarketOverview(baseSymbol));

      return JSON.stringify({
        symbol: baseSymbol,
        type,
        status: 'success',
        // External content is fenced as untrusted data.
        analysis: fenceExternalContent(
          'market_intelligence_synthesis',
          result.answer || '',
          MAX_EXTERNAL_CONTENT_CHARS
        ),
        // Structured summaries (titles + urls) are safe metadata; the bodies
        // are fenced below.
        sources:
          result.results?.slice(0, MAX_RESULTS).map((r) => ({ title: r.title, url: r.url })) ?? [],
        fenced_results: result.results
          ?.slice(0, MAX_RESULTS)
          .map((r, i) => fenceExternalContent(`${r.title || `result ${i + 1}`} (${r.url})`, r.content || '', SNIPPET_CHARS))
          .join('\n'),
        news_count: result.results?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Graceful degradation — the agent proceeds with other data.
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      return JSON.stringify({
        symbol: baseSymbol,
        type,
        status: isTimeout ? 'timeout' : 'error',
        message: isTimeout
          ? 'Market intelligence request timed out. Proceeding with other data.'
          : 'Market intelligence temporarily unavailable',
        detail: message,
      });
    }
  },
});

/**
 * Create a domain-specific search toolset.
 *
 * @param includeDomains Tavily `include_domains` allowlist. Omit/empty = no restriction.
 * @param includeMarketIntelligence whether to include the market-intelligence tool
 *        (crypto/forex domains use it; stock advisor previously got it by mistake).
 */
export function createSearchTools(includeDomains?: string[], includeMarketIntelligence = true) {
  const tools: Array<DynamicStructuredTool<any, any, any, any, any, any>> = [createTavilySearchTool(includeDomains)];
  if (includeMarketIntelligence) {
    tools.push(getMarketIntelligenceTool);
  }
  return tools;
}

/**
 * Default search tools (no domain restriction) — kept for backward compatibility.
 */
export const searchTools = [...createSearchTools()];
