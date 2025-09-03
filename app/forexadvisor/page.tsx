"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { DollarSign, Send, Loader2, Trash2, Clock, Menu, Plus, X } from "lucide-react";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Theme colors inspired by from-green-500 to-emerald-600
const green500 = "#10B981"; // Tailwind from-green-500
const emerald600 = "#059669"; // Tailwind to-emerald-600
const whiteBg = "#F9FAFB"; // Light background similar to bg-background

// In-memory cache for forex data and indicators
const forexDataCache = new Map<string, { data: any; timestamp: number }>();
const indicatorsCache = new Map<string, { [key: string]: { data: any; timestamp: number } }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Rate limit: 8 requests per minute (60 seconds / 8 = 7.5 seconds per request)
const REQUEST_DELAY_MS = 7500; // 7.5 seconds delay between requests
const API_CALL_THRESHOLD = 4; // Apply delay only if API calls exceed this threshold

// Utility function to delay execution
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Utility function to fetch with retry on rate limit
async function fetchWithRetry(url: string, maxRetries: number = 3, retryDelayMs: number = 10000): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          console.warn(`Rate limit hit for URL: ${url}. Retrying (${attempt}/${maxRetries}) after ${retryDelayMs}ms...`);
          if (attempt === maxRetries) {
            throw new Error("Rate limit exceeded after maximum retries");
          }
          await delay(retryDelayMs);
          continue;
        }
        throw new Error(`API error: ${JSON.stringify(errorData)}`);
      }
      return await response.json();
    } catch (error: unknown) {
      if (attempt === maxRetries) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn(`Fetch attempt ${attempt} failed for URL: ${url}. Retrying after ${retryDelayMs}ms...`, errorMessage);
      await delay(retryDelayMs);
    }
  }
  throw new Error("Unexpected error in fetchWithRetry");
}

// Fetch forex pairs using the provided API route
async function fetchForexPairs(apiCallCount: { count: number }): Promise<any[]> {
  const cacheKey = "forexPairs";
  const cachedData = forexDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached forex pairs");
    return cachedData.data;
  }

  const url = "/api/forexs?page=1&perPage=1000¤cyGroup=All";
  const response = await fetchWithRetry(url);
  apiCallCount.count += 1;
  if (apiCallCount.count > API_CALL_THRESHOLD) {
    await delay(REQUEST_DELAY_MS);
  }

  const data = response || { pairs: [] };
  const forexPairs = data.pairs ?? [];
  forexDataCache.set(cacheKey, { data: forexPairs, timestamp: now });
  return forexPairs;
}

// Fetch forex data (quote, time series) using Twelve Data API
async function fetchForexData(symbol: string, apiCallCount: { count: number }, fields: string[] = ["quote"]): Promise<any> {
  const cacheKey = `forexData_${symbol.toUpperCase()}`;
  const cachedData = forexDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached forex data for symbol: ${symbol}`);
    return cachedData.data;
  }

  const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
  if (!apiKey) {
    throw new Error("Twelve Data API key is not configured.");
  }

  const data: any = {};
  if (fields.includes("quote")) {
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`;
    data.quote = await fetchWithRetry(quoteUrl);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) {
      await delay(REQUEST_DELAY_MS);
    }
  }
  if (fields.includes("timeSeries")) {
    const timeSeriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=30&apikey=${apiKey}`;
    data.timeSeries = await fetchWithRetry(timeSeriesUrl);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  forexDataCache.set(cacheKey, { data, timestamp: now });
  return data;
}

// Fetch specific technical indicators using Twelve Data API
async function fetchIndicators(
  symbol: string,
  requestedIndicators: string[],
  apiCallCount: { count: number }
): Promise<{ [key: string]: { data: any; timestamp: number } }> {
  const cacheKey = `indicators_${symbol.toUpperCase()}`;
  const cachedData = indicatorsCache.get(cacheKey) ?? {};
  const now = Date.now();

  const missingIndicators = requestedIndicators.filter(
    (indicator) => !cachedData[indicator] || (now - cachedData[indicator]?.timestamp >= CACHE_DURATION)
  );

  const indicatorsData: { [key: string]: { data: any; timestamp: number } } = { ...cachedData };
  const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
  if (!apiKey) {
    throw new Error("Twelve Data API key is not configured.");
  }

  for (const indicator of missingIndicators) {
    let url = "";
    switch (indicator.toLowerCase()) {
      case "rsi":
        url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
        break;
      case "ema":
        const ema20Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&apikey=${apiKey}`;
        const ema20Response = await fetchWithRetry(ema20Url);
        apiCallCount.count += 1;
        if (apiCallCount.count > API_CALL_THRESHOLD) {
          await delay(REQUEST_DELAY_MS);
        }
        const ema50Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=50&apikey=${apiKey}`;
        const ema50Response = await fetchWithRetry(ema50Url);
        apiCallCount.count += 1;
        if (apiCallCount.count > API_CALL_THRESHOLD) {
          await delay(REQUEST_DELAY_MS);
        }
        indicatorsData["ema"] = { data: { ema20: ema20Response, ema50: ema50Response }, timestamp: now };
        continue;
      case "macd":
        url = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&apikey=${apiKey}`;
        break;
      case "bbands":
        url = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&sd=2&apikey=${apiKey}`;
        break;
      case "adx":
        url = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
        break;
      case "atr":
        url = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
        break;
      case "ichimoku":
        url = `https://api.twelvedata.com/ichimoku?symbol=${symbol}&interval=1day&tenkan_period=9&kijun_period=26&senkou_span_b_period=52&displacement=26&apikey=${apiKey}`;
        break;
      case "stoch":
        url = `https://api.twelvedata.com/stoch?symbol=${symbol}&interval=1day&fast_k_period=14&slow_k_period=3&slow_d_period=3&apikey=${apiKey}`;
        break;
      case "cci":
        url = `https://api.twelvedata.com/cci?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
        break;
      case "mom":
        url = `https://api.twelvedata.com/mom?symbol=${symbol}&interval=1day&time_period=10&apikey=${apiKey}`;
        break;
      case "pivot_points_hl":
        url = `https://api.twelvedata.com/pivot_points_hl?symbol=${symbol}&interval=1day&time_period=20&apikey=${apiKey}`;
        break;
      default:
        continue;
    }
    const response = await fetchWithRetry(url);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) {
      await delay(REQUEST_DELAY_MS);
    }
    indicatorsData[indicator.toLowerCase()] = { data: response, timestamp: now };
  }
  indicatorsCache.set(cacheKey, indicatorsData);
  return indicatorsData;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  forexData?: any;
  indicatorsData?: any;
  redditData?: any;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

