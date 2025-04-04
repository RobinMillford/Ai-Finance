"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Bitcoin, Send, Loader2, Trash2, Clock, Menu, Plus, X } from "lucide-react";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MessageContentComplex } from "@langchain/core/messages"; // Import for type checking

// Theme colors inspired by from-orange-500 to-yellow-600
const orange500 = "#F97316"; // Tailwind from-orange-500
const yellow600 = "#CA8A04"; // Tailwind to-yellow-600
const whiteBg = "#F9FAFB"; // Light background similar to bg-background

// In-memory cache for crypto data and indicators
const cryptoDataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for real-time data

// Rate limit handling
const REQUEST_DELAY_MS = 8000; // 8 seconds delay (adjusted for Twelve Data's 8 req/min limit)
const API_CALL_THRESHOLD = 4;

// Utility function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility function to fetch with retry on rate limit
async function fetchWithRetry(url: string, maxRetries: number = 3, retryDelayMs: number = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        console.error(`Non-OK response from ${url}: Status ${response.status}, Body: ${text}`);
        if (response.status === 429) {
          console.warn(`Rate limit hit for URL: ${url}. Retrying (${attempt}/${maxRetries}) after ${retryDelayMs}ms...`);
          if (attempt === maxRetries) throw new Error("Rate limit exceeded after maximum retries");
          await delay(retryDelayMs);
          continue;
        }
        throw new Error(`API error: ${text || response.statusText}`);
      }
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return json;
      } catch (jsonError) {
        console.error(`Failed to parse JSON from ${url}:`, text);
        throw new Error(`Invalid JSON response: ${jsonError instanceof Error ? jsonError.message : "Unknown parsing error"}`);
      }
    } catch (error: unknown) {
      if (attempt === maxRetries) throw error;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn(`Fetch attempt ${attempt} failed for URL: ${url}. Retrying after ${retryDelayMs}ms...`, errorMessage);
      await delay(retryDelayMs);
    }
  }
  throw new Error("Unexpected error in fetchWithRetry");
}

