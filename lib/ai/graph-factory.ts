/**
 * Advisor Graph Factory
 *
 * Creates a compiled LangGraph multi-agent workflow from a domain config.
 * All three advisor types (crypto, stock, forex) share this factory — each
 * domain only provides the parts that actually differ:
 *   - Which technical tools to use
 *   - Domain-specific system prompts for every node
 *
 * Architecture (identical for every domain):
 *   supervisor → TechnicalAnalyst ─┐
 *             → SentimentAnalyst  ─┼→ supervisor → … → finalResponse → END
 *             → MarketResearcher  ─┘
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  BaseMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";

import { smartLLM, fastLLM } from "./config";
import { socialTools } from "./tools/social";
import { searchTools } from "./tools/search";
import { collectToolResults } from "./utils";

// ── Config type ───────────────────────────────────────────────────────────────

export interface AdvisorGraphConfig {
  /** Short display name used in log prefixes, e.g. "Crypto", "Stock", "Forex" */
  name: string;

  /** Domain-specific tools wired to the TechnicalAnalyst worker */
  technicalTools: any[];

  /** System prompt for the TechnicalAnalyst worker node */
  technicalSystemPrompt: string;

  /** System prompt for the SentimentAnalyst worker node */
  sentimentSystemPrompt: string;

  /** System prompt for the MarketResearcher worker node */
  researchSystemPrompt: string;

  /**
   * State.data key under which the researcher stores its results.
   * Use "market" for crypto/forex, "research" for stocks.
   */
  researchDataKey: string;

  /**
   * Domain-specific routing hints injected into the supervisor's system prompt.
   * List what each worker is best for in this domain.
   */
  supervisorRouteHint: string;

  /**
   * Final response system prompt factory.
   * Receives the full state.data object so domain-specific examples can reference
   * actual collected fields.
   */
  finalSystemPrompt: (data: Record<string, any>) => string;
}

// ── Shared state + schema (identical for all domains) ─────────────────────────

