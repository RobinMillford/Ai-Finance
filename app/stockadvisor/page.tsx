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

// Theme colors
const blue500 = "#3B82F6";
const indigo600 = "#4F46E5";
const whiteBg = "#F9FAFB"; // Light background similar to bg-background

// In-memory cache for stock data and indicators
const stockDataCache = new Map<string, { data: any; timestamp: number }>();
const indicatorsCache = new Map<string, { [key: string]: IndicatorData }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Rate limit: 8 requests/minute (7.5 seconds/request)
const REQUEST_DELAY_MS = 7500;
const API_CALL_THRESHOLD = 4;

// Utility to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch with retry for rate limits
async function fetchWithRetry(url: string, maxRetries: number = 3, retryDelayMs: number = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Rate limit hit for ${url}. Retrying (${attempt}/${maxRetries}) after ${retryDelayMs}ms...`);
          if (attempt === maxRetries) throw new Error("Rate limit exceeded after max retries");
          await delay(retryDelayMs);
          continue;
        }
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.message || "Unknown error"}`);
      }
      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (attempt === maxRetries) throw new Error(`Fetch failed after ${maxRetries} attempts: ${errorMessage}`);
      console.warn(`Fetch attempt ${attempt} failed for ${url}. Retrying after ${retryDelayMs}ms...`, errorMessage);
      await delay(retryDelayMs);
    }
  }
  throw new Error("Unexpected error in fetchWithRetry");
}

// Fetch US stock listings (NASDAQ, NYSE)
async function fetchStockListings() {
  const cacheKey = "stockListings";
  const cachedData = stockDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached stock listings");
    return cachedData.data;
  }

  const exchanges = ["NASDAQ", "NYSE"];
  const allListings: any[] = [];

  try {
    const fetchPromises = exchanges.map(async (exchange) => {
      const url = `https://api.twelvedata.com/stocks?source=docs&exchange=${exchange}&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
      const data = await fetchWithRetry(url);
      return data.data || [];
    });
    const results = await Promise.all(fetchPromises);
    results.forEach((exchangeData) => allListings.push(...exchangeData));
    const uniqueListings = Array.from(new Map(allListings.map((item) => [item.symbol, item])).values());
    stockDataCache.set(cacheKey, { data: uniqueListings, timestamp: now });
    console.log(`Fetched ${uniqueListings.length} US stock listings`);
    return uniqueListings;
  } catch (error) {
    console.error("Error fetching stock listings:", error);
    throw error;
  }
}

// Fetch stock data (quote, time series)
async function fetchStockData(symbol: string, apiCallCount: { count: number }) {
  const cacheKey = `stockData_${symbol}`;
  const cachedData = stockDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached stock data for ${symbol}`);
    return cachedData.data;
  }

  if (!process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY) {
    throw new Error("API key is missing. Please configure NEXT_PUBLIC_TWELVEDATA_API_KEY.");
  }

  try {
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
    const quoteResponse = await fetchWithRetry(quoteUrl);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) await delay(REQUEST_DELAY_MS);

    const timeSeriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=30&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
    const timeSeriesResponse = await fetchWithRetry(timeSeriesUrl);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) await delay(REQUEST_DELAY_MS);

    const data = { quote: quoteResponse, timeSeries: timeSeriesResponse };
    stockDataCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error);
    throw error;
  }
}

// Define IndicatorData interface
interface IndicatorData {
  data: any;
  timestamp: number;
}

