/**
 * AI Configuration
 * 
 * Initializes ChatGroq models with different capabilities:
 * - Smart Model (70b): High reasoning for routing and final responses
 * - Fast Model (8b): Quick tool execution for worker nodes
 */

import { ChatGroq } from "@langchain/groq";
import { env, hasValidGroqKey } from "@/lib/env";

// Validate Groq API key
if (!hasValidGroqKey() && env.nodeEnv === 'production') {
  console.error(
    '❌ Invalid Groq API key in production!\n' +
    '   Set GROQ_API_KEY environment variable with a valid key.'
  );
}

/**
 * Smart Model: High-intelligence routing and final response generation
 * Used by: Supervisor, Final Response Generator
 */
export const smartLLM = new ChatGroq({
  apiKey: env.groq.apiKey,
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
  maxTokens: 8192,
  streaming: true,
});

/**
 * Fast Model: Quick tool execution and data processing
 * Used by: All Worker Nodes (TechnicalAnalyst, SentimentAnalyst, MarketResearcher)
 */
export const fastLLM = new ChatGroq({
  apiKey: env.groq.apiKey,
  model: "llama-3.1-8b-instant",
  temperature: 0.3,
  maxTokens: 2048,
  streaming: true,
});

/**
 * API Keys for external services
 */
export const API_KEYS = {
  twelveData: process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY || "",
  tavily: process.env.NEXT_PUBLIC_TAVILY_API_KEY || "",
} as const;

/**
 * Model configuration constants
 */
export const MODEL_CONFIG = {
  smart: {
    name: "llama-3.3-70b-versatile",
    purpose: "Supervisor & Final Response",
    temperature: 0.7,
  },
  fast: {
    name: "llama-3.1-8b-instant",
    purpose: "Worker Nodes & Tool Execution",
    temperature: 0.3,
  },
} as const;
