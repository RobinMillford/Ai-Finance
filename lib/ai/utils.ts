/**
 * Shared AI utilities
 */

import { BaseMessage } from "@langchain/core/messages";

/**
 * Rough token count for a piece of text.
 * Uses the ~4 chars-per-token rule of thumb for English / mixed content.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Trim a message array to fit within a token budget.
 *
 * Strategy:
 *  - The most-recent message (current user query) is always kept.
 *  - Older messages are added newest-first until the budget is exhausted.
 *  - If a single message already exceeds the budget it is still kept alone
 *    so the graph always has something to work with.
 *
 * @param messages  Raw message objects from the request body `{ role, content }`
 * @param budget    Maximum estimated tokens to keep (default from env, else 4000)
 */
export function trimToTokenBudget(
  messages: Array<{ role: string; content: string }>,
  budget?: number
): Array<{ role: string; content: string }> {
  const tokenBudget =
    budget ??
    parseInt(process.env.AI_HISTORY_TOKEN_BUDGET ?? "4000", 10);

  if (messages.length === 0) return messages;

  let usedTokens = 0;
  const kept: Array<{ role: string; content: string }> = [];

  // Iterate newest → oldest; always keep at least the last message
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(
      typeof messages[i].content === "string"
        ? messages[i].content
        : JSON.stringify(messages[i].content)
    );

    if (usedTokens + tokens > tokenBudget && kept.length > 0) break;

    kept.unshift(messages[i]);
    usedTokens += tokens;
  }

  return kept;
}

/**
 * Collect tool-call results from a list of LangChain messages into a plain object.
 * Shared across all worker nodes.
 */
export function collectToolResults(messages: BaseMessage[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const msg of messages) {
    if (msg._getType() === "tool") {
      const raw =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      const name = (msg as any).name ?? "unknown";
      try {
        data[name] = JSON.parse(raw);
      } catch {
        data[name] = msg.content;
      }
    }
  }
  return data;
}