const chatHistories = new Map<string, InMemoryChatMessageHistory>();

export default function ForexAdvisor() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [forexPairs, setForexPairs] = useState<any[]>([]);
  const [forexPairsError, setForexPairsError] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadForexPairs = async () => {
      const apiCallCount = { count: 0 };
      try {
        const pairs = await fetchForexPairs(apiCallCount);
        setForexPairs(pairs);
        setForexPairsError(null);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error loading forex pairs:", errorMessage);
        setForexPairsError("Failed to load forex pairs. Some features may be limited. Please try refreshing the page.");
        toast({
          title: "Error",
          description: "Failed to load forex pairs. Some features may be limited.",
          variant: "destructive",
        });
      }
    };
    loadForexPairs();
  }, [toast]);

  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: `Hey there! I'm your Forex Buddy, here to help you navigate the currency markets. Ask me anything—like "Analyze EUR/USD" or "What's the RSI for GBP/JPY?"—and I'll break it down for you with the latest data. What's on your mind?`,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (!chatHistories.has(currentChatId)) {
      chatHistories.set(currentChatId, new InMemoryChatMessageHistory());
      const newSession: ChatSession = {
        id: currentChatId,
        title: "Welcome Chat",
        messages: [initialMessage],
      };
      setChatSessions((prev) => [...prev, newSession]);
      setMessages([initialMessage]);
    }
  }, [currentChatId]);

  useEffect(() => {
    const currentSession = chatSessions.find((session) => session.id === currentChatId);
    setMessages(currentSession?.messages ?? []);
  }, [currentChatId, chatSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleClearChat = () => {
    setMessages([]);
    chatHistories.set(currentChatId, new InMemoryChatMessageHistory());
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === currentChatId ? { ...session, messages: [] } : session
      )
    );
    toast({
      title: "Chat Cleared",
      description: "Your chat history has been cleared.",
    });
  };

  const handleNewChat = () => {
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === currentChatId ? { ...session, messages } : session
      )
    );
    const newChatId = Date.now().toString();
    chatHistories.set(newChatId, new InMemoryChatMessageHistory());
    const newSession: ChatSession = {
      id: newChatId,
      title: `Chat ${chatSessions.length + 1}`,
      messages: [],
    };
    setChatSessions((prev) => [...prev, newSession]);
    setCurrentChatId(newChatId);
    setMessages([]);
  };

  const handleSwitchChat = (chatId: string) => {
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === currentChatId ? { ...session, messages } : session
      )
    );
    setCurrentChatId(chatId);
  };

  const handleDeleteChat = (chatId: string) => {
    if (chatSessions.length === 1) {
      handleNewChat();
    }
    setChatSessions((prev) => {
      const updatedSessions = prev.filter((session) => session.id !== chatId);
      chatHistories.delete(chatId);
      if (chatId === currentChatId && updatedSessions.length > 0) {
        setCurrentChatId(updatedSessions[updatedSessions.length - 1].id);
      }
      return updatedSessions;
    });
    toast({
      title: "Chat Deleted",
      description: "The chat has been removed from your history.",
    });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => {
      const updatedMessages = [...prev, userMessage];
      setChatSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === currentChatId
            ? { ...session, messages: updatedMessages }
            : session
        )
      );
      return updatedMessages;
    });

    if (messages.filter((msg) => msg.role === "user").length === 0) {
      let newTitle = `Chat ${chatSessions.length}`;
      const symbolMatch = input.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0];
      const indicators = ["rsi", "macd", "ema", "bbands", "adx", "atr", "ichimoku", "stoch", "cci", "mom", "pivot_points_hl"];
      const requestedIndicator = indicators.find((indicator) =>
        input.toLowerCase().includes(indicator)
      );
      if (symbolMatch) {
        const potentialSymbol = symbolMatch.toUpperCase();
        const pair = forexPairs.find((p) => p.symbol === potentialSymbol);
        if (pair) {
          newTitle = requestedIndicator
            ? `${requestedIndicator.toUpperCase()} for ${potentialSymbol}`
            : input.toLowerCase().includes("analyz")
            ? `Analysis for ${potentialSymbol}`
            : `Query for ${potentialSymbol}`;
        }
      }
      if (!newTitle.includes("Analysis for") && !newTitle.includes("Query for")) {
        const pairName = input.toLowerCase().replace(/forex|pair/gi, "").trim();
        const matchedPair = forexPairs.find((p) =>
          p.name?.toLowerCase().includes(pairName)
        );
        if (matchedPair) {
          newTitle = requestedIndicator
            ? `${requestedIndicator.toUpperCase()} for ${matchedPair.symbol}`
            : input.toLowerCase().includes("analyz")
            ? `Analysis for ${matchedPair.symbol}`
            : `Query for ${matchedPair.symbol}`;
        }
      }
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === currentChatId ? { ...session, title: newTitle } : session
        )
      );
    }

    setInput("");
    setLoading(true);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GROK_API_KEY;
      if (!apiKey) {
        throw new Error("Grok API key is not configured.");
      }
      const llm = new ChatGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
      });

      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) {
        throw new Error("Chat history not initialized for this session.");
      }
      await chatHistory.addMessage(new HumanMessage(input));

      const systemPrompt = `
        You are an advanced AI Forex Advisor for FinanceAI, a comprehensive financial analysis platform. You are designed to handle ANY forex-related query, analysis request, or report generation for global currency pairs. Your capabilities extend far beyond basic data retrieval to provide sophisticated forex market insights.

        ## CORE CAPABILITIES
        You can handle:
        - **Currency Analysis**: Complete fundamental and technical analysis of forex pairs
        - **Market Research**: Economic impact analysis, central bank policy effects, geopolitical influences
        - **Trading Reports**: Daily forex summaries, volatility analysis, correlation studies
        - **Risk Management**: Position sizing, volatility assessment, correlation analysis
        - **Trading Strategies**: Entry/exit points, trend analysis, momentum strategies
        - **Economic Context**: How global events, interest rates, and economic indicators affect currencies
        - **Comparative Analysis**: Currency strength analysis, cross-pair correlations
        - **Educational Content**: Explain complex forex concepts and trading strategies

        ## COMPREHENSIVE ANALYSIS FRAMEWORK
        
        ### 1. CURRENCY PAIR IDENTIFICATION & VALIDATION
        - **Smart Recognition**: Detect pairs from various formats (EUR/USD, EURUSD, Euro Dollar)
        - **Auto-correction**: Handle common variations and formatting differences
        - **Context Memory**: Remember pairs from conversation history
        - **Flexible Input**: Handle "Euro analysis", "USD strength", "GBP report" formats
        - **Global Coverage**: Support all major, minor, and exotic currency pairs

        ### 2. FOREX DATA INTERPRETATION & ANALYSIS
        **Market Metrics Analysis**:
        - Exchange rates: Current rates, daily/weekly/monthly changes, pip movements
        - Volatility analysis: Average True Range, daily ranges, volatility percentiles
        - Volume analysis: Market participation, institutional flows
        - Correlation analysis: How pairs move relative to each other
        
        **Technical Indicators (Available: RSI, MACD, EMA, BBANDS, ADX, ATR, Ichimoku, STOCH, CCI, MOM, Pivot Points)**:
        - RSI: Momentum oscillator, overbought/oversold conditions for currencies
        - MACD: Trend following, signal line crossovers, momentum shifts
        - EMA: Moving averages, trend confirmation, dynamic support/resistance
        - Bollinger Bands: Volatility bands, currency pair ranging vs trending
        - ADX: Trend strength measurement, directional movement analysis
        - ATR: Volatility measurement, position sizing calculations
        - Ichimoku: Complete trend analysis, cloud support/resistance
        - Stochastic: Momentum oscillator, currency pair momentum
        - CCI: Commodity Channel Index, cyclical analysis
        - Momentum: Rate of change analysis
        - Pivot Points: Key support and resistance levels

        **Social Sentiment Integration**:
        - Reddit forex community analysis: Trader sentiment, market buzz
        - Social momentum: How community sentiment aligns with technical analysis
        - Contrarian signals: When sentiment diverges from price action
        - Geographic sentiment: Regional trading perspectives

        ### 3. RESPONSE ADAPTABILITY
        **Query Types & Responses**:
        - **Quick Rates**: "What's EUR/USD at?" → Current rate + key highlights
        - **Analysis Requests**: "Analyze GBP/JPY" → Complete technical + fundamental + sentiment analysis
        - **Economic Impact**: "How do rate hikes affect USD?" → Economic analysis with currency implications
        - **Trading Strategies**: "Best EUR/USD entry point?" → Technical analysis with entry/exit recommendations
        - **Risk Assessment**: "EUR/USD volatility analysis" → Risk metrics and position sizing guidance
        - **Cross-Analysis**: "USD strength today" → Multi-pair USD analysis
        - **Educational**: "Explain carry trades" → Clear educational content with examples
        - **Market Updates**: "Forex market summary" → Comprehensive market overview
        - **Correlation Analysis**: "How does EUR/USD affect GBP/USD?" → Inter-pair relationship analysis

        ### 4. COMPREHENSIVE REPORTING
        **Analysis Depth Levels**:
        - **Quick Summary**: 2-3 key points for rapid trading decisions
        - **Standard Analysis**: Rate, trends, key indicators, sentiment, trading recommendation
        - **Deep Dive**: Comprehensive analysis with multiple timeframes, economic context, risk factors
        - **Custom Reports**: Tailored analysis based on specific trading requirements

        **Professional Formatting**:
        - Use bullet points, headers, and sections for complex analysis
        - Include confidence levels and data freshness indicators
        - Provide actionable trading insights and clear recommendations
        - Always cite data sources and timestamps
        - Include pip targets and risk levels where appropriate

        ### 5. INTELLIGENT ERROR HANDLING
        - **Missing Data**: Explain what's missing and provide analysis with available data
        - **Invalid Pairs**: Suggest closest matches or alternative analysis approaches
        - **API Failures**: Provide general market context or educational content
        - **Ambiguous Requests**: Ask clarifying questions to provide better analysis

        ### 6. CONTEXTUAL INTELLIGENCE
        - **Market Awareness**: Consider current global economic conditions
        - **Session Analysis**: Account for Asian, European, US trading sessions
        - **Economic Calendar**: Reference upcoming economic events when relevant
        - **Cross-Market Analysis**: Connect forex movements with stocks, commodities, bonds

        ### 7. RISK & COMPLIANCE
        - Always include risk disclaimers for trading advice
        - Provide balanced analysis showing both opportunities and risks
        - Emphasize proper risk management and position sizing
        - Focus on education and analysis rather than direct trading signals
        - Remind users about leverage risks in forex trading

        ## OUTPUT GUIDELINES
        - **Be Comprehensive**: Address all aspects of the user's query
        - **Be Adaptive**: Match response depth to query complexity
        - **Be Accurate**: Only use provided API data, clearly state limitations
        - **Be Helpful**: Always try to provide value even with limited data
        - **Be Professional**: Maintain expert-level forex communication
        - **Be Educational**: Explain concepts when beneficial for user understanding

        Remember: You are a sophisticated forex advisor capable of handling any currency-related query with professional-grade analysis.
      `;

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"],
      ]);

      // Enhanced forex pair detection with multiple patterns and aliases
      let symbol: string | null = null;

      // Pattern 1: Standard forex pair format (EUR/USD, GBP/JPY, etc.)
      const symbolMatch = input.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0];
      if (symbolMatch) {
        const potentialSymbol = symbolMatch.toUpperCase();
        const pair = forexPairs.find((p) => p.symbol === potentialSymbol);
        if (pair) {
          symbol = potentialSymbol;
        } else {
          // Try fuzzy matching for similar pairs
          const closestSymbol = forexPairs.reduce(
            (closest: { symbol: string; distance: number }, p) => {
              const distance = levenshteinDistance(potentialSymbol.replace("/", ""), p.symbol.replace("/", ""));
              return distance < closest.distance ? { symbol: p.symbol, distance } : closest;
            },
            { symbol: "", distance: Infinity }
          );
          if (closestSymbol.distance <= 2) {
            symbol = closestSymbol.symbol;
          }
        }
      }

      // Pattern 2: Currency name variations and common aliases
      if (!symbol) {
        const currencyAliases: { [key: string]: string } = {
          "eurusd": "EUR/USD",
          "euro dollar": "EUR/USD",
          "eur usd": "EUR/USD",
          "gbpusd": "GBP/USD",
          "pound dollar": "GBP/USD",
          "gbp usd": "GBP/USD",
          "cable": "GBP/USD",
          "usdjpy": "USD/JPY",
          "dollar yen": "USD/JPY",
          "usd jpy": "USD/JPY",
          "usdchf": "USD/CHF",
          "dollar franc": "USD/CHF",
          "usd chf": "USD/CHF",
          "audusd": "AUD/USD",
          "aussie dollar": "AUD/USD",
          "aud usd": "AUD/USD",
          "usdcad": "USD/CAD",
          "dollar loonie": "USD/CAD",
          "usd cad": "USD/CAD",
          "nzdusd": "NZD/USD",
          "kiwi dollar": "NZD/USD",
          "nzd usd": "NZD/USD",
          "eurgbp": "EUR/GBP",
          "euro pound": "EUR/GBP",
          "eur gbp": "EUR/GBP",
          "gbpjpy": "GBP/JPY",
          "pound yen": "GBP/JPY",
          "gbp jpy": "GBP/JPY",
          "eurjpy": "EUR/JPY",
          "euro yen": "EUR/JPY",
          "eur jpy": "EUR/JPY"
        };
        
        const lowerInput = input.toLowerCase().replace(/[^a-z\s]/g, "");
        for (const [alias, pair] of Object.entries(currencyAliases)) {
          if (lowerInput.includes(alias)) {
            symbol = pair;
            break;
          }
        }
      }

      // Pattern 3: Individual currency mentions with context
      if (!symbol) {
        const currencyMentions = [];
        const currencies = ["EUR", "USD", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"];
        const upperInput = input.toUpperCase();
        
        for (const curr of currencies) {
          if (upperInput.includes(curr)) {
            currencyMentions.push(curr);
          }
        }
        
        // If exactly 2 currencies mentioned, create pair
        if (currencyMentions.length === 2) {
          const potentialPair = `${currencyMentions[0]}/${currencyMentions[1]}`;
          if (forexPairs.some(p => p.symbol === potentialPair)) {
            symbol = potentialPair;
          } else {
            // Try reverse order
            const reversePair = `${currencyMentions[1]}/${currencyMentions[0]}`;
            if (forexPairs.some(p => p.symbol === reversePair)) {
              symbol = reversePair;
            }
          }
        }
      }

      if (!symbol) {
        const pairName = input.toLowerCase().replace(/forex|pair/gi, "").trim();
        const pair = forexPairs.find((p) => p.name?.toLowerCase().includes(pairName));
        if (pair) {
          symbol = pair.symbol;
        } else {
          const closestPair = forexPairs.reduce(
            (closest: { symbol: string; name: string; distance: number }, p) => {
              const distance = levenshteinDistance(pairName, p.name?.toLowerCase() ?? "");
              return distance < closest.distance ? { symbol: p.symbol, name: p.name ?? "", distance } : closest;
            },
            { symbol: "", name: "", distance: Infinity }
          );
          if (closestPair.distance <= 3) {
            symbol = closestPair.symbol;
          }
        }
      }

      if (!symbol) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          const historySymbolMatch = msg.content.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0];
          if (historySymbolMatch) {
            const potentialSymbol = historySymbolMatch.toUpperCase();
            const pair = forexPairs.find((p) => p.symbol === potentialSymbol);
            if (pair) {
              symbol = potentialSymbol;
              break;
            }
          }
        }
      }

      // Enhanced forex pair detection and smart suggestions
      if (!symbol) {
        // Try to provide intelligent assistance even without a symbol
        const isGeneralQuery = 
          input.toLowerCase().includes("market") ||
          input.toLowerCase().includes("forex") ||
          input.toLowerCase().includes("currency") ||
          input.toLowerCase().includes("general") ||
          input.toLowerCase().includes("overall") ||
          input.toLowerCase().includes("economy") ||
          input.toLowerCase().includes("tips") ||
          input.toLowerCase().includes("advice") ||
          input.toLowerCase().includes("help") ||
          input.toLowerCase().includes("explain") ||
          input.toLowerCase().includes("what is") ||
          input.toLowerCase().includes("how to") ||
          input.toLowerCase().includes("trading");

        let content = "";
        if (isGeneralQuery) {
          content = `I'd be happy to help with your forex question! For general market insights, I can provide:

🌍 **Forex Market Analysis Options:**
• Currency pair overviews (majors, minors, exotics)
• Economic impact analysis and central bank policies
• Trading strategy guidance and risk management
• Technical analysis education and chart patterns
• Market session analysis (Asian, European, US)

🔍 **For Specific Pair Analysis:**
Provide a forex pair (e.g., 'EUR/USD', 'GBP/JPY', 'USD/CHF') or currency name.

📈 **Popular Pairs to Try:**
• EUR/USD (Euro/Dollar), GBP/USD (Pound/Dollar), USD/JPY (Dollar/Yen)
• GBP/JPY (Pound/Yen), EUR/GBP (Euro/Pound), AUD/USD (Aussie/Dollar)
• USD/CAD (Dollar/Loonie), USD/CHF (Dollar/Franc)

What specific aspect of forex would you like me to focus on?`;
        } else {
          // Try to suggest similar symbols from input
          const inputUpper = input.toUpperCase().replace(/[^A-Z]/g, "");
          const similarPairs = forexPairs
            .filter(pair => 
              pair.symbol.replace("/", "").includes(inputUpper.slice(0, 3)) ||
              (pair.name && pair.name.toLowerCase().includes(input.toLowerCase().slice(0, 4)))
            )
            .slice(0, 5)
            .map(pair => `${pair.symbol} (${pair.name || 'Currency Pair'})`)
            .join(", ");

          content = `I couldn't identify a specific forex pair from your message. 

🔍 **Did you mean:**
${similarPairs ? `• ${similarPairs}` : "• Please provide a valid forex pair"}

💡 **Popular Options:**
• EUR/USD (Euro/US Dollar) • GBP/USD (British Pound/US Dollar)
• USD/JPY (US Dollar/Japanese Yen) • GBP/JPY (British Pound/Japanese Yen)
• EUR/GBP (Euro/British Pound) • AUD/USD (Australian Dollar/US Dollar)

📝 **Try formats like:**
• "Analyze EUR/USD"
• "What's GBP/JPY RSI?"
• "USD/JPY trading strategy"

What forex pair would you like me to analyze?`;
        }

        const errorMessage: Message = {
          role: "assistant",
          content,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => {
          const updatedMessages = [...prev, errorMessage];
          setChatSessions((prevSessions) =>
            prevSessions.map((session) =>
              session.id === currentChatId
                ? { ...session, messages: updatedMessages }
                : session
            )
          );
          return updatedMessages;
        });
        setLoading(false);
        return;
      }

      // Enhanced forex pair validation with suggestions
      if (forexPairs.length > 0) {
        const isValidSymbol = forexPairs.some((pair) => pair.symbol === symbol);
        if (!isValidSymbol) {
          const closestSymbol = forexPairs.reduce(
            (closest: { symbol: string; distance: number }, p) => {
              const distance = levenshteinDistance(symbol!.replace("/", ""), p.symbol.replace("/", "")); // Non-null assertion
              return distance < closest.distance ? { symbol: p.symbol, distance } : closest;
            },
            { symbol: "", distance: Infinity }
          );
          
          // Find additional similar pairs
          const similarPairs = forexPairs
            .filter(pair => 
              pair.symbol.includes(symbol!.slice(0, 3)) ||
              pair.symbol.startsWith(symbol!.charAt(0)) ||
              (pair.name && pair.name.toLowerCase().includes(symbol!.toLowerCase()))
            )
            .slice(0, 5)
            .map(pair => `${pair.symbol} (${pair.name || 'Currency Pair'})`)
            .join(", ");

          const suggestion = closestSymbol.distance <= 2 ? ` Did you mean '${closestSymbol.symbol}'?` : "";
          const content = `❌ **Forex Pair '${symbol}' not found** in available currency pairs.

🔍 **Did you mean:**
${suggestion || (similarPairs ? `• ${similarPairs}` : "No similar pairs found")}

💡 **Popular Forex Pairs:**
• **Majors**: EUR/USD, GBP/USD, USD/JPY, USD/CHF
• **Crosses**: EUR/GBP, GBP/JPY, EUR/JPY, AUD/CAD
• **Commodities**: AUD/USD, USD/CAD, NZD/USD

📝 **Note:** I analyze all major, minor, and exotic forex pairs. Ensure the format is correct (e.g., EUR/USD).

Please provide a valid forex pair for analysis.`;

          const errorMessage: Message = {
            role: "assistant",
            content,
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => {
            const updatedMessages = [...prev, errorMessage];
            setChatSessions((prevSessions) =>
              prevSessions.map((session) =>
                session.id === currentChatId
                  ? { ...session, messages: updatedMessages }
                  : session
              )
            );
            return updatedMessages;
          });
          setLoading(false);
          return;
        }
      }

      const indicators = ["rsi", "macd", "ema", "bbands", "adx", "atr", "ichimoku", "stoch", "cci", "mom", "pivot_points_hl"];
      const requestedIndicators = indicators.filter((indicator) =>
        input.toLowerCase().includes(indicator)
      );
      
      // Enhanced data fetching logic for comprehensive forex analysis
      const needsForexData =
        input.toLowerCase().includes("price") ||
        input.toLowerCase().includes("rate") ||
        input.toLowerCase().includes("change") ||
        input.toLowerCase().includes("trend") ||
        input.toLowerCase().includes("analyz") ||
        input.toLowerCase().includes("report") ||
        input.toLowerCase().includes("research") ||
        input.toLowerCase().includes("trade") ||
        input.toLowerCase().includes("trading") ||
        input.toLowerCase().includes("buy") ||
        input.toLowerCase().includes("sell") ||
        input.toLowerCase().includes("recommend") ||
        input.toLowerCase().includes("assessment") ||
        input.toLowerCase().includes("evaluation") ||
        input.toLowerCase().includes("overview") ||
        input.toLowerCase().includes("summary") ||
        input.toLowerCase().includes("how") ||
        input.toLowerCase().includes("what") ||
        input.toLowerCase().includes("performance") ||
        input.toLowerCase().includes("outlook") ||
        input.toLowerCase().includes("volatility") ||
        input.toLowerCase().includes("strength") ||
        input.toLowerCase().includes("weakness") ||
        requestedIndicators.length > 0; // Always fetch forex data if indicators are requested

      // Always fetch comprehensive indicators for analysis, research, or trading queries
      const needsComprehensiveAnalysis = 
        input.toLowerCase().includes("analyz") ||
        input.toLowerCase().includes("report") ||
        input.toLowerCase().includes("research") ||
        input.toLowerCase().includes("trade") ||
        input.toLowerCase().includes("trading") ||
        input.toLowerCase().includes("recommend") ||
        input.toLowerCase().includes("assessment") ||
        input.toLowerCase().includes("evaluation") ||
        input.toLowerCase().includes("overview") ||
        input.toLowerCase().includes("comprehensive") ||
        input.toLowerCase().includes("detailed") ||
        input.toLowerCase().includes("full") ||
        input.toLowerCase().includes("complete") ||
        input.toLowerCase().includes("strategy") ||
        input.toLowerCase().includes("position");
      
      const isGeneralAnalysis = needsComprehensiveAnalysis;

      let forexData: any = undefined;
      let indicatorsData: { [key: string]: { data: any; timestamp: number } } | undefined = undefined;
      const apiCallCount = { count: 0 };

      // Fetch only what's needed
      if (needsForexData || isGeneralAnalysis) {
        const fields = [];
        if (input.toLowerCase().includes("price") || input.toLowerCase().includes("change") || isGeneralAnalysis) {
          fields.push("quote");
        }
        if (input.toLowerCase().includes("trend") || isGeneralAnalysis) {
          fields.push("timeSeries");
        }
        forexData = await fetchForexData(symbol, apiCallCount, fields);
      }

      if (requestedIndicators.length > 0 || isGeneralAnalysis) {
        const indicatorsToFetch = requestedIndicators.length > 0
          ? requestedIndicators
          : isGeneralAnalysis
          ? ["ema", "rsi", "macd", "bbands", "adx", "atr"] // Comprehensive set for detailed forex analysis
          : []; // Default minimal set
        if (indicatorsToFetch.length > 0) {
          indicatorsData = await fetchIndicators(symbol, indicatorsToFetch, apiCallCount);
        }
      }

      // Fetch Reddit sentiment data
      let redditData: any = null;
      try {
        const redditResponse = await fetch(`/api/reddit?symbol=${symbol}`);
        if (redditResponse.ok) {
          redditData = await redditResponse.json();
          console.log(`Successfully fetched Reddit data for forex pair: ${symbol}`);
        } else {
          console.warn(`Failed to fetch Reddit data for ${symbol}`);
        }
      } catch (error) {
        console.warn(`Error fetching Reddit data for ${symbol}:`, error);
        // Continue without Reddit data
      }

      // Prepare minimal data for LLM
      const apiData: any = {};
      if (forexData) {
        if (forexData.quote) apiData.quote = forexData.quote;
        if (forexData.timeSeries) apiData.timeSeries = forexData.timeSeries;
      }
      if (indicatorsData) {
        apiData.indicators = {};
        for (const indicator of requestedIndicators.length > 0 ? requestedIndicators : ["ema", "rsi", "macd"]) {
          if (indicatorsData[indicator]) {
            apiData.indicators[indicator] = indicatorsData[indicator].data;
          }
        }
      }
      if (redditData) {
        apiData.redditSentiment = redditData;
      }

      const enhancedInput = `${input}\n\nAPI Data: ${JSON.stringify(apiData)}`;

      const chain = prompt.pipe(llm);
      const response = await chain.invoke({
        input: enhancedInput,
        chat_history: await chatHistory.getMessages(),
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: response.content as string,
        timestamp: new Date().toLocaleTimeString(),
        forexData,
        indicatorsData,
        redditData,
      };

      setMessages((prev) => {
        const updatedMessages = [...prev, assistantMessage];
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId
              ? { ...session, messages: updatedMessages }
              : session
          )
        );
        return updatedMessages;
      });

      await chatHistory.addMessage(new SystemMessage(response.content as string));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in chatbot:", errorMessage);
      
      // Enhanced error handling with intelligent fallback for forex
      let fallbackContent = "";
      
      // Determine error type and provide appropriate fallback
      if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("timeout")) {
        fallbackContent = `🌐 **Network Issue Detected**

I'm experiencing connectivity issues: ${errorMessage}

💡 **What I can still help with:**
• Explain forex concepts and terminology
• Discuss currency trading strategies and risk management
• Provide market analysis framework guidance
• Share forex psychology and trading insights
• Explain technical indicators for forex trading
• Currency correlation analysis concepts

🔄 **Troubleshooting:**
• Please check your internet connection
• Try again in a few moments
• Consider asking general forex questions

I'm here to help with forex education even without real-time data!`;
      } else if (errorMessage.includes("API") || errorMessage.includes("key") || errorMessage.includes("quota")) {
        fallbackContent = `⚙️ **API Service Issue**

There's a temporary service limitation: ${errorMessage}

📚 **Educational Content Available:**
• Forex market fundamentals and structure
• Currency pair analysis principles
• Technical analysis for forex trading
• Risk management in forex markets
• Economic indicators impact on currencies
• Central bank policies and forex effects

💬 **Ask me about:**
• "How do interest rates affect forex?"
• "What is carry trading?"
• "Explain forex market sessions"
• "How to read forex charts?"

Let's continue with forex education while the service recovers!`;
      } else {
        fallbackContent = `🔧 **Technical Issue Encountered**

I encountered an unexpected error: ${errorMessage}

🎯 **Alternative Assistance:**
• General forex market analysis concepts
• Currency trading strategy discussions
• Forex risk management principles
• Technical analysis education for forex
• Economic calendar and news impact
• Cross-currency analysis techniques

💭 **Try asking:**
• "Explain forex spreads and pips"
• "What are major vs minor pairs?"
• "How to analyze currency strength?"
• "Forex position sizing strategies"

I'm still here to help with your forex learning journey!`;
      }
      
      toast({
        title: "Service Issue",
        description: "Providing alternative forex assistance while resolving the issue.",
        variant: "destructive",
      });
      
      const errorMsg: Message = {
        role: "assistant",
        content: fallbackContent,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => {
        const updatedMessages = [...prev, errorMsg];
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId
              ? { ...session, messages: updatedMessages }
              : session
          )
        );
        return updatedMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= b.length; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b" style={{ background: `linear-gradient(to right, ${green500}, ${emerald600})` }}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={toggleSidebar} className="lg:hidden" style={{ color: "white" }}>
                <Menu className="h-6 w-6" />
              </Button>
              <DollarSign className="h-8 w-8" style={{ color: "white" }} />
              <span className="text-2xl font-bold" style={{ color: "white" }}>Forex Advisor</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" style={{ color: "white" }}>All Markets</Button>
              </Link>
              <Link href="/forexs">
                <Button variant="ghost" style={{ color: "white" }}>Forex Market</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" style={{ color: "white" }}>Other Advisors</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" style={{ borderColor: "white", color: "green" }}>Back Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-64 border-r p-4 flex flex-col lg:w-80 overflow-hidden"
              style={{ backgroundColor: "var(--background)" }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold" style={{ color: emerald600 }}>Chat History</h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden" style={{ color: emerald600 }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleNewChat}
                  className="mb-4"
                  style={{ background: `linear-gradient(to right, ${green500}, ${emerald600})`, color: "white" }}
                >
                  <Plus className="h-4 w-4 mr-2" /> New Chat
                </Button>
              </motion.div>
              <div className="flex-1 overflow-y-auto">
                {chatSessions.map((session) => (
                  <motion.div
                    key={session.id}
                    whileHover={{ scale: 1.02 }}
                    className={`flex justify-between items-center p-2 rounded-lg mb-2 cursor-pointer ${
                      session.id === currentChatId ? "bg-green-100 dark:bg-green-900" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex-1 truncate" onClick={() => handleSwitchChat(session.id)}>
                      <span className="text-sm font-medium" style={{ color: emerald600 }}>{session.title}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteChat(session.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {forexPairsError && (
              <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg mb-4">{forexPairsError}</div>
            )}
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                    message.role === "user"
                      ? "text-white"
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  }`}
                  style={{
                    background: message.role === "user" ? `linear-gradient(to right, ${green500}, ${emerald600})` : undefined,
                  }}
                >
                  <p>{message.content}</p>
                  <span className="text-xs mt-1 block" style={{ color: message.role === "user" ? "white" : "#6B7280" }}>
                    <Clock className="h-3 w-3 inline mr-1" /> {message.timestamp}
                  </span>
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: emerald600 }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-4" style={{ background: `linear-gradient(to bottom, var(--background), var(--muted))` }}>
            <div className="flex space-x-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  onClick={handleClearChat}
                  style={{ borderColor: green500, color: green500 }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
                </Button>
              </motion.div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a forex pair (e.g., 'Analyze EUR/USD', 'What's the RSI for GBP/JPY?')"
                className="flex-1 resize-none shadow-md"
                rows={2}
                style={{ borderColor: green500, backgroundColor: "var(--background)", color: "var(--foreground)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleSendMessage}
                  disabled={loading}
                  style={{ background: `linear-gradient(to right, ${green500}, ${emerald600})`, color: "white" }}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}