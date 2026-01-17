/**
 * AI Configuration
 * 
 * Initializes ChatGroq models with different capabilities:
 * - Smart Model (70b): High reasoning for routing and final responses
 * - Fast Model (8b): Quick tool execution for worker nodes
 */

import { ChatGroq } from "@langchain/groq";

// Validate required environment variables
const requiredEnvVars = {
  NEXT_PUBLIC_GROK_API_KEY: process.env.NEXT_PUBLIC_GROK_API_KEY,
  NEXT_PUBLIC_TWELVEDATA_API_KEY: process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY,
  NEXT_PUBLIC_TAVILY_API_KEY: process.env.NEXT_PUBLIC_TAVILY_API_KEY,
} as const;

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.warn(
    `⚠️  Missing environment variables: ${missingVars.join(", ")}\n` +
    `Some AI features may not work correctly.`
  );
}

/**
 * Smart Model: High-intelligence routing and final response generation
 * Used by: Supervisor, Final Response Generator
 */
export const smartLLM = new ChatGroq({
  apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY || "",
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
  apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY || "",
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
