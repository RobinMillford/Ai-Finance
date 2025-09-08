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
import { getMarketIntelligence, getComprehensiveMarketOverview, getLatestNews, getGeopoliticalAnalysis, getMarketSentiment, getFundamentalAnalysis, getTechnicalAnalysis, getMacroeconomicAnalysis, getRegulatoryAnalysis, getMarketAlerts } from "@/lib/market-intelligence";

// Theme colors inspired by from-orange-500 to-yellow-600
const orange500 = "#F97316"; // Tailwind from-orange-500
const yellow600 = "#CA8A04"; // Tailwind to-yellow-600

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
  redditData?: any; // Add Reddit data
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
        model: "openai/gpt-oss-120b",
        temperature: 0.7,
      });
  
      const chatHistory = chatHistories.get(currentChatId);
      if (!chatHistory) throw new Error("Chat history not initialized.");
      await chatHistory.addMessage(new HumanMessage(userInput));
  
      const systemPrompt = `
        You are an advanced AI Crypto Advisor for FinanceAI, a comprehensive financial analysis platform. You are designed to handle ANY cryptocurrency-related query, analysis request, or report generation for digital assets and crypto pairs. Your capabilities extend far beyond basic price checking to provide sophisticated blockchain and crypto market insights.

        ## CORE CAPABILITIES
        You can handle:
        - **Crypto Analysis**: Complete technical and fundamental analysis of cryptocurrencies
        - **Blockchain Research**: Technology analysis, adoption metrics, network health
        - **Market Reports**: Daily crypto summaries, volatility analysis, correlation studies
        - **Investment Research**: DeFi analysis, tokenomics evaluation, risk assessment
        - **Trading Strategies**: Entry/exit points, momentum analysis, trend identification
        - **Portfolio Management**: Diversification advice, allocation strategies, risk management
        - **Educational Content**: Explain blockchain concepts, crypto trading, and DeFi protocols
        - **Market Context**: How regulations, adoption, and macro factors affect crypto markets

        ## COMPREHENSIVE ANALYSIS FRAMEWORK
        
        ### 1. CRYPTOCURRENCY IDENTIFICATION & VALIDATION
        - **Smart Recognition**: Detect symbols from names (Bitcoin→BTC/USD, Ethereum→ETH/USD)
        - **Multi-format Support**: Handle BTC, BTC/USD, BTCUSD, Bitcoin formats
        - **Context Memory**: Remember cryptocurrencies from conversation history
        - **Flexible Input**: Handle "Bitcoin analysis", "ETH report", "crypto market" formats
        - **Comprehensive Coverage**: Support major cryptocurrencies and trading pairs

        ### 2. CRYPTO DATA INTERPRETATION & ANALYSIS
        **Market Metrics Analysis**:
        - Price action: Current prices, daily/weekly/monthly changes, volume analysis
        - Volatility analysis: Price swings, risk metrics, historical volatility
        - Market cap analysis: Ranking, dominance, relative performance
        - Volume analysis: Trading activity, institutional flows, retail sentiment
        
        **Technical Indicators (Available: RSI, EMA, MACD, BBANDS, ATR, OBV, Supertrend, STOCH, ADX)**:
        - RSI: Momentum oscillator, overbought/oversold conditions for crypto assets
        - MACD: Trend following, signal crossovers, momentum shifts in crypto markets
        - EMA: Moving averages, trend confirmation, dynamic support/resistance levels
        - Bollinger Bands: Volatility bands, ranging vs trending crypto markets
        - ATR: Volatility measurement, position sizing for crypto trading
        - OBV: Volume analysis, accumulation/distribution patterns
        - Supertrend: Trend following indicator for crypto momentum
        - Stochastic: Momentum oscillator for crypto price momentum
        - ADX: Trend strength measurement for directional crypto moves

        **Social Sentiment Integration**:
        - Reddit crypto community analysis: r/cryptocurrency, r/bitcoin, r/ethereum sentiment
        - Social momentum: How community sentiment drives crypto price action
        - FOMO/FUD detection: Identifying fear and greed cycles in crypto markets
        - Developer activity: GitHub commits, network upgrades, protocol developments

        **Market Intelligence Integration**:
        - Real-time news analysis and market alerts
        - Geopolitical event impact assessment on crypto markets
        - Regulatory change impact analysis
        - Macroeconomic factor influence evaluation
        - Comprehensive market sentiment understanding
        - Blockchain technology and adoption trends

        ### 3. RESPONSE ADAPTABILITY
        **Query Types & Responses**:
        - **Quick Prices**: "What's Bitcoin at?" → Current price + key highlights
        - **Analysis Requests**: "Analyze Ethereum" → Complete technical + fundamental + sentiment analysis
        - **Market Context**: "How's the crypto market?" → Broad market analysis with key movers
        - **Investment Research**: "Should I buy Bitcoin?" → Risk/reward analysis with recommendations
        - **Trading Strategies**: "Best ETH entry point?" → Technical analysis with entry/exit levels
        - **Portfolio Questions**: "Crypto diversification advice" → Portfolio construction guidance
        - **Educational**: "Explain DeFi" → Clear educational content with examples
        - **Technology Analysis**: "Ethereum 2.0 impact" → Technical and market implications
        - **Regulatory Impact**: "How do regulations affect crypto?" → Policy analysis and market effects

        ### 4. COMPREHENSIVE REPORTING
        **Analysis Depth Levels**:
        - **Quick Summary**: 2-3 key points for rapid trading decisions
        - **Standard Analysis**: Price, trends, key indicators, sentiment, recommendation
        - **Deep Dive**: Comprehensive analysis with multiple timeframes, technology factors, market context
        - **Custom Reports**: Tailored analysis based on specific crypto investment requirements

        **Professional Formatting**:
        - Use bullet points, headers, and sections for complex analysis
        - Include confidence levels and data freshness indicators
        - Provide actionable insights and clear recommendations
        - Always cite data sources and timestamps
        - Include price targets and risk levels where appropriate

        ### 5. INTELLIGENT ERROR HANDLING
        - **Missing Data**: Explain what's missing and provide analysis with available data
        - **Invalid Symbols**: Suggest closest matches or alternative crypto analysis
        - **API Failures**: Provide general crypto market context or educational content
        - **Ambiguous Requests**: Ask clarifying questions to provide better analysis

        ### 6. CONTEXTUAL INTELLIGENCE
        - **Market Awareness**: Consider current crypto market conditions and cycles
        - **Technology Updates**: Account for network upgrades, hard forks, protocol changes
        - **Regulatory Environment**: Consider regulatory developments affecting crypto
        - **Cross-Market Analysis**: Connect crypto movements with traditional markets
        - **Market Intelligence**: Access real-time news, geopolitical events, and comprehensive market analysis
        - **Global Context**: Understand how worldwide events affect cryptocurrency markets
        - **Risk Awareness**: Highlight potential risks and market alerts

        ### 7. RISK & COMPLIANCE
        - Always include risk disclaimers for crypto investment advice
        - Emphasize the high volatility and speculative nature of cryptocurrencies
        - Provide balanced analysis showing both opportunities and risks
        - Focus on education and analysis rather than direct investment signals
        - Remind users about proper risk management in volatile crypto markets

        ## OUTPUT GUIDELINES
        - **Be Comprehensive**: Address all aspects of the user's crypto query
        - **Be Adaptive**: Match response depth to query complexity
        - **Be Accurate**: Only use provided API data, clearly state limitations
        - **Be Helpful**: Always try to provide value even with limited data
        - **Be Professional**: Maintain expert-level crypto market communication
        - **Be Educational**: Explain blockchain and crypto concepts when beneficial
        - **Be Accessible**: Use friendly tone while maintaining professional analysis
        - **Include Market Intelligence**: When available, incorporate real-time news, geopolitical events, and comprehensive market analysis
        - **Contextual Awareness**: Consider global events and their impact on cryptocurrency markets
        - **Risk Alerts**: Highlight any urgent market alerts or warnings
        - **Data Integration**: Reference specific data points from all available sources (crypto data, indicators, sentiment, market intelligence)

        Remember: You are a sophisticated crypto advisor capable of handling any digital asset query with professional-grade analysis. Always reference the specific data provided and explain how different data sources inform your analysis.
      `;
  
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"],
      ]);
  
      // Enhanced crypto symbol detection with multiple patterns and aliases
      let symbol: string | null = null;
      
      // Pattern 1: Standard crypto pair format (BTC/USD, ETH/BTC, etc.)
      const symbolMatch = input.match(/\b[A-Z]{3,5}\/[A-Z]{3,5}\b/);
      if (symbolMatch) {
        symbol = symbolMatch[0].toUpperCase();
      }
      
      // Pattern 2: Crypto name variations and common aliases
      if (!symbol) {
        const cryptoAliases: { [key: string]: string } = {
          "bitcoin": "BTC/USD",
          "btc": "BTC/USD",
          "ethereum": "ETH/USD",
          "eth": "ETH/USD",
          "ether": "ETH/USD",
          "cardano": "ADA/USD",
          "ada": "ADA/USD",
          "solana": "SOL/USD",
          "sol": "SOL/USD",
          "polkadot": "DOT/USD",
          "dot": "DOT/USD",
          "chainlink": "LINK/USD",
          "link": "LINK/USD",
          "polygon": "MATIC/USD",
          "matic": "MATIC/USD",
          "avalanche": "AVAX/USD",
          "avax": "AVAX/USD",
          "binance": "BNB/USD",
          "bnb": "BNB/USD",
          "ripple": "XRP/USD",
          "xrp": "XRP/USD",
          "dogecoin": "DOGE/USD",
          "doge": "DOGE/USD",
          "shiba": "SHIB/USD",
          "shib": "SHIB/USD",
          "uniswap": "UNI/USD",
          "uni": "UNI/USD",
          "aave": "AAVE/USD",
          "compound": "COMP/USD",
          "comp": "COMP/USD",
          "maker": "MKR/USD",
          "mkr": "MKR/USD",
          "litecoin": "LTC/USD",
          "ltc": "LTC/USD",
          "monero": "XMR/USD",
          "xmr": "XMR/USD",
          "zcash": "ZEC/USD",
          "zec": "ZEC/USD",
          "stellar": "XLM/USD",
          "xlm": "XLM/USD",
          "tron": "TRX/USD",
          "trx": "TRX/USD",
          "eos": "EOS/USD",
          "iota": "MIOTA/USD",
          "neo": "NEO/USD",
          "dash": "DASH/USD"
        };
        
        const lowerInput = input.toLowerCase();
        for (const [alias, pair] of Object.entries(cryptoAliases)) {
          if (lowerInput.includes(alias)) {
            symbol = pair;
            break;
          }
        }
      }
      
      // Pattern 3: Generic crypto mentions with default pairing
      if (!symbol) {
        const cryptoPatterns = [
          /\b(BTC|BITCOIN)\b/i,
          /\b(ETH|ETHEREUM|ETHER)\b/i,
          /\b(ADA|CARDANO)\b/i,
          /\b(SOL|SOLANA)\b/i,
          /\b(DOT|POLKADOT)\b/i,
          /\b(LINK|CHAINLINK)\b/i,
          /\b(MATIC|POLYGON)\b/i,
          /\b(AVAX|AVALANCHE)\b/i
        ];
        
        for (const pattern of cryptoPatterns) {
          const match = input.match(pattern);
          if (match) {
            const crypto = match[1].toUpperCase();
            if (["BTC", "BITCOIN"].includes(crypto)) symbol = "BTC/USD";
            else if (["ETH", "ETHEREUM", "ETHER"].includes(crypto)) symbol = "ETH/USD";
            else if (["ADA", "CARDANO"].includes(crypto)) symbol = "ADA/USD";
            else if (["SOL", "SOLANA"].includes(crypto)) symbol = "SOL/USD";
            else if (["DOT", "POLKADOT"].includes(crypto)) symbol = "DOT/USD";
            else if (["LINK", "CHAINLINK"].includes(crypto)) symbol = "LINK/USD";
            else if (["MATIC", "POLYGON"].includes(crypto)) symbol = "MATIC/USD";
            else if (["AVAX", "AVALANCHE"].includes(crypto)) symbol = "AVAX/USD";
            break;
          }
        }
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
            const cryptoNames = ["bitcoin", "btc", "ethereum", "eth", "cardano", "ada", "solana", "sol"];
            const prevCryptoMatch = cryptoNames.find((name: string) => messages[i].content.toLowerCase().includes(name));
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
  
      // Enhanced crypto symbol detection and smart suggestions
      if (!symbol) {
        // Try to provide intelligent assistance even without a symbol
        const isGeneralQuery = 
          input.toLowerCase().includes("market") ||
          input.toLowerCase().includes("crypto") ||
          input.toLowerCase().includes("cryptocurrency") ||
          input.toLowerCase().includes("digital") ||
          input.toLowerCase().includes("blockchain") ||
          input.toLowerCase().includes("general") ||
          input.toLowerCase().includes("overall") ||
          input.toLowerCase().includes("defi") ||
          input.toLowerCase().includes("tips") ||
          input.toLowerCase().includes("advice") ||
          input.toLowerCase().includes("help") ||
          input.toLowerCase().includes("explain") ||
          input.toLowerCase().includes("what is") ||
          input.toLowerCase().includes("how to") ||
          input.toLowerCase().includes("trading");

        let content = "";
        if (isGeneralQuery) {
          content = `I'd be happy to help with your crypto question! For general market insights, I can provide:

🚀 **Crypto Market Analysis Options:**
• Cryptocurrency overviews (Bitcoin, Ethereum, Altcoins)
• Market sentiment analysis and trend identification
• Trading strategy guidance and risk management
• Technical analysis education and chart patterns
• DeFi and blockchain technology explanations

🔍 **For Specific Crypto Analysis:**
Provide a crypto symbol (e.g., 'BTC/USD', 'ETH/BTC', 'ADA/USD') or name.

📈 **Popular Cryptos to Try:**
• BTC/USD (Bitcoin), ETH/USD (Ethereum), ADA/USD (Cardano)
• SOL/USD (Solana), DOT/USD (Polkadot), LINK/USD (Chainlink)
• MATIC/USD (Polygon), AVAX/USD (Avalanche)

What specific aspect of crypto would you like me to focus on?`;
        } else {
          // Try to suggest similar symbols from input
          const inputUpper = input.toUpperCase().replace(/[^A-Z]/g, "");
          const similarCryptos = cryptoPairs
            .filter((pair: any) => 
              pair.symbol.replace("/", "").includes(inputUpper.slice(0, 3)) ||
              (pair.currency_base && pair.currency_base.toLowerCase().includes(input.toLowerCase().slice(0, 4))) ||
              (pair.currency_quote && pair.currency_quote.toLowerCase().includes(input.toLowerCase().slice(0, 4)))
            )
            .slice(0, 5)
            .map((pair: any) => `${pair.symbol} (${pair.currency_base || 'Crypto'})`);

          const suggestions = similarCryptos.length > 0 ? similarCryptos.join(", ") : "";

          content = `I couldn't identify a specific crypto from your message. 

🔍 **Did you mean:**
${suggestions ? `• ${suggestions}` : "• Please provide a valid crypto symbol"}

💡 **Popular Options:**
• BTC/USD (Bitcoin) • ETH/USD (Ethereum) • ADA/USD (Cardano)
• SOL/USD (Solana) • DOT/USD (Polkadot) • LINK/USD (Chainlink)
• MATIC/USD (Polygon) • AVAX/USD (Avalanche)

What crypto would you like me to analyze?`;
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
  
      // Enhanced crypto symbol validation with suggestions
      const isValidSymbol = cryptoPairs.some((pair: any) => pair.symbol === symbol);
      if (!isValidSymbol && cryptoPairs.length > 0) {
        // Find similar crypto symbols for suggestions
        const similarCryptos = cryptoPairs
          .filter((pair: any) => 
            pair.symbol.includes(symbol!.slice(0, 3)) ||
            pair.symbol.startsWith(symbol!.charAt(0)) ||
            (pair.currency_base && pair.currency_base.toLowerCase().includes(symbol!.toLowerCase())) ||
            (pair.currency_quote && pair.currency_quote.toLowerCase().includes(symbol!.toLowerCase()))
          )
          .slice(0, 5)
          .map((pair: any) => `${pair.symbol} (${pair.currency_base || 'Crypto'})`);

        const suggestions = similarCryptos.length > 0 ? similarCryptos.join(", ") : "";
        const content = `❌ **Crypto Symbol '${symbol}' not found** in available cryptocurrency pairs.

🔍 **Did you mean:**
${suggestions ? `• ${suggestions}` : "No similar symbols found"}

💡 **Popular Crypto Pairs:**
• **Major**: BTC/USD, ETH/USD, BNB/USD, XRP/USD
• **DeFi**: UNI/USD, AAVE/USD, SUSHI/USD, CRV/USD
• **Layer 1**: SOL/USD, ADA/USD, DOT/USD, AVAX/USD
• **Layer 2**: MATIC/USD, METIS/USD, ARB/USD

📝 **Note:** I analyze all major cryptocurrencies and trading pairs. Ensure the format is correct (e.g., BTC/USD).

Please provide a valid crypto symbol for analysis.`;

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
  
      const predefinedIndicators = ["rsi", "ema", "macd", "bbands", "atr", "obv", "supertrend", "stoch", "adx"];
      const indicatorMatch = input.match(new RegExp(`\\b(${predefinedIndicators.join("|")})\\b`, "i"))?.[0]?.toLowerCase();
      const requestedIndicators = indicatorMatch ? [indicatorMatch] : [];
      
      // Enhanced data fetching logic for comprehensive crypto analysis
      const needsQuote =
        input.toLowerCase().includes("price") ||
        input.toLowerCase().includes("worth") ||
        input.toLowerCase().includes("value") ||
        input.toLowerCase().includes("at") ||
        input.toLowerCase().includes("up") ||
        input.toLowerCase().includes("down") ||
        input.toLowerCase().includes("analyz") ||
        input.toLowerCase().includes("report") ||
        input.toLowerCase().includes("research") ||
        input.toLowerCase().includes("invest") ||
        input.toLowerCase().includes("buy") ||
        input.toLowerCase().includes("sell") ||
        input.toLowerCase().includes("trade") ||
        input.toLowerCase().includes("trading") ||
        input.toLowerCase().includes("recommend") ||
        input.toLowerCase().includes("assessment") ||
        input.toLowerCase().includes("evaluation") ||
        input.toLowerCase().includes("overview") ||
        input.toLowerCase().includes("summary") ||
        input.toLowerCase().includes("how") ||
        input.toLowerCase().includes("what") ||
        input.toLowerCase().includes("performance") ||
        input.toLowerCase().includes("outlook") ||
        requestedIndicators.length > 0; // Always fetch quote if indicators are requested
        
      const needsTrend =
        input.toLowerCase().includes("trend") ||
        input.toLowerCase().includes("time series") ||
        input.toLowerCase().includes("doing") ||
        input.toLowerCase().includes("performance") ||
        input.toLowerCase().includes("analyz") ||
        input.toLowerCase().includes("report") ||
        input.toLowerCase().includes("research") ||
        input.toLowerCase().includes("chart") ||
        input.toLowerCase().includes("history") ||
        input.toLowerCase().includes("historical") ||
        input.toLowerCase().includes("movement") ||
        input.toLowerCase().includes("direction"); // Always fetch trend for analysis
        
      // Always fetch comprehensive indicators for analysis, research, or investment queries
      const needsComprehensiveAnalysis = 
        input.toLowerCase().includes("analyz") ||
        input.toLowerCase().includes("report") ||
        input.toLowerCase().includes("research") ||
        input.toLowerCase().includes("invest") ||
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
        input.toLowerCase().includes("portfolio");
        
      const isGeneralAnalysis = needsComprehensiveAnalysis;

      const apiCallCount = { count: 0 };
      let cryptoData: any = {};
      let redditData: any = null;
      let marketIntelligence: any = null;
      let marketAlerts: any = null;

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

      if (requestedIndicators.length > 0 || isGeneralAnalysis) {
        const indicatorsToFetch = requestedIndicators.length > 0 
          ? requestedIndicators 
          : isGeneralAnalysis 
          ? ["rsi", "ema", "macd", "bbands", "atr", "obv"] // Comprehensive set for detailed crypto analysis
          : [];
        for (const indicator of indicatorsToFetch) {
          try {
            cryptoData[indicator] = await fetchCryptoData(symbol, indicator, apiCallCount);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            cryptoData[indicator] = { error: errorMessage };
          }
        }
      }

      // Fetch Reddit sentiment data for general analysis
      if (isGeneralAnalysis || needsTrend || needsQuote) {
        try {
          const redditResponse = await fetch(`/api/reddit?symbol=${symbol}`);
          if (redditResponse.ok) {
            redditData = await redditResponse.json();
            console.log(`Successfully fetched Reddit data for crypto symbol: ${symbol}`);
          } else {
            console.warn(`Failed to fetch Reddit data for ${symbol}`);
          }
        } catch (error) {
          console.warn(`Error fetching Reddit data for ${symbol}:`, error);
          // Continue without Reddit data
        }
      }

      // Fetch comprehensive market intelligence for analysis requests with timeout
      if (needsComprehensiveAnalysis || input.toLowerCase().includes("analyz") || input.toLowerCase().includes("report") || input.toLowerCase().includes("research")) {
        try {
          console.log(`Fetching market intelligence for crypto symbol: ${symbol}`);
          
          // Add timeout to prevent hanging
          const marketIntelPromise = fetch(`/api/market-intelligence?symbol=${symbol}&type=comprehensive`);
          const marketAlertsPromise = fetch(`/api/market-intelligence?symbol=${symbol}&type=alerts`);
          
          // Race the promises with a timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Market intelligence request timeout')), 30000) // 30 second timeout
          );
          
          const marketIntelResponse = await Promise.race([marketIntelPromise, timeoutPromise]) as Response;
          if (marketIntelResponse.ok) {
            marketIntelligence = await marketIntelResponse.json();
            console.log(`Successfully fetched market intelligence for crypto symbol: ${symbol}`);
          } else if (marketIntelResponse.status === 429) {
            // Handle rate limit error
            console.warn(`Rate limit exceeded when fetching market intelligence for ${symbol}`);
            marketIntelligence = {
              error: "Rate limit exceeded for market intelligence. Please try again later."
            };
          }
          
          // Fetch market alerts for risk awareness with timeout
          const marketAlertsResponse = await Promise.race([marketAlertsPromise, timeoutPromise]) as Response;
          if (marketAlertsResponse.ok) {
            marketAlerts = await marketAlertsResponse.json();
            console.log(`Successfully fetched market alerts for crypto symbol: ${symbol}`);
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
          // Make sure to reset loading state even if there's an error
          if (error instanceof Error && error.message.includes('timeout')) {
            marketIntelligence = {
              error: "Market intelligence request timed out. Proceeding with available data."
            };
            marketAlerts = {
              error: "Market alerts request timed out. Proceeding with available data."
            };
          }
        }
      }

      // Add Reddit data to crypto data if available
      if (redditData) {
        cryptoData.redditSentiment = redditData;
      }

      // Add market intelligence to crypto data if available
      if (marketIntelligence) {
        cryptoData.marketIntelligence = marketIntelligence;
      }

      // Add market alerts to crypto data if available
      if (marketAlerts) {
        cryptoData.marketAlerts = marketAlerts;
      }
  
      // Optimize data size for LLM to prevent rate limit errors
      const optimizedCryptoData: any = {};
      
      // Optimize quote data
      if (cryptoData.quote) {
        optimizedCryptoData.quote = {
          symbol: cryptoData.quote.symbol,
          name: cryptoData.quote.name,
          price: cryptoData.quote.price,
          change: cryptoData.quote.change,
          change_percent: cryptoData.quote.change_percent,
          volume: cryptoData.quote.volume,
        };
      }
      
      // Optimize time series data
      if (cryptoData.time_series) {
        optimizedCryptoData.time_series = {
          values: cryptoData.time_series.values?.slice(0, 5) // Limit to last 5 data points
        };
      }
      
      // Optimize indicators data
      if (cryptoData.indicators) {
        optimizedCryptoData.indicators = {};
        const indicatorEntries = Object.entries(cryptoData.indicators).slice(0, 3);
        for (const [key, value] of indicatorEntries) {
          if (typeof value === 'object' && value !== null) {
            optimizedCryptoData.indicators[key] = {
              symbol: (value as any).symbol,
              name: (value as any).name,
              values: (value as any).values ? [(value as any).values[0]] : null // Only send latest value
            };
          }
        }
      }
      
      // Optimize Reddit sentiment data
      if (cryptoData.redditSentiment) {
        optimizedCryptoData.redditSentiment = {
          symbol: cryptoData.redditSentiment.symbol,
          bullish_percentage: cryptoData.redditSentiment.bullish_percentage,
          bearish_percentage: cryptoData.redditSentiment.bearish_percentage,
          total_posts: cryptoData.redditSentiment.total_posts,
          overall_sentiment: cryptoData.redditSentiment.overall_sentiment,
          confidence: cryptoData.redditSentiment.confidence
        };
      }
      
      // Optimize market intelligence data
      if (cryptoData.marketIntelligence) {
        optimizedCryptoData.marketIntelligence = {
          symbol: cryptoData.marketIntelligence.symbol,
          error: cryptoData.marketIntelligence.error,
          // Only send the analysis, not the raw results which can be large
          synthesizedAnalysis: cryptoData.marketIntelligence.synthesizedAnalysis || cryptoData.marketIntelligence.analysis
        };
        // Limit the size of the market intelligence analysis
        if (optimizedCryptoData.marketIntelligence.synthesizedAnalysis && optimizedCryptoData.marketIntelligence.synthesizedAnalysis.length > 1000) {
          optimizedCryptoData.marketIntelligence.synthesizedAnalysis = optimizedCryptoData.marketIntelligence.synthesizedAnalysis.substring(0, 1000) + '... (analysis truncated)';
        }
      }
      
      // Optimize market alerts data
      if (cryptoData.marketAlerts) {
        optimizedCryptoData.marketAlerts = {
          symbol: cryptoData.marketAlerts.symbol,
          error: cryptoData.marketAlerts.error,
          alerts: cryptoData.marketAlerts.alerts
        };
      }

      // Limit the size of the data being sent to prevent rate limit errors
      const serializedData = JSON.stringify(optimizedCryptoData);
      const limitedData = serializedData.length > 2000 
        ? serializedData.substring(0, 2000) + '... (data truncated to prevent rate limit)'
        : serializedData;

      const recentHistory = messages.slice(-1); // Reduce chat history
      const enhancedInput = `${input}\n\nAPI Data: ${limitedData}\n\nRecent Chat History: ${JSON.stringify(recentHistory)}`;
  
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
            session.id === currentChatId ? { ...session, messages: updatedMessages, lastSymbol: symbol } : session
          )
        );
        return updatedMessages;
      });
  
      await chatHistory.addMessage(new SystemMessage(responseContent));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in chatbot:", errorMessage);
      
      // Enhanced error handling with intelligent fallback for crypto
      let fallbackContent = "";
      
      // Determine error type and provide appropriate fallback
      if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("timeout")) {
        fallbackContent = `🌐 **Network Issue Detected**

I'm experiencing connectivity issues: ${errorMessage}

💡 **What I can still help with:**
• Explain crypto concepts and blockchain technology
• Discuss cryptocurrency trading strategies and risk management
• Provide crypto market analysis framework guidance
• Share DeFi and yield farming insights
• Explain technical indicators for crypto trading
• NFT and Web3 technology explanations

🔄 **Troubleshooting:**
• Please check your internet connection
• Try again in a few moments
• Consider asking general crypto questions

I'm here to help with crypto education even without real-time data!`;
      } else if (errorMessage.includes("API") || errorMessage.includes("key") || errorMessage.includes("quota")) {
        fallbackContent = `⚙️ **API Service Issue**

There's a temporary service limitation: ${errorMessage}

📚 **Educational Content Available:**
• Cryptocurrency fundamentals and blockchain basics
• Technical analysis for crypto trading
• DeFi protocols and yield strategies
• NFT market analysis and trends
• Crypto portfolio management strategies
• Security best practices for crypto investors

💬 **Ask me about:**
• "How does Bitcoin mining work?"
• "What is DeFi and yield farming?"
• "Explain crypto market cycles"
• "How to read crypto charts?"

Let's continue with crypto education while the service recovers!`;
      } else {
        fallbackContent = `🔧 **Technical Issue Encountered**

I encountered an unexpected error: ${errorMessage}

🎯 **Alternative Assistance:**
• General crypto market analysis concepts
• Cryptocurrency trading strategy discussions
• Blockchain technology explanations
• DeFi and NFT educational content
• Crypto security and wallet guidance
• Market psychology and HODL strategies

💭 **Try asking:**
• "Explain Bitcoin vs Ethereum"
• "What are altcoins and memecoins?"
• "How to analyze crypto projects?"
• "Crypto staking vs trading strategies"

I'm still here to help with your crypto learning journey!`;
      }
      
      toast({
        title: "Service Issue",
        description: "Providing alternative crypto assistance while resolving the issue.",
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
                    <div className="flex-1" onClick={() => handleSwitchChat(session.id)}>
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
                  className={`max-w-[85%] p-4 rounded-lg shadow-md ${
                    message.role === "user" ? "text-white" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  }`}
                  style={{
                    background: message.role === "user" ? `linear-gradient(to right, ${orange500}, ${yellow600})` : undefined,
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
                  {message.role === "assistant" && (message.cryptoData || message.redditData || (message as any).marketIntelligence || (message as any).marketAlerts) && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-orange-600 dark:text-orange-400">
                          View Additional Data Sources
                        </summary>
                        <div className="mt-2 space-y-3">
                          {message.cryptoData && (
                            <div>
                              <h4 className="font-semibold">Crypto Data</h4>
                              <pre className="text-xs overflow-x-auto bg-gray-100 dark:bg-gray-900 p-2 rounded">
                                {JSON.stringify(message.cryptoData, null, 2)}
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