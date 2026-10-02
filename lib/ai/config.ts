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
 *
 * SECRET LIFECYCLE: the Groq clients below are constructed LAZILY on first
 * runtime access and cached as singletons. Importing this module never
 * requires GROQ_API_KEY, so `next build` can compile every route without
 * production provider credentials. The key is validated on the first access;
 * a missing key in production raises a clear, controlled error there.
 */

import { ChatGroq } from "@langchain/groq";
import { env } from "@/lib/env";

// ── Model configuration (env-driven with defaults) ────────────────────────────
// Build-time safe: plain process.env reads with defaults, no secrets involved.

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

// ── Runtime secret resolution ─────────────────────────────────────────────────

/**
 * Resolve the Groq API key at client-construction time.
 *
 * Production: a missing (or dummy) key throws a clear, controlled error —
 * the secret must be injected through the container environment, never baked
 * into the image.
 *
 * Non-production: keeps the historical development fallback so local dev and
 * tests run without a provider key. The advisor routes already reject
 * requests while the key is a dummy before any LLM call is made.
 */
function requireGroqApiKey(): string {
  const apiKey = env.groq.apiKey;

  if (!apiKey || apiKey.includes("dummy")) {
    if (env.nodeEnv !== "production") {
      return "gsk_dummy-key-for-build-and-development-only";
    }

    throw new Error(
      "GROQ_API_KEY is required at runtime. " +
        "Inject it through the container environment (Docker Compose / .env) — " +
        "it must never be baked into the image."
    );
  }

  return apiKey;
}

// ── Lazy LLM singletons (first runtime access constructs + caches) ────────────

let smartClient: ChatGroq | undefined;
let fastClient: ChatGroq | undefined;
let routingClient: ChatGroq | undefined;

/**
 * Smart Model — high-intelligence routing and final response generation.
 * Used by: Supervisor, Final Response Generator.
 */
export function getSmartLLM(): ChatGroq {
  if (!smartClient) {
    smartClient = new ChatGroq({
      apiKey:      requireGroqApiKey(),
      model:       MODEL_CONFIG.smart.name,
      temperature: MODEL_CONFIG.smart.temperature,
      maxTokens:   MODEL_CONFIG.smart.maxTokens,
      streaming:   true,
    });
  }
  return smartClient;
}

/**
 * Fast Model — quick tool execution and data processing.
 * Used by: All Worker Nodes (TechnicalAnalyst, SentimentAnalyst, MarketResearcher).
 */
export function getFastLLM(): ChatGroq {
  if (!fastClient) {
    fastClient = new ChatGroq({
      apiKey:      requireGroqApiKey(),
      model:       MODEL_CONFIG.fast.name,
      temperature: MODEL_CONFIG.fast.temperature,
      maxTokens:   MODEL_CONFIG.fast.maxTokens,
      streaming:   true,
    });
  }
  return fastClient;
}

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
export function getRoutingLLM(): ChatGroq {
  if (!routingClient) {
    routingClient = new ChatGroq({
      apiKey:      requireGroqApiKey(),
      model:       process.env.GROQ_ROUTING_MODEL ?? MODEL_CONFIG.smart.name,
      temperature: parseFloat(process.env.GROQ_ROUTING_TEMPERATURE ?? "0.1"),
      maxTokens:   parseInt(process.env.GROQ_ROUTING_MAX_TOKENS ?? "512", 10),
    });
  }
  return routingClient;
}
