// app/forexadvisor/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { BarChart3, Send, Loader2, Trash2, Clock, Menu, Plus, X } from "lucide-react";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// In-memory cache for forex data and indicators
const forexDataCache = new Map();
const indicatorsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Rate limit: 8 requests per minute (60 seconds / 8 = 7.5 seconds per request)
const REQUEST_DELAY_MS = 7500; // 7.5 seconds delay between requests
const API_CALL_THRESHOLD = 4; // Apply delay only if API calls exceed this threshold

// Utility function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility function to fetch with retry on rate limit
async function fetchWithRetry(url: string, maxRetries: number = 3, retryDelayMs: number = 10000) {
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
async function fetchForexPairs(apiCallCount: { count: number }) {
  const cacheKey = "forexPairs";
  const cachedData = forexDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached forex pairs");
    return cachedData.data;
  }

  try {
    const url = "/api/forexs?page=1&perPage=1000¤cyGroup=All";
    const response = await fetchWithRetry(url);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) {
      await delay(REQUEST_DELAY_MS);
    }

    const data = response || { pairs: [] };
    const forexPairs = data.pairs || [];
    forexDataCache.set(cacheKey, { data: forexPairs, timestamp: now });
    return forexPairs;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching forex pairs:", errorMessage);
    throw error;
  }
}

// Fetch forex data (quote, time series) using Twelve Data API
async function fetchForexData(symbol: string, apiCallCount: { count: number }) {
  const cacheKey = `forexData_${symbol.toUpperCase()}`;
  const cachedData = forexDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached forex data for symbol: ${symbol}`);
    return cachedData.data;
  }

  try {
    // Fetch quote (current price, daily change)
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
    const quoteResponse = await fetchWithRetry(quoteUrl);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) {
      await delay(REQUEST_DELAY_MS);
    }

    // Fetch time series (historical data for trend analysis)
    const timeSeriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=30&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
    const timeSeriesResponse = await fetchWithRetry(timeSeriesUrl);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) {
      await delay(REQUEST_DELAY_MS);
    }

    const data = {
      quote: quoteResponse,
      timeSeries: timeSeriesResponse,
    };
    forexDataCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error fetching forex data for ${symbol}:`, errorMessage);
    throw error;
  }
}

