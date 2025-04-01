// app/stockadvisor/page.tsx
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

// In-memory cache for stock data and indicators
const stockDataCache = new Map();
const indicatorsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Rate limit: 8 requests per minute (60 seconds / 8 = 7.5 seconds per request)
const REQUEST_DELAY_MS = 7500; // 7.5 seconds delay between requests
const API_CALL_THRESHOLD = 4; // Apply delay only if API calls exceed this threshold

// Define the top 10 exchanges to fetch
const exchanges = [
  "NYSE",      // New York Stock Exchange (USA)
  "NASDAQ",    // NASDAQ (USA)
  "SSE",       // Shanghai Stock Exchange (China)
  "SZSE",      // Shenzhen Stock Exchange (China)
  "Euronext",  // Euronext (Europe)
  "JPX",       // Japan Exchange Group (Japan)
  "LSE",       // London Stock Exchange (UK)
  "HKEX",      // Hong Kong Stock Exchange (Hong Kong)
  "TSX",       // Toronto Stock Exchange (Canada)
  "NSE"        // National Stock Exchange of India (India)
];

// Utility function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Fetch stock listings from multiple exchanges using Twelve Data API
async function fetchStockListings() {
  const cacheKey = "stockListings";
  const cachedData = stockDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached stock listings");
    return cachedData.data;
  }

  try {
    const allListings: any[] = [];
    const apiCallCount = { count: 0 }; // Track API calls for rate limiting

    // Fetch stock listings for each exchange
    for (const exchange of exchanges) {
      const url = `https://api.twelvedata.com/stocks?source=docs&exchange=${exchange}`;
      const response = await fetchWithRetry(url);
      apiCallCount.count += 1;
      if (apiCallCount.count > API_CALL_THRESHOLD) {
        await delay(REQUEST_DELAY_MS);
      }

      const listings = response.data || [];
      allListings.push(...listings);
    }

    // Remove duplicates based on symbol (in case of cross-listings)
    const uniqueListings = Array.from(
      new Map(allListings.map((item) => [item.symbol, item])).values()
    );

    stockDataCache.set(cacheKey, { data: uniqueListings, timestamp: now });
    return uniqueListings;
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
    // Fetch quote (current price, daily change, volume)
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
    stockDataCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error fetching stock data for ${symbol}:`, errorMessage);
    throw error;
  }
}

// List of relevant technical indicators for stock analysis from Twelve Data
const SUPPORTED_INDICATORS = [
  // Trend Indicators
  "ema", "sma", "wma", "dema", "tema", "trima", "kama",
  "macd", "macdext", "ppo",
  "adx", "adxr", "cci", "aroon", "aroonosc",
  "minus_di", "minus_dm", "plus_di", "plus_dm",
  "sar", "sarext", "supertrend", "ichimoku", "keltner",
  
  // Momentum Indicators
  "rsi", "stoch", "stochf", "stochrsi", "willr", "mfi",
  "roc", "rocp", "rocr", "rocr100", "mom", "cmo", "ultosc",
  
  // Volatility Indicators
  "bbands", "atr", "natr", "stddev", "var",
  
  // Volume Indicators
  "ad", "adosc", "obv", "vwap",
  
  // Other Useful Indicators
  "beta", "bop", "correl", "dpo", "kst",
  "linearreg", "linearregangle", "linearregintercept", "linearregslope",
  "max", "min", "midpoint", "midprice", "percent_b", "pivot_points_hl",
  "rvol", "tsf", "typprice", "wclprice",
];

// Fetch specific technical indicators using Twelve Data API
// Fetch specific technical indicators using Twelve Data API
async function fetchIndicators(symbol: string, requestedIndicators: string[], apiCallCount: { count: number }) {
  const cacheKey = `indicators_${symbol.toUpperCase()}`;
  const cachedData = indicatorsCache.get(cacheKey) || {};
  const now = Date.now();

  // Normalize requested indicators to lowercase
  const normalizedRequestedIndicators = requestedIndicators.map(ind => ind.toLowerCase());

  // Check if all requested indicators are already cached
  const missingIndicators = normalizedRequestedIndicators.filter(
    (indicator) => !cachedData[indicator] || (now - cachedData[indicator]?.timestamp >= CACHE_DURATION)
  );

  const indicatorsData: { [key: string]: any } = { ...cachedData };

  try {
    for (const indicator of missingIndicators) {
      // Validate if the indicator is supported
      if (!SUPPORTED_INDICATORS.includes(indicator)) {
        console.warn(`Indicator ${indicator} is not supported by Twelve Data API.`);
        continue;
      }

      let url = `https://api.twelvedata.com/${indicator}?symbol=${symbol}&interval=1day&apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;

      // Add specific parameters for certain indicators
      switch (indicator) {
        case "rsi":
        case "adx":
        case "adxr":
        case "atr":
        case "cci":
        case "cmo":
        case "dema":
        case "kama":
        case "mfi":
        case "minus_di":
        case "minus_dm":
        case "plus_di":
        case "plus_dm":
        case "ppo":
        case "sma":
        case "tema":
        case "trima":
        case "willr":
        case "wma":
          url += "&time_period=14";
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
        case "macdext":
          url += "&fast_period=12&slow_period=26&signal_period=9";
          break;
        case "bbands":
          url += "&time_period=20&sd=2";
          break;
        case "aroon":
        case "aroonosc":
          url += "&time_period=14";
          break;
        case "stoch":
        case "stochf":
          url += "&fast_k_period=14&slow_k_period=3&slow_d_period=3";
          break;
        case "stochrsi":
          url += "&time_period=14&fast_k_period=14&fast_d_period=3";
          break;
        case "supertrend":
          url += "&time_period=10&multiplier=3";
          break;
        case "ichimoku":
          url += "&tenkan_period=9&kijun_period=26&senkou_span_b_period=52";
          break;
        case "keltner":
          url += "&time_period=20&multiplier=2";
          break;
        case "pivot_points_hl":
          url += "&time_period=20";
          break;
        default:
          // Use default parameters for indicators that don't require specific settings
          break;
      }

      const response = await fetchWithRetry(url);
      apiCallCount.count += 1;
      if (apiCallCount.count > API_CALL_THRESHOLD) {
        await delay(REQUEST_DELAY_MS);
      }
      indicatorsData[indicator] = { data: response, timestamp: now };
    }
    indicatorsCache.set(cacheKey, indicatorsData);
    return indicatorsData;
  } catch (error) {
    console.error(`Error fetching technical indicators for ${symbol}:`, error.message);
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

  // Fetch stock listings on mount to validate symbols
  useEffect(() => {
    const loadStockListings = async () => {
      try {
        const listings = await fetchStockListings();
        setStockListings(listings);
        setStockListingsError(null);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error loading stock listings:", errorMessage);
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

  // Initialize the chat session with an initial message
  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: `Welcome to the Stock Advisor! I can help you analyze stocks from major exchanges like NYSE, NASDAQ, SSE, SZSE, Euronext, JPX, LSE, HKEX, TSX, and NSE. Please provide a stock symbol or company name to get started (e.g., "AAPL" for Apple, "Tesla"), and specify any technical indicators you'd like to analyze (e.g., RSI, EMA, MACD, VWAP, ADX, etc.). I support a wide range of technical indicators from Twelve Data, including AD, ADX, BBANDS, EMA, MACD, RSI, VWAP, and many more—just ask!`,
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // Placeholder for the system prompt (to be added later)
// With this:
const systemPrompt = `
You are an AI stock advisor for FinanceAI, a platform that provides financial data analysis for stocks. Your task is to assist users by interpreting stock data and technical indicators for a given stock symbol or company name from major exchanges including NYSE, NASDAQ, SSE, SZSE, Euronext, JPX, LSE, HKEX, TSX, and NSE. Follow these steps:

1. **Identify the Symbol**:
   - The user will provide a stock symbol (e.g., "AAPL" for Apple, "TSLA" for Tesla) or a company name (e.g., "Apple", "Tesla").
   - Be robust to typos in the symbol or company name:
     - For symbols, if the input is close to a valid symbol (e.g., "APPL" instead of "AAPL"), correct it to the closest match from the stock listings.
     - For company names, if the input has a typo (e.g., "Aple" instead of "Apple"), use fuzzy matching to find the closest match in the stock listings.
   - If a company name is provided, map it to the correct stock symbol using the stock listings data (e.g., "Apple" -> "AAPL").
   - If the user does not provide a symbol in the current message, check the chat history for the most recent symbol mentioned and use that. Do not ask for a symbol if it’s already clear from the context.

2. **Validate the Symbol**:
   - Validate the symbol against a list of known stock symbols provided in the stock listings data from exchanges: NYSE, NASDAQ, SSE, SZSE, Euronext, JPX, LSE, HKEX, TSX, and NSE.
   - If the symbol is invalid, inform the user and suggest trying a valid stock symbol (e.g., "I couldn’t find 'XYZ' in the stock listings. Did you mean 'AAPL' for Apple? Please try a valid symbol like 'AAPL' for Apple or 'TSLA' for Tesla.").

3. **Identify Requested Data**:
   - Determine what the user is asking for:
     - If the user asks for general analysis (e.g., "Analyze AAPL"), provide a full analysis including stock data (current price, daily change, 30-day trend) and a selection of common technical indicators (e.g., EMA, RSI, MACD, BBANDS, ADX, ATR, AROON).
     - If the user asks for specific indicators (e.g., "What’s the VWAP for AAPL?" or "Show me the ADX and STOCH for AAPL"), only provide analysis for the requested indicators.
     - If the user asks for stock statistics (e.g., "What’s the current price of AAPL?"), only provide the requested stock data.
   - The available technical indicators are: ad, add, adosc, adx, adxr, apo, aroon, aroonosc, atr, avg, avgprice, bbands, beta, bop, cci, ceil, cmo, coppock, correl, crsi, dema, div, dpo, dx, ema, exp, floor, heikinashicandles, hlc3, ht_dcperiod, ht_dcphase, ht_phasor, ht_sine, ht_trendline, ht_trendmode, ichimoku, kama, keltner, kst, linearreg, linearregangle, linearregintercept, linearregslope, ln, log10, ma, macd, macd_slope, macdext, mama, max, maxindex, mcginley_dynamic, medprice, mfi, midpoint, midprice, min, minindex, minmax, minmaxindex, minus_di, minus_dm, mom, mult, natr, obv, percent_b, pivot_points_hl, plus_di, plus_dm, ppo, roc, rocp, rocr, rocr100, rsi, rvol, sar, sarext, sma, sqrt, stddev, stoch, stochf, stochrsi, sub, sum, supertrend, supertrend_heikinashicandles, t3ma, tema, trange, trima, tsf, typprice, ultosc, var, vwap, wclprice, willr, wma.
   - Stock data includes: current price, daily change, volume, and 30-day price trend.

4. **Use Provided Data**:
   - The data has already been fetched and provided to you in the input as JSON under "API Data". Do not attempt to fetch data yourself.
   - The data includes:
     - **Stock Data**:
       - Quote: Current price, daily change, volume, etc.
       - Time Series: Historical price data (up to 30 days for trend analysis).
     - **Technical Indicators** (only the requested indicators will be provided):
       - Each indicator will have its own data structure based on the Twelve Data API response.
       - For example, RSI will have a "values" array with the latest RSI value, EMA may have 20-day and 50-day values, etc.
   - If the data for a requested indicator or stock data is null or missing, inform the user (e.g., "I couldn’t fetch the VWAP for [symbol] due to an API error. Please try again later.").

5. **Deep Analysis**:
   - Provide a detailed analysis based on the user’s request:
     - **For General Analysis**: Include current price, daily change, 30-day trend, and a selection of common technical indicators (e.g., EMA, RSI, MACD, BBANDS, ADX, ATR, AROON).
     - **For Specific Indicators**: Only analyze the requested indicators.
     - **For Stock Statistics**: Only provide the requested stock data (e.g., current price, volume).
   - Include the following in your analysis (where applicable):
     - **Current Values**: Report the most recent value for each indicator or data point (e.g., "The current price is $174.55", "The 14-day RSI is 54.21").
     - **Trend Analysis**: Analyze the trend over the past 30 days using the time series data or indicator values (e.g., "The price has increased by 5% over the past 30 days", "The RSI has risen from 50 to 54.21, indicating growing bullish momentum").
     - **Comparisons**: Compare indicators to identify confirmations or divergences (e.g., "The price is above both the 20-day and 50-day EMA, confirming a bullish trend, but the RSI is nearing overbought levels at 70").
     - **Momentum and Volatility**: Assess momentum and volatility where applicable (e.g., "The ATR indicates increasing volatility, suggesting larger price swings").
     - **Trend Strength**: Evaluate trend strength where applicable (e.g., "An ADX of 30 indicates a strong trend").
     - **Actionable Insights**: Provide potential trading strategies based on the analysis (e.g., "The MACD histogram is positive and increasing, suggesting a buy opportunity, but monitor for a potential pullback as the price nears the upper Bollinger Band").
   - Avoid speculative advice (e.g., don’t say "This stock will definitely go up"). Instead, provide data-driven insights.

6. **Handle Unsupported Indicators**:
   - If the user requests an indicator that is not in the supported list, inform them that the indicator is not available and suggest a similar indicator (e.g., "The indicator 'XYZ' is not supported. Did you mean 'RSI' or 'MACD'? I support indicators like ad, add, adosc, adx, adxr, apo, aroon, aroonosc, atr, avg, avgprice, bbands, beta, bop, cci, ceil, cmo, coppock, correl, crsi, dema, div, dpo, dx, ema, exp, floor, heikinashicandles, hlc3, ht_dcperiod, ht_dcphase, ht_phasor, ht_sine, ht_trendline, ht_trendmode, ichimoku, kama, keltner, kst, linearreg, linearregangle, linearregintercept, linearregslope, ln, log10, ma, macd, macd_slope, macdext, mama, max, maxindex, mcginley_dynamic, medprice, mfi, midpoint, midprice, min, minindex, minmax, minmaxindex, minus_di, minus_dm, mom, mult, natr, obv, percent_b, pivot_points_hl, plus_di, plus_dm, ppo, roc, rocp, rocr, rocr100, rsi, rvol, sar, sarext, sma, sqrt, stddev, stoch, stochf, stochrsi, sub, sum, supertrend, supertrend_heikinashicandles, t3ma, tema, trange, trima, tsf, typprice, ultosc, var, vwap, wclprice, willr, wma.").

7. **Handle Errors**:
   - If the symbol is invalid or the API data is unavailable, inform the user and suggest trying a different symbol (e.g., "I couldn't find data for 'XYZ'. Did you mean 'AAPL' for Apple? Please try a valid symbol like 'AAPL' for Apple.").

8. **Maintain Conversational Context**:
   - Use the chat history to maintain context (e.g., if the user asks "What’s the VWAP?" after discussing AAPL, provide the VWAP for AAPL).
   - Do not ask for the symbol again unless the context is unclear.

9. **Response Format**:
   - Respond in a clear, professional tone.
   - Use bullet points or short paragraphs for readability.
   - Do not invent or hallucinate data. Only use the provided API data.
   - Do not include chart-related notes (e.g., "[Chart Available]") since visualizations are not needed.

Example Interaction:
User: "What’s the VWAP for AAPL?"
Assistant:
**VWAP for AAPL (Apple)**

- The Volume Weighted Average Price (VWAP) for AAPL is $173.45 (as of the latest data).
- The VWAP is a useful indicator for assessing the average price at which the stock has traded throughout the day, weighted by volume. Since the current price ($174.55) is above the VWAP, it suggests that the stock is trading at a premium relative to its volume-weighted average.

Would you like to analyze another indicator for AAPL or try a different stock?
`;

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
      const symbolMatch = input.match(/\b[A-Za-z]{1,5}\b/)?.[0];
      const requestedIndicator = SUPPORTED_INDICATORS.find((indicator) =>
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
          if (requestedIndicator) {
            newTitle = `${requestedIndicator.toUpperCase()} for ${matchedStock.symbol}`;
          } else if (input.toLowerCase().includes("analyz")) {
            newTitle = `Analysis for ${matchedStock.symbol}`;
          } else {
            newTitle = `Query for ${matchedStock.symbol}`;
          }
        }
      }
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === currentChatId ? { ...session, title: newTitle } : session
        )
      );
    }

    setLoading(true);
    try {
      const chatHistory = chatHistories.get(currentChatId) || new InMemoryChatMessageHistory();
      const apiCallCount = { count: 0 }; // Track API calls for rate limiting

      // Add user message to chat history
      await chatHistory.addMessage(new HumanMessage(input));

      // Extract symbol and indicators from user input
      let symbol = input.match(/\b[A-Za-z]{1,5}\b/)?.[0]?.toUpperCase();
      if (!symbol) {
        const companyName = input.toLowerCase().replace(/stock/gi, "").trim();
        const matchedStock = stockListings.find((s) =>
          s.name.toLowerCase().includes(companyName)
        );
        if (matchedStock) {
          symbol = matchedStock.symbol;
        } else {
          // Check chat history for the most recent symbol
          const historyMessages = await chatHistory.getMessages();
          for (let i = historyMessages.length - 1; i >= 0; i--) {
            const msg = historyMessages[i];
            if (msg.content) {
              const historySymbol = msg.content.match(/\b[A-Za-z]{1,5}\b/)?.[0]?.toUpperCase();
              if (historySymbol) {
                symbol = historySymbol;
                break;
              }
            }
          }
        }
      }

      if (!symbol || !stockListings.some((s) => s.symbol === symbol)) {
        const assistantMessage: Message = {
          role: "assistant",
          content: `I couldn’t find a valid stock symbol in your request. Please provide a valid symbol (e.g., "AAPL" for Apple) or company name from exchanges like NYSE, NASDAQ, SSE, SZSE, Euronext, JPX, LSE, HKEX, TSX, or NSE.`,
          timestamp: new Date().toLocaleTimeString(),
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
        await chatHistory.addMessage(new SystemMessage(assistantMessage.content));
        setLoading(false);
        return;
      }

      // Determine requested indicators
      const requestedIndicators = SUPPORTED_INDICATORS.filter((indicator) =>
        input.toLowerCase().includes(indicator)
      );
      const isGeneralAnalysis = input.toLowerCase().includes("analyz") && requestedIndicators.length === 0;
      const defaultIndicators = ["ema", "rsi", "macd", "bbands", "adx", "atr", "aroon"];
      const indicatorsToFetch = isGeneralAnalysis ? defaultIndicators : requestedIndicators;

      // Fetch stock data and indicators
      const stockData = await fetchStockData(symbol, apiCallCount);
      const indicatorsData = indicatorsToFetch.length > 0 ? await fetchIndicators(symbol, indicatorsToFetch, apiCallCount) : {};

      // Prepare API data for the LLM
      const apiData = {
        stockData,
        indicatorsData,
      };

      // Initialize the LLM
      const llm = new ChatGroq({
        apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
        model: "llama3-70b-8192",
      });

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ...messages.map((msg) => [msg.role, msg.content]),
        ["user", `User Input: ${input}\nAPI Data: ${JSON.stringify(apiData)}`],
      ]);

      const chain = prompt.pipe(llm);
      const response = await chain.invoke({
        messages: await chatHistory.getMessages(),
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
      console.error("Error processing request:", errorMessage);
      const errorMessageObj: Message = {
        role: "assistant",
        content: "An error occurred while processing your request. Please try again later.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => {
        const updatedMessages = [...prev, errorMessageObj];
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId
              ? { ...session, messages: updatedMessages }
              : session
          )
        );
        return updatedMessages;
      });
      toast({
        title: "Error",
        description: "An error occurred while processing your request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setInput("");
    }

    return (
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="w-64 bg-white shadow-lg p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Chat History</h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Button onClick={handleNewChat} className="mb-4">
                <Plus className="h-4 w-4 mr-2" /> New Chat
              </Button>
              <div className="flex-1 overflow-y-auto">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                      session.id === currentChatId ? "bg-gray-200" : "hover:bg-gray-100"
                    }`}
                  >
                    <div
                      className="flex-1 truncate"
                      onClick={() => handleSwitchChat(session.id)}
                    >
                      <p className="text-sm font-medium">{session.title}</p>
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
    
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white shadow p-4 flex items-center justify-between">
            <div className="flex items-center">
              {!isSidebarOpen && (
                <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <h1 className="text-xl font-bold ml-2">Stock Advisor</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/">
                <Button variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" /> Dashboard
                </Button>
              </Link>
              <Button variant="destructive" onClick={handleClearChat}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
              </Button>
            </div>
          </div>
    
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {stockListingsError && (
              <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
                {stockListingsError}
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
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">{message.timestamp}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-800 p-3 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
    
          {/* Input Area */}
          <div className="bg-white p-4 shadow">
            <div className="flex items-center space-x-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a stock (e.g., 'Analyze AAPL' or 'What’s the VWAP for TSLA?')"
                className="flex-1 resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button onClick={handleSendMessage} disabled={loading}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );