"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { BarChart3, Send, Loader2, Trash2, Clock } from "lucide-react";
import axios from "axios";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  chartData?: { labels: string[]; data: number[]; title: string };
}

// Initialize chat history storage
const chatHistories = new Map<string, InMemoryChatMessageHistory>();

export default function Advisor() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(Date.now().toString()); // Unique session ID for chat history
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat history for the session immediately
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, new InMemoryChatMessageHistory());
  }

  // Scroll to the bottom of the chat when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear chat history
  const handleClearChat = () => {
    setMessages([]);
    chatHistories.set(sessionId, new InMemoryChatMessageHistory());
    toast({
      title: "Chat Cleared",
      description: "Your chat history has been cleared.",
    });
  };

  // Custom prompt for the LLM
  const systemPrompt = `
You are an AI financial advisor for FinanceAI, a platform that provides financial data analysis for stocks, forex, and crypto. Your task is to assist users by fetching and interpreting financial data for a given symbol using the TwelveData API. Follow these steps:

1. **Identify the Symbol and Asset Type**:
   - The user will provide a symbol (e.g., "AAPL" for stocks, "EUR/USD" for forex, "BTC/USD" for crypto).
   - Determine the asset type based on the symbol format:
     - Stocks: Single ticker (e.g., "AAPL", "TSLA").
     - Forex: Currency pair (e.g., "EUR/USD", "GBP/JPY").
     - Crypto: Crypto pair (e.g., "BTC/USD", "ETH/BTC").
   - If the asset type is unclear, ask the user to clarify (e.g., "Is 'XYZ' a stock, forex pair, or crypto pair?").

2. **Fetch Data from TwelveData API**:
   - Use the following API endpoints based on the asset type:
     - **Stocks**: Use "/quote" endpoint (e.g., https://api.twelvedata.com/quote?symbol=AAPL&apikey=YOUR_API_KEY).
     - **Forex**: Use "/quote" endpoint (e.g., https://api.twelvedata.com/quote?symbol=EUR/USD&apikey=YOUR_API_KEY).
     - **Crypto**: Use "/quote" endpoint (e.g., https://api.twelvedata.com/quote?symbol=BTC/USD&apikey=YOUR_API_KEY).
   - Additional data (if requested):
     - Time Series: Use "/time_series" endpoint (e.g., https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=30&apikey=YOUR_API_KEY).
     - Technical Indicators: Use "/technical_indicators" endpoint (e.g., https://api.twelvedata.com/rsi?symbol=AAPL&interval=1day&apikey=YOUR_API_KEY).
   - The API key is available as TWELVE_DATA_API_KEY in the environment.

3. **Interpret the Data**:
   - Provide a concise summary of the data (e.g., current price, daily change, volume).
   - If time series or technical indicators are requested, analyze trends (e.g., "The stock has been trending upward over the past 30 days," "The RSI indicates overbought conditions").
   - Offer insights or recommendations based on the data (e.g., "The stock is near its 52-week high, which may indicate a good time to sell").
   - If you provide time series data or technical indicator data (e.g., RSI, MACD), include a note like "[Chart Available]" to indicate that a chart will be displayed.

4. **Handle Errors**:
   - If the symbol is invalid or the API request fails, inform the user and suggest trying a different symbol (e.g., "I couldn't find data for 'XYZ'. Please try a valid symbol like 'AAPL' for stocks or 'BTC/USD' for crypto.").

5. **Maintain Conversational Context**:
   - Use the chat history to maintain context (e.g., if the user asks "What about TSLA?" after discussing AAPL, understand that they are asking about a new stock symbol).
   - If the user asks follow-up questions (e.g., "What’s the RSI?"), fetch the relevant data for the previously discussed symbol.

6. **Response Format**:
   - Respond in a clear, professional tone.
   - Use bullet points or short paragraphs for readability.
   - Avoid speculative advice (e.g., don’t say "This stock will definitely go up"); instead, provide data-driven insights (e.g., "Based on the RSI, the stock may be overbought").

Example Interaction:
User: "Analyze AAPL"
Assistant:
- **Symbol**: AAPL (Stock)
- **Current Price**: $150.25
- **Daily Change**: +2.5% (+$3.65)
- **Volume**: 85M shares
- **52-Week Range**: $120.00 - $155.00
- **Insight**: AAPL is near its 52-week high, which may indicate strong momentum. Would you like to see technical indicators like RSI or MACD?

User: "What’s the RSI for AAPL?"
Assistant:
- **RSI for AAPL** (14-day period): 72.3
- **Analysis**: An RSI above 70 typically indicates overbought conditions, suggesting AAPL might be due for a pullback.
[Chart Available]

User: "Show me the time series for AAPL"
Assistant:
- **Time Series for AAPL** (Last 30 Days): The stock has been trending upward, with a 10% increase over the period.
[Chart Available]
`;

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to the chat
    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Initialize the Grok model
      const llm = new ChatGroq({
        apiKey: process.env.NEXT_PUBLIC_GROK_API_KEY,
        model: "llama3-8b-8192", // Adjust model name as needed
        temperature: 0.7,
      });

      // Get the chat history for this session
      const chatHistory = chatHistories.get(sessionId);
      if (!chatHistory) {
        throw new Error("Chat history not initialized for this session.");
      }
      await chatHistory.addMessage(new HumanMessage(input));

      // Create the prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ...messages.map((msg) => [msg.role, msg.content]),
        ["human", input],
      ]);

      // Create the chain
      const chain = prompt.pipe(llm);

      // Fetch data from TwelveData if a symbol is mentioned
      let symbol = input.match(/\b[A-Z]+(?:\/[A-Z]+)?\b/)?.[0]; // Extract symbol (e.g., AAPL, EUR/USD, BTC/USD)
      let assetType: "stock" | "forex" | "crypto" | null = null;
      let apiData: any = null;
      let chartData: { labels: string[]; data: number[]; title: string } | undefined = undefined;

      if (symbol) {
        // Determine asset type
        if (symbol.includes("/")) {
          const isCrypto = ["BTC", "ETH", "XRP", "LTC"].some((crypto) => symbol.startsWith(crypto));
          assetType = isCrypto ? "crypto" : "forex";
        } else {
          assetType = "stock";
        }

        // Fetch quote data from TwelveData
        try {
          const response = await axios.get("https://api.twelvedata.com/quote", {
            params: {
              symbol,
              apikey: process.env.TWELVE_DATA_API_KEY,
            },
          });
          apiData = response.data;
        } catch (error) {
          apiData = { error: "Failed to fetch data from TwelveData" };
        }
      }

      // Add API data to the prompt context
      const context = apiData ? JSON.stringify(apiData) : "No API data available";
      const enhancedInput = `${input}\n\nAPI Data: ${context}`;

      // Call the chain with the enhanced input
      const response = await chain.invoke({
        input: enhancedInput,
        chat_history: await chatHistory.getMessages(),
      });

      // Check if the response mentions time series or technical indicators
      const mentionsIndicator =
        response.content.toLowerCase().includes("rsi") ||
        response.content.toLowerCase().includes("macd") ||
        input.toLowerCase().includes("rsi") ||
        input.toLowerCase().includes("macd");
      const mentionsTimeSeries =
        response.content.toLowerCase().includes("time series") ||
        response.content.toLowerCase().includes("trend") ||
        input.toLowerCase().includes("time series") ||
        input.toLowerCase().includes("trend");

      if (symbol && (mentionsIndicator || mentionsTimeSeries)) {
        if (mentionsIndicator && (response.content.toLowerCase().includes("rsi") || input.toLowerCase().includes("rsi"))) {
          // Fetch RSI data
          const rsiResponse = await axios.get("https://api.twelvedata.com/rsi", {
            params: {
              symbol,
              interval: "1day",
              time_period: 14,
              apikey: process.env.TWELVE_DATA_API_KEY,
            },
          });
          const rsiData = rsiResponse.data.values;
          chartData = {
            labels: rsiData.map((entry: any) => entry.datetime).slice(0, 30).reverse(),
            data: rsiData.map((entry: any) => parseFloat(entry.rsi)).slice(0, 30).reverse(),
            title: `RSI for ${symbol} (14-day period)`,
          };
        } else if (mentionsTimeSeries) {
          // Fetch time series data
          const timeSeriesResponse = await axios.get("https://api.twelvedata.com/time_series", {
            params: {
              symbol,
              interval: "1day",
              outputsize: 30,
              apikey: process.env.TWELVE_DATA_API_KEY,
            },
          });
          const timeSeriesData = timeSeriesResponse.data.values;
          chartData = {
            labels: timeSeriesData.map((entry: any) => entry.datetime).reverse(),
            data: timeSeriesData.map((entry: any) => parseFloat(entry.close)).reverse(),
            title: `Price Trend for ${symbol} (Last 30 Days)`,
          };
        }
      }

      // Add assistant response to the chat
      const assistantMessage: Message = {
        role: "assistant",
        content: response.content,
        timestamp: new Date().toLocaleTimeString(),
        chartData,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await chatHistory.addMessage(new SystemMessage(response.content));
    } catch (error) {
      console.error("Error in chatbot:", error);
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      });
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Chart",
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">FinanceAI</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost">Analyze Market</Button>
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
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-64 bg-muted/20 border-r p-4 flex flex-col"
        >
          <h2 className="text-xl font-semibold mb-4">AI Advisor</h2>
          <Button
            onClick={handleClearChat}
            variant="outline"
            className="flex items-center gap-2 border border-muted hover:bg-muted/50"
          >
            <Trash2 className="h-4 w-4" />
            Clear Chat
          </Button>
        </motion.div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center text-muted-foreground"
              >
                <p>Start by asking about a symbol (e.g., "Analyze AAPL" or "What’s the RSI for BTC/USD?").</p>
              </motion.div>
            ) : (
              messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}
                >
                  <div className="flex items-start gap-3 max-w-[80%]">
                    {msg.role === "assistant" && (
                      <div className="p-2 rounded-full bg-gradient-to-br from-pink-600 to-purple-600">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div>
                      <div
                        className={`p-4 rounded-lg ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {msg.chartData && (
                          <div className="mt-4">
                            <Line
                              data={{
                                labels: msg.chartData.labels,
                                datasets: [
                                  {
                                    label: msg.chartData.title,
                                    data: msg.chartData.data,
                                    borderColor: "rgb(219, 39, 119)", // Pink from your theme
                                    backgroundColor: "rgba(219, 39, 119, 0.5)",
                                    tension: 0.1,
                                  },
                                ],
                              }}
                              options={{
                                ...chartOptions,
                                plugins: {
                                  ...chartOptions.plugins,
                                  title: {
                                    display: true,
                                    text: msg.chartData.title,
                                  },
                                },
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="p-2 rounded-full bg-primary">
                        <span className="text-primary-foreground font-semibold">You</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Larger Chat Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="p-6 border-t bg-background"
          >
            <div className="max-w-full mx-auto flex items-end gap-3">
              <Textarea
                placeholder="Ask about a symbol (e.g., AAPL, EUR/USD, BTC/USD)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                className="flex-1 min-h-[120px] border border-muted rounded-lg focus:ring-2 focus:ring-primary resize-none"
                disabled={loading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 h-14 px-8 text-lg"
              >
                {loading ? (
                  <span className="flex items-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center">
                    Send <Send className="h-6 w-6 ml-2" />
                  </span>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}