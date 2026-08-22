/**
 * AI Configuration
 *
 * All model names and tunables are read from environment variables so they
 * can be changed without a redeploy.  Sensible defaults are provided so the
 * app works out-of-the-box for local development.
 *
 * Env vars (all optional — defaults shown):
 *   GROQ_SMART_MODEL          openai/gpt-oss-120b
 *   GROQ_FAST_MODEL           openai/gpt-oss-20b
 *   GROQ_SMART_TEMPERATURE    0.7
 *   GROQ_FAST_TEMPERATURE     0.3
 *   GROQ_SMART_MAX_TOKENS     8192
 *   GROQ_FAST_MAX_TOKENS      2048
 *   AI_HISTORY_TOKEN_BUDGET   4000  (history trimmer budget — see lib/ai/utils.ts)
 *
 * API key resolution (handled by lib/env.ts, tries in order):
 *   GROQ_API_KEY → NEXT_PUBLIC_GROQ_API_KEY → NEXT_PUBLIC_GROK_API_KEY (legacy typo)
 */

import { ChatGroq } from "@langchain/groq";
import { env } from "@/lib/env";

// ── Model configuration (env-driven with defaults) ────────────────────────────

export const MODEL_CONFIG = {
  smart: {
    name:        process.env.GROQ_SMART_MODEL       ?? "openai/gpt-oss-120b",
    temperature: parseFloat(process.env.GROQ_SMART_TEMPERATURE ?? "0.7"),
    maxTokens:   parseInt(process.env.GROQ_SMART_MAX_TOKENS    ?? "8192", 10),
    purpose:     "Final Response Synthesis",
  },
  fast: {
    name:        process.env.GROQ_FAST_MODEL        ?? "openai/gpt-oss-20b",
    temperature: parseFloat(process.env.GROQ_FAST_TEMPERATURE  ?? "0.3"),
    maxTokens:   parseInt(process.env.GROQ_FAST_MAX_TOKENS     ?? "2048", 10),
    purpose:     "Worker Nodes & Tool Execution",
  },
} as const;

// ── LLM singletons ────────────────────────────────────────────────────────────

/**
 * Smart Model — high-intelligence routing and final response generation.
 * Used by: Supervisor, Final Response Generator.
 */
export const smartLLM = new ChatGroq({
  apiKey:      env.groq.apiKey,
  model:       MODEL_CONFIG.smart.name,
  temperature: MODEL_CONFIG.smart.temperature,
  maxTokens:   MODEL_CONFIG.smart.maxTokens,
  streaming:   true,
});

/**
 * Fast Model — quick tool execution and data processing.
 * Used by: All Worker Nodes (TechnicalAnalyst, SentimentAnalyst, MarketResearcher).
 */
export const fastLLM = new ChatGroq({
  apiKey:      env.groq.apiKey,
  model:       MODEL_CONFIG.fast.name,
  temperature: MODEL_CONFIG.fast.temperature,
  maxTokens:   MODEL_CONFIG.fast.maxTokens,
  streaming:   true,
});

/**
 * Routing Model — deterministic agent planning for the Supervisor.
 * Low temperature for stable routing decisions; small token budget since
 * the output is only a short structured plan.
 *
 * Degrade path: if planning fails after retries (rate limit, parse error),
 * the supervisor falls back to a TechnicalAnalyst-only plan instead of
 * failing the request — see graph-factory supervisorNode.
 *
 * Used by: Supervisor (plan generation).
 */
export const routingLLM = new ChatGroq({
  apiKey:      env.groq.apiKey,
  model:       process.env.GROQ_ROUTING_MODEL ?? MODEL_CONFIG.smart.name,
  temperature: parseFloat(process.env.GROQ_ROUTING_TEMPERATURE ?? "0.1"),
  maxTokens:   parseInt(process.env.GROQ_ROUTING_MAX_TOKENS ?? "512", 10),
});

// ── External API keys ─────────────────────────────────────────────────────────
export const API_KEYS = {
  twelveData: env.twelveData.apiKey,
  tavily:     env.tavily.apiKey,
} as const;
