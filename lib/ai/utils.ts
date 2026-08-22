/**
 * Shared AI utilities
 */

import { BaseMessage } from "@langchain/core/messages";
import { encodingForModel } from "js-tiktoken";

// ── Retry with backoff (LLM calls) ────────────────────────────────────────────

/** Default: 2 retries, 1s base delay, ~10s total worst case. */
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 1000;

/**
 * Decide whether an error is transient and worth retrying.
 * Covers Groq/OpenAI rate limits, provider outages, timeouts, network blips.
 * Exported for unit testing.
 */
export function isTransientError(error: unknown): boolean {
  const raw =
    error instanceof Error ? error.message : String(error ?? "");
  const msg = raw.toLowerCase();
  // 413 = request too large — deterministic, retrying cannot shrink the payload
  if (msg.includes("413") || msg.includes("request too large")) return false;
  if (error instanceof Error) {
    return (
      msg.includes("429") ||
      msg.includes("rate_limit") ||
      msg.includes("503") ||
      msg.includes("502") ||
      msg.includes("overloaded") ||
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("fetch failed") ||
      msg.includes("network")
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff + jitter on transient
 * errors. Non-transient errors propagate immediately.
 *
 * The @langchain/groq client hardcodes maxRetries: 0, so application-level
 * retrying is the only protection against Groq rate limits / blips.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = parseInt(
    process.env.LLM_MAX_RETRIES ?? String(DEFAULT_MAX_RETRIES),
    10
  ),
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !isTransientError(error)) throw error;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      console.warn(
        `[AI retry] Transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`,
        error instanceof Error ? error.message : error
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * Rough token count for a piece of text.
 * Uses the ~4 chars-per-token rule of thumb for English / mixed content.
 */
/**
 * Real BPE tokenizer (o200k). Accurate for English AND JSON/tool blobs —
 * unlike the old ~chars/4 estimate, which undercounted dense JSON 30-50%.
 */
const encoder = encodingForModel("gpt-4o");

function countTokens(text: string): number {
  return encoder.encode(text).length;
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
    const tokens = countTokens(
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = msg.content;
      }

      const existing = data[name];
      if (existing === undefined) {
        data[name] = parsed;
      } else if (Array.isArray(existing)) {
        existing.push(parsed);
      } else {
        data[name] = [existing, parsed];
      }
    }
  }
  return data;
}
