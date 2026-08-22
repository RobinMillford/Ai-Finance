/**
 * Supervisor plan normalization
 *
 * Pure helpers shared by the advisor graph factory and unit tests.
 * Kept free of LangGraph imports so they run in any environment.
 */

import { z } from "zod";

export const VALID_AGENTS = [
  "TechnicalAnalyst",
  "SentimentAnalyst",
  "MarketResearcher",
] as const;

export type ValidAgent = (typeof VALID_AGENTS)[number];
export const MAX_PLAN_SIZE = 3;

/**
 * Normalize a raw LLM-produced plan into a valid, de-duplicated agent list
 * capped at MAX_PLAN_SIZE.
 */
export function normalizePlan(raw: unknown): ValidAgent[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const plan: ValidAgent[] = [];
  for (const item of raw) {
    if (
      typeof item === "string" &&
      (VALID_AGENTS as readonly string[]).includes(item) &&
      !seen.has(item)
    ) {
      seen.add(item);
      plan.push(item as ValidAgent);
      if (plan.length >= MAX_PLAN_SIZE) break;
    }
  }
  return plan;
}

/** Structured-output schema for the supervisor's plan. */
export const planSchema = z.object({
  agents: z.array(z.string()).max(MAX_PLAN_SIZE).describe(
    "The agents needed to answer the query (0-3). Empty array if no specialist data is needed.\n" +
    "- TechnicalAnalyst: prices, charts, technical indicators\n" +
    "- SentimentAnalyst: social sentiment, community mood\n" +
    "- MarketResearcher: news, macro, regulatory events"
  ),
  reasoning: z.string().describe("Brief explanation of the plan"),
});

// ── Planning input selection ──────────────────────────────────────────────────

/** Max recent non-tool messages fed to the planning LLM. */
export const MAX_PLANNING_MESSAGES = 6;

/** Rough char cap applied to each message's content for planning. */
const MAX_CONTENT_CHARS = 2000;

function toPlanningText(content: unknown): string {
  const text =
    typeof content === "string" ? content : JSON.stringify(content) ?? "";
  return text.length > MAX_CONTENT_CHARS
    ? text.slice(0, MAX_CONTENT_CHARS) + "…[truncated]"
    : text;
}

/**
 * Resolve a message's type whether it is a LangChain BaseMessage
 * (`_getType()`) or a plain `{ role | type, content }` object.
 */
function messageType(m: { _getType?: () => string; type?: string; role?: string }): string {
  if (typeof m._getType === "function") return m._getType();
  return m.type ?? m.role ?? "";
}

/**
 * Build a lean message list for the supervisor's planning call.
 *
 * Strategy (keeps routing prompt small and stable as history grows):
 *  - Drop tool/system messages — raw tool payloads are noise for intent
 *    classification and can dominate the token budget.
 *  - Keep only the most recent MAX_PLANNING_MESSAGES messages.
 *  - Truncate each message's string content.
 *  - Output `{ type, content }` pairs directly usable as LLM input.
 */
export function selectPlanningMessages(
  messages: Array<{ _getType?: () => string; type?: string; role?: string; content: unknown }>
): Array<{ type: "human" | "ai"; content: string }> {
  if (!messages.length) return [];
  const withoutTools = messages.filter((m) => messageType(m) !== "tool");
  const source = withoutTools.length ? withoutTools : messages;
  return source
    .slice(-MAX_PLANNING_MESSAGES)
    .map((m) => ({
      type: messageType(m) === "human" || messageType(m) === "user" ? "human" : "ai",
      content: toPlanningText(m.content),
    }));
}
