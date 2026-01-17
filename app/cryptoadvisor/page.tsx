"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { 
  Bitcoin, 
  Send, 
  Loader2, 
  Trash2, 
  Clock, 
  Menu, 
  Plus, 
  X,
  TrendingUp,
  MessageSquare,
  Globe,
  CheckCircle2
} from "lucide-react";
import { useSession } from "next-auth/react";

// Theme colors
const orange500 = "#F97316";
const yellow600 = "#CA8A04";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agentSteps?: AgentStep[];
}

interface AgentStep {
  agent: string;
  status: string;
  message: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

// Agent metadata for UI display
const AGENT_CONFIG = {
  supervisor: {
    name: "Supervisor",
    icon: Globe,
    color: "bg-blue-500",
    label: "Routing query...",
  },
  TechnicalAnalyst: {
    name: "Technical Analyst",
    icon: TrendingUp,
    color: "bg-green-500",
    label: "Analyzing price & indicators...",
  },
  SentimentAnalyst: {
    name: "Sentiment Analyst",
    icon: MessageSquare,
    color: "bg-purple-500",
    label: "Analyzing social sentiment...",
  },
  MarketResearcher: {
    name: "Market Researcher",
    icon: Globe,
    color: "bg-orange-500",
    label: "Researching market intelligence...",
  },
  finalResponse: {
    name: "Synthesizing",
    icon: CheckCircle2,
    color: "bg-yellow-500",
    label: "Generating final response...",
  },
};

export default function CryptoAdvisor() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/signin';
    }
  }, [status]);

  // Initialize first chat
  useEffect(() => {
    const initialMessage: Message = {
      role: "assistant",
      content: `Hey there! I'm your **AI-Powered Crypto Advisor** with specialized agents ready to help you:\n\n🔍 **Technical Analyst**: Price analysis, RSI, MACD, indicators\n💬 **Sentiment Analyst**: Reddit sentiment, community mood\n📰 **Market Researcher**: News, regulations, market intelligence\n\nAsk me anything—like "How's Bitcoin doing?" or "Analyze Ethereum"—and watch my agents work together to provide comprehensive insights!`,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (chatSessions.length === 0) {
      const newSession: ChatSession = {
        id: currentChatId,
        title: "Welcome Chat",
        messages: [initialMessage],
      };
      setChatSessions([newSession]);
      setMessages([initialMessage]);
    }
  }, []);

  // Sync messages with current session
  useEffect(() => {
    const currentSession = chatSessions.find((session) => session.id === currentChatId);
    if (currentSession) {
      setMessages(currentSession.messages);
    } else {
      setMessages([]);
    }
  }, [currentChatId, chatSessions]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, agentSteps]);

  // Handle sidebar responsiveness
  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleClearChat = () => {
    setMessages([]);
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === currentChatId ? { ...session, messages: [] } : session
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

    // Update messages state
    setMessages((prev) => {
      const updatedMessages = [...prev, userMessage];
      setTimeout(() => {
        setChatSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === currentChatId ? { ...session, messages: updatedMessages } : session
          )
        );
      }, 0);
      return updatedMessages;
    });

    // Generate title for first message
    if (messages.filter((msg) => msg.role === "user").length === 0) {
      const cryptoMatch = input.match(/\b(bitcoin|btc|ethereum|eth|crypto|[A-Z]{3,5}\/[A-Z]{3,5})\b/i);
      const newTitle = cryptoMatch 
        ? `Query about ${cryptoMatch[0].toUpperCase()}`
        : `Chat ${chatSessions.length}`;
      
      setChatSessions((prev) =>
        prev.map((session) =>
          session.id === currentChatId ? { ...session, title: newTitle } : session
        )
      );
    }

    const userInput = input;
    setInput("");
    setLoading(true);
    setAgentSteps([]);
    setCurrentAgent(null);

    try {
      // Call the streaming API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.details 
            ? `${errorData.error}: ${errorData.details}`
            : `API error: ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalResponse = "";
      const steps: AgentStep[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "agent") {
                  // Update current agent
                  setCurrentAgent(data.agent);
                  
                  // Add agent step
                  const step: AgentStep = {
                    agent: data.agent,
                    status: data.status,
                    message: data.message,
                    timestamp: new Date().toLocaleTimeString(),
                  };
                  steps.push(step);
                  setAgentSteps([...steps]);
                } else if (data.type === "final") {
                  // Final response received
                  finalResponse = data.message;
                  setCurrentAgent(null);
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE data:", line);
              }
            }
          }
        }
      }

      // Add assistant message with agent steps
      const assistantMessage: Message = {
        role: "assistant",
        content: finalResponse || "Analysis complete.",
        timestamp: new Date().toLocaleTimeString(),
        agentSteps: steps,
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

      setAgentSteps([]);
    } catch (error) {
      console.error("Error in chat:", error);
      
      const errorMessage: Message = {
        role: "assistant",
        content: `🔧 **Error**: ${error instanceof Error ? error.message : "An error occurred"}. Please try again.`,
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

      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setCurrentAgent(null);
      setAgentSteps([]);
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
              <span className="text-2xl font-bold" style={{ color: "white" }}>AI Crypto Advisor</span>
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
                  className="mb-4 w-full"
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
                  {/* Message Content */}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {message.content.split('\n').map((line, i) => {
                      if (!line.trim()) return null;
                      
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
                      } else {
                        return <p key={i} className="mb-2">{line}</p>;
                      }
                    })}
                  </div>

                  {/* Agent Steps Display */}
                  {message.role === "assistant" && message.agentSteps && message.agentSteps.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-orange-600 dark:text-orange-400 mb-2">
                          🤖 View Agent Workflow ({message.agentSteps.length} steps)
                        </summary>
                        <div className="mt-2 space-y-2">
                          {message.agentSteps.map((step, idx) => {
                            const config = AGENT_CONFIG[step.agent as keyof typeof AGENT_CONFIG];
                            const Icon = config?.icon || Globe;
                            
                            return (
                              <div key={idx} className="flex items-start space-x-2 text-xs">
                                <Badge className={`${config?.color || 'bg-gray-500'} text-white`}>
                                  <Icon className="h-3 w-3 mr-1" />
                                  {config?.name || step.agent}
                                </Badge>
                                <span className="flex-1">{step.message}</span>
                                <span className="text-gray-500">{step.timestamp}</span>
                              </div>
                            );
                          })}
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

            {/* Live Agent Status */}
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md max-w-[85%]">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: yellow600 }} />
                    <div className="flex-1">
                      {currentAgent && AGENT_CONFIG[currentAgent as keyof typeof AGENT_CONFIG] ? (
                        <div className="flex items-center space-x-2">
                          <Badge className={`${AGENT_CONFIG[currentAgent as keyof typeof AGENT_CONFIG].color} text-white`}>
                            {(() => {
                              const Icon = AGENT_CONFIG[currentAgent as keyof typeof AGENT_CONFIG].icon;
                              return <Icon className="h-3 w-3 mr-1" />;
                            })()}
                            {AGENT_CONFIG[currentAgent as keyof typeof AGENT_CONFIG].name}
                          </Badge>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {AGENT_CONFIG[currentAgent as keyof typeof AGENT_CONFIG].label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-400">Processing your query...</span>
                      )}
                    </div>
                  </div>

                  {/* Agent Steps Progress */}
                  {agentSteps.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {agentSteps.map((step, idx) => {
                        const config = AGENT_CONFIG[step.agent as keyof typeof AGENT_CONFIG];
                        return (
                          <div key={idx} className="flex items-center space-x-2 text-xs text-gray-500">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            <span>{config?.name || step.agent}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                  <Trash2 className="h-4 w-4 mr-2" /> Clear
                </Button>
              </motion.div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything—like 'Analyze Bitcoin' or 'What's ETH sentiment?'"
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
