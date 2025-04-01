"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { TrendingUp, Send, Loader2, Trash2, Clock, Menu, Plus, X } from "lucide-react";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Stock theme colors
const stockBlue = "#1E3A8A"; // Deep blue for headers and buttons
const stockGold = "#D4AF37"; // Gold for accents
const stockWhite = "#F5F6F5"; // Soft white for backgrounds

// In-memory cache for stock data and indicators
const stockDataCache = new Map();
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

// Fetch stock listings to validate symbols using Twelve Data API
async function fetchStockListings() {
  const cacheKey = "stockListings";
  const cachedData = stockDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached stock listings");
    return cachedData.data;
  }

  try {
    const url = `https://api.twelvedata.com/stocks?source=docs&exchange=NASDAQ`;
    const response = await fetchWithRetry(url);
    const data = response.data || [];
    stockDataCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching stock listings:", errorMessage);
    throw error;
  }
}

// Fetch stock data (quote, time series) using Twelve Data API
async function fetchStockData(symbol: string, apiCallCount: { count: number }) {
  const cacheKey = `stockData_${symbol.toUpperCase()}`;
  const cachedData = stockDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached stock data for symbol: ${symbol}`);
    return cachedData.data;
  }

  try {
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
    const quoteResponse = await fetchWithRetry(quoteUrl);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) {
      await delay(REQUEST_DELAY_MS);
    }

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
    stockDataCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error fetching stock data for ${symbol}:`, errorMessage);
    throw error;
  }
}

