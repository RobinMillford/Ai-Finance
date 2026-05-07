/**
 * Market Intelligence — powered by Tavily search API (@tavily/core)
 *
 * Each function builds a targeted query and returns structured results
 * so callers (API routes, AI tools) get consistent, typed data.
 *
 * Env var required: NEXT_PUBLIC_TAVILY_API_KEY
 */

import { tavily } from "@tavily/core";

type TavilyResult = {
  url: string;
  title: string;
  content: string;
  score?: number;
};

type IntelligenceResult = {
  symbol: string;
  queryType: string;
  answer?: string;
  results: TavilyResult[];
  timestamp: string;
  error?: string;
};

function getClient() {
  const apiKey = process.env.NEXT_PUBLIC_TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_TAVILY_API_KEY is not set");
  }
  return tavily({ apiKey });
}

async function search(
  symbol: string,
  queryType: string,
  query: string,
  includeDomains?: string[]
): Promise<IntelligenceResult> {
  const client = getClient();

  const opts: Parameters<ReturnType<typeof tavily>["search"]>[1] = {
    searchDepth: "advanced",
    maxResults: 5,
    includeAnswer: true,
  };
  if (includeDomains?.length) opts.includeDomains = includeDomains;

  const data = await client.search(query, opts);

  return {
    symbol,
    queryType,
    answer: (data as any).answer ?? "",
    results: ((data as any).results ?? []).map((r: any) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      score: r.score,
    })),
    timestamp: new Date().toISOString(),
  };
}

// ── Public functions ────────────────────────────────────────────────────────

export async function getMarketIntelligence(
  symbol: string,
  queryType: string = "general"
): Promise<IntelligenceResult> {
  return search(
    symbol,
    queryType,
    `${symbol} market analysis ${queryType} ${new Date().getFullYear()}`
  );
}

export async function getComprehensiveMarketOverview(
  symbol: string
): Promise<IntelligenceResult> {
  return search(
    symbol,
    "comprehensive",
    `${symbol} comprehensive market overview price analysis outlook`,
    ["bloomberg.com", "reuters.com", "ft.com", "wsj.com", "marketwatch.com"]
  );
}

export async function getLatestNews(symbol: string): Promise<IntelligenceResult> {
  return search(
    symbol,
    "news",
    `${symbol} latest news today`,
    ["bloomberg.com", "reuters.com", "cnbc.com", "ft.com", "forbes.com"]
  );
}

export async function getMarketSentiment(symbol: string): Promise<IntelligenceResult> {
  return search(
    symbol,
    "sentiment",
    `${symbol} market sentiment investor outlook bullish bearish`
  );
}

export async function getFundamentalAnalysis(
  symbol: string
): Promise<IntelligenceResult> {
  return search(
    symbol,
    "fundamental",
    `${symbol} fundamental analysis earnings revenue valuation`,
    ["bloomberg.com", "reuters.com", "seekingalpha.com", "marketwatch.com"]
  );
}

export async function getTechnicalAnalysis(
  symbol: string
): Promise<IntelligenceResult> {
  return search(
    symbol,
    "technical",
    `${symbol} technical analysis chart patterns support resistance`
  );
}

export async function getMacroeconomicAnalysis(
  symbol: string
): Promise<IntelligenceResult> {
  return search(
    symbol,
    "macroeconomic",
    `${symbol} macroeconomic impact interest rates inflation GDP`
  );
}

export async function getRegulatoryAnalysis(
  symbol: string
): Promise<IntelligenceResult> {
  return search(
    symbol,
    "regulatory",
    `${symbol} regulatory news SEC CFTC compliance legal`
  );
}

export async function getGeopoliticalAnalysis(
  symbol: string
): Promise<IntelligenceResult> {
  return search(
    symbol,
    "geopolitical",
    `${symbol} geopolitical risk global events trade policy sanctions`
  );
}

export async function getMarketAlerts(symbol: string): Promise<IntelligenceResult> {
  return search(
    symbol,
    "alerts",
    `${symbol} urgent market alert warning risk today`,
    ["bloomberg.com", "reuters.com", "cnbc.com"]
  );
}
