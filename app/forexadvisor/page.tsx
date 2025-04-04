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
        model: "llama3-70b-8192",
        temperature: 0.5,
      });

      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) {
        throw new Error("Chat history not initialized for this session.");
      }
      await chatHistory.addMessage(new HumanMessage(input));

      const systemPrompt = `
        You are an AI forex advisor for FinanceAI, a platform that provides financial data analysis for forex trading. Your task is to assist users by interpreting forex data and technical indicators for a given forex pair symbol (e.g., "EUR/USD", "GBP/JPY"). Follow these steps:

        1. **Identify the Symbol**:
           - The user may provide a symbol (e.g., "EUR/USD") or pair name (e.g., "Euro to US Dollar").
           - If no symbol is provided in the current message, use the most recent symbol from the chat history.
           - The code has already validated the symbol, so assume it's valid when provided.

        2. **Identify Requested Data**:
           - For "analyze [symbol]", provide a concise analysis with current price, daily change, 30-day trend, and a few key indicators (EMA, RSI, MACD).
           - For specific indicators (e.g., "What's the RSI for [symbol]?"), only provide the requested indicator.
           - For forex stats (e.g., "current price of [symbol]"), only provide the requested data.
           - Available indicators: EMA (20-day, 50-day), RSI (14-day), MACD (12, 26, 9), BBANDS (20, 2 SD), ADX (14), ATR (14), Ichimoku, STOCH, CCI, MOM, Pivot Points.

        3. **Use Provided Data**:
           - Use only the API data provided in the input under "API Data". Do not fetch data yourself.
           - If data is missing, inform the user (e.g., "I couldn't fetch the RSI for [symbol].").

        4. **Deep Analysis**:
           - For general analysis: Include price, change, trend, and key indicators (EMA, RSI, MACD).
           - For specific indicators: Provide current value, trend, and insights.
           - Use data-driven insights (e.g., "RSI at 70 suggests overbought conditions").

        5. **Handle Unsupported Indicators**:
           - If an indicator isn't supported, say: "Indicator 'XYZ' isn't available. Try EMA, RSI, MACD, etc."

        6. **Maintain Context**:
           - Use chat history for context (e.g., if "What's the RSI?" follows EUR/USD discussion, answer for EUR/USD).

        7. **Response Format**:
           - Use clear, concise language with bullet points or short paragraphs.
           - Do not invent data. Use only what's provided.
      `;

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"],
      ]);

      let symbol: string | null = null;

      const symbolMatch = input.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0];
      if (symbolMatch) {
        const potentialSymbol = symbolMatch.toUpperCase();
        const pair = forexPairs.find((p) => p.symbol === potentialSymbol);
        if (pair) {
          symbol = potentialSymbol;
        } else {
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

      if (!symbol) {
        const errorMessage: Message = {
          role: "assistant",
          content: "Please provide a forex pair symbol or name (e.g., 'EUR/USD' or 'Euro to US Dollar').",
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
          const suggestion = closestSymbol.distance <= 2 ? ` Did you mean '${closestSymbol.symbol}'?` : "";
          const errorMessage: Message = {
            role: "assistant",
            content: `I couldn't find '${symbol}' in the forex pairs list.${suggestion} Try 'EUR/USD' or 'GBP/JPY'.`,
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
      const needsForexData =
        input.toLowerCase().includes("price") ||
        input.toLowerCase().includes("change") ||
        input.toLowerCase().includes("trend");
      const isGeneralAnalysis = input.toLowerCase().includes("analyz") && requestedIndicators.length === 0;

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
          ? ["ema", "rsi", "macd"] // Limit to a few key indicators for general analysis
          : [];
        if (indicatorsToFetch.length > 0) {
          indicatorsData = await fetchIndicators(symbol, indicatorsToFetch, apiCallCount);
        }
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
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      });
      const errorMsg: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
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