// Fetch specific technical indicators using Twelve Data API
async function fetchIndicators(symbol: string, requestedIndicators: string[], apiCallCount: { count: number }) {
  const cacheKey = `indicators_${symbol.toUpperCase()}`;
  const cachedData = indicatorsCache.get(cacheKey) || {};
  const now = Date.now();

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
        case "aroon":
          url = `https://api.twelvedata.com/aroon?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
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
  stockData?: any;
  indicatorsData?: any;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

const chatHistories = new Map<string, InMemoryChatMessageHistory>();

export default function StockAdvisor() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [stockListings, setStockListings] = useState<any[]>([]);
  const [stockListingsError, setStockListingsError] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadStockListings = async () => {
      try {
        const listings = await fetchStockListings();
        setStockListings(listings);
        setStockListingsError(null);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setStockListingsError("Failed to load stock listings. Some features may be limited. Please try refreshing the page.");
        toast({
          title: "Error",
          description: "Failed to load stock listings. Some features may be limited.",
          variant: "destructive",
        });
      }
    };
    loadStockListings();
  }, [toast]);

  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: `Hey there! I’m your Stock Buddy, here to help you dive into the stock market. Ask me anything—like "Analyze AAPL" or "What’s the RSI for Tesla?"—and I’ll give you the latest insights. What’s on your mind?`,
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
    if (currentSession) {
      setMessages(currentSession.messages);
    } else {
      setMessages([]);
    }
  }, [currentChatId, chatSessions]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  const systemPrompt = `
You are an AI stock advisor for FinanceAI, a platform that provides financial data analysis for stocks. Your task is to assist users by interpreting stock data and technical indicators for a given stock symbol or company name. Follow these steps:

1. **Identify the Symbol**:
   - The user will provide a stock symbol (e.g., "AAPL" for Apple, "TSLA" for Tesla) or a company name (e.g., "Apple", "Tesla").
   - Be robust to typos in the symbol or company name:
     - For symbols, if the input is close to a valid symbol (e.g., "APPL" instead of "AAPL"), correct it to the closest match from the stock listings.
     - For company names, if the input has a typo (e.g., "Aple" instead of "Apple"), use fuzzy matching to find the closest match in the stock listings.
   - If a company name is provided, map it to the correct stock symbol using the stock listings data (e.g., "Apple" -> "AAPL").
   - If the user does not provide a symbol in the current message, check the chat history for the most recent symbol mentioned and use that. Do not ask for a symbol if it’s already clear from the context.

2. **Validate the Symbol**:
   - Validate the symbol against a list of known stock symbols provided in the stock listings data.
   - If the symbol is invalid, inform the user and suggest trying a valid stock symbol (e.g., "I couldn’t find 'XYZ' in the stock listings. Did you mean 'AAPL' for Apple? Please try a valid symbol like 'AAPL' for Apple or 'TSLA' for Tesla.").

3. **Identify Requested Data**:
   - Determine what the user is asking for:
     - If the user asks for general analysis (e.g., "Analyze AAPL"), provide a full analysis including stock data (current price, daily change, 30-day trend) and all available technical indicators.
     - If the user asks for specific indicators (e.g., "What’s the RSI for AAPL?" or "Show me the EMA and MACD for AAPL"), only provide analysis for the requested indicators.
     - If the user asks for stock statistics (e.g., "What’s the current price of AAPL?"), only provide the requested stock data.
   - The available technical indicators are: EMA (20-day and 50-day), RSI (14-day), MACD (12-day, 26-day, 9-day signal line), BBANDS (Bollinger Bands, 20-day, 2 standard deviations), ADX (14-day), ATR (14-day), AROON (14-day).
   - Stock data includes: current price, daily change, volume, and 30-day price trend.

4. **Use Provided Data**:
   - The data has already been fetched and provided to you in the input as JSON under "API Data". Do not attempt to fetch data yourself.
   - The data includes:
     - **Stock Data**:
       - Quote: Current price, daily change, volume, etc.
       - Time Series: Historical price data (up to 30 days for trend analysis).
     - **Technical Indicators** (only the requested indicators will be provided):
       - EMA: 20-day and 50-day Exponential Moving Average.
       - RSI: 14-day Relative Strength Index.
       - MACD: Moving Average Convergence Divergence (12-day, 26-day, 9-day signal line).
       - BBANDS: Bollinger Bands (20-day, 2 standard deviations).
       - ADX: Average Directional Index (14-day).
       - ATR: Average True Range (14-day).
       - AROON: Aroon Indicator (14-day).
   - If the data for a requested indicator or stock data is null or missing, inform the user (e.g., "I couldn’t fetch the RSI for [symbol] due to an API error. Please try again later.").

5. **Deep Analysis**:
   - Provide a detailed analysis based on the user’s request:
     - **For General Analysis**: Include current price, daily change, 30-day trend, and all available technical indicators.
     - **For Specific Indicators**: Only analyze the requested indicators.
     - **For Stock Statistics**: Only provide the requested stock data (e.g., current price, volume).
   - Include the following in your analysis (where applicable):
     - **Current Values**: Report the most recent value for each indicator or data point (e.g., "The current price is $174.55", "The 14-day RSI is 54.21").
     - **Trend Analysis**: Analyze the trend over the past 30 days using the time series data or indicator values (e.g., "The price has increased by 5% over the past 30 days", "The RSI has risen from 50 to 54.21, indicating growing bullish momentum").
     - **Comparisons**: Compare indicators to identify confirmations or divergences (e.g., "The price is above both the 20-day and 50-day EMA, confirming a bullish trend, but the RSI is nearing overbought levels at 70").
     - **Momentum and Volatility**: Assess momentum using RSI, MACD, and AROON, and volatility using BBANDS and ATR (e.g., "The ATR indicates increasing volatility, suggesting larger price swings").
     - **Trend Strength**: Use ADX to evaluate trend strength (e.g., "An ADX of 30 indicates a strong trend").
     - **Actionable Insights**: Provide potential trading strategies based on the analysis (e.g., "The MACD histogram is positive and increasing, suggesting a buy opportunity, but monitor for a potential pullback as the price nears the upper Bollinger Band").
   - Avoid speculative advice (e.g., don’t say "This stock will definitely go up"). Instead, provide data-driven insights.

6. **Handle Additional Indicator Requests**:
   - If the user requests additional indicators not currently provided (e.g., "Can you show me the SMA?"), inform them that you currently have data for EMA, RSI, MACD, BBANDS, ADX, ATR, and AROON. Suggest they ask for one of those or provide a general analysis.

7. **Handle Errors**:
   - If the symbol is invalid or the API data is unavailable, inform the user and suggest trying a different symbol (e.g., "I couldn't find data for 'XYZ'. Did you mean 'AAPL' for Apple? Please try a valid symbol like 'AAPL' for Apple.").

8. **Maintain Conversational Context**:
   - Use the chat history to maintain context (e.g., if the user asks "What’s the RSI?" after discussing AAPL, provide the RSI for AAPL).
   - Do not ask for the symbol again unless the context is unclear.

9. **Response Format**:
   - Respond in a clear, professional tone.
   - Use bullet points or short paragraphs for readability.
   - Do not invent or hallucinate data. Only use the provided API data.
   - Do not include chart-related notes (e.g., "[Chart Available]") since visualizations are not needed.
  `;

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
      const symbolMatch = input.match(/\b[A-Za-z]{1,5}\b/)?.[0];
      const indicators = ["rsi", "macd", "ema", "bbands", "adx", "atr", "aroon"];
      const requestedIndicator = indicators.find((indicator) =>
        input.toLowerCase().includes(indicator)
      );
      if (symbolMatch) {
        const potentialSymbol = symbolMatch.toUpperCase();
        const stock = stockListings.find((s) => s.symbol === potentialSymbol);
        if (stock) {
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
        const companyName = input.toLowerCase().replace(/stock/gi, "").trim();
        const matchedStock = stockListings.find((s) =>
          s.name.toLowerCase().includes(companyName)
        );
        if (matchedStock) {
          newTitle = `Analysis for ${matchedStock.symbol}`;
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
      const llm = new ChatGroq({
        apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
        model: "llama3-70b-8192",
        temperature: 0.5,
      });

      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) {
        throw new Error("Chat history not initialized for this session.");
      }
      await chatHistory.addMessage(new HumanMessage(input));

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"],
      ]);

      let symbol: string | null = null;

      const symbolMatch = input.match(/\b[A-Za-z]{1,5}\b/)?.[0];
      if (symbolMatch) {
        const potentialSymbol = symbolMatch.toUpperCase();
        const stock = stockListings.find((s) => s.symbol === potentialSymbol);
        if (stock) {
          symbol = potentialSymbol;
        } else {
          const closestSymbol = stockListings.reduce((closest: any, s: any) => {
            const distance = levenshteinDistance(potentialSymbol, s.symbol);
            return distance < (closest.distance || Infinity) ? { symbol: s.symbol, distance } : closest;
          }, { symbol: "", distance: Infinity });
          if (closestSymbol.distance <= 2) {
            symbol = closestSymbol.symbol;
          }
        }
      }

      if (!symbol) {
        const companyName = input.toLowerCase().replace(/stock/gi, "").trim();
        const stock = stockListings.find((s: any) =>
          s.name.toLowerCase().includes(companyName)
        );
        if (stock) {
          symbol = stock.symbol;
        } else {
          const closestStock = stockListings.reduce((closest: any, s: any) => {
            const distance = levenshteinDistance(companyName, s.name.toLowerCase());
            return distance < (closest.distance || Infinity) ? { symbol: s.symbol, name: s.name, distance } : closest;
          }, { symbol: "", name: "", distance: Infinity });
          if (closestStock.distance <= 3) {
            symbol = closestStock.symbol;
          }
        }
      }

      if (!symbol) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          const historySymbolMatch = msg.content.match(/\b[A-Za-z]{1,5}\b/)?.[0];
          if (historySymbolMatch) {
            const potentialSymbol = historySymbolMatch.toUpperCase();
            const stock = stockListings.find((s: any) => s.symbol === potentialSymbol);
            if (stock) {
              symbol = potentialSymbol;
              break;
            }
          }
        }
      }

      if (!symbol) {
        const errorMessage: Message = {
          role: "assistant",
          content: "Please provide a stock symbol or company name to analyze (e.g., 'AAPL' for Apple, 'Tesla').",
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

      if (stockListings.length > 0) {
        const isValidSymbol = stockListings.some((stock: any) => stock.symbol === symbol);
        if (!isValidSymbol) {
          const closestSymbol = stockListings.reduce((closest: any, s: any) => {
            const distance = levenshteinDistance(symbol, s.symbol);
            return distance < (closest.distance || Infinity) ? { symbol: s.symbol, distance } : closest;
          }, { symbol: "", distance: Infinity });
          const suggestion = closestSymbol.distance <= 2 ? ` Did you mean '${closestSymbol.symbol}'?` : "";
          const errorMessage: Message = {
            role: "assistant",
            content: `I couldn’t find '${symbol}' in the stock listings.${suggestion} Please try a valid symbol like 'AAPL' for Apple or 'TSLA' for Tesla.`,
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

      const indicators = ["rsi", "macd", "ema", "bbands", "adx", "atr", "aroon"];
      const requestedIndicators = indicators.filter((indicator) =>
        input.toLowerCase().includes(indicator)
      );
      const needsStockData =
        input.toLowerCase().includes("price") ||
        input.toLowerCase().includes("change") ||
        input.toLowerCase().includes("volume") ||
        input.toLowerCase().includes("trend") ||
        input.toLowerCase().includes("analyz");

      let stockData, indicatorsData;
      const apiCallCount = { count: 0 };

      if (needsStockData || requestedIndicators.length === 0) {
        try {
          stockData = await fetchStockData(symbol, apiCallCount);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorMsg: Message = {
            role: "assistant",
            content: `I couldn't fetch stock data for ${symbol} due to an API error: ${errorMessage}. Please try again later or use a different symbol.`,
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

      if (requestedIndicators.length > 0 || (!needsStockData && input.toLowerCase().includes("analyz"))) {
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

      const combinedData = {
        stockData,
        indicators: indicatorsData,
        stockListings,
      };
      const enhancedInput = `${input}\n\nAPI Data: ${JSON.stringify(combinedData)}\n\nChat History: ${JSON.stringify(messages)}`;

      const chain = prompt.pipe(llm);
      const response = await chain.invoke({
        input: enhancedInput,
        chat_history: await chatHistory.getMessages(),
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: response.content,
        timestamp: new Date().toLocaleTimeString(),
        stockData,
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

  function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: stockWhite }}>
      <header className="border-b" style={{ backgroundColor: stockBlue, color: stockGold }}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={toggleSidebar} className="lg:hidden" style={{ color: stockGold }}>
                <Menu className="h-6 w-6" />
              </Button>
              <TrendingUp className="h-8 w-8" style={{ color: stockGold }} />
              <span className="text-2xl font-bold">Stock Buddy</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" style={{ color: stockGold }}>All Markets</Button>
              </Link>
              <Link href="/news">
                <Button variant="ghost" style={{ color: stockGold }}>News</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" style={{ borderColor: stockGold, color: stockGold }}>Back Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-64 border-r p-4 flex flex-col lg:w-80"
              style={{ backgroundColor: stockBlue, color: stockGold }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Chat History</h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden" style={{ color: stockGold }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Button onClick={handleNewChat} style={{ backgroundColor: stockGold, color: stockBlue }}>
                <Plus className="h-4 w-4 mr-2" /> New Chat
              </Button>
              <div className="flex-1 overflow-y-auto mt-4">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex justify-between items-center p-2 rounded-lg mb-2 cursor-pointer ${
                      session.id === currentChatId ? "bg-blue-200" : "hover:bg-blue-700"
                    }`}
                  >
                    <div className="flex-1 truncate" onClick={() => handleSwitchChat(session.id)}>
                      <span className="text-sm font-medium">{session.title}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteChat(session.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {stockListingsError && (
              <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{stockListingsError}</div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.role === "user" ? "text-white" : "bg-gray-200 text-gray-800"
                  }`}
                  style={{ backgroundColor: message.role === "user" ? stockGold : undefined }}
                >
                  <p>{message.content}</p>
                  <span className="text-xs text-gray-500 mt-1 block">
                    <Clock className="h-3 w-3 inline mr-1" /> {message.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-200 p-3 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: stockBlue }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4" style={{ backgroundColor: stockBlue }}>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleClearChat} style={{ borderColor: stockGold, color: stockGold }}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a stock (e.g., 'Analyze AAPL', 'What’s the RSI for Tesla?')"
                className="flex-1 resize-none"
                rows={2}
                style={{ borderColor: stockGold, backgroundColor: stockWhite, color: stockBlue }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button onClick={handleSendMessage} disabled={loading} style={{ backgroundColor: stockGold, color: stockBlue }}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}