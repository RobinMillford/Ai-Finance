/**
 * Multi-Agent Crypto Advisor Graph
 * 
 * Orchestrator-Workers pattern using LangGraph for cryptocurrency analysis
 * 
 * Architecture:
 * - Supervisor (Smart Model): Routes queries to specialized workers
 * - Workers (Fast Model): Execute specific tools and return data
 *   - TechnicalAnalyst: Price & indicators
 *   - SentimentAnalyst: Social sentiment
 *   - MarketResearcher: News & market intelligence
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { smartLLM, fastLLM } from "./config";
import { financialTools } from "./tools/financial";
import { socialTools } from "./tools/social";
import { searchTools } from "./tools/search";
import { z } from "zod";

/**
 * Agent State Definition
 * Tracks messages, routing decisions, and shared data across nodes
 */
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  next: Annotation<string>({
    reducer: (_, y) => y,
    default: () => "supervisor",
  }),
  data: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  agentCalls: Annotation<number>({
    reducer: (x, y) => (x || 0) + y,
    default: () => 0,
  }),
});

/**
 * Routing Schema for Supervisor
 */
const routeSchema = z.object({
  next: z.enum([
    "TechnicalAnalyst",
    "SentimentAnalyst", 
    "MarketResearcher",
    "FINISH",
  ]).describe(
    "The next agent to route to. Choose based on the query:\n" +
    "- TechnicalAnalyst: For price, charts, indicators (RSI, MACD, etc.)\n" +
    "- SentimentAnalyst: For social sentiment, community mood, Reddit analysis\n" +
    "- MarketResearcher: For news, regulations, market events, macro factors\n" +
    "- FINISH: When you have sufficient data to answer the user's query"
  ),
  reasoning: z.string().describe("Brief explanation of why this agent was chosen"),
});

/**
 * Supervisor Node
 * Routes user queries to specialized workers using smart model
 */
async function supervisorNode(state: typeof AgentState.State) {
  const messages = state.messages;
  const agentCalls = state.agentCalls || 0;
  
  // Force finish after 3 agent calls to prevent infinite loops
  if (agentCalls >= 3) {
    console.log(`[Supervisor] Maximum agent calls reached (${agentCalls}). Forcing FINISH.`);
    return {
      next: "FINISH",
      messages: [
        new AIMessage({
          content: "[Routing to Final Response] All necessary data collected.",
        }),
      ],
    };
  }
  
  // System prompt for intelligent routing
  const systemPrompt = `You are a routing supervisor for a crypto advisory system.
  
Your job is to analyze the user's query and route it to the appropriate specialist:

**TechnicalAnalyst**: Choose for:
- Price queries ("What's BTC at?", "ETH price")
- Technical analysis (RSI, MACD, EMA, indicators)
- Chart patterns, support/resistance
- Trading signals

**SentimentAnalyst**: Choose for:
- Social sentiment ("What does Reddit think?")
- Community mood, FOMO/FUD analysis
- Social trends and discussions

**MarketResearcher**: Choose for:
- News and current events
- Regulatory updates
- Geopolitical impacts
- Market context and macro factors
- Broader market analysis

**FINISH**: Choose when:
- You have gathered sufficient data from workers
- The query is answered with available information
- No additional tool calls are needed

**ROUTING RULES**:
1. For simple price queries ("What is the price of BTC?"): Call TechnicalAnalyst ONCE, then FINISH
2. For indicator queries ("What's the RSI for ETH?"): Call TechnicalAnalyst ONCE, then FINISH
3. For analysis requests ("Analyze BTC"): Call 2-3 relevant agents, then FINISH
4. ALWAYS choose FINISH if the previous agent provided data that answers the user's question
5. **${agentCalls} agent calls made. Maximum is 3. If >= 2 calls made, strongly prefer FINISH**

Current data collected: ${JSON.stringify(state.data, null, 2)}

Previous agent responses: ${messages.slice(-2).map(m => m.content).join("\n")}

**Ask yourself**: Does the collected data already answer the user's query? If YES, route to FINISH.

Based on the user's query and collected data, which agent should handle this next?`;

  const llmWithStructuredOutput = smartLLM.withStructuredOutput(routeSchema);
  
  const response = await llmWithStructuredOutput.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  console.log(`[Supervisor] Routing to: ${response.next} - ${response.reasoning} (Calls: ${agentCalls})`);
  
  return {
    next: response.next,
    messages: [
      new AIMessage({
        content: `[Routing to ${response.next}] ${response.reasoning}`,
      }),
    ],
  };
}

/**
 * Technical Analyst Worker Node
 * Handles price and technical indicator analysis
 */
async function technicalAnalystNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Technical Analyst specialist for cryptocurrencies.

Your tools:
- get_crypto_price: Real-time price, volume, change data
- get_technical_indicators: RSI, MACD, EMA, BBANDS, ATR, OBV, ADX, etc.

**Your task**: Analyze the user's query and use your tools to gather technical data.
Call the appropriate tools, then summarize your findings in a clear, structured format.

Focus on: Price action, momentum, trends, volatility, and key technical levels.`;

  const llmWithTools = fastLLM.bindTools(financialTools);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  // If tools were called, execute them
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolNode = new ToolNode(financialTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
    // Store results in shared data
    const technicalData: Record<string, any> = {};
    for (const msg of toolResults.messages) {
      if (msg._getType() === "tool") {
        try {
          const toolContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          technicalData[msg.name || "unknown"] = JSON.parse(toolContent);
        } catch {
          technicalData[msg.name || "unknown"] = msg.content;
        }
      }
    }
    
    return {
      messages: [response, ...toolResults.messages],
      data: { technical: technicalData },
      next: "supervisor",
      agentCalls: 1,
    };
  }
  
  return {
    messages: [response],
    next: "supervisor",
    agentCalls: 1,
  };
}

/**
 * Sentiment Analyst Worker Node
 * Handles social sentiment analysis
 */
async function sentimentAnalystNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Sentiment Analyst specialist for cryptocurrencies.

Your tools:
- get_reddit_sentiment: Analyze Reddit community sentiment (bullish/bearish %, overall mood)

**Your task**: Analyze social sentiment and community mood for the requested cryptocurrency.
Use your tools to gather sentiment data, then provide insights on community perception.

Focus on: Bullish/bearish sentiment, FOMO/FUD indicators, community confidence.`;

  const llmWithTools = fastLLM.bindTools(socialTools);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  // If tools were called, execute them
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolNode = new ToolNode(socialTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
    // Store results in shared data
    const sentimentData: Record<string, any> = {};
    for (const msg of toolResults.messages) {
      if (msg._getType() === "tool") {
        try {
          const toolContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          sentimentData[msg.name || "unknown"] = JSON.parse(toolContent);
        } catch {
          sentimentData[msg.name || "unknown"] = msg.content;
        }
      }
    }
    
    return {
      messages: [response, ...toolResults.messages],
      data: { sentiment: sentimentData },
      next: "supervisor",
      agentCalls: 1,
    };
  }
  
  return {
    messages: [response],
    next: "supervisor",
    agentCalls: 1,
  };
}

/**
 * Market Researcher Worker Node
 * Handles news and market intelligence
 */
async function marketResearcherNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Market Researcher specialist for cryptocurrencies.

Your tools:
- tavily_search_results_json: Search for crypto news, regulatory updates, market events
- get_market_intelligence: Comprehensive market analysis, alerts, geopolitical factors

**Your task**: Research market context, news, and external factors affecting the cryptocurrency.
Use your tools to gather market intelligence, then summarize key insights.

