/**
 * Multi-Agent Forex Advisor Graph
 * 
 * Orchestrator-Workers pattern using LangGraph for forex pair analysis
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { smartLLM, fastLLM } from "./config";
import { forexTools } from "./tools/forex";
import { socialTools } from "./tools/social";
import { searchTools } from "./tools/search";
import { z } from "zod";

/**
 * Agent State Definition
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
 * Routing Schema
 */
const routeSchema = z.object({
  next: z.enum([
    "TechnicalAnalyst",
    "SentimentAnalyst", 
    "MarketResearcher",
    "FINISH",
  ]).describe(
    "The next agent to route to. Choose based on the query:\n" +
    "- TechnicalAnalyst: For exchange rates, technical indicators, pip movements\n" +
    "- SentimentAnalyst: For social sentiment, trader mood, community analysis\n" +
    "- MarketResearcher: For news, central bank policies, economic events\n" +
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
    console.log(`[Forex Supervisor] Maximum calls reached (${agentCalls}). Forcing FINISH.`);
    return {
      next: "FINISH",
      messages: [
        new AIMessage({
          content: "[Routing to Final Response] All necessary forex data collected.",
        }),
      ],
    };
  }
  
  const systemPrompt = `You are a routing supervisor for a forex advisory system.

Route to:
- **TechnicalAnalyst**: Exchange rates, pip movements, RSI, MACD, EMA, support/resistance
- **SentimentAnalyst**: Trader sentiment, community mood, social trends
- **MarketResearcher**: News, central bank policies, economic data, geopolitical events
- **FINISH**: When you have enough data to answer the user's query

**ROUTING RULES**:
1. For simple price queries ("What is the price of EUR/USD?"): Call TechnicalAnalyst ONCE, then FINISH
2. For indicator queries ("What's the RSI for GBP/JPY?"): Call TechnicalAnalyst ONCE, then FINISH
3. For analysis requests ("Analyze EUR/USD"): Call 2-3 relevant agents, then FINISH
4. ALWAYS choose FINISH if the previous agent provided data that answers the user's question
5. **${agentCalls} agent calls made. Maximum is 3. If >= 2 calls made, strongly prefer FINISH**

Current data collected: ${JSON.stringify(state.data, null, 2)}

Previous agent responses: ${messages.slice(-2).map(m => m.content).join("\n")}

**Ask yourself**: Does the collected data already answer the user's query? If YES, route to FINISH.

Which agent should handle this forex query next?`;

  const llmWithStructuredOutput = smartLLM.withStructuredOutput(routeSchema);
  
  const response = await llmWithStructuredOutput.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  console.log(`[Forex Supervisor] Routing to: ${response.next} - ${response.reasoning} (Calls: ${agentCalls})`);
  
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
  
  const systemPrompt = `You are a Technical Analyst for forex pairs.

Tools:
- get_forex_quote: Exchange rates, spreads, daily changes
- get_forex_indicators: RSI, MACD, EMA, BBANDS, ATR, ADX

Task: Use tools to gather technical data for the forex pair. Summarize findings clearly.
Focus on: Exchange rate trends, momentum, volatility, key levels.`;

  const llmWithTools = fastLLM.bindTools(forexTools);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolNode = new ToolNode(forexTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
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
 * Sentiment Analyst Node
 */
async function sentimentAnalystNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Sentiment Analyst for forex markets.

Tools:
- get_reddit_sentiment: Analyze forex trader sentiment and community mood

Task: Analyze social sentiment for the forex pair. Provide insights on trader psychology.
Focus on: Bullish/bearish sentiment, trader confidence, market mood.`;

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
  
  return {
    messages: [response],
    next: "supervisor",
    agentCalls: 1,
  };
}

/**
 * Market Researcher Node
 */
async function marketResearcherNode(state: typeof AgentState.State) {
  const messages = state.messages;
  
  const systemPrompt = `You are a Market Researcher for forex markets.

Tools:
- tavily_search_results_json: Search forex news, central bank policies, economic events
- get_market_intelligence: Comprehensive market analysis and alerts

Task: Research market context and external factors affecting the forex pair.
Focus on: Economic data, central bank decisions, geopolitical events, market alerts.`;

  const llmWithTools = fastLLM.bindTools(searchTools);
  
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolNode = new ToolNode(searchTools);
    const toolResults = await toolNode.invoke({ messages: [response] });
    
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
 */
async function finalResponseNode(state: typeof AgentState.State) {
  const messages = state.messages;
  const collectedData = state.data;
  
  const systemPrompt = `You are an expert Forex Advisor delivering professional currency market analysis.

Available data from specialist agents:
${JSON.stringify(collectedData, null, 2)}

CRITICAL INSTRUCTIONS:
1. Start IMMEDIATELY with your analysis - NO preamble, NO meta-commentary
2. Include specific exchange rates, pip movements, and percentages
3. Write naturally, synthesizing data into insights
4. Tell a story about what's happening with the currency pair

STRICTLY FORBIDDEN - DO NOT include ANY of these:
❌ "about analyzing EUR/USD"
❌ "Now, the response should be generated based on the given data"
❌ "Let me analyze..."
❌ "Based on the data provided..."
❌ "Looking at the information..."
❌ "Here's my analysis..."
❌ Any meta-commentary about generating the response

CORRECT APPROACH - Include numbers but with interpretation:
✅ "EUR/USD is trading at 1.0875, down 45 pips (-0.41%) today, testing key support near 1.0850. The RSI at 42 signals neutral conditions, while the bearish MACD crossover at -0.0012 suggests continued downside pressure. The pair remains below its 20-day EMA of 1.0920."

✅ "The dollar strengthens against the yen, with USD/JPY climbing to 149.85 (up 0.68%). The 50-pip rally finds resistance at the psychological 150.00 level. The ADX at 28 confirms a developing trend, while trader sentiment shows 58% bearish positions."

STRUCTURE:
- Begin directly with market insight (NO introduction)
- Weave in specific rates and pip movements naturally
- Provide interpretation alongside data
- Use ## headers for sections
- Include pip targets and levels
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
export function createForexAdvisorGraph() {
  const workflow = new StateGraph(AgentState)
    .addNode("supervisor", supervisorNode)
    .addNode("TechnicalAnalyst", technicalAnalystNode)
    .addNode("SentimentAnalyst", sentimentAnalystNode)
    .addNode("MarketResearcher", marketResearcherNode)
    .addNode("finalResponse", finalResponseNode)
    
    .addEdge("__start__", "supervisor")
    
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
    
    .addEdge("TechnicalAnalyst", "supervisor")
    .addEdge("SentimentAnalyst", "supervisor")
    .addEdge("MarketResearcher", "supervisor")
    
    .addEdge("finalResponse", END);
  
  return workflow.compile();
}

/**
 * Export the graph instance
 */
export const forexAdvisorGraph = createForexAdvisorGraph();