// Fetch cryptocurrency pairs list
async function fetchCryptoPairs(apiCallCount: { count: number }) {
  const cacheKey = "cryptoPairs";
  const cachedData = cryptoDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached cryptocurrency pairs");
    return cachedData.data;
  }

  try {
    const url = `https://api.twelvedata.com/cryptocurrencies?apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
    const response = await fetchWithRetry(url);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) await delay(REQUEST_DELAY_MS);
    const cryptoPairs = response.data || response || [];
    cryptoDataCache.set(cacheKey, { data: cryptoPairs, timestamp: now });
    return cryptoPairs;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching cryptocurrency pairs:", errorMessage);
    throw error;
  }
}

// Fetch specific data based on user request
async function fetchCryptoData(symbol: string, type: string, apiCallCount: { count: number }) {
  const cacheKey = `${type}_${symbol.toUpperCase()}`;
  const cachedData = cryptoDataCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached ${type} data for symbol: ${symbol}`);
    return cachedData.data;
  }

  try {
    let url = "";
    switch (type.toLowerCase()) {
      case "quote":
        url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "time_series":
        url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "rsi":
        url = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "ema":
        url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "macd":
        url = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "bbands":
        url = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&sd=2&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "atr":
        url = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "obv":
        url = `https://api.twelvedata.com/obv?symbol=${symbol}&interval=1day&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "supertrend":
        url = `https://api.twelvedata.com/supertrend?symbol=${symbol}&interval=1day&multiplier=3&period=10&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "stoch":
        url = `https://api.twelvedata.com/stoch?symbol=${symbol}&interval=1day&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      case "adx":
        url = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
      default:
        url = `https://api.twelvedata.com/${type.toLowerCase()}?symbol=${symbol}&interval=1day&outputsize=10&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
        break;
    }
    const response = await fetchWithRetry(url);
    apiCallCount.count += 1;
    if (apiCallCount.count > API_CALL_THRESHOLD) await delay(REQUEST_DELAY_MS);
    cryptoDataCache.set(cacheKey, { data: response, timestamp: now });
    console.log(`Successfully fetched ${type} data for symbol: ${symbol}`);
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error fetching ${type} data for ${symbol}:`, errorMessage);
    throw error;
  }
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  cryptoData?: any;
  symbol?: string; // Add symbol to track context
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastSymbol?: string | null | undefined; // Updated to allow null
}

const chatHistories = new Map<string, InMemoryChatMessageHistory>();

export default function CryptoAdvisor() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [cryptoPairs, setCryptoPairs] = useState<any[]>([]);
  const [cryptoPairsError, setCryptoPairsError] = useState<string | null>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadCryptoPairs = async () => {
      const apiCallCount = { count: 0 };
      try {
        const pairs = await fetchCryptoPairs(apiCallCount);
        setCryptoPairs(pairs);
        setCryptoPairsError(null);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error loading crypto pairs:", errorMessage);
        setCryptoPairsError("Failed to load cryptocurrency pairs. Some features may be limited.");
        toast({
          title: "Error",
          description: "Failed to load crypto pairs. Some features may be limited.",
          variant: "destructive",
        });
      }
    };
    loadCryptoPairs();
  }, [toast]);

  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: `Hey there! I'm your Crypto Buddy, here to help you with Bitcoin and other cryptocurrencies. You can ask me anything—like "How's Bitcoin doing?" or "What's ETH worth?"—and I'll figure it out for you. What's on your mind?`,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (!chatHistories.has(currentChatId)) {
      chatHistories.set(currentChatId, new InMemoryChatMessageHistory());
      const newSession: ChatSession = {
        id: currentChatId,
        title: "Welcome Chat",
        messages: [initialMessage],
        lastSymbol: null, // Explicitly set to null initially
      };
      setChatSessions((prev) => [...prev, newSession]);
      setMessages([initialMessage]);
    }
  }, [currentChatId]);

  useEffect(() => {
    const currentSession = chatSessions.find((session) => session.id === currentChatId);
    if (currentSession) setMessages(currentSession.messages);
    else setMessages([]);
  }, [currentChatId, chatSessions]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
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
      prev.map((session) =>
        session.id === currentChatId ? { ...session, messages: [], lastSymbol: null } : session
      )
    );
    toast({ title: "Chat Cleared", description: "Chat history cleared." });
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
      lastSymbol: null, // Explicitly set to null
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
    if (chatSessions.length === 1) handleNewChat();
    setChatSessions((prev) => {
      const updatedSessions = prev.filter((session) => session.id !== chatId);
      chatHistories.delete(chatId);
      if (chatId === currentChatId && updatedSessions.length > 0) {
        setCurrentChatId(updatedSessions[updatedSessions.length - 1].id);
      }
      return updatedSessions;
    });
    toast({ title: "Chat Deleted", description: "Chat removed from history." });
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
  
    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    
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
      const symbolMatch = input.match(/\b[A-Z]{3,5}\/[A-Z]{3,5}\b/)?.[0];
      const cryptoNames = ["bitcoin", "btc", "ethereum", "eth"];
      const cryptoMatch = cryptoNames.find((name) => input.toLowerCase().includes(name));
      if (symbolMatch || cryptoMatch) {
        const symbol = symbolMatch || (cryptoMatch === "bitcoin" || cryptoMatch === "btc" ? "BTC/USD" : "ETH/USD");
        newTitle = input.toLowerCase().includes("how") ? `How's ${symbol}?` : `Query about ${symbol}`;
      }
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === currentChatId ? { ...session, title: newTitle } : session
        )
      );
    }
  
    const userInput = input; // Store input before clearing
    setInput("");
    setLoading(true);
  
    try {
      const llm = new ChatGroq({
        apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
        model: "llama3-70b-8192",
        temperature: 0.7,
      });
  
      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) throw new Error("Chat history not initialized.");
      await chatHistory.addMessage(new HumanMessage(userInput));
  
      const systemPrompt = `
        You are Crypto Buddy, a friendly AI assistant for anyone curious about cryptocurrencies, from beginners to experts. Your goal is to understand casual or vague questions and provide clear, helpful answers about crypto prices, trends, or indicators. Use a conversational tone and avoid jargon unless explaining it.
  
        1. **Understand Intent**: Interpret the user's request, even if vague (e.g., "How's Bitcoin doing?" → BTC/USD price/trend, "What's ETH worth?" → ETH/USD price).
           - Recognize common crypto names: "Bitcoin" or "BTC" → BTC/USD, "Ethereum" or "ETH" → ETH/USD.
           - If no symbol is specified in the current input, use the last symbol mentioned in the chat history (tracked as "lastSymbol" in the session or "symbol" in messages).
           - If no symbol is clear, default to BTC/USD for general crypto queries.
        2. **Handle Requests**:
           - Price/value questions (e.g., "What's Bitcoin at?"): Fetch "quote" data.
           - Trend/performance (e.g., "How's BTC doing?"): Fetch "quote" and "time_series" for recent trend.
           - Technical indicators (e.g., "RSI for BTC", "STOCH for ETH"): Fetch the specific indicator (only if explicitly mentioned).
           - General analysis (e.g., "Analyze Bitcoin"): Fetch quote, time series, and common indicators (EMA, RSI, MACD).
           - Casual queries (e.g., "Is Bitcoin up?"): Fetch "quote" or "time_series" and summarize.
        3. **Use API Data**: Use the JSON under "API Data". If a field (e.g., "time_series") has an "error" key, report the specific error.
        4. **Respond**:
           - Keep it simple: "Bitcoin's at $50,000, up 2% today!" or "ETH's been steady around 0.05 BTC lately."
           - For indicators: Explain briefly (e.g., "RSI is 65, meaning it's close to being overbought—might slow down soon").
           - If data fails: "I couldn't get [data] for [symbol] because [error]. Want to try something else?"
        5. **Supported Indicators**: Predefined: EMA (20-day), RSI (14-day), MACD (12,26,9), BBANDS, ATR, OBV, Supertrend, STOCH, ADX. Others are attempted if requested.
        6. **Context**: Use chat history to maintain context—stick to the last symbol unless a new one is mentioned.
        7. **Tone**: Friendly and approachable, e.g., "Hey, looks like Bitcoin's on a roll!"
  
        Example:
        User: "How's Bitcoin doing?"
        Response: "Hey! Bitcoin (BTC/USD) is at $50,000, up 2% today based on the latest quote. Over the last 10 days, it's climbed about 5%. Want more details?"
        User: "What's STOCH?"
        Response: "For Bitcoin (BTC/USD), the Stochastic indicator shows SlowK at 75 and SlowD at 70. That's a hint it might be overbought—could be peaking soon!"
        User: "time series data of BTC"
        Response (if failed): "Oops, I couldn't get the time series for BTC/USD because [error]. How about the current price instead?"
      `;
  
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"],
      ]);
  
      let symbol: string | null = null;
      const symbolMatch = input.match(/\b[A-Z]{3,5}\/[A-Z]{3,5}\b/);
      if (symbolMatch) symbol = symbolMatch[0].toUpperCase();
      const cryptoNames = ["bitcoin", "btc", "ethereum", "eth"];
      const cryptoMatch = cryptoNames.find((name) => input.toLowerCase().includes(name));
      if (!symbol && cryptoMatch) {
        symbol = cryptoMatch === "bitcoin" || cryptoMatch === "btc" ? "BTC/USD" : "ETH/USD";
      }
      if (!symbol) {
        const currentSession = chatSessions.find((session) => session.id === currentChatId);
        if (currentSession?.lastSymbol) {
          symbol = currentSession.lastSymbol; // Use the last symbol from the session
        } else {
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].symbol !== undefined) {
              symbol = messages[i].symbol as string; // Type assertion since we know it's string if not undefined
              break;
            }
            const match = messages[i].content.match(/\b[A-Z]{3,5}\/[A-Z]{3,5}\b/);
            if (match) {
              symbol = match[0].toUpperCase();
              break;
            }
            const prevCryptoMatch = cryptoNames.find((name) => messages[i].content.toLowerCase().includes(name));
            if (prevCryptoMatch) {
              symbol = prevCryptoMatch === "bitcoin" || prevCryptoMatch === "btc" ? "BTC/USD" : "ETH/USD";
              break;
            }
          }
        }
      }
      if (!symbol && !input.toLowerCase().includes("analyz") && !input.match(/\b[A-Z]{2,10}\b/i)) {
        symbol = "BTC/USD"; // Default to BTC/USD for vague crypto queries
      }
  
      if (!symbol) {
        const errorMessage: Message = {
          role: "assistant",
          content: "I'm not sure which crypto you mean! Could you mention something like 'Bitcoin' or 'ETH' so I can help you?",
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
  
      const isValidSymbol = cryptoPairs.some((pair: any) => pair.symbol === symbol);
      if (!isValidSymbol && cryptoPairs.length > 0) {
        const errorMessage: Message = {
          role: "assistant",
          content: `Hmm, I couldn't find '${symbol}'. Did you mean something like 'BTC/USD' for Bitcoin or 'ETH/BTC' for Ethereum? Let me know!`,
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
  
      const predefinedIndicators = ["rsi", "ema", "macd", "bbands", "atr", "obv", "supertrend", "stoch", "adx"];
      const indicatorMatch = input.match(new RegExp(`\\b(${predefinedIndicators.join("|")})\\b`, "i"))?.[0]?.toLowerCase();
      const requestedIndicators = indicatorMatch ? [indicatorMatch] : [];
      const needsQuote =
        input.toLowerCase().includes("price") ||
        input.toLowerCase().includes("worth") ||
        input.toLowerCase().includes("value") ||
        input.toLowerCase().includes("at") ||
        input.toLowerCase().includes("up") ||
        input.toLowerCase().includes("down");
      const needsTrend =
        input.toLowerCase().includes("trend") ||
        input.toLowerCase().includes("time series") ||
        input.toLowerCase().includes("doing") ||
        input.toLowerCase().includes("performance") ||
        input.toLowerCase().includes("analyz");
      const isGeneralAnalysis = input.toLowerCase().includes("analyz") && requestedIndicators.length === 0;
  
      const apiCallCount = { count: 0 };
      let cryptoData: any = {};
  
      if (needsQuote || isGeneralAnalysis) {
        try {
          cryptoData.quote = await fetchCryptoData(symbol, "quote", apiCallCount);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          cryptoData.quote = { error: errorMessage };
        }
      }
  
      if (needsTrend || isGeneralAnalysis) {
        try {
          cryptoData.time_series = await fetchCryptoData(symbol, "time_series", apiCallCount);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          cryptoData.time_series = { error: errorMessage };
        }
      }
  
      if (requestedIndicators.length > 0) {
        for (const indicator of requestedIndicators) {
          try {
            cryptoData[indicator] = await fetchCryptoData(symbol, indicator, apiCallCount);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            cryptoData[indicator] = { error: errorMessage };
          }
        }
      }
  
      const recentHistory = messages.slice(-5);
      const enhancedInput = `${input}\n\nAPI Data: ${JSON.stringify(cryptoData)}\n\nRecent Chat History: ${JSON.stringify(recentHistory)}`;
  
      const chain = prompt.pipe(llm);
      const response = await chain.invoke({
        input: enhancedInput,
        chat_history: (await chatHistory.getMessages()).slice(-5),
      });
  
      const responseContent = Array.isArray(response.content)
        ? response.content
            .map((item: any) => {
              if ("type" in item && item.type === "text") {
                return item.text;
              }
              return JSON.stringify(item);
            })
            .join("\n")
        : typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
  
      const assistantMessage: Message = {
        role: "assistant",
        content: responseContent,
        timestamp: new Date().toLocaleTimeString(),
        cryptoData,
        symbol,
      };
      setMessages((prev) => {
        const updatedMessages = [...prev, assistantMessage];
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId ? { ...session, messages: updatedMessages, lastSymbol: symbol } : session
          )
        );
        return updatedMessages;
      });
  
      await chatHistory.addMessage(new SystemMessage(responseContent));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in chatbot:", errorMessage);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again!",
        variant: "destructive",
      });
      const errorMsg: Message = {
        role: "assistant",
        content: "Oops, something broke on my end. Try asking again?",
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b" style={{ background: `linear-gradient(to right, ${orange500}, ${yellow600})` }}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={toggleSidebar} className="lg:hidden" style={{ color: "white" }}>
                <Menu className="h-6 w-6" />
              </Button>
              <Bitcoin className="h-8 w-8" style={{ color: "white" }} />
              <span className="text-2xl font-bold" style={{ color: "white" }}>Crypto Advisor</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" style={{ color: "white" }}>All Markets</Button>
              </Link>
              <Link href="/cryptos">
                <Button variant="ghost" style={{ color: "white" }}>Crypto Market</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" style={{ color: "white" }}>Other Advisors</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" style={{ borderColor: "white", color: "orange" }}>Back Home</Button>
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
                <h2 className="text-lg font-semibold" style={{ color: yellow600 }}>Chat History</h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden" style={{ color: yellow600 }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleNewChat}
                  className="mb-4"
                  style={{ background: `linear-gradient(to right, ${orange500}, ${yellow600})`, color: "white" }}
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
                      session.id === currentChatId ? "bg-orange-100 dark:bg-orange-900" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex-1 truncate" onClick={() => handleSwitchChat(session.id)}>
                      <span className="text-sm font-medium" style={{ color: yellow600 }}>{session.title}</span>
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
            {cryptoPairsError && (
              <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg mb-4">{cryptoPairsError}</div>
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
                    background: message.role === "user" ? `linear-gradient(to right, ${orange500}, ${yellow600})` : undefined,
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
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: yellow600 }} />
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
                  style={{ borderColor: orange500, color: orange500 }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
                </Button>
              </motion.div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything—like 'How's Bitcoin?' or 'What's ETH worth?'"
                className="flex-1 resize-none shadow-md"
                rows={2}
                style={{ borderColor: orange500, backgroundColor: "var(--background)", color: "var(--foreground)" }}
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
                  style={{ background: `linear-gradient(to right, ${orange500}, ${yellow600})`, color: "white" }}
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