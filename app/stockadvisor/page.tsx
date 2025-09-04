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
import { getMarketIntelligence, getComprehensiveMarketOverview, getLatestNews, getGeopoliticalAnalysis, getMarketSentiment, getFundamentalAnalysis, getTechnicalAnalysis, getMacroeconomicAnalysis, getRegulatoryAnalysis, getMarketAlerts } from "@/lib/market-intelligence";

// Theme colors
const blue500 = "#3B82F6";
const indigo600 = "#4F46E5";

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
  redditData?: any;
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
  You are an advanced AI Stock Advisor for FinanceAI, a comprehensive financial analysis platform. You are designed to handle ANY financial query, analysis request, or report generation for US stocks (NASDAQ/NYSE). Your capabilities extend far beyond basic data retrieval to provide sophisticated financial insights.

  ## CORE CAPABILITIES
  You can handle:
  - **Financial Analysis**: Complete fundamental and technical analysis
  - **Investment Research**: Sector analysis, company comparisons, risk assessment
  - **Market Reports**: Daily summaries, earnings analysis, trend reports
  - **Portfolio Advice**: Diversification, allocation, risk management
  - **Trading Insights**: Entry/exit points, momentum analysis, volatility assessment
  - **Economic Context**: How macro factors affect individual stocks
  - **Scenario Analysis**: What-if scenarios, stress testing, future projections
  - **Educational Content**: Explain complex financial concepts

  ## COMPREHENSIVE ANALYSIS FRAMEWORK
  
  ### 1. SYMBOL IDENTIFICATION & VALIDATION
  - **Smart Recognition**: Detect symbols from partial names, common nicknames, or company references
  - **Auto-correction**: Fix common typos (APPL→AAPL, TESL→TSLA, GOOGL→GOOGL)
  - **Context Memory**: Remember symbols from conversation history
  - **Flexible Input**: Handle "Apple stock", "Tesla analysis", "MSFT report" formats
  - **Validation**: Confirm against US stock listings with helpful suggestions

  ### 2. DATA INTERPRETATION & ANALYSIS
  **Financial Metrics Analysis**:
  - Price action: Current price, daily/weekly/monthly changes, volume analysis
  - Trend analysis: Short, medium, long-term trends with momentum indicators
  - Volatility assessment: Price stability, risk metrics, beta analysis
  
  **Technical Indicators (Available: RSI, MACD, EMA, BBANDS, ADX, ATR, AROON)**:
  - RSI: Momentum oscillator (0-100), overbought (>70), oversold (<30)
  - MACD: Trend following, signal line crossovers, histogram analysis
  - EMA: Moving averages (20-day, 50-day), trend confirmation, support/resistance
  - Bollinger Bands: Volatility bands, squeeze patterns, breakout signals
  - ADX: Trend strength indicator, directional movement
  - ATR: Volatility measurement, position sizing implications
  - AROON: Trend identification, new highs/lows timing

  **Social Sentiment Integration**:
  - Reddit community analysis: Bullish/bearish sentiment percentages
  - Social momentum: How community sentiment aligns with technical indicators
  - Contrarian signals: When sentiment diverges from price action
  - Confidence levels: Based on post volume and sentiment consistency

  **Market Intelligence Integration**:
  - Real-time news analysis and market alerts
  - Geopolitical event impact assessment
  - Fundamental and technical analysis synthesis
  - Macroeconomic factor influence evaluation
  - Regulatory change impact analysis
  - Comprehensive market sentiment understanding

  ### 3. RESPONSE ADAPTABILITY
  **Query Types & Responses**:
  - **Quick Questions**: "What's AAPL at?" → Current price + key highlights
  - **Analysis Requests**: "Analyze NVDA" → Complete technical + fundamental + sentiment analysis
  - **Specific Indicators**: "RSI for TSLA?" → Detailed RSI analysis with interpretation
  - **Comparison Requests**: "AAPL vs MSFT" → Comparative analysis across metrics
  - **Sector Analysis**: "Tech stocks today" → Sector-wide analysis with key players
  - **Investment Advice**: "Should I buy AMZN?" → Risk/reward analysis with recommendations
  - **Portfolio Questions**: "Diversification advice" → Portfolio construction guidance
  - **Market Context**: "How is the market affecting GOOGL?" → Macro to micro analysis
  - **Educational**: "Explain P/E ratio" → Clear educational content with examples
  - **Scenario Planning**: "What if rates rise?" → Impact analysis on stocks/sectors

  ### 4. COMPREHENSIVE REPORTING
  **Analysis Depth Levels**:
  - **Quick Summary**: 2-3 key points for fast decisions
  - **Standard Analysis**: Price, trends, key indicators, sentiment, recommendation
  - **Deep Dive**: Comprehensive analysis with multiple timeframes, risk factors, scenarios
  - **Custom Reports**: Tailored analysis based on specific user requirements

  **Professional Formatting**:
  - Use bullet points, headers, and sections for complex analysis
  - Include confidence levels and data freshness indicators
  - Provide actionable insights and clear recommendations
  - Always cite data sources and timestamps

  ### 5. INTELLIGENT ERROR HANDLING
  - **Missing Data**: Explain what's missing and provide analysis with available data
  - **Invalid Symbols**: Suggest closest matches or alternative analysis approaches
  - **API Failures**: Provide general market context or educational content
  - **Ambiguous Requests**: Ask clarifying questions to provide better analysis

  ### 6. CONTEXTUAL INTELLIGENCE
  - **Stock Data**: Real-time price, volume, and basic metrics
  - **Technical Indicators**: RSI, EMA, MACD, Bollinger Bands, ADX, ATR
  - **Reddit Sentiment**: Community mood analysis from financial subreddits
  - **Market Intelligence**: Real-time news, geopolitical events, and comprehensive market analysis
  - **Market Alerts**: Urgent warnings and risk notifications
  - **Global Context**: Understanding how worldwide events affect specific stocks

  ### 7. USER ENGAGEMENT
  - **Adaptive Responses**: Match explanation depth to user's knowledge level
  - **Cross-References**: Connect related stocks, sectors, and market themes
  - **Market Intelligence Integration**: Seamlessly incorporate real-time news, geopolitical events, and comprehensive market analysis
  - **Global Context Awareness**: Understand how worldwide events affect specific stocks
  - **Risk Awareness**: Highlight potential risks and market alerts

  ### 8. RISK & COMPLIANCE
  - Always include risk disclaimers for investment advice
  - Provide balanced analysis showing both opportunities and risks
  - Encourage due diligence and professional consultation for major decisions
  - Focus on education and analysis rather than direct buy/sell recommendations

  ## OUTPUT GUIDELINES
  - **Be Comprehensive**: Address all aspects of the user's query
  - **Be Adaptive**: Match response depth to query complexity
  - **Be Accurate**: Only use provided API data, clearly state limitations
  - **Be Helpful**: Always try to provide value even with limited data
  - **Be Professional**: Maintain expert-level financial communication
  - **Be Educational**: Explain concepts when beneficial for user understanding
  - **Include Market Intelligence**: When available, incorporate real-time news, geopolitical events, and comprehensive market analysis
  - **Contextual Awareness**: Consider global events and their impact on specific stocks
  - **Risk Alerts**: Highlight any urgent market alerts or warnings
  - **Data Integration**: Reference specific data points from all available sources (stock data, indicators, sentiment, market intelligence)

  Remember: You are a sophisticated financial advisor capable of handling any stock-related query with professional-grade analysis. Always reference the specific data provided and explain how different data sources inform your analysis.
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
        model: "openai/gpt-oss-120b",
        temperature: 0.5,
      });
  
      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) throw new Error("Chat history not initialized.");
      await chatHistory.addMessage(new HumanMessage(userInput));
  
      const prompt = ChatPromptTemplate.fromMessages([["system", systemPrompt], ["human", "{input}"]]);
  
      // Enhanced symbol detection with multiple patterns and fuzzy matching
      let symbol: string | null = null;
              
      // Pattern 1: Exact symbol match (AAPL, TSLA, etc.)
      const symbolMatch = input.match(/\b[A-Z]{1,5}\b/)?.[0]; // Stricter: only uppercase, standalone
      if (symbolMatch && stockListings.some((s) => s.symbol === symbolMatch)) {
        symbol = symbolMatch;
      }
              
      // Pattern 2: Company name matching with fuzzy search
      if (!symbol) {
        const companyName = input.toLowerCase().replace(/stock|inc|corp|ltd|company/gi, "").trim();
        const exactMatch = stockListings.find((s) => s.name.toLowerCase().includes(companyName));
        if (exactMatch) {
          symbol = exactMatch.symbol;
        } else {
          // Fuzzy matching for company names
          const fuzzyMatches = stockListings.filter((s) => {
            const name = s.name.toLowerCase();
            const words = companyName.split(" ").filter(w => w.length > 2);
            return words.some(word => name.includes(word));
          });
          if (fuzzyMatches.length === 1) {
            symbol = fuzzyMatches[0].symbol;
          }
        }
      }
              
      // Pattern 3: Common name variations and aliases
      if (!symbol) {
        const aliases: { [key: string]: string } = {
          "apple": "AAPL",
          "tesla": "TSLA",
          "microsoft": "MSFT",
          "google": "GOOGL",
          "alphabet": "GOOGL",
          "amazon": "AMZN",
          "facebook": "META",
          "meta": "META",
          "nvidia": "NVDA",
          "amd": "AMD",
          "intel": "INTC",
          "netflix": "NFLX",
          "disney": "DIS",
          "walmart": "WMT",
          "coca cola": "KO",
          "pepsi": "PEP",
          "johnson": "JNJ",
          "visa": "V",
          "mastercard": "MA",
          "boeing": "BA",
          "nike": "NKE",
          "mcdonalds": "MCD",
          "starbucks": "SBUX"
        };
                
        const lowerInput = input.toLowerCase();
        for (const [alias, ticker] of Object.entries(aliases)) {
          if (lowerInput.includes(alias)) {
            symbol = ticker;
            break;
          }
        }
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
  
      // Enhanced symbol detection and smart suggestions
      if (!symbol) {
        // Try to provide intelligent assistance even without a symbol
        const isGeneralQuery = 
          input.toLowerCase().includes("market") ||
          input.toLowerCase().includes("sector") ||
          input.toLowerCase().includes("general") ||
          input.toLowerCase().includes("overall") ||
          input.toLowerCase().includes("economy") ||
          input.toLowerCase().includes("tips") ||
          input.toLowerCase().includes("advice") ||
          input.toLowerCase().includes("help") ||
          input.toLowerCase().includes("explain") ||
          input.toLowerCase().includes("what is") ||
          input.toLowerCase().includes("how to");

        let content = "";
        if (isGeneralQuery) {
          content = `I'd be happy to help with your financial question! For general market insights, I can provide:

📊 **Market Analysis Options:**
• Sector overviews (tech, healthcare, finance, etc.)
• Market trend explanations
• Investment strategy guidance
• Risk management advice
• Technical analysis education

🔍 **For Specific Stock Analysis:**
Provide a US stock symbol (e.g., 'AAPL', 'TSLA', 'MSFT') or company name.

📈 **Popular Symbols to Try:**
• AAPL (Apple), TSLA (Tesla), MSFT (Microsoft)
• GOOGL (Google), AMZN (Amazon), NVDA (NVIDIA)
• SPY (S&P 500 ETF), QQQ (NASDAQ ETF)

What specific aspect would you like me to focus on?`;
        } else {
          // Try to suggest similar symbols
          const inputUpper = input.toUpperCase();
          const similarSymbols = stockListings
            .filter(stock => 
              stock.symbol.includes(inputUpper.slice(0, 3)) ||
              stock.name.toLowerCase().includes(input.toLowerCase().slice(0, 4))
            )
            .slice(0, 5)
            .map(stock => `${stock.symbol} (${stock.name})`)
            .join(", ");

          content = `I couldn't identify a specific stock symbol from your message. 

🔍 **Did you mean:**
${similarSymbols ? `• ${similarSymbols}` : "• Please provide a valid US stock symbol"}

💡 **Popular Options:**
• AAPL (Apple) • TSLA (Tesla) • MSFT (Microsoft)
• GOOGL (Google) • AMZN (Amazon) • NVDA (NVIDIA)

📝 **Try formats like:**
• "Analyze AAPL"
• "What's Tesla's RSI?"
• "MSFT price target"

What stock would you like me to analyze?`;
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
              session.id === currentChatId ? { ...session, messages: updatedMessages } : session
            )
          );
          return updatedMessages;
        });
        setLoading(false);
        return;
      }

      // Enhanced symbol validation with suggestions
      if (!stockListings.some((s) => s.symbol === symbol)) {
        // Find similar symbols for suggestions
        const similarSymbols = stockListings
          .filter(stock => 
            stock.symbol.includes(symbol!.slice(0, 2)) ||
            stock.symbol.startsWith(symbol!.charAt(0)) ||
            stock.name.toLowerCase().includes(symbol!.toLowerCase())
          )
          .slice(0, 5)
          .map(stock => `${stock.symbol} (${stock.name})`)
          .join(", ");

        const content = `❌ **Symbol '${symbol}' not found** in US stock listings (NASDAQ/NYSE).

🔍 **Did you mean:**
${similarSymbols ? `• ${similarSymbols}` : "No similar symbols found"}

💡 **Popular Alternatives:**
• AAPL (Apple) • TSLA (Tesla) • MSFT (Microsoft)
• GOOGL (Alphabet) • AMZN (Amazon) • NVDA (NVIDIA)

📝 **Note:** I only analyze US-listed stocks. For other markets, try our Forex or Crypto advisors.

Please provide a valid US stock symbol for analysis.`;

        const errorMessage: Message = {
          role: "assistant",
          content,
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
      
      // Enhanced data fetching logic for comprehensive analysis
      const needsStockData =
        input.toLowerCase().includes("price") ||
        input.toLowerCase().includes("change") ||
        input.toLowerCase().includes("volume") ||
        input.toLowerCase().includes("trend") ||
        input.toLowerCase().includes("analyz") ||
        input.toLowerCase().includes("report") ||
        input.toLowerCase().includes("research") ||
        input.toLowerCase().includes("invest") ||
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
        requestedIndicators.length > 0; // Always fetch stock data if indicators are requested

      // Always fetch comprehensive indicators for analysis, research, or investment queries
      const needsComprehensiveAnalysis = 
        input.toLowerCase().includes("analyz") ||
        input.toLowerCase().includes("report") ||
        input.toLowerCase().includes("research") ||
        input.toLowerCase().includes("invest") ||
        input.toLowerCase().includes("recommend") ||
        input.toLowerCase().includes("assessment") ||
        input.toLowerCase().includes("evaluation") ||
        input.toLowerCase().includes("overview") ||
        input.toLowerCase().includes("comprehensive") ||
        input.toLowerCase().includes("detailed") ||
        input.toLowerCase().includes("full") ||
        input.toLowerCase().includes("complete");
  
      let stockData: any = undefined;
      let indicatorsData: { [key: string]: IndicatorData } | undefined = undefined;
      let redditData: any = undefined;
      const apiCallCount = { count: 0 };
  
      // Enhanced stock data fetching with fallback analysis
      if (needsStockData) {
        try {
          stockData = await fetchStockData(symbol, apiCallCount);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.warn(`Failed to fetch stock data for ${symbol}:`, errorMessage);
          
          // Provide fallback analysis without current price data
          const fallbackContent = `⚠️ **Data Fetch Warning for ${symbol}**

I encountered an issue fetching real-time data: ${errorMessage}

📈 **Alternative Analysis Available:**
• I can still provide general market insights for ${symbol}
• Technical analysis concepts and strategies
• Sector overview and competitive landscape
• Historical performance context
• Investment thesis and risk factors

🔄 **Troubleshooting:**
• Please try again in a few moments
• Check if symbol ${symbol} is correctly spelled
• Ensure ${symbol} is a US-listed stock

💡 **What I can help with right now:**
• Explain technical indicators for ${symbol}
• Discuss ${symbol}'s business model
• Compare ${symbol} with sector peers
• Provide investment strategy guidance

Would you like me to proceed with general analysis, or would you prefer to try a different symbol?`;

          const fallbackMessage: Message = {
            role: "assistant",
            content: fallbackContent,
            timestamp: new Date().toLocaleTimeString(),
          };
          setMessages((prev) => {
            const updatedMessages = [...prev, fallbackMessage];
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
  
      // Enhanced indicators fetching with fallback analysis
      if (requestedIndicators.length > 0 || input.toLowerCase().includes("analyz") || needsComprehensiveAnalysis) {
        const indicatorsToFetch = requestedIndicators.length > 0 
          ? requestedIndicators 
          : needsComprehensiveAnalysis 
          ? ["ema", "rsi", "macd", "bbands", "adx"] // Comprehensive set for detailed analysis
          : ["ema", "rsi"]; // Default minimal set
        try {
          indicatorsData = await fetchIndicators(symbol, indicatorsToFetch, apiCallCount);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.warn(`Failed to fetch indicators for ${symbol}:`, errorMessage);
          
          // Continue with analysis but note the limitation
          const indicatorNames = indicatorsToFetch.join(", ").toUpperCase();
          const partialContent = `⚠️ **Technical Indicators Unavailable for ${symbol}**

I couldn't fetch ${indicatorNames} data: ${errorMessage}

📈 **Alternative Technical Analysis:**
• Price action analysis using available data
• Support and resistance level identification
• Volume trend analysis
• Chart pattern recognition concepts
• Moving average theory and application

📚 **Educational Content Available:**
• How ${indicatorNames} indicators work
• Interpretation guidelines for technical signals
• Risk management strategies
• Portfolio diversification concepts

🔄 **Proceeding with available data...**

Let me provide analysis with the stock data I was able to fetch.`;

          // Continue execution but note the limitation in the response
          indicatorsData = undefined; // Ensure we proceed without indicators
        }
      }
  
      // Fetch Reddit sentiment data
      try {
        const redditResponse = await fetch(`/api/reddit?symbol=${symbol}`);
        if (redditResponse.ok) {
          redditData = await redditResponse.json();
          console.log(`Successfully fetched Reddit data for symbol: ${symbol}`);
        } else {
          console.warn(`Failed to fetch Reddit data for ${symbol}`);
        }
      } catch (error) {
        console.warn(`Error fetching Reddit data for ${symbol}:`, error);
        // Continue without Reddit data
      }

      // Fetch comprehensive market intelligence for analysis requests
      let marketIntelligence: any = null;
      let marketAlerts: any = null;
      if (needsComprehensiveAnalysis || input.toLowerCase().includes("analyz") || input.toLowerCase().includes("report") || input.toLowerCase().includes("research")) {
        try {
          console.log(`Fetching market intelligence for symbol: ${symbol}`);
          const marketIntelResponse = await fetch(`/api/market-intelligence?symbol=${symbol}&type=comprehensive`);
          if (marketIntelResponse.ok) {
            marketIntelligence = await marketIntelResponse.json();
            console.log(`Successfully fetched market intelligence for symbol: ${symbol}`);
          } else if (marketIntelResponse.status === 429) {
            // Handle rate limit error
            console.warn(`Rate limit exceeded when fetching market intelligence for ${symbol}`);
            marketIntelligence = {
              error: "Rate limit exceeded for market intelligence. Please try again later."
            };
          }
          
          // Fetch market alerts for risk awareness
          const marketAlertsResponse = await fetch(`/api/market-intelligence?symbol=${symbol}&type=alerts`);
          if (marketAlertsResponse.ok) {
            marketAlerts = await marketAlertsResponse.json();
            console.log(`Successfully fetched market alerts for symbol: ${symbol}`);
          } else if (marketAlertsResponse.status === 429) {
            // Handle rate limit error
            console.warn(`Rate limit exceeded when fetching market alerts for ${symbol}`);
            marketAlerts = {
              error: "Rate limit exceeded for market alerts. Please try again later."
            };
          }
        } catch (error) {
          console.warn(`Error fetching market intelligence for ${symbol}:`, error);
          // Continue without market intelligence
        }
      }

      // Optimize data size for LLM to prevent rate limit errors
      const optimizedStockData = stockData ? {
        quote: {
          symbol: stockData.quote?.symbol,
          name: stockData.quote?.name,
          price: stockData.quote?.price,
          change: stockData.quote?.change,
          change_percent: stockData.quote?.change_percent,
          volume: stockData.quote?.volume,
        },
        timeSeries: stockData.timeSeries ? {
          values: stockData.timeSeries.values?.slice(0, 5) // Limit to last 5 data points
        } : null
      } : null;

      const optimizedIndicators = indicatorsData
        ? Object.fromEntries(
            Object.entries(indicatorsData).slice(0, 3).map(([key, value]: [string, IndicatorData]) => [
              key, 
              {
                symbol: value.data?.symbol,
                name: value.data?.name,
                values: value.data?.values ? [value.data.values[0]] : null // Only send latest value
              }
            ])
          )
        : null;

      const optimizedRedditData = redditData ? {
        symbol: redditData.symbol,
        bullish_percentage: redditData.bullish_percentage,
        bearish_percentage: redditData.bearish_percentage,
        total_posts: redditData.total_posts,
        overall_sentiment: redditData.overall_sentiment,
        confidence: redditData.confidence
      } : null;

      const optimizedMarketIntelligence = marketIntelligence ? {
        symbol: marketIntelligence.symbol,
        error: marketIntelligence.error,
        // Only send the analysis, not the raw results which can be large
        synthesizedAnalysis: marketIntelligence.synthesizedAnalysis || marketIntelligence.analysis
      } : null;

      // Limit the size of the market intelligence analysis
      if (optimizedMarketIntelligence?.synthesizedAnalysis && optimizedMarketIntelligence.synthesizedAnalysis.length > 1000) {
        optimizedMarketIntelligence.synthesizedAnalysis = optimizedMarketIntelligence.synthesizedAnalysis.substring(0, 1000) + '... (analysis truncated)';;
      }

      const optimizedMarketAlerts = marketAlerts ? {
        symbol: marketAlerts.symbol,
        error: marketAlerts.error,
        // Only send the alerts, not the raw results
        alerts: marketAlerts.alerts
      } : null;

      const combinedData = {
        stockData: optimizedStockData,
        indicators: optimizedIndicators,
        redditSentiment: optimizedRedditData,
        marketIntelligence: optimizedMarketIntelligence,
        marketAlerts: optimizedMarketAlerts,
      };

      // Limit the size of the data being sent to prevent rate limit errors
      const serializedData = JSON.stringify(combinedData);
      const limitedData = serializedData.length > 2000 
        ? serializedData.substring(0, 2000) + '... (data truncated to prevent rate limit)'
        : serializedData;

      // Only include chat history for complex analysis requests
      const shouldIncludeChatHistory = input.toLowerCase().includes("analyz") || input.toLowerCase().includes("report") || input.toLowerCase().includes("research");
      const recentChatHistory = shouldIncludeChatHistory ? messages.slice(-1) : [];
      const chatHistoryString = shouldIncludeChatHistory 
        ? `\n\nRecent Chat History: ${JSON.stringify(recentChatHistory)}`
        : '';
      
      const enhancedInput = `${input}\n\nAPI Data: ${limitedData}${chatHistoryString}`;
  
      const chain = prompt.pipe(llm);
      const response = await chain.invoke({ input: enhancedInput, chat_history: (await chatHistory.getMessages()).slice(-3) });
  
      const assistantMessage: Message = {
        role: "assistant",
        content: response.content as string,
        timestamp: new Date().toLocaleTimeString(),
        stockData,
        indicatorsData,
        redditData,
      };
  
      // Add market intelligence data if available
      if (marketIntelligence) {
        (assistantMessage as any).marketIntelligence = marketIntelligence;
      }
      if (marketAlerts) {
        (assistantMessage as any).marketAlerts = marketAlerts;
      }
  
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
      
      // Enhanced error handling with intelligent fallback
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      let fallbackContent = "";
      
      // Determine error type and provide appropriate fallback
      if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("timeout")) {
        fallbackContent = `🌐 **Network Issue Detected**

I'm experiencing connectivity issues: ${errorMessage}

💡 **What I can still help with:**
• Explain financial concepts and terminology
• Discuss investment strategies and risk management
• Provide market analysis framework guidance
• Share trading psychology insights
• Explain technical indicators theory

🔄 **Troubleshooting:**
• Please check your internet connection
• Try again in a few moments
• Consider asking general financial questions

I'm here to help with financial education even without real-time data!`;
      } else if (errorMessage.includes("API") || errorMessage.includes("key") || errorMessage.includes("quota")) {
        fallbackContent = `⚙️ **API Service Issue**

There's a temporary service limitation: ${errorMessage}

📚 **Educational Content Available:**
• Stock analysis fundamentals
• Technical analysis principles
• Portfolio management strategies
• Risk assessment techniques
• Investment planning guidance

💬 **Ask me about:**
• "How does RSI indicator work?"
• "What is fundamental analysis?"
• "Explain diversification strategies"
• "How to read financial statements?"

Let's continue with financial education while the service recovers!`;
      } else {
        fallbackContent = `🔧 **Technical Issue Encountered**

I encountered an unexpected error: ${errorMessage}

🎯 **Alternative Assistance:**
• General market analysis concepts
• Investment strategy discussions
• Financial planning guidance
• Technical analysis education
• Risk management principles

💭 **Try asking:**
• "Explain P/E ratios"
• "What are growth vs value stocks?"
• "How to analyze a company?"
• "Sector rotation strategies"

I'm still here to help with your financial learning journey!`;
      }
      
      toast({ 
        title: "Service Issue", 
        description: "Providing alternative assistance while resolving the issue.", 
        variant: "destructive" 
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
                  className={`max-w-[85%] p-4 rounded-lg shadow-md ${
                    message.role === "user" ? "text-white" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  }`}
                  style={{
                    background: message.role === "user" ? `linear-gradient(to right, ${blue500}, ${indigo600})` : undefined,
                  }}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content.split('\n').map((line, i) => {
                      // Skip empty lines
                      if (!line.trim()) return null;
                      
                      // Check for markdown headings
                      if (line.startsWith('#### ')) {
                        return <h4 key={i} className="text-base font-bold mt-3 mb-1">{line.slice(5)}</h4>;
                      } else if (line.startsWith('### ')) {
                        return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(4)}</h3>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
                      } else if (line.startsWith('# ')) {
                        return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
                      } else if (line.startsWith('- ')) {
                        return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
                      } else if (line.match(/^\d+\./)) {
                        return <li key={i} className="ml-4 list-decimal">{line.slice(line.indexOf('.') + 2)}</li>;
                      } else if (line.startsWith('**') && line.endsWith('**')) {
                        return <p key={i} className="mb-2"><strong>{line.slice(2, -2)}</strong></p>;
                      } else if (line.startsWith('*') && line.endsWith('*')) {
                        return <p key={i} className="mb-2"><em>{line.slice(1, -1)}</em></p>;
                      } else {
                        // Regular paragraph
                        return <p key={i} className="mb-2">{line}</p>;
                      }
                    })}
                  </div>
                  
                  {/* Display additional data if available */}
                  {message.role === "assistant" && (message.stockData || message.indicatorsData || message.redditData || (message as any).marketIntelligence || (message as any).marketAlerts) && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400">
                          View Additional Data Sources
                        </summary>
                        <div className="mt-2 space-y-3">
                          {message.stockData && (
                            <div>
                              <h4 className="font-semibold">Stock Data</h4>
                              <pre className="text-xs overflow-x-auto bg-gray-100 dark:bg-gray-900 p-2 rounded">
                                {JSON.stringify(message.stockData, null, 2)}
                              </pre>
                            </div>
                          )}
                          {message.indicatorsData && (
                            <div>
                              <h4 className="font-semibold">Technical Indicators</h4>
                              <pre className="text-xs overflow-x-auto bg-gray-100 dark:bg-gray-900 p-2 rounded">
                                {JSON.stringify(message.indicatorsData, null, 2)}
                              </pre>
                            </div>
                          )}
                          {message.redditData && (
                            <div>
                              <h4 className="font-semibold">Reddit Sentiment</h4>
                              <div className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded">
                                <p><strong>Symbol:</strong> {message.redditData.symbol}</p>
                                <p><strong>Bullish:</strong> {message.redditData.bullish_percentage}%</p>
                                <p><strong>Bearish:</strong> {message.redditData.bearish_percentage}%</p>
                                <p><strong>Total Posts:</strong> {message.redditData.total_posts}</p>
                                <p><strong>Sentiment:</strong> {message.redditData.overall_sentiment}</p>
                              </div>
                            </div>
                          )}
                          {(message as any).marketIntelligence && (
                            <div>
                              <h4 className="font-semibold">Market Intelligence</h4>
                              <div className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded">
                                {((message as any).marketIntelligence as any).synthesizedAnalysis ? (
                                  <div>
                                    <p className="font-medium mb-1">Synthesized Analysis:</p>
                                    <p className="whitespace-pre-wrap">{((message as any).marketIntelligence as any).synthesizedAnalysis}</p>
                                  </div>
                                ) : ((message as any).marketIntelligence as any).analysis ? (
                                  <div>
                                    <p className="font-medium mb-1">Analysis:</p>
                                    <p className="whitespace-pre-wrap">{((message as any).marketIntelligence as any).analysis}</p>
                                  </div>
                                ) : (
                                  <pre className="overflow-x-auto">
                                    {JSON.stringify((message as any).marketIntelligence, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          )}
                          {(message as any).marketAlerts && (
                            <div>
                              <h4 className="font-semibold">Market Alerts</h4>
                              <div className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded">
                                {((message as any).marketAlerts as any).alerts ? (
                                  <div>
                                    <p className="font-medium mb-1">Alerts:</p>
                                    <p className="whitespace-pre-wrap">{((message as any).marketAlerts as any).alerts}</p>
                                  </div>
                                ) : (
                                  <pre className="overflow-x-auto">
                                    {JSON.stringify((message as any).marketAlerts, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                  
                  <span className="text-xs mt-2 block" style={{ color: message.role === "user" ? "white" : "#6B7280" }}>
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