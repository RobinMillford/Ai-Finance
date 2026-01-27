/**
 * Stock Advisor Multi-Agent Graph
 * 
 * LangGraph workflow for comprehensive stock analysis
 * Uses specialized agents coordinated by a supervisor
 */

import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// Import configuration and tools
import { smartLLM, fastLLM } from "./config";
import { stockTools } from "./tools/stock";
import { socialTools } from "./tools/social";
import { searchTools } from "./tools/search";

/**
 * Agent State Definition
 */
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "supervisor",
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
    "- TechnicalAnalyst: For stock prices, technical indicators, chart analysis\n" +
    "- SentimentAnalyst: For social sentiment, Reddit analysis, trader mood\n" +
    "- MarketResearcher: For news, earnings, market events, sector trends\n" +
    "- FINISH: When you have sufficient data to answer"
  ),
  reasoning: z.string().describe("Brief explanation of why this agent was chosen"),
});

/**
 * Supervisor Node
 */
async function supervisorNode(state: typeof AgentState.State) {
  const messages = state.messages;
  const agentCalls = state.agentCalls || 0;
  
  if (agentCalls >= 3) {
    console.log(`[Stock Supervisor] Maximum calls reached (${agentCalls}). Forcing FINISH.`);
    return {
      next: "FINISH",
      messages: [
        new AIMessage({
          content: "[Routing to Final Response] All necessary stock data collected.",
        }),
      ],
    };
  }
  
  const systemPrompt = `You are a routing supervisor for a stock advisory system.

Route to:
- **TechnicalAnalyst**: Stock prices, volume, RSI, MACD, EMA, Bollinger Bands, chart patterns
- **SentimentAnalyst**: Reddit sentiment, trader mood, social media trends
- **MarketResearcher**: News, earnings reports, sector analysis, market events
- **FINISH**: When you have enough data to answer the user's query

**ROUTING RULES**:
1. For simple price queries ("What is AAPL's price?"): Call TechnicalAnalyst ONCE, then FINISH
2. For indicator queries ("What's the RSI for TSLA?"): Call TechnicalAnalyst ONCE, then FINISH
3. For analysis requests ("Analyze MSFT"): Call 2-3 relevant agents, then FINISH
4. ALWAYS choose FINISH if the previous agent provided data that answers the user's question
5. **${agentCalls} agent calls made. Maximum is 3. If >= 2 calls made, strongly prefer FINISH**

Current data collected: ${JSON.stringify(state.data, null, 2)}

Previous agent responses: ${messages.slice(-2).map(m => m.content).join("\n")}

**Ask yourself**: Does the collected data already answer the user's query? If YES, route to FINISH.

Which agent should handle this stock query next?`;

  const llmWithStructuredOutput = smartLLM.withStructuredOutput(routeSchema);
  
  const response = await llmWithStructuredOutput.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  console.log(`[Stock Supervisor] Routing to: ${response.next} - ${response.reasoning} (Calls: ${agentCalls})`);
  
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
 * Technical Analyst Node
 */
async function technicalAnalystNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Technical Analyst for US stocks.

Available tools:
- get_stock_quote: Gets current price, volume, daily changes, trading range for a stock symbol
- get_stock_indicators: Gets RSI, MACD, EMA (20/50), Bollinger Bands, ATR, ADX for a stock symbol

**CRITICAL**: You MUST call the appropriate tools to gather data. Do NOT provide analysis without calling tools first.

For the user's query, identify the stock symbol (e.g., TSLA, AAPL) and call the relevant tools.
After receiving tool results, provide a brief summary of the technical findings.`;

  const llmWithTools = fastLLM.bindTools(stockTools);
  
  console.log(`[TechnicalAnalyst] Processing query with ${messages.length} messages`);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  console.log(`[TechnicalAnalyst] Response - Tool calls: ${response.tool_calls?.length || 0}`);
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    console.log(`[TechnicalAnalyst] Executing ${response.tool_calls.length} tool calls`);
    const toolNode = new ToolNode(stockTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
    const technicalData: Record<string, any> = {};
    for (const msg of toolResults.messages) {
      if (msg._getType() === "tool") {
        try {
          const toolContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          technicalData[msg.name || "unknown"] = JSON.parse(toolContent);
          console.log(`[TechnicalAnalyst] Tool result for ${msg.name}: ${toolContent.substring(0, 100)}...`);
        } catch {
          technicalData[msg.name || "unknown"] = msg.content;
        }
      }
    }
    
    console.log(`[TechnicalAnalyst] Returning technical data:`, Object.keys(technicalData));
    
    return {
      messages: [response, ...toolResults.messages],
      data: { technical: technicalData },
      next: "supervisor",
      agentCalls: 1,
    };
  }
  
  console.log(`[TechnicalAnalyst] WARNING: No tools called! Response: ${response.content?.toString().substring(0, 100)}`);
  
  // Trim any leading/trailing whitespace
  const cleanedContent = typeof response.content === 'string'
    ? response.content.trim()
    : response.content;
  
  return {
    messages: [new AIMessage(cleanedContent)],
    next: "supervisor",
    agentCalls: 1,
  };
}

/**
 * Sentiment Analyst Node
 */
async function sentimentAnalystNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Sentiment Analyst specializing in social media and community sentiment for stocks.

Tools:
- get_reddit_sentiment: Analyze Reddit discussions about the stock, bullish/bearish sentiment

Task: Use tools to gather social sentiment data. Summarize community mood and trading sentiment.
Focus on: Bullish vs bearish sentiment, social momentum, retail investor interest, FOMO/FUD indicators.`;

  const llmWithTools = fastLLM.bindTools(socialTools);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolNode = new ToolNode(socialTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
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
  
  // Trim any leading/trailing whitespace
  const cleanedContent = typeof response.content === 'string'
    ? response.content.trim()
    : response.content;
  
  return {
    messages: [new AIMessage(cleanedContent)],
    next: "supervisor",
    agentCalls: 1,
  };
}

/**
 * Market Researcher Node
 */
async function marketResearcherNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Market Researcher specializing in news, earnings, and market events.

Tools:
- tavily_search: Search for recent news, earnings reports, analyst ratings, market events

Task: Use tools to gather market context and news. Summarize key developments and market impact.
Focus on: Recent news, earnings results, sector trends, analyst opinions, market catalysts.`;

  const llmWithTools = fastLLM.bindTools(searchTools);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolNode = new ToolNode(searchTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
    const researchData: Record<string, any> = {};
    for (const msg of toolResults.messages) {
      if (msg._getType() === "tool") {
        try {
          const toolContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          researchData[msg.name || "unknown"] = JSON.parse(toolContent);
        } catch {
          researchData[msg.name || "unknown"] = msg.content;
        }
      }
    }
    
    return {
      messages: [response, ...toolResults.messages],
      data: { research: researchData },
      next: "supervisor",
      agentCalls: 1,
    };
  }
  
  // Trim any leading/trailing whitespace
  const cleanedContent = typeof response.content === 'string'
    ? response.content.trim()
    : response.content;
  
  return {
    messages: [new AIMessage(cleanedContent)],
    next: "supervisor",
    agentCalls: 1,
  };
}

/**
 * Final Response Node
 */
async function finalResponseNode(state: typeof AgentState.State) {
  const messages = state.messages;
  const data = state.data;
  
  console.log(`[FinalResponse] Received data:`, JSON.stringify(data, null, 2));
  console.log(`[FinalResponse] Has technical data:`, !!data.technical);
  console.log(`[FinalResponse] Has sentiment data:`, !!data.sentiment);
  console.log(`[FinalResponse] Has research data:`, !!data.research);
  
  const systemPrompt = `You are a professional Stock Analyst delivering insightful investment analysis.

Available data from specialist agents:
${JSON.stringify(data, null, 2)}

CRITICAL INSTRUCTIONS:
1. Start IMMEDIATELY with your analysis - NO preamble, NO meta-commentary
2. Include specific numbers and data points in your analysis
3. Write naturally, synthesizing data into insights
4. Tell a story about what's happening with the stock

STRICTLY FORBIDDEN - DO NOT include ANY of these:
❌ "about analyzing AAPL"
❌ "Now, the response should be generated based on the given data"
❌ "Let me analyze..."
❌ "Based on the data provided..."
❌ "Looking at the information..."
❌ "Here's my analysis..."
❌ Any meta-commentary about generating the response

CORRECT APPROACH - Include numbers but with interpretation:
✅ "Apple is showing mixed signals today. Trading at $255.41 (up 2.97%), the stock faces resistance at its 20-day EMA of $258.85. The ADX at 31.74 confirms a strong trend, but the RSI at 40.32 suggests neutral momentum. The bearish MACD histogram of -0.81 signals weakening momentum, while the stock trades below both its 20-day and 50-day moving averages."

✅ "Despite gaining nearly 3% today, Apple's technical setup suggests caution. At $255.41, the stock remains below key resistance levels. The strong ADX reading of 31.74 indicates a defined trend, though the neutral RSI at 40.32 leaves room for movement in either direction."

STRUCTURE:
- Begin directly with market insight (NO introduction)
- Weave in specific numbers naturally
- Provide interpretation alongside data
- End with actionable perspective

Start your response immediately with substantive analysis.`;

  const response = await smartLLM.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  // Trim any leading/trailing whitespace from the response
  const cleanedContent = typeof response.content === 'string' 
    ? response.content.trim() 
    : response.content;
  
  return {
    messages: [new AIMessage(cleanedContent)],
    next: END,
  };
}

/**
 * Routing Logic
 */
function routeAfterSupervisor(state: typeof AgentState.State): string {
  const next = state.next;
  
  if (next === "FINISH" || !next || next === "__end__") {
    return "finalResponse";
  }
  
  return next;
}

/**
 * Build the Graph
 */
const workflow = new StateGraph(AgentState)
  .addNode("supervisor", supervisorNode)
  .addNode("TechnicalAnalyst", technicalAnalystNode)
  .addNode("SentimentAnalyst", sentimentAnalystNode)
  .addNode("MarketResearcher", marketResearcherNode)
  .addNode("finalResponse", finalResponseNode)
  .addEdge("__start__", "supervisor")
  .addConditionalEdges("supervisor", routeAfterSupervisor)
  .addEdge("TechnicalAnalyst", "supervisor")
  .addEdge("SentimentAnalyst", "supervisor")
  .addEdge("MarketResearcher", "supervisor")
  .addEdge("finalResponse", "__end__");

export const stockAdvisorGraph = workflow.compile();
