import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Initialize different LLMs for different tasks to manage token usage and performance
const fastLLM = new ChatGroq({
  apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
  model: "llama-3.1-8b-instant", // Faster, more economical model for simple tasks
  temperature: 0.3,
});

const smartLLM = new ChatGroq({
  apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
  model: "openai/gpt-oss-120b", // More capable model for complex analysis
  temperature: 0.3,
});

// Function to get appropriate LLM based on task complexity
function getLLMForTask(task: string) {
  // Use the faster model for simple tasks to conserve tokens
  const simpleTasks = ["news", "sentiment", "alerts"];
  if (simpleTasks.includes(task.toLowerCase())) {
    return fastLLM;
  }
  // Use the more capable model for complex synthesis tasks
  if (task.toLowerCase() === "synthesis") {
    return smartLLM;
  }
  // Use the more capable model for complex analysis
  return smartLLM;
}

/**
 * Fetches and processes market intelligence for a given symbol
 * @param symbol - The financial symbol (e.g., AAPL, EUR/USD, BTC/USD)
 * @param queryType - Type of intelligence to gather (news, analysis, sentiment, etc.)
 * @returns Processed market intelligence
 */
export async function getMarketIntelligence(symbol: string, queryType: string = "general") {
  // Check if API key is available
  const apiKey = process.env.NEXT_PUBLIC_TAVILY_API_KEY;
  if (!apiKey) {
    return {
      symbol,
      queryType,
      error: "NEXT_PUBLIC_TAVILY_API_KEY not found in environment variables. Market intelligence features are disabled.",
      timestamp: new Date().toISOString()
    };
  }

  let tavilySearch: TavilySearchResults | null = null;
  try {
    tavilySearch = new TavilySearchResults({
      maxResults: 5,
      searchDepth: "basic",
      includeAnswer: true,
      includeRawContent: false,
      apiKey: apiKey.trim()
    });
  } catch (error) {
    console.warn("Failed to initialize TavilySearchResults:", error);
    return {
      symbol,
      queryType,
      error: "Failed to initialize TavilySearchResults: " + (error instanceof Error ? error.message : "Unknown error"),
      timestamp: new Date().toISOString()
    };
  }

  try {
    // Create search queries based on symbol and query type
    let searchQuery = "";
    switch (queryType.toLowerCase()) {
      case "news":
        searchQuery = `latest news about ${symbol} financial market`;
        break;
      case "geopolitical":
        searchQuery = `geopolitical events affecting ${symbol} market impact`;
        break;
      case "sentiment":
        searchQuery = `market sentiment analysis ${symbol} investor opinion`;
        break;
      case "technical":
        searchQuery = `technical analysis ${symbol} price prediction`;
        break;
      case "fundamental":
        searchQuery = `fundamental analysis ${symbol} financial health`;
        break;
      case "macroeconomic":
        searchQuery = `macroeconomic factors affecting ${symbol} market trends`;
        break;
      case "regulatory":
        searchQuery = `regulatory changes impacting ${symbol} industry`;
        break;
      default:
        searchQuery = `financial analysis ${symbol} market trends`;
    }

    // Perform search
    console.log(`Performing Tavily search for symbol: ${symbol}, queryType: ${queryType}, searchQuery: ${searchQuery}`);
    const searchResults = await tavilySearch.invoke(searchQuery);
    console.log(`Tavily search successful for symbol: ${symbol}, queryType: ${queryType}`);
    
    // Get appropriate LLM for this task
    const llm = getLLMForTask(queryType);
    
    // Process results with LLM
    const systemPrompt = `
      You are a financial market intelligence analyst. Provide concise insights about ${symbol}.
      
      Focus on key points only:
      1. Most important developments
      2. Key market sentiment
      3. Major risk factors
      4. Critical opportunities
      
      Keep response under 200 words. Be specific about data when available.
    `;
    
    const humanPrompt = `
      Search Results for "${searchQuery}":
      ${JSON.stringify(searchResults)}
      
      Provide a concise analysis for ${symbol} in under 200 words.
    `;
    
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ]);
    
    return {
      symbol,
      queryType,
      searchQuery,
      rawResults: searchResults,
      analysis: response.content as string,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error fetching market intelligence:", error);
    // Check if it's a rate limit error
    if (error instanceof Error && error.message.includes("rate_limit_exceeded")) {
      return {
        symbol,
        queryType,
        error: "Rate limit exceeded for AI processing. Please try again later.",
        timestamp: new Date().toISOString()
      };
    }
    return {
      symbol,
      queryType,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Gets comprehensive market overview for a symbol
 * @param symbol - The financial symbol
 * @returns Comprehensive market analysis
 */
export async function getComprehensiveMarketOverview(symbol: string) {
  // Check if API key is available
  const apiKey = process.env.NEXT_PUBLIC_TAVILY_API_KEY;
  if (!apiKey) {
    return {
      symbol,
      error: "NEXT_PUBLIC_TAVILY_API_KEY not found in environment variables. Market intelligence features are disabled.",
      timestamp: new Date().toISOString()
    };
  }

  const intelligenceTypes = ["news", "technical", "fundamental"];
  const results = [];
  
  for (const type of intelligenceTypes) {
    const intel = await getMarketIntelligence(symbol, type);
    results.push(intel);
  }
  
  // Generate a synthesized overview from all intelligence
  try {
    const synthesisPrompt = `
      You are a senior financial analyst. Synthesize reports for ${symbol}.
      
      Keep response under 300 words. Format as:
      1. Key Insights (bullet points)
      2. Risks & Opportunities (bullet points)
      3. Market Outlook (1-2 sentences)
    `;
    
    const synthesisResponse = await smartLLM.invoke([
      new SystemMessage(synthesisPrompt),
      new HumanMessage(`Intelligence Reports: ${JSON.stringify(results)}`)
    ]);
    
    return {
      symbol,
      comprehensiveOverview: results,
      synthesizedAnalysis: synthesisResponse.content as string,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error synthesizing market intelligence:", error);
    // Check if it's a rate limit error
    if (error instanceof Error && error.message.includes("rate_limit_exceeded")) {
      return {
        symbol,
        comprehensiveOverview: results,
        synthesisError: "Rate limit exceeded for AI processing. Please try again later.",
        timestamp: new Date().toISOString()
      };
    }
    return {
      symbol,
      comprehensiveOverview: results,
      synthesisError: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Analyzes market sentiment from social media and news
 * @param symbol - The financial symbol
 * @returns Sentiment analysis
 */
export async function getMarketSentiment(symbol: string) {
  return await getMarketIntelligence(symbol, "sentiment");
}

/**
 * Gets latest news affecting the symbol
 * @param symbol - The financial symbol
 * @returns Latest news analysis
 */
export async function getLatestNews(symbol: string) {
  return await getMarketIntelligence(symbol, "news");
}

/**
 * Analyzes geopolitical factors affecting the symbol
 * @param symbol - The financial symbol
 * @returns Geopolitical analysis
 */
export async function getGeopoliticalAnalysis(symbol: string) {
  return await getMarketIntelligence(symbol, "geopolitical");
}

/**
 * Gets fundamental analysis for the symbol
 * @param symbol - The financial symbol
 * @returns Fundamental analysis
 */
export async function getFundamentalAnalysis(symbol: string) {
  return await getMarketIntelligence(symbol, "fundamental");
}

/**
 * Gets technical analysis for the symbol
 * @param symbol - The financial symbol
 * @returns Technical analysis
 */
export async function getTechnicalAnalysis(symbol: string) {
  return await getMarketIntelligence(symbol, "technical");
}

/**
 * Analyzes macroeconomic factors affecting the symbol
 * @param symbol - The financial symbol
 * @returns Macroeconomic analysis
 */
export async function getMacroeconomicAnalysis(symbol: string) {
  return await getMarketIntelligence(symbol, "macroeconomic");
}

/**
 * Analyzes regulatory factors affecting the symbol
 * @param symbol - The financial symbol
 * @returns Regulatory analysis
 */
export async function getRegulatoryAnalysis(symbol: string) {
  return await getMarketIntelligence(symbol, "regulatory");
}

/**
 * Gets real-time market alerts and warnings
 * @param symbol - The financial symbol
 * @returns Market alerts
 */
export async function getMarketAlerts(symbol: string) {
  // Check if API key is available
  const apiKey = process.env.NEXT_PUBLIC_TAVILY_API_KEY;
  if (!apiKey) {
    return {
      symbol,
      error: "NEXT_PUBLIC_TAVILY_API_KEY not found in environment variables. Market intelligence features are disabled.",
      timestamp: new Date().toISOString()
    };
  }

  let tavilySearch: TavilySearchResults | null = null;
  try {
    tavilySearch = new TavilySearchResults({
      maxResults: 5,
      searchDepth: "basic",
      includeAnswer: true,
      includeRawContent: false,
      apiKey: apiKey.trim()
    });
  } catch (error) {
    console.warn("Failed to initialize TavilySearchResults:", error);
    return {
      symbol,
      error: "Failed to initialize TavilySearchResults: " + (error instanceof Error ? error.message : "Unknown error"),
      timestamp: new Date().toISOString()
    };
  }

  try {
    const searchQuery = `urgent alerts warnings ${symbol} market crash surge`;
    console.log(`Performing Tavily search for market alerts: ${searchQuery}`);
    const searchResults = await tavilySearch.invoke(searchQuery);
    console.log(`Tavily search for market alerts successful for symbol: ${symbol}`);
    
    // Use the faster model for alerts
    const alertPrompt = `
      You are a financial risk analyst. Identify urgent alerts for ${symbol}.
      
      Format as bullet points. Keep under 150 words.
      Focus on:
      1. Immediate risks
      2. Market-moving events
      3. Price movement warnings
    `;
    
    const alertResponse = await fastLLM.invoke([
      new SystemMessage(alertPrompt),
      new HumanMessage(`Search Results: ${JSON.stringify(searchResults)}`)
    ]);
    
    return {
      symbol,
      alerts: alertResponse.content as string,
      rawResults: searchResults,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error fetching market alerts:", error);
    // Check if it's a rate limit error
    if (error instanceof Error && error.message.includes("rate_limit_exceeded")) {
      return {
        symbol,
        error: "Rate limit exceeded for AI processing. Please try again later.",
        timestamp: new Date().toISOString()
      };
    }
    return {
      symbol,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    };
  }
}