function makeAgentState() {
  return Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
    next: Annotation<string>({
      reducer: (x, y) => y ?? x ?? "supervisor",
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
}

const routeSchema = z.object({
  next: z
    .enum(["TechnicalAnalyst", "SentimentAnalyst", "MarketResearcher", "FINISH"])
    .describe(
      "The next agent to route to.\n" +
      "- TechnicalAnalyst: prices, charts, technical indicators\n" +
      "- SentimentAnalyst: social sentiment, community mood\n" +
      "- MarketResearcher: news, macro, regulatory events\n" +
      "- FINISH: sufficient data collected to answer the query"
    ),
  reasoning: z.string().describe("Brief explanation of why this agent was chosen"),
});

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAdvisorGraph(cfg: AdvisorGraphConfig) {
  const AgentState = makeAgentState();
  const log = (node: string, msg: string) =>
    console.log(`[${cfg.name} ${node}] ${msg}`);

  // ── Supervisor ──────────────────────────────────────────────────────────────
  async function supervisorNode(state: typeof AgentState.State) {
    const agentCalls = state.agentCalls ?? 0;

    if (agentCalls >= 3) {
      log("Supervisor", `Max agent calls reached (${agentCalls}). Forcing FINISH.`);
      return {
        next: "FINISH",
        messages: [
          new AIMessage("[Routing to Final Response] All necessary data collected."),
        ],
      };
    }

    const systemPrompt = `You are a routing supervisor for a ${cfg.name.toLowerCase()} advisory system.

${cfg.supervisorRouteHint}

**ROUTING RULES**:
1. Simple price queries: Call TechnicalAnalyst ONCE, then FINISH.
2. Indicator queries: Call TechnicalAnalyst ONCE, then FINISH.
3. Full analysis requests: Call 2-3 relevant agents, then FINISH.
4. ALWAYS choose FINISH once the collected data answers the user's query.
5. **${agentCalls} agent calls made so far. Maximum is 3. If >= 2, strongly prefer FINISH.**

Current data collected:
${JSON.stringify(state.data, null, 2)}

Last agent responses:
${state.messages.slice(-2).map((m) => m.content).join("\n")}

Does the collected data already answer the user's query? If YES, route to FINISH.`;

    const llmWithStructure = smartLLM.withStructuredOutput(routeSchema);
    const response = await llmWithStructure.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]);

    log("Supervisor", `→ ${response.next} — ${response.reasoning} (calls: ${agentCalls})`);

    return {
      next: response.next,
      messages: [
        new AIMessage(`[Routing to ${response.next}] ${response.reasoning}`),
      ],
    };
  }

  // ── Technical Analyst ───────────────────────────────────────────────────────
  async function technicalAnalystNode(state: typeof AgentState.State) {
    const llmWithTools = fastLLM.bindTools(cfg.technicalTools);
    log("TechnicalAnalyst", `Processing with ${state.messages.length} messages`);

    const response = await llmWithTools.invoke([
      new SystemMessage(cfg.technicalSystemPrompt),
      ...state.messages,
    ]);

    if (response.tool_calls?.length) {
      log("TechnicalAnalyst", `Executing ${response.tool_calls.length} tool call(s)`);
      const toolNode = new ToolNode(cfg.technicalTools);
      const toolResults = await toolNode.invoke({ messages: [response] });
      const technicalData = collectToolResults(toolResults.messages);

      return {
        messages: [response, ...toolResults.messages],
        data: { technical: technicalData },
        next: "supervisor",
        agentCalls: 1,
      };
    }

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
      next: "supervisor",
      agentCalls: 1,
    };
  }

  // ── Sentiment Analyst ───────────────────────────────────────────────────────
  async function sentimentAnalystNode(state: typeof AgentState.State) {
    const llmWithTools = fastLLM.bindTools(socialTools);

    const response = await llmWithTools.invoke([
      new SystemMessage(cfg.sentimentSystemPrompt),
      ...state.messages,
    ]);

    if (response.tool_calls?.length) {
      const toolNode = new ToolNode(socialTools);
      const toolResults = await toolNode.invoke({ messages: [response] });

      return {
        messages: [response, ...toolResults.messages],
        data: { sentiment: collectToolResults(toolResults.messages) },
        next: "supervisor",
        agentCalls: 1,
      };
    }

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
      next: "supervisor",
      agentCalls: 1,
    };
  }

  // ── Market Researcher ───────────────────────────────────────────────────────
  async function marketResearcherNode(state: typeof AgentState.State) {
    const llmWithTools = fastLLM.bindTools(searchTools);

    const response = await llmWithTools.invoke([
      new SystemMessage(cfg.researchSystemPrompt),
      ...state.messages,
    ]);

    if (response.tool_calls?.length) {
      const toolNode = new ToolNode(searchTools);
      const toolResults = await toolNode.invoke({ messages: [response] });

      return {
        messages: [response, ...toolResults.messages],
        data: { [cfg.researchDataKey]: collectToolResults(toolResults.messages) },
        next: "supervisor",
        agentCalls: 1,
      };
    }

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
      next: "supervisor",
      agentCalls: 1,
    };
  }

  // ── Final Response ──────────────────────────────────────────────────────────
  async function finalResponseNode(state: typeof AgentState.State) {
    const response = await smartLLM.invoke([
      new SystemMessage(cfg.finalSystemPrompt(state.data)),
      ...state.messages,
    ]);

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
      next: END,
    };
  }

  // ── Routing ─────────────────────────────────────────────────────────────────
  function routeAfterSupervisor(state: typeof AgentState.State): string {
    const next = state.next;
    if (next === "FINISH" || !next || next === "__end__") return "finalResponse";
    return next;
  }

  // ── Compile ─────────────────────────────────────────────────────────────────
  return new StateGraph(AgentState)
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
    .addEdge("finalResponse", "__end__")
    .compile();
}
