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
 *   supervisor (plan) ─┬→ TechnicalAnalyst ─┐
 *                      ├→ SentimentAnalyst ─┼─(parallel via Send)→ finalResponse → END
 *                      └→ MarketResearcher ─┘
 */

import {
  StateGraph,
  Annotation,
  Send,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  BaseMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";

import { smartLLM, fastLLM, routingLLM } from "./config";
import { socialTools } from "./tools/social";
import { createSearchTools } from "./tools/search";
import { collectToolResults, withRetry } from "./utils";
import {
  normalizePlan,
  planSchema,
  selectPlanningMessages,
  MAX_PLAN_SIZE,
  type ValidAgent,
} from "./plan";

export {
  VALID_AGENTS,
  MAX_PLAN_SIZE,
  normalizePlan,
} from "./plan";

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
   * Tavily `include_domains` allowlist for the MarketResearcher's web search.
   * Keeps research results relevant to the advisor domain (crypto vs stock vs forex).
   * Omit or pass empty array for unrestricted search.
   */
  searchDomains?: string[];

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
    /**
     * Agent plan produced by the supervisor (max 3 agents).
     * Dispatched in parallel via Send API.
     */
    plan: Annotation<string[]>({
      reducer: (x, y) => y ?? x,
      default: () => [],
    }),
    data: Annotation<Record<string, any>>({
      reducer: (x, y) => ({ ...x, ...y }),
      default: () => ({}),
    }),
    /**
     * Number of agents dispatched (set once by supervisor = plan length).
     * Diagnostic only — the plan cap is enforced by planSchema.max(3).
     */
    agentCalls: Annotation<number>({
      reducer: (x, y) => y ?? x ?? 0,
      default: () => 0,
    }),
  });
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAdvisorGraph(cfg: AdvisorGraphConfig) {
  const AgentState = makeAgentState();
  const log = (node: string, msg: string) =>
    console.log(`[${cfg.name} ${node}] ${msg}`);

  // ── Supervisor (planner) ────────────────────────────────────────────────────
  async function supervisorNode(state: typeof AgentState.State) {
    const systemPrompt = `You are a planning supervisor for a ${cfg.name.toLowerCase()} advisory system.

${cfg.supervisorRouteHint}

**PLANNING RULES**:
1. Simple price or indicator queries: plan ONLY TechnicalAnalyst.
2. Full analysis requests: plan 2-3 relevant agents.
3. Plan ONLY the agents actually needed — every agent costs latency.
4. All planned agents run in parallel; they cannot see each other's results.
5. Maximum ${MAX_PLAN_SIZE} agents.

User query is the last message in the conversation. Decide which specialists it needs.`;

    const llmWithStructure = routingLLM.withStructuredOutput(planSchema);
    let response;
    try {
      response = await withRetry(() =>
        llmWithStructure.invoke([
          new SystemMessage(systemPrompt),
          // Lean planning input: no raw tool payloads, bounded history.
          ...selectPlanningMessages(state.messages),
        ])
      );
    } catch (error) {
      log("Supervisor", `Planning failed: ${error instanceof Error ? error.message : error}. Falling back to full analysis.`);
      return finalizePlan(["TechnicalAnalyst"], "fallback: planning failed");
    }

    const plan = normalizePlan(response.agents);
    log("Supervisor", `→ [${plan.join(", ")}] — ${response.reasoning}`);

    return finalizePlan(plan, response.reasoning);
  }

  function finalizePlan(plan: ValidAgent[], reasoning: string) {
    return {
      plan,
      agentCalls: plan.length,
      messages: [
        new AIMessage(`[Plan: ${plan.join(", ") || "direct answer"}] ${reasoning}`),
      ],
    };
  }

  /**
   * Conditional edge after supervisor.
   * Dispatches all planned agents in parallel via Send API, or goes
   * straight to finalResponse when the plan is empty.
   */
  function routeFromSupervisor(state: typeof AgentState.State) {
    if (!state.plan?.length) return "finalResponse";
    return state.plan.map((agent) => new Send(agent, state));
  }

  // ── Technical Analyst ───────────────────────────────────────────────────────
  async function technicalAnalystNode(state: typeof AgentState.State) {
    const llmWithTools = fastLLM.bindTools(cfg.technicalTools);
    log("TechnicalAnalyst", `Processing with ${state.messages.length} messages`);

    const response = await withRetry(() => llmWithTools.invoke([
      new SystemMessage(cfg.technicalSystemPrompt),
      ...state.messages,
    ]));

    if (response.tool_calls?.length) {
      log("TechnicalAnalyst", `Executing ${response.tool_calls.length} tool call(s)`);
      const toolNode = new ToolNode(cfg.technicalTools);
      const toolResults = await toolNode.invoke({ messages: [response] });
      const technicalData = collectToolResults(toolResults.messages);

      return {
        messages: [response, ...toolResults.messages],
        data: { technical: technicalData },
      };
    }

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
    };
  }

  // ── Sentiment Analyst ───────────────────────────────────────────────────────
  async function sentimentAnalystNode(state: typeof AgentState.State) {
    const llmWithTools = fastLLM.bindTools(socialTools);

    const response = await withRetry(() => llmWithTools.invoke([
      new SystemMessage(cfg.sentimentSystemPrompt),
      ...state.messages,
    ]));

    if (response.tool_calls?.length) {
      const toolNode = new ToolNode(socialTools);
      const toolResults = await toolNode.invoke({ messages: [response] });

      return {
        messages: [response, ...toolResults.messages],
        data: { sentiment: collectToolResults(toolResults.messages) },
      };
    }

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
    };
  }

  // ── Market Researcher ───────────────────────────────────────────────────────
  const researchTools = createSearchTools(cfg.searchDomains);

  async function marketResearcherNode(state: typeof AgentState.State) {
    const llmWithTools = fastLLM.bindTools(researchTools);

    const response = await withRetry(() => llmWithTools.invoke([
      new SystemMessage(cfg.researchSystemPrompt),
      ...state.messages,
    ]));

    if (response.tool_calls?.length) {
      const toolNode = new ToolNode(researchTools);
      const toolResults = await toolNode.invoke({ messages: [response] });

      return {
        messages: [response, ...toolResults.messages],
        data: { [cfg.researchDataKey]: collectToolResults(toolResults.messages) },
      };
    }

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
    };
  }

  // ── Final Response ──────────────────────────────────────────────────────────
  async function finalResponseNode(state: typeof AgentState.State) {
    // All collected data is already serialized into the system prompt via
    // cfg.finalSystemPrompt(state.data). Replaying the full message history
    // (raw tool payloads, worker summaries, plan chatter) would double-count
    // tokens for zero synthesis value — and blows small TPM budgets.
    const lastUserMessage = [...state.messages]
      .reverse()
      .find((m: any) =>
        typeof m?._getType === "function"
          ? m._getType() === "human"
          : m?.type === "human" || m?.role === "user" || m?.role === "human"
      );

    const response = await withRetry(() =>
      smartLLM.invoke([
        new SystemMessage(cfg.finalSystemPrompt(state.data)),
        ...(lastUserMessage ? [lastUserMessage] : []),
      ])
    );

    const cleanedContent =
      typeof response.content === "string"
        ? response.content.trim()
        : response.content;

    return {
      messages: [new AIMessage(cleanedContent)],
    };
  }

  // ── Compile ─────────────────────────────────────────────────────────────────
  // Supervisor plans once → all planned agents run in parallel (Send API)
  // → results merge into state.data → finalResponse synthesizes.
  return new StateGraph(AgentState)
    .addNode("supervisor", supervisorNode)
    .addNode("TechnicalAnalyst", technicalAnalystNode)
    .addNode("SentimentAnalyst", sentimentAnalystNode)
    .addNode("MarketResearcher", marketResearcherNode)
    .addNode("finalResponse", finalResponseNode)
    .addEdge("__start__", "supervisor")
    .addConditionalEdges("supervisor", routeFromSupervisor)
    .addEdge("TechnicalAnalyst", "finalResponse")
    .addEdge("SentimentAnalyst", "finalResponse")
    .addEdge("MarketResearcher", "finalResponse")
    .addEdge("finalResponse", "__end__")
    .compile();
}