// Fetch technical indicators
async function fetchIndicators(symbol: string, requestedIndicators: string[], apiCallCount: { count: number }): Promise<{ [key: string]: IndicatorData }> {
  const cacheKey = `indicators_${symbol}`;
  const cachedData = indicatorsCache.get(cacheKey) || {};
  const now = Date.now();

  const missingIndicators = requestedIndicators.filter(
    (indicator) => !cachedData[indicator] || now - cachedData[indicator].timestamp >= CACHE_DURATION
  );

  const indicatorsData: { [key: string]: IndicatorData } = { ...cachedData };

  if (!process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY) {
    throw new Error("API key is missing. Please configure NEXT_PUBLIC_TWELVEDATA_API_KEY.");
  }

  try {
    for (const indicator of missingIndicators) {
      let url = "";
      switch (indicator.toLowerCase()) {
        case "rsi":
          url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          break;
        case "ema":
          const ema20Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          const ema20Response = await fetchWithRetry(ema20Url);
          apiCallCount.count += 1;
          if (apiCallCount.count > API_CALL_THRESHOLD) await delay(REQUEST_DELAY_MS);
          const ema50Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=50&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          const ema50Response = await fetchWithRetry(ema50Url);
          apiCallCount.count += 1;
          if (apiCallCount.count > API_CALL_THRESHOLD) await delay(REQUEST_DELAY_MS);
          indicatorsData["ema"] = { data: { ema20: ema20Response, ema50: ema50Response }, timestamp: now };
          continue;
        case "macd":
          url = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          break;
        case "bbands":
          url = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&sd=2&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          break;
        case "adx":
          url = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          break;
        case "atr":
          url = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          break;
        case "aroon":
          url = `https://api.twelvedata.com/aroon?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          break;
        default:
          continue;
      }
      const response = await fetchWithRetry(url);
      apiCallCount.count += 1;
      if (apiCallCount.count > API_CALL_THRESHOLD) await delay(REQUEST_DELAY_MS);
      indicatorsData[indicator] = { data: response, timestamp: now };
    }
    indicatorsCache.set(cacheKey, indicatorsData);
    return indicatorsData;
  } catch (error) {
    console.error(`Error fetching indicators for ${symbol}:`, error);
    throw error;
  }
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  stockData?: any;
  indicatorsData?: { [key: string]: IndicatorData };
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
        if (!process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY) {
          throw new Error("API key is missing. Please configure NEXT_PUBLIC_TWELVEDATA_API_KEY.");
        }
        const listings = await fetchStockListings();
        setStockListings(listings);
        setStockListingsError(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setStockListingsError(`Failed to load US stock listings: ${errorMessage}. Some features may be limited.`);
        toast({ title: "Error", description: "Failed to load stock listings.", variant: "destructive" });
      }
    };
    loadStockListings();
  }, [toast]);

  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: "Hey there! I'm your Stock Buddy, here to help with US stocks (NASDAQ/NYSE only). Ask me anything—like 'Analyze AAPL' or 'What's the RSI for TSLA?'—and I'll fetch the latest data. What's on your mind?",
      timestamp: new Date().toLocaleTimeString(),
    };
    if (!chatHistories.has(currentChatId)) {
      chatHistories.set(currentChatId, new InMemoryChatMessageHistory());
      const newSession: ChatSession = { id: currentChatId, title: "Welcome Chat", messages: [initialMessage] };
      setChatSessions((prev) => [...prev, newSession]);
      setMessages([initialMessage]);
    }
  }, [currentChatId]);

  useEffect(() => {
    const currentSession = chatSessions.find((session) => session.id === currentChatId);
    setMessages(currentSession?.messages || []);
  }, [currentChatId, chatSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleClearChat = () => {
    setMessages([]);
    chatHistories.set(currentChatId, new InMemoryChatMessageHistory());
    setChatSessions((prev) =>
      prev.map((session) => (session.id === currentChatId ? { ...session, messages: [] } : session))
    );
    toast({ title: "Chat Cleared", description: "Your chat history has been cleared." });
  };

  const handleNewChat = () => {
    setChatSessions((prev) =>
      prev.map((session) => (session.id === currentChatId ? { ...session, messages } : session))
    );
    const newChatId = Date.now().toString();
    chatHistories.set(newChatId, new InMemoryChatMessageHistory());
    const newSession: ChatSession = { id: newChatId, title: `Chat ${chatSessions.length + 1}`, messages: [] };
    setChatSessions((prev) => [...prev, newSession]);
    setCurrentChatId(newChatId);
    setMessages([]);
  };

  const handleSwitchChat = (chatId: string) => {
    setChatSessions((prev) =>
      prev.map((session) => (session.id === currentChatId ? { ...session, messages } : session))
    );
    setCurrentChatId(chatId);
  };

  const handleDeleteChat = (chatId: string) => {
    if (chatSessions.length === 1) handleNewChat();
    setChatSessions((prev) => {
      const updatedSessions = prev.filter((session) => session.id !== chatId);
      chatHistories.delete(chatId);
      if (chatId === currentChatId && updatedSessions.length > 0) {
        setCurrentChatId(updatedSessions[updatedSessions.length - 1].id);
      }
      return updatedSessions;
    });
    toast({ title: "Chat Deleted", description: "The chat has been removed." });
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const systemPrompt = `
  You are an AI stock advisor for FinanceAI, focused on US stocks (NASDAQ/NYSE only) due to free plan limitations. Your task is to assist users by interpreting stock data and technical indicators for a given US stock symbol or company name. Follow these steps:
  
  1. **Identify the Symbol**:
     - The user provides a stock symbol (e.g., "AAPL" for Apple) or company name (e.g., "Tesla").
     - Correct typos: If "APPL" is entered, suggest "AAPL". For "Tesl", match to "Tesla" (TSLA).
     - Map company names to symbols using stock listings (e.g., "Apple" -> "AAPL").
     - Use the most recent symbol from chat history if not provided in the current message. Do not interpret common English words like "can," "will," or "is" as stock symbols unless explicitly intended (e.g., "CAN" is a symbol only if standalone or clearly a stock reference).
     - Persist with the last discussed symbol for follow-up questions unless a new symbol is explicitly introduced.
  
  2. **Validate the Symbol**:
     - Check against US stock listings (NASDAQ/NYSE). If invalid, suggest a valid symbol (e.g., "I couldn't find 'XYZ'. Try 'AAPL' for Apple.").
  
  3. **Identify Requested Data**:
     - General analysis (e.g., "Analyze AAPL"): Provide current price, daily change, 30-day trend, EMA, and RSI.
     - Specific indicators (e.g., "What's the RSI for TSLA?"): Analyze only requested indicators.
     - Stock stats (e.g., "Price of AAPL?"): Provide only requested data.
     - Available indicators: EMA (20-day, 50-day), RSI (14-day), MACD (12, 26, 9), BBANDS (20-day, 2sd), ADX (14-day), ATR (14-day), AROON (14-day).
     - Stock data: price, change, volume, 30-day trend.
  
  4. **Use Provided Data**:
     - Use only "API Data" from the input. If data is missing, say so (e.g., "I couldn't fetch RSI for AAPL.").
  
  5. **Deep Analysis**:
     - Provide concise answers by default, but when the user requests elaboration ("in detail," "elaborate," "tell me more"), give a thorough explanation:
       - Include current values, historical context (if available from API data), trends, and actionable insights.
       - For RSI, explain its value, range (0-100), overbought (>70), oversold (<30), and momentum implications. Build on prior responses if applicable.
     - Examples:
       - General: "AAPL price: $174.55, up 1.2%, 30-day trend: +5%, RSI: 65 (neutral)."
       - Specific: "TSLA RSI: 70 (overbought)."
       - Stats: "AAPL price: $174.55."
  
  6. **Handle Errors**:
     - If symbol is invalid or data fails, suggest a US stock (e.g., "No data for 'XYZ'. Try 'AAPL'.").
  
  7. **Context**:
     - Use the full chat history to maintain context, especially for follow-up questions. Reference prior symbols and data when elaborating unless instructed otherwise.
  
  8. **Response Format**:
     - Clear, concise, professional by default. Use bullet points or short sentences.
     - When elaboration is requested, use detailed paragraphs or expanded bullet points.
     - Only use provided data—do not invent historical trends beyond API data.
  `;

  const handleSendMessage = async () => {
    if (!input.trim()) return;
  
    const userMessage: Message = { role: "user", content: input, timestamp: new Date().toLocaleTimeString() };
    
    // Update messages state first
    setMessages((prev) => {
      const updatedMessages = [...prev, userMessage];
      // Update chat sessions in a separate operation to avoid state update conflicts
      setTimeout(() => {
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId ? { ...session, messages: updatedMessages } : session
          )
        );
      }, 0);
      return updatedMessages;
    });
  
    if (messages.filter((msg) => msg.role === "user").length === 0) {
      let newTitle = `Chat ${chatSessions.length}`;
      const symbolMatch = input.match(/\b[A-Z]{1,5}\b/)?.[0]; // Stricter: only uppercase, standalone
      if (symbolMatch && stockListings.some((s) => s.symbol === symbolMatch)) {
        newTitle = input.toLowerCase().includes("analyz")
          ? `Analysis for ${symbolMatch}`
          : `Query for ${symbolMatch}`;
      }
      setChatSessions((prev) =>
        prev.map((session) => (session.id === currentChatId ? { ...session, title: newTitle } : session))
      );
    }
  
    const userInput = input; // Store input before clearing
    setInput("");
    setLoading(true);
  
    try {
      const llm = new ChatGroq({
        apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
        model: "llama3-70b-8192",
        temperature: 0.5,
      });
  
      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) throw new Error("Chat history not initialized.");
      await chatHistory.addMessage(new HumanMessage(userInput));
  
      const prompt = ChatPromptTemplate.fromMessages([["system", systemPrompt], ["human", "{input}"]]);
  
      let symbol: string | null = null;
      const symbolMatch = input.match(/\b[A-Z]{1,5}\b/)?.[0]; // Stricter regex for symbols
      if (symbolMatch && stockListings.some((s) => s.symbol === symbolMatch)) {
        symbol = symbolMatch;
      } else {
        const companyName = input.toLowerCase().replace(/stock/gi, "").trim();
        const stock = stockListings.find((s) => s.name.toLowerCase().includes(companyName));
        if (stock) symbol = stock.symbol;
      }
  
      if (!symbol) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const match = messages[i].content.match(/\b[A-Z]{1,5}\b/)?.[0];
          if (match && stockListings.some((s) => s.symbol === match)) {
            symbol = match;
            break;
          }
        }
      }
  
      if (!symbol) {
        const errorMessage: Message = {
          role: "assistant",
          content: "Please provide a US stock symbol (e.g., 'AAPL') or company name (e.g., 'Tesla').",
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => {
          const updatedMessages = [...prev, errorMessage];
          setChatSessions((prevSessions) =>
            prevSessions.map((session) =>
              session.id === currentChatId ? { ...session, messages: updatedMessages } : session
            )
          );
          return updatedMessages;
        });
        setLoading(false);
        return;
      }
  
      if (!stockListings.some((s) => s.symbol === symbol)) {
        const errorMessage: Message = {
          role: "assistant",
          content: `I couldn't find '${symbol}' in US stock listings (NASDAQ/NYSE). Try 'AAPL' for Apple or 'TSLA' for Tesla.`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => {
          const updatedMessages = [...prev, errorMessage];
          setChatSessions((prevSessions) =>
            prevSessions.map((session) =>
              session.id === currentChatId ? { ...session, messages: updatedMessages } : session
            )
          );
          return updatedMessages;
        });
        setLoading(false);
        return;
      }
  
      const indicators = ["rsi", "macd", "ema", "bbands", "adx", "atr", "aroon"];
      const requestedIndicators = indicators.filter((ind) => input.toLowerCase().includes(ind));
      const needsStockData =
        input.toLowerCase().includes("price") ||
        input.toLowerCase().includes("change") ||
        input.toLowerCase().includes("volume") ||
        input.toLowerCase().includes("trend") ||
        input.toLowerCase().includes("analyz");
  
      let stockData: any = undefined;
      let indicatorsData: { [key: string]: IndicatorData } | undefined = undefined;
      const apiCallCount = { count: 0 };
  
      if (needsStockData) {
        try {
          stockData = await fetchStockData(symbol, apiCallCount);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorMsg: Message = {
            role: "assistant",
            content: `Failed to fetch data for ${symbol}: ${errorMessage}. Try again later.`,
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => {
            const updatedMessages = [...prev, errorMsg];
            setChatSessions((prevSessions) =>
              prevSessions.map((session) =>
                session.id === currentChatId ? { ...session, messages: updatedMessages } : session
              )
            );
            return updatedMessages;
          });
          setLoading(false);
          return;
        }
      }
  
      if (requestedIndicators.length > 0 || input.toLowerCase().includes("analyz")) {
        const indicatorsToFetch = requestedIndicators.length > 0 ? requestedIndicators : ["ema", "rsi"];
        try {
          indicatorsData = await fetchIndicators(symbol, indicatorsToFetch, apiCallCount);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorMsg: Message = {
            role: "assistant",
            content: `Failed to fetch indicators for ${symbol}: ${errorMessage}. Try again later.`,
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => {
            const updatedMessages = [...prev, errorMsg];
            setChatSessions((prevSessions) =>
              prevSessions.map((session) =>
                session.id === currentChatId ? { ...session, messages: updatedMessages } : session
              )
            );
            return updatedMessages;
          });
          setLoading(false);
          return;
        }
      }
  
      const combinedData = {
        stockData: stockData || null,
        indicators: indicatorsData
          ? Object.fromEntries(
              Object.entries(indicatorsData).map(([key, value]: [string, IndicatorData]) => [key, value.data])
            )
          : null,
      };
  
      const recentChatHistory = messages.slice(-10);
      const enhancedInput = `${input}\n\nAPI Data: ${JSON.stringify(combinedData)}\n\nChat History: ${JSON.stringify(recentChatHistory)}`;
  
      const chain = prompt.pipe(llm);
      const response = await chain.invoke({ input: enhancedInput, chat_history: await chatHistory.getMessages() });
  
      const assistantMessage: Message = {
        role: "assistant",
        content: response.content as string,
        timestamp: new Date().toLocaleTimeString(),
        stockData,
        indicatorsData,
      };
  
      setMessages((prev) => {
        const updatedMessages = [...prev, assistantMessage];
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId ? { ...session, messages: updatedMessages } : session
          )
        );
        return updatedMessages;
      });
  
      await chatHistory.addMessage(new SystemMessage(response.content as string));
    } catch (error) {
      console.error("Chatbot error:", error);
      toast({ title: "Error", description: "Failed to process your request.", variant: "destructive" });
      const errorMsg: Message = {
        role: "assistant",
        content: "Sorry, I hit an error. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => {
        const updatedMessages = [...prev, errorMsg];
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId ? { ...session, messages: updatedMessages } : session
          )
        );
        return updatedMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b" style={{ background: `linear-gradient(to right, ${blue500}, ${indigo600})` }}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={toggleSidebar} className="lg:hidden" style={{ color: "white" }}>
                <Menu className="h-6 w-6" />
              </Button>
              <TrendingUp className="h-8 w-8" style={{ color: "white" }} />
              <span className="text-2xl font-bold" style={{ color: "white" }}>
                Stock Advisor (US Only)
              </span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" style={{ color: "white" }}>
                  All Markets
                </Button>
              </Link>
              <Link href="/stocks">
                <Button variant="ghost" style={{ color: "white" }}>
                  Stock Market
                </Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" style={{ color: "white" }}>
                  Other Advisors
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" style={{ borderColor: "white", color: blue500 }}>
                  Back Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
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
                <h2 className="text-lg font-semibold" style={{ color: indigo600 }}>
                  Chat History
                </h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden" style={{ color: indigo600 }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleNewChat}
                  className="mb-4"
                  style={{ background: `linear-gradient(to right, ${blue500}, ${indigo600})`, color: "white" }}
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
                      session.id === currentChatId ? "bg-blue-100 dark:bg-blue-900" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex-1 truncate" onClick={() => handleSwitchChat(session.id)}>
                      <span className="text-sm font-medium" style={{ color: indigo600 }}>
                        {session.title}
                      </span>
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

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {stockListingsError && (
              <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg mb-4">{stockListingsError}</div>
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
                    message.role === "user" ? "text-white" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  }`}
                  style={{
                    background: message.role === "user" ? `linear-gradient(to right, ${blue500}, ${indigo600})` : undefined,
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
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: indigo600 }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4" style={{ background: `linear-gradient(to bottom, var(--background), var(--muted))` }}>
            <div className="flex space-x-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" onClick={handleClearChat} style={{ borderColor: blue500, color: blue500 }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
                </Button>
              </motion.div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a US stock (e.g., 'Analyze AAPL', 'RSI for TSLA')"
                className="flex-1 resize-none shadow-md"
                rows={2}
                style={{ borderColor: blue500, backgroundColor: "var(--background)", color: "var(--foreground)" }}
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
                  style={{ background: `linear-gradient(to right, ${blue500}, ${indigo600})`, color: "white" }}
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