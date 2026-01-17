"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Send, Loader2, TrendingUp, Trash2, X, Menu, Plus, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";

const blue500 = "#3B82F6";
const indigo600 = "#4F46E5";

const AGENT_CONFIG = {
  Supervisor: { color: "bg-purple-500", label: "Supervisor", icon: "🎯" },
  TechnicalAnalyst: { color: "bg-blue-500", label: "Technical Analyst", icon: "📊" },
  SentimentAnalyst: { color: "bg-green-500", label: "Sentiment Analyst", icon: "💭" },
  MarketResearcher: { color: "bg-orange-500", label: "Market Researcher", icon: "🔍" },
  FinalResponse: { color: "bg-indigo-600", label: "Final Response", icon: "✨" },
  finalResponse: { color: "bg-indigo-600", label: "Final Response", icon: "✨" },
};

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

interface AgentStatus {
  agent: string;
  status: string;
  timestamp: string;
}

export default function StockAdvisor() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/signin';
    }
  }, [status]);

  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: `Hey there! I'm your Stock Buddy, powered by a team of AI specialists. Ask me anything about US stocks—like "Analyze AAPL" or "What's the RSI for TSLA?"—and my team will provide comprehensive analysis. What's on your mind?`,
      timestamp: new Date().toLocaleTimeString(),
    };

    const sessionExists = chatSessions.some(s => s.id === currentChatId);
    if (!sessionExists) {
      const newSession: ChatSession = {
        id: currentChatId,
        title: "Welcome Chat",
        messages: [initialMessage],
      };
      setChatSessions((prev) => {
        if (prev.some(s => s.id === currentChatId)) {
          return prev;
        }
        return [...prev, newSession];
      });
      setMessages([initialMessage]);
    }
  }, [currentChatId, chatSessions]);

  useEffect(() => {
    const currentSession = chatSessions.find((session) => session.id === currentChatId);
    setMessages(currentSession?.messages ?? []);
  }, [currentChatId, chatSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentStatuses]);

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
    setAgentStatuses([]);
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
    const newSession: ChatSession = {
      id: newChatId,
      title: `Chat ${chatSessions.length + 1}`,
      messages: [],
    };
    setChatSessions((prev) => [...prev, newSession]);
    setCurrentChatId(newChatId);
    setMessages([]);
    setAgentStatuses([]);
  };

  const handleSwitchChat = (chatId: string) => {
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === currentChatId ? { ...session, messages } : session
      )
    );
    setCurrentChatId(chatId);
    setAgentStatuses([]);
  };

  const handleDeleteChat = (chatId: string) => {
    if (chatSessions.length === 1) {
      handleNewChat();
    }
    setChatSessions((prev) => {
      const updatedSessions = prev.filter((session) => session.id !== chatId);
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
      const symbolMatch = input.match(/\b[A-Z]{1,5}\b/)?.[0];
      if (symbolMatch) {
        newTitle = input.toLowerCase().includes("analyz")
          ? `Analysis for ${symbolMatch}`
          : `Query for ${symbolMatch}`;
      }
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === currentChatId ? { ...session, title: newTitle } : session
        )
      );
    }

    setInput("");
    setLoading(true);
    setAgentStatuses([]);
    setShowAgentPanel(true);

    try {
      const response = await fetch("/api/stock-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "agent") {
                setAgentStatuses((prev) => [
                  ...prev,
                  {
                    agent: data.agent,
                    status: data.message,
                    timestamp: new Date(data.timestamp).toLocaleTimeString(),
                  },
                ]);
              } else if (data.type === "final") {
                finalContent = data.message;
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error("Error parsing SSE data:", parseError);
            }
          }
        }
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: finalContent || "Analysis complete.",
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
    } catch (error) {
      console.error("Error in chatbot:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `🔧 **Error**: ${error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}`,
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
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b" style={{ background: `linear-gradient(to right, ${blue500}, ${indigo600})` }}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={toggleSidebar} className="lg:hidden" style={{ color: "white" }}>
                <Menu className="h-6 w-6" />
              </Button>
              <TrendingUp className="h-8 w-8" style={{ color: "white" }} />
              <span className="text-2xl font-bold" style={{ color: "white" }}>Stock Advisor (US Only)</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" style={{ color: "white" }}>All Markets</Button>
              </Link>
              <Link href="/stocks">
                <Button variant="ghost" style={{ color: "white" }}>Stock Market</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" style={{ color: "white" }}>Other Advisors</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" style={{ borderColor: "white", color: blue500 }}>Back Home</Button>
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
                <h2 className="text-lg font-semibold" style={{ color: indigo600 }}>Chat History</h2>
                <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden" style={{ color: indigo600 }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleNewChat}
                  className="mb-4 w-full"
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
                    <div className="flex-1" onClick={() => handleSwitchChat(session.id)}>
                      <span className="text-sm font-medium" style={{ color: indigo600 }}>{session.title}</span>
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
          {showAgentPanel && agentStatuses.length > 0 && (
            <div className="border-b p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">🤖 View Agent Workflow ({agentStatuses.length} steps)</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAgentPanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {agentStatuses.map((status, idx) => {
                  const config = AGENT_CONFIG[status.agent as keyof typeof AGENT_CONFIG];
                  return (
                    <Badge
                      key={idx}
                      className={`${config?.color || "bg-gray-500"} text-white text-xs`}
                    >
                      <span className="mr-1">{config?.icon || "🤖"}</span>
                      <span className="font-medium">{config?.label || status.agent}</span>
                      <span className="mx-1">•</span>
                      <span className="opacity-90">{status.status.slice(0, 30)}</span>
                      <span className="ml-2 opacity-75">{status.timestamp}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
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
                    message.role === "user"
                      ? "text-white"
                      : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  }`}
                  style={{
                    background: message.role === "user" ? `linear-gradient(to right, ${blue500}, ${indigo600})` : undefined,
                  }}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {message.content}
                  </div>
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
                <Button
                  variant="outline"
                  onClick={handleClearChat}
                  style={{ borderColor: blue500, color: blue500 }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Clear
                </Button>
              </motion.div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a US stock (e.g., 'Analyze AAPL', 'What's the RSI for TSLA?')"
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