Focus on: Recent news, regulatory changes, macro factors, market alerts, adoption trends.`;

  const llmWithTools = fastLLM.bindTools(searchTools);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  // If tools were called, execute them
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolNode = new ToolNode(searchTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
    // Store results in shared data
    const marketData: Record<string, any> = {};
    for (const msg of toolResults.messages) {
      if (msg._getType() === "tool") {
        try {
          const toolContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          marketData[msg.name || "unknown"] = JSON.parse(toolContent);
        } catch {
          marketData[msg.name || "unknown"] = msg.content;
        }
      }
    }
    
    return {
      messages: [response, ...toolResults.messages],
      data: { market: marketData },
      next: "supervisor",
      agentCalls: 1,
    };
  }
  
  return {
    messages: [response],
    next: "supervisor",
    agentCalls: 1,
  };
}

/**
 * Final Response Node
 * Synthesizes all collected data into a comprehensive answer
 */
async function finalResponseNode(state: typeof AgentState.State) {
  const messages = state.messages;
  const collectedData = state.data;
  
  const systemPrompt = `You are an expert Crypto Advisor delivering professional market analysis.

Available data from specialist agents:
${JSON.stringify(collectedData, null, 2)}

CRITICAL INSTRUCTIONS:
1. Start IMMEDIATELY with your analysis - NO preamble, NO meta-commentary
2. Include specific numbers, prices, and percentages in your analysis
3. Write naturally, synthesizing data into insights
4. Tell a story about what's happening with the crypto

STRICTLY FORBIDDEN - DO NOT include ANY of these:
❌ "about analyzing BTC"
❌ "Now, the response should be generated based on the given data"
❌ "Let me analyze..."
❌ "Based on the data provided..."
❌ "Looking at the information..."
❌ "Here's my analysis..."
❌ Any meta-commentary about generating the response

CORRECT APPROACH - Include numbers but with interpretation:
✅ "Bitcoin is trading at $42,350 (up 3.2% in 24h), showing strength above the key $42,000 support level. The RSI at 58 indicates neutral-to-bullish momentum, while the MACD histogram at 0.45 confirms positive momentum building."

✅ "Ethereum faces resistance at $2,250 after gaining 2.1% today. Trading at $2,180, the price sits between the 20-day EMA of $2,150 and 50-day EMA of $2,220. Social sentiment shows 65% bullish mentions across major platforms."

STRUCTURE:
- Begin directly with market insight (NO introduction)
- Weave in specific numbers naturally
- Provide interpretation alongside data
- Use ## headers for sections
- End with actionable perspective

Start your response immediately with substantive analysis.`;

  const response = await smartLLM.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  return {
    messages: [response],
    next: END,
  };
}

/**
 * Routing Logic
 * Determines which node to execute next based on supervisor's decision
 */
function routeAfterSupervisor(state: typeof AgentState.State): string {
  const next = state.next;
  
  if (next === "FINISH") {
    return "finalResponse";
  }
  
  return next;
}

/**
 * Build and Compile the Graph
 */
export function createCryptoAdvisorGraph() {
  const workflow = new StateGraph(AgentState)
    // Add nodes
    .addNode("supervisor", supervisorNode)
    .addNode("TechnicalAnalyst", technicalAnalystNode)
    .addNode("SentimentAnalyst", sentimentAnalystNode)
    .addNode("MarketResearcher", marketResearcherNode)
    .addNode("finalResponse", finalResponseNode)
    
    // Set entry point
    .addEdge("__start__", "supervisor")
    
    // Supervisor routing (conditional edges)
    .addConditionalEdges(
      "supervisor",
      routeAfterSupervisor,
      {
        TechnicalAnalyst: "TechnicalAnalyst",
        SentimentAnalyst: "SentimentAnalyst",
        MarketResearcher: "MarketResearcher",
        finalResponse: "finalResponse",
      }
    )
    
    // Workers route back to supervisor
    .addEdge("TechnicalAnalyst", "supervisor")
    .addEdge("SentimentAnalyst", "supervisor")
    .addEdge("MarketResearcher", "supervisor")
    
    // Final response ends the graph
    .addEdge("finalResponse", END);
  
  // Compile the graph
  return workflow.compile();
}

/**
 * Export the graph instance
 */
export const cryptoAdvisorGraph = createCryptoAdvisorGraph();