// Fetch specific technical indicators using Twelve Data API
async function fetchIndicators(symbol: string, requestedIndicators: string[], apiCallCount: { count: number }) {
  const cacheKey = `indicators_${symbol.toUpperCase()}`;
  const cachedData = indicatorsCache.get(cacheKey) || {};
  const now = Date.now();

  // Check if all requested indicators are already cached
  const missingIndicators = requestedIndicators.filter(
    (indicator) => !cachedData[indicator] || (now - cachedData[indicator]?.timestamp >= CACHE_DURATION)
  );

  const indicatorsData: { [key: string]: any } = { ...cachedData };

  try {
    for (const indicator of missingIndicators) {
      let url = "";
      switch (indicator.toLowerCase()) {
        case "rsi":
          url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "ema":
          // Fetch both 20-day and 50-day EMA
          url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          const ema20Response = await fetchWithRetry(url);
          apiCallCount.count += 1;
          if (apiCallCount.count > API_CALL_THRESHOLD) {
            await delay(REQUEST_DELAY_MS);
          }
          url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=50&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          const ema50Response = await fetchWithRetry(url);
          apiCallCount.count += 1;
          if (apiCallCount.count > API_CALL_THRESHOLD) {
            await delay(REQUEST_DELAY_MS);
          }
          indicatorsData["ema"] = { ema20: ema20Response, ema50: ema50Response, timestamp: now };
          continue;
        case "macd":
          url = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "bbands":
          url = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&sd=2&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "adx":
          url = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "atr":
          url = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "ichimoku":
          url = `https://api.twelvedata.com/ichimoku?symbol=${symbol}&interval=1day&tenkan_period=9&kijun_period=26&senkou_span_b_period=52&displacement=26&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "stoch":
          url = `https://api.twelvedata.com/stoch?symbol=${symbol}&interval=1day&fast_k_period=14&slow_k_period=3&slow_d_period=3&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "cci":
          url = `https://api.twelvedata.com/cci?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "mom":
          url = `https://api.twelvedata.com/mom?symbol=${symbol}&interval=1day&time_period=10&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        case "pivot_points_hl":
          url = `https://api.twelvedata.com/pivot_points_hl?symbol=${symbol}&interval=1day&time_period=20&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
          break;
        default:
          continue; // Skip unsupported indicators
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error fetching technical indicators for ${symbol}:`, errorMessage);
    throw error;
  }
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

  // Fetch forex pairs on mount to validate symbols
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

  // Initialize the chat session with an initial message
  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: `Welcome to the Forex Advisor! I can help you analyze forex pairs from major currency groups like Major, Minor, and Exotic. Please provide a forex pair symbol to get started (e.g., "EUR/USD" for Euro to US Dollar, "GBP/JPY"), and specify any technical indicators you'd like to analyze (e.g., RSI, EMA, MACD, ATR, etc.). I support a wide range of technical indicators from Twelve Data, including SMA, EMA, MACD, ADX, RSI, ATR, and more—just ask!`,
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

  // Update messages when switching chats
  useEffect(() => {
    const currentSession = chatSessions.find((session) => session.id === currentChatId);
    if (currentSession) {
      setMessages(currentSession.messages);
    } else {
      setMessages([]);
    }
  }, [currentChatId, chatSessions]);

  // Auto-scroll to the latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Set sidebar to closed on smaller screens by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
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

    // Add user message to the chat
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

    // Generate a descriptive title for the chat session
    if (messages.filter((msg) => msg.role === "user").length === 0) {
      let newTitle = `Chat ${chatSessions.length}`;
      const symbolMatch = input.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0];
      const indicators = ["rsi", "macd", "ema", "bbands", "adx", "atr", "ichimoku", "stoch", "cci", "mom", "pivot_points_hl"];
      const requestedIndicator = indicators.find((indicator) =>
        input.toLowerCase().includes(indicator)
      );
      if (symbolMatch) {
        const potentialSymbol = symbolMatch.toUpperCase();
        const pair = forexPairs.find((p: any) => p.symbol === potentialSymbol);
        if (pair) {
          if (requestedIndicator) {
            newTitle = `${requestedIndicator.toUpperCase()} for ${potentialSymbol}`;
          } else if (input.toLowerCase().includes("analyz")) {
            newTitle = `Analysis for ${potentialSymbol}`;
          } else {
            newTitle = `Query for ${potentialSymbol}`;
          }
        }
      }
      if (!newTitle.includes("Analysis for") && !newTitle.includes("Query for")) {
        const pairName = input.toLowerCase().replace(/forex|pair/gi, "").trim();
        const matchedPair = forexPairs.find((p: any) =>
          p.name.toLowerCase().includes(pairName)
        );
        if (matchedPair) {
          if (requestedIndicator) {
            newTitle = `${requestedIndicator.toUpperCase()} for ${matchedPair.symbol}`;
          } else if (input.toLowerCase().includes("analyz")) {
            newTitle = `Analysis for ${matchedPair.symbol}`;
          } else {
            newTitle = `Query for ${matchedPair.symbol}`;
          }
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
      // Initialize the Groq model
      const llm = new ChatGroq({
        apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
        model: "llama3-70b-8192",
        temperature: 0.5,
      });

      // Get the chat history for this session
      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) {
        throw new Error("Chat history not initialized for this session.");
      }
        await chatHistory.addMessage(new HumanMessage(input));
        
        const systemPrompt = `
        You are an AI forex advisor for FinanceAI, a platform that provides financial data analysis for forex trading. Your task is to assist users by interpreting forex data and technical indicators for a given forex pair symbol (e.g., "EUR/USD" for Euro to US Dollar, "GBP/JPY" for British Pound to Japanese Yen). Follow these steps:
        
        1. **Identify the Symbol**:
           - The user will provide a forex pair symbol (e.g., "EUR/USD", "GBP/JPY") or a pair name (e.g., "Euro to US Dollar", "British Pound to Yen").
           - Be robust to typos in the symbol or pair name:
             - For symbols, if the input is close to a valid symbol (e.g., "EURUSD" instead of "EUR/USD"), the code will correct it to the closest match from the forex pairs list.
             - For pair names, if the input has a typo (e.g., "Euro to Doller" instead of "Euro to Dollar"), the code will use fuzzy matching to find the closest match in the forex pairs list.
           - If a pair name is provided, the code will map it to the correct forex pair symbol using the forex pairs data (e.g., "Euro to US Dollar" -> "EUR/USD").
           - If the user does not provide a symbol in the current message, check the chat history for the most recent symbol mentioned and use that. Do not ask for a symbol if it’s already clear from the context.
        
        2. **Validate the Symbol**:
           - The symbol has already been validated by the code against a list of known forex pair symbols provided in the forex pairs data, which includes pairs from currency groups like Major, Minor, and Exotic.
           - If the symbol is invalid, the code will handle it and prompt the user, so you can assume the symbol provided to you is valid.
        
        3. **Identify Requested Data**:
           - Determine what the user is asking for:
             - If the user asks for general analysis (e.g., "Analyze EUR/USD"), provide a full analysis including forex data (current price, daily change, 30-day trend) and a selection of common technical indicators (e.g., EMA, RSI, MACD, BBANDS, ADX, ATR).
             - If the user asks for specific indicators (e.g., "What’s the RSI for EUR/USD?" or "Show me the ADX and STOCH for GBP/JPY"), only provide analysis for the requested indicators.
             - If the user asks for forex statistics (e.g., "What’s the current price of EUR/USD?"), only provide the requested forex data.
           - The available technical indicators are: EMA (20-day and 50-day), RSI (14-day), MACD (12-day, 26-day, 9-day signal line), BBANDS (Bollinger Bands, 20-day, 2 standard deviations), ADX (14-day), ATR (14-day), Ichimoku (Tenkan 9, Kijun 26, Senkou Span B 52, displacement 26), STOCH (Stochastic Oscillator, fast K 14, slow K 3, slow D 3), CCI (Commodity Channel Index, 14-day), MOM (Momentum, 10-day), Pivot Points (High/Low method, 20-day).
           - Forex data includes: current price, daily change, and 30-day price trend.
        
        4. **Use Provided Data**:
           - The data has already been fetched and provided to you in the input as JSON under "API Data". Do not attempt to fetch data yourself.
           - The data includes:
             - **Forex Data**:
               - Quote: Current price, daily change, etc.
               - Time Series: Historical price data (up to 30 days for trend analysis).
             - **Technical Indicators** (only the requested indicators will be provided):
               - EMA: 20-day and 50-day Exponential Moving Average (under "ema" with subfields "ema20" and "ema50").
               - RSI: 14-day Relative Strength Index.
               - MACD: Moving Average Convergence Divergence (12-day, 26-day, 9-day signal line).
               - BBANDS: Bollinger Bands (20-day, 2 standard deviations).
               - ADX: Average Directional Index (14-day).
               - ATR: Average True Range (14-day).
               - Ichimoku: Ichimoku Cloud (Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, Chikou Span).
               - STOCH: Stochastic Oscillator (fast K, slow K, slow D).
               - CCI: Commodity Channel Index (14-day).
               - MOM: Momentum (10-day).
               - Pivot Points: High/Low method (pivot, support, and resistance levels).
           - If the data for a requested indicator or forex data is null or missing, inform the user (e.g., "I couldn’t fetch the RSI for [symbol] due to an API error. Please try again later.").
        
        5. **Deep Analysis**:
           - Provide a detailed analysis based on the user’s request:
             - **For General Analysis**: Include current price, daily change, 30-day trend, and a selection of common technical indicators (e.g., EMA, RSI, MACD, BBANDS, ADX, ATR).
             - **For Specific Indicators**: Only analyze the requested indicators.
             - **For Forex Statistics**: Only provide the requested forex data (e.g., current price).
           - Include the following in your analysis (where applicable):
             - **Current Values**: Report the most recent value for each indicator or data point (e.g., "The current price is 1.1850", "The 14-day RSI is 54.21").
             - **Trend Analysis**: Analyze the trend over the past 30 days using the time series data or indicator values (e.g., "The price has increased by 0.5% over the past 30 days", "The RSI has risen from 50 to 54.21, indicating growing bullish momentum").
             - **Comparisons**: Compare indicators to identify confirmations or divergences (e.g., "The price is above both the 20-day and 50-day EMA, confirming a bullish trend, but the RSI is nearing overbought levels at 70").
             - **Momentum and Volatility**: Assess momentum and volatility where applicable (e.g., "The ATR indicates increasing volatility, suggesting larger price swings", "The Stochastic Oscillator shows the pair is in overbought territory").
             - **Trend Strength**: Evaluate trend strength where applicable (e.g., "An ADX of 30 indicates a strong trend").
             - **Support and Resistance**: Use indicators like Pivot Points to identify key levels (e.g., "The price is approaching the R1 pivot point at 1.1900, which may act as resistance").
             - **Actionable Insights**: Provide potential trading strategies based on the analysis (e.g., "The MACD histogram is positive and increasing, suggesting a buy opportunity, but monitor for a potential pullback as the price nears the upper Bollinger Band").
           - Avoid speculative advice (e.g., don’t say "This pair will definitely go up"). Instead, provide data-driven insights.
        
        6. **Handle Unsupported Indicators**:
           - If the user requests an indicator that is not in the supported list, inform them that the indicator is not available and suggest a similar indicator (e.g., "The indicator 'XYZ' is not supported. Did you mean 'RSI' or 'MACD'? I support indicators like EMA, RSI, MACD, BBANDS, ADX, ATR, Ichimoku, STOCH, CCI, MOM, and Pivot Points.").
        
        7. **Handle Errors**:
           - If the API data is unavailable, the code will handle it and prompt the user, so you can assume the data provided to you is valid. If a specific piece of data (e.g., an indicator) is missing, inform the user (e.g., "I couldn't fetch the RSI for [symbol] due to an API error. Please try again later.").
        
        8. **Maintain Conversational Context**:
           - Use the chat history to maintain context (e.g., if the user asks "What’s the RSI?" after discussing EUR/USD, provide the RSI for EUR/USD).
           - Do not ask for the symbol again unless the context is unclear.
        
        9. **Response Format**:
           - Respond in a clear, professional tone.
           - Use bullet points or short paragraphs for readability.
           - Do not invent or hallucinate data. Only use the provided API data.
           - Do not include chart-related notes (e.g., "[Chart Available]") since visualizations are not needed.
        
        Example Interaction:
        User: "Analyze EUR/USD"
        Assistant:
        **Analysis for EUR/USD (Euro to US Dollar)**
        
        - **Current Price**: The current price is 1.1850 (as of the latest quote).
        - **Daily Change**: The pair is up +0.15% today, with a change of +0.0018.
        - **30-Day Trend**: Over the past 30 days, the price has increased by 0.5%, showing a steady uptrend.
        - **Technical Indicators**:
          - **20-day EMA**: 1.1820. The price is above the 20-day EMA, indicating short-term bullish momentum.
          - **50-day EMA**: 1.1800. The price is also above the 50-day EMA, confirming a longer-term bullish trend.
          - **14-day RSI**: 54.21. The RSI is in the neutral zone, suggesting the pair is neither overbought nor oversold. Over the past 30 days, the RSI has risen from 50 to 54.21, indicating growing bullish momentum.
          - **MACD**: MACD Line: 0.0020, Signal Line: 0.0015, Histogram: 0.0005. The MACD is bullish, with the histogram showing increasing momentum.
          - **Bollinger Bands**: Upper Band: 1.1900, Lower Band: 1.1750. The price is near the upper band, suggesting a potential overbought condition, but the wide bands indicate the trend may continue.
          - **ADX**: 25. The ADX indicates a moderate trend strength, supporting the current uptrend.
          - **ATR**: 0.0050. The ATR suggests moderate volatility, with potential price swings of around 50 pips per day.
        - **Actionable Insights**:
          - The pair is in a confirmed uptrend, supported by the EMA, MACD, and ADX indicators.
          - The RSI and Bollinger Bands suggest caution as the pair may be approaching overbought territory. Consider waiting for a pullback to the 20-day EMA (1.1820) for a better entry point.
          - The moderate volatility (ATR) and trend strength (ADX) suggest the trend is sustainable, but monitor for any reversal signals (e.g., RSI above 70 or a MACD crossover).
        
        Would you like to analyze specific indicators for EUR/USD or try a different forex pair?
        `;

        // Create the prompt template (systemPrompt to be added in the next response)
        const prompt = ChatPromptTemplate.fromMessages([
            ["system", systemPrompt], // Replace "Placeholder for system prompt" with the actual systemPrompt
            ["human", input],
          ]);

      // Extract symbol or pair name with typo handling
      let symbol: string | null = null;

      // Step 1: Try to extract a forex pair symbol (e.g., "EUR/USD", "GBP/JPY")
      const symbolMatch = input.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0];
      if (symbolMatch) {
        const potentialSymbol = symbolMatch.toUpperCase();
        const pair = forexPairs.find((p: any) => p.symbol === potentialSymbol);
        if (pair) {
          symbol = potentialSymbol;
        } else {
          // Handle typos in symbol (e.g., "EURUSD" -> "EUR/USD")
          const closestSymbol = forexPairs.reduce((closest: any, p: any) => {
            const distance = levenshteinDistance(potentialSymbol.replace("/", ""), p.symbol.replace("/", ""));
            return distance < (closest.distance || Infinity) ? { symbol: p.symbol, distance } : closest;
          }, { symbol: "", distance: Infinity });
          if (closestSymbol.distance <= 2) {
            symbol = closestSymbol.symbol;
          }
        }
      }

      // Step 2: If no symbol is found, try to match a pair name with typo handling
      if (!symbol) {
        const pairName = input.toLowerCase().replace(/forex|pair/gi, "").trim();
        const pair = forexPairs.find((p: any) =>
          p.name.toLowerCase().includes(pairName)
        );
        if (pair) {
          symbol = pair.symbol;
        } else {
          // Handle typos in pair name (e.g., "Euro to Doller" -> "Euro to Dollar")
          const closestPair = forexPairs.reduce((closest: any, p: any) => {
            const distance = levenshteinDistance(pairName, p.name.toLowerCase());
            return distance < (closest.distance || Infinity) ? { symbol: p.symbol, name: p.name, distance } : closest;
          }, { symbol: "", name: "", distance: Infinity });
          if (closestPair.distance <= 3) {
            symbol = closestPair.symbol;
          }
        }
      }

      // Step 3: If still no symbol, check chat history for a symbol
      if (!symbol) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          const historySymbolMatch = msg.content.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0];
          if (historySymbolMatch) {
            const potentialSymbol = historySymbolMatch.toUpperCase();
            const pair = forexPairs.find((p: any) => p.symbol === potentialSymbol);
            if (pair) {
              symbol = potentialSymbol;
              break;
            }
          }
        }
      }

      // Step 4: If no symbol is found, ask the user to provide one
      if (!symbol) {
        const errorMessage: Message = {
          role: "assistant",
          content: "Please provide a forex pair symbol or pair name to analyze (e.g., 'EUR/USD' for Euro to US Dollar, 'British Pound to Yen').",
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

      // Step 5: Validate symbol against forex pairs
      if (forexPairs.length > 0) {
        const isValidSymbol = forexPairs.some((pair: any) => pair.symbol === symbol);
        if (!isValidSymbol) {
          const closestSymbol = forexPairs.reduce((closest: any, p: any) => {
            const distance = levenshteinDistance(symbol.replace("/", ""), p.symbol.replace("/", ""));
            return distance < (closest.distance || Infinity) ? { symbol: p.symbol, distance } : closest;
          }, { symbol: "", distance: Infinity });
          const suggestion = closestSymbol.distance <= 2 ? ` Did you mean '${closestSymbol.symbol}'?` : "";
          const errorMessage: Message = {
            role: "assistant",
            content: `I couldn’t find '${symbol}' in the forex pairs list.${suggestion} Please try a valid symbol like 'EUR/USD' for Euro to US Dollar or 'GBP/JPY' for British Pound to Japanese Yen.`,
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

      // Step 6: Determine what data to fetch
      const indicators = ["rsi", "macd", "ema", "bbands", "adx", "atr", "ichimoku", "stoch", "cci", "mom", "pivot_points_hl"];
      const requestedIndicators = indicators.filter((indicator) =>
        input.toLowerCase().includes(indicator)
      );
      const needsForexData = input.toLowerCase().includes("price") ||
                            input.toLowerCase().includes("change") ||
                            input.toLowerCase().includes("trend") ||
                            input.toLowerCase().includes("analyz");

      let forexData, indicatorsData;
      const apiCallCount = { count: 0 }; // Track the number of API calls

      // Fetch forex data if needed
      if (needsForexData || requestedIndicators.length === 0) {
        try {
          forexData = await fetchForexData(symbol, apiCallCount);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorMsg: Message = {
            role: "assistant",
            content: `I couldn't fetch forex data for ${symbol} due to an API error: ${errorMessage}. Please try again later or use a different symbol.`,
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
          setLoading(false);
          return;
        }
      }

      // Fetch technical indicators if requested (or all for general analysis)
      if (requestedIndicators.length > 0 || (!needsForexData && input.toLowerCase().includes("analyz"))) {
        const indicatorsToFetch = requestedIndicators.length > 0 ? requestedIndicators : indicators;
        try {
          indicatorsData = await fetchIndicators(symbol, indicatorsToFetch, apiCallCount);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorMsg: Message = {
            role: "assistant",
            content: `I couldn't fetch technical indicators for ${symbol} due to an API error: ${errorMessage}. Please try again later or use a different symbol.`,
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
          setLoading(false);
          return;
        }
      }

      // Step 7: Prepare the enhanced input with API data and chat history
      const combinedData = {
        forexData,
        indicators: indicatorsData,
        forexPairs,
      };
      const enhancedInput = `${input}\n\nAPI Data: ${JSON.stringify(combinedData)}\n\nChat History: ${JSON.stringify(messages)}`;

      // Step 8: Call the chain with the enhanced input and chat history
      const chain = prompt.pipe(llm);
      const response = await chain.invoke({
        input: enhancedInput,
        chat_history: await chatHistory.getMessages(),
      });

      // Step 9: Add assistant response to the chat with fetched data
      const assistantMessage: Message = {
        role: "assistant",
        content: response.content,
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

      await chatHistory.addMessage(new SystemMessage(response.content));
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

  // Levenshtein Distance for typo handling
  function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={toggleSidebar} className="lg:hidden">
                <Menu className="h-6 w-6" />
              </Button>
              <BarChart3 className="h-8 w-8 text-teal-600" />
              <span className="text-2xl font-bold">Forex Advisor</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost">All Markets</Button>
              </Link>
              <Link href="/news">
                <Button variant="ghost">News</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Back Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Full-Screen Chat Interface */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-64 bg-muted border-r p-4 flex flex-col lg:w-80"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Chat History</h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Button onClick={handleNewChat} className="mb-4 bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" /> New Chat
              </Button>
              <div className="flex-1 overflow-y-auto">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex justify-between items-center p-2 rounded-lg mb-2 cursor-pointer ${
                      session.id === currentChatId ? "bg-teal-100" : "hover:bg-gray-100"
                    }`}
                  >
                    <div
                      className="flex-1 truncate"
                      onClick={() => handleSwitchChat(session.id)}
                    >
                      <span className="text-sm font-medium">{session.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteChat(session.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {forexPairsError && (
              <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
                {forexPairsError}
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-teal-600 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  <p>{message.content}</p>
                  <span className="text-xs text-gray-500 mt-1 block">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {message.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-200 text-gray-800 p-3 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleClearChat}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a forex pair (e.g., 'Analyze EUR/USD', 'What’s the RSI for GBP/JPY?')"
                className="flex-1 resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button onClick={handleSendMessage} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}