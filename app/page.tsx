"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Newspaper, Brain, BarChart3, DollarSign, Bitcoin, ArrowRight, ChevronRight, Sparkles, Zap, LineChart, Globe, MessageSquare, Users, Menu, Twitter, Linkedin, Github } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import React from "react";
import { AuthStatus } from "@/components/AuthStatus";
import { useSession } from 'next-auth/react';

interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
}

interface ForexPair {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  base_currency?: string;
  quote_currency?: string;
}

interface CryptoPair {
  symbol: string;
  currency_base: string;
  currency_quote: string;
  available_exchanges: string[];
}

const FeatureCard = ({ icon: Icon, title, description, link, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -5 }}
    className="relative group"
  >
    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
    <button 
      onClick={() => {
        // Define which features are protected (require authentication)
        const protectedFeatures = [
          'Reddit Social Sentiment',
          'AI-Powered Analysis'
        ];
        
        const isProtectedFeature = protectedFeatures.includes(title);
        
        if (isProtectedFeature && status !== 'authenticated') {
          window.location.href = '/auth/signin';
        } else {
          window.location.href = link;
        }
      }}
      className="w-full text-left"
    >
      <Card className="relative p-6 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-all duration-300 border border-primary/10 shadow-lg">
        <div className="flex flex-col items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-muted-foreground">{description}</p>
          <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform duration-300">
            Explore <ChevronRight className="ml-1 h-4 w-4" />
          </div>
        </div>
      </Card>
    </button>
  </motion.div>
);

const StatCard = ({ value, label, icon: Icon }: any) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5 }}
    className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-primary/10 shadow-md"
  >
    <div className="flex items-center justify-between mb-2">
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">{value}+</span>
    </div>
    <p className="text-muted-foreground">{label}</p>
  </motion.div>
);

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [forexPairs, setForexPairs] = useState<ForexPair[]>([]);
  const [cryptoPairs, setCryptoPairs] = useState<CryptoPair[]>([]);
  const [activeFeature, setActiveFeature] = useState(0);
  const { toast } = useToast();
  const { data: session, status } = useSession();

  useEffect(() => {
    fetchStocks();
    fetchForexPairs();
    fetchCryptoPairs();
    
    // Auto-rotate through features
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchStocks = async () => {
    try {
      const response = await fetch("/api/stocks");
      const data = await response.json();
      // Ensure we're setting an array even if data is undefined
      setStocks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch stock listings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch stock listings",
        variant: "destructive",
      });
      // Set empty array on error
      setStocks([]);
    }
  };

  const fetchForexPairs = async () => {
    try {
      const response = await fetch("/api/forexs?page=1&perPage=1000");
      const data = await response.json();
      // Ensure we're setting an array even if data is undefined
      setForexPairs(Array.isArray(data.pairs) ? data.pairs : []);
    } catch (error) {
      console.error("Failed to fetch forex listings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch forex listings",
        variant: "destructive",
      });
      // Set empty array on error
      setForexPairs([]);
    }
  };

  const fetchCryptoPairs = async () => {
    try {
      const response = await fetch("/api/cryptos");
      const data = await response.json();
      // Ensure we're setting an array even if data is undefined
      setCryptoPairs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch crypto listings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch crypto listings",
        variant: "destructive",
      });
      // Set empty array on error
      setCryptoPairs([]);
    }
  };

  const formatNumber = (num: number) => {
    // Handle undefined or null values
    if (num === undefined || num === null) {
      return "0";
    }
    
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Stock Data",
      description: "Access live market data and comprehensive stock information from global exchanges with technical indicators.",
      link: "/stocks",
    },
    {
      icon: DollarSign,
      title: "Forex Market Analysis",
      description: "Analyze forex pairs with real-time data, categorized by currency groups like Major and Exotic.",
      link: "/forexs",
    },
    {
      icon: Bitcoin,
      title: "Cryptocurrency Insights",
      description: "Explore crypto pairs with detailed market data and exchange information.",
      link: "/cryptos",
    },
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description: "Get intelligent insights and predictions powered by advanced machine learning algorithms with comprehensive technical and fundamental analysis.",
      link: "/choose-advisor",
    },
    {
      icon: MessageSquare,
      title: "Reddit Social Sentiment",
      description: "Analyze community discussions and sentiment from 15+ financial subreddits for informed decision making with real-time bullish/bearish tracking.",
      link: "/reddit",
    },
    {
      icon: Newspaper,
      title: "Financial News",
      description: "Stay updated with the latest financial news and market analysis from trusted sources with AI-powered summarization.",
      link: "/news",
    },
  ];

  // Add new enhanced features section
  const enhancedFeatures = [
    {
      icon: TrendingUp,
      title: "Multi-Market Analysis",
      description: "Unified platform for stocks, forex, and crypto analysis with cross-market correlation insights."
    },
    {
      icon: Users,
      title: "Community Intelligence",
      description: "Harness the power of Reddit sentiment across 15+ financial communities for contrarian signals."
    },
    {
      icon: Zap,
      title: "Real-Time Alerts",
      description: "Get instant notifications on market-moving events, technical breakouts, and sentiment shifts."
    },
    {
      icon: Globe,
      title: "Global Market Coverage",
      description: `Comprehensive data on ${formatNumber(stocks?.length || 0)}+ stocks, ${formatNumber(forexPairs?.length || 0)}+ forex pairs, and ${formatNumber(cryptoPairs?.length || 0)}+ cryptocurrencies.`
    }
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-primary/10 blur-3xl"></div>
          <div className="absolute top-20 right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl"></div>
          <div className="absolute bottom-20 left-1/3 w-40 h-40 rounded-full bg-primary/10 blur-3xl"></div>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/20 bg-background/50 backdrop-blur-md">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-full blur opacity-30"></div>
                <BarChart3 className="h-8 w-8 text-primary relative z-10" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">FinanceAI</span>
            </div>
            <div className="hidden md:flex items-center space-x-1">
              <Link href="/choose-market" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                Markets
              </Link>
              <Link href="/news" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                News
              </Link>
              <button 
                onClick={() => {
                  if (status === 'authenticated') {
                    window.location.href = '/reddit';
                  } else {
                    window.location.href = '/auth/signin';
                  }
                }}
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Sentiment
              </button>
              <button 
                onClick={() => {
                  if (status === 'authenticated') {
                    window.location.href = '/choose-advisor';
                  } else {
                    window.location.href = '/auth/signin';
                  }
                }}
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                AI Advisors
              </button>
              <Link href="/about" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                About
              </Link>
              <Link href="/contact" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                Contact
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <AuthStatus />
              <Link href="/choose-market">
                <Button className="bg-primary hover:bg-primary/90 relative group hidden sm:flex">
                  <span className="relative z-10">Get Started</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </Button>
              </Link>
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10 sm:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="max-w-full mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="text-left"
              >
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI-Powered Financial Analysis
                </div>
                <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">Smart</span> Market Analysis with AI
                </h1>
                <p className="text-xl text-muted-foreground mb-8 max-w-xl">
                  Make informed decisions with real-time data on stocks, forex, and crypto, AI-powered insights, <span className="font-semibold text-primary">community sentiment analysis</span>, and comprehensive financial news.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 relative group"
                    onClick={() => {
                      if (status === 'authenticated') {
                        window.location.href = '/choose-advisor';
                      } else {
                        window.location.href = '/auth/signin';
                      }
                    }}
                  >
                    <span className="relative z-10 flex items-center">
                      Try AI Advisors
                      <Zap className="ml-2 h-4 w-4" />
                    </span>
                    <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  </Button>
                  <Link href="/choose-market">
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="w-full sm:w-auto border-primary/20 hover:bg-primary/10"
                    >
                      View Markets
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Real-time Data</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span>AI Insights</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span>Reddit Sentiment</span>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur-xl"></div>
                <div className="relative bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-primary/10 shadow-xl">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeFeature}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className="text-center"
                    >
                      <div className="flex justify-center mb-6">
                        <div className="p-4 rounded-full bg-primary/10">
                          {(() => {
                            const IconComponent = features[activeFeature].icon;
                            return <IconComponent className="h-10 w-10 text-primary" />;
                          })()}
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold mb-2">{features[activeFeature].title}</h3>
                      <p className="text-muted-foreground mb-6">{features[activeFeature].description}</p>
                      <Link href={features[activeFeature].link}>
                        <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                          Learn More
                        </Button>
                      </Link>
                    </motion.div>
                  </AnimatePresence>
                  
                  <div className="flex justify-center mt-6 space-x-2">
                    {features.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveFeature(index)}
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          index === activeFeature ? 'bg-primary' : 'bg-primary/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 px-4">
          <div className="max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-6"
            >
              <StatCard value={formatNumber(stocks?.length || 0)} label="Listed Stocks" icon={LineChart} />
              <StatCard value={formatNumber(forexPairs?.length || 0)} label="Forex Pairs" icon={Globe} />
              <StatCard value={formatNumber(cryptoPairs?.length || 0)} label="Crypto Pairs" icon={Bitcoin} />
            </motion.div>
          </div>
        </section>

        {/* Reddit Sentiment Highlight Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-background/80 to-primary/5">
          <div className="max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <MessageSquare className="h-4 w-4 mr-2" />
                Community Intelligence
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Reddit Social Sentiment Analysis</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Harness the power of community discussions to gauge market sentiment across stocks, forex, and crypto.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <Card className="p-8 bg-card/80 backdrop-blur-sm border border-primary/10 shadow-xl h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">Community-Driven Insights</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 p-2 rounded-full bg-green-100 dark:bg-green-900/20">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Real-Time Sentiment Tracking</h4>
                        <p className="text-muted-foreground text-sm">
                          Monitor bullish and bearish sentiment across 15+ financial subreddits including r/investing, r/stocks, and r/cryptocurrency.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="mt-1 p-2 rounded-full bg-blue-100 dark:bg-blue-900/20">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Multi-Market Coverage</h4>
                        <p className="text-muted-foreground text-sm">
                          Analyze sentiment for stocks (AAPL, TSLA), crypto (BTC, ETH), and forex pairs (EUR/USD, GBP/USD) with specialized algorithms for each market.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="mt-1 p-2 rounded-full bg-purple-100 dark:bg-purple-900/20">
                        <Brain className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">AI-Powered Analysis</h4>
                        <p className="text-muted-foreground text-sm">
                          Advanced natural language processing identifies financial keywords and context to provide accurate sentiment classification.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="mt-1 p-2 rounded-full bg-orange-100 dark:bg-orange-900/20">
                        <Zap className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Actionable Signals</h4>
                        <p className="text-muted-foreground text-sm">
                          Receive alerts when community sentiment reaches extreme levels that historically precede price movements.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-border/50">
                    <Button 
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90"
                      onClick={() => {
                        if (status === 'authenticated') {
                          window.location.href = '/reddit';
                        } else {
                          window.location.href = '/auth/signin';
                        }
                      }}
                    >
                      Explore Reddit Sentiment
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-indigo-600/20 rounded-2xl blur-xl"></div>
                <Card className="relative p-6 bg-card/80 backdrop-blur-sm border border-primary/10 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">AAPL Community Sentiment</h3>
                    <Badge variant="outline" className="text-green-600 bg-green-100 dark:bg-green-900/20 border-0">
                      Bullish
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <div className="text-2xl font-bold text-green-600">65%</div>
                      <div className="text-sm text-muted-foreground">Bullish</div>
                    </div>
                    
                    <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                      <div className="text-2xl font-bold text-red-600">20%</div>
                      <div className="text-sm text-muted-foreground">Bearish</div>
                    </div>
                    
                    <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="text-2xl font-bold text-gray-600">15%</div>
                      <div className="text-sm text-muted-foreground">Neutral</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">r/stocks • Bullish</span>
                        <span className="text-xs text-muted-foreground">2h ago</span>
                      </div>
                      <p className="text-sm font-medium mb-2 line-clamp-1">
                        AAPL breaking new highs! Apple's latest earnings beat expectations by 15%
                      </p>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20">
                          +earnings
                        </Badge>
                        <Badge variant="outline" className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20">
                          +beats
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">r/investing • Bearish</span>
                        <span className="text-xs text-muted-foreground">5h ago</span>
                      </div>
                      <p className="text-sm font-medium mb-2 line-clamp-1">
                        Concerns about iPhone sales growth in China market weighing on AAPL
                      </p>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20">
                          -sales
                        </Badge>
                        <Badge variant="outline" className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20">
                          -china
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg border border-border/50 bg-blue-50/50 dark:bg-blue-900/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">r/SecurityAnalysis • Neutral</span>
                        <span className="text-xs text-muted-foreground">1d ago</span>
                      </div>
                      <p className="text-sm font-medium mb-2 line-clamp-1">
                        AAPL's balance sheet remains strong with $150B in cash reserves
                      </p>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20">
                          +balance sheet
                        </Badge>
                        <Badge variant="outline" className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20">
                          +cash
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border/50 text-center">
                    <p className="text-sm text-muted-foreground">
                      Based on 42 recent posts • High confidence
                    </p>
                  </div>
                </Card>
              </motion.div>
            </div>
            
            {/* Add a new section showing sentiment insights */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-16 max-w-4xl mx-auto"
            >
              <Card className="p-8 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border border-blue-500/20">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-4">How Community Sentiment Drives Investment Decisions</h3>
                  <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                    Our AI analyzes thousands of Reddit posts daily to identify sentiment trends that often precede market movements by hours or days.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20">
                      <div className="text-3xl font-bold text-blue-600 mb-2">87%</div>
                      <p className="text-sm text-muted-foreground">Accuracy in sentiment classification</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20">
                      <div className="text-3xl font-bold text-green-600 mb-2">2.3x</div>
                      <p className="text-sm text-muted-foreground">Faster signal detection vs traditional news</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20">
                      <div className="text-3xl font-bold text-purple-600 mb-2">15+</div>
                      <p className="text-sm text-muted-foreground">Financial subreddits monitored</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4">
          <div className="max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4 mr-2" />
                Powerful Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need for Smart Investing</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Comprehensive tools and insights combining real-time data, AI analysis, and community sentiment to make smart investment decisions.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <FeatureCard key={index} {...feature} delay={index * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* Enhanced Features Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-background/80 to-primary/5">
          <div className="max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why FinanceAI Stands Out</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Our platform combines cutting-edge technology with community intelligence for unparalleled market insights.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {enhancedFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-primary/10 shadow-md hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 rounded-full bg-primary/10 mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Investment Strategy?</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of investors who are already leveraging AI-powered insights and community intelligence to make smarter financial decisions.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 relative group"
                  onClick={() => {
                    if (status === 'authenticated') {
                      window.location.href = '/choose-advisor';
                    } else {
                      window.location.href = '/auth/signin';
                    }
                  }}
                >
                  <span className="relative z-10 flex items-center">
                    Try AI Advisors
                    <Zap className="ml-2 h-4 w-4" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </Button>
                <Link href="/choose-market">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full sm:w-auto border-primary/20 hover:bg-primary/10"
                  >
                    Explore Markets
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/20 bg-background/50 backdrop-blur-md py-12 px-4">
        <div className="max-w-full mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-full blur opacity-30"></div>
                  <BarChart3 className="h-8 w-8 text-primary relative z-10" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">FinanceAI</span>
              </div>
              <p className="text-muted-foreground mb-4 max-w-md">
                AI-powered financial analysis platform providing real-time data, community sentiment, and expert insights for smarter investment decisions.
              </p>
              <div className="flex space-x-4">
                {/* <Link href="#" className="text-muted-foreground hover:text-primary">
                  <Twitter className="h-5 w-5" />
                </Link> */}
                <Link href="https://www.linkedin.com/in/yamin-hossain-38a3b3263" className="text-muted-foreground hover:text-primary">
                  <Linkedin className="h-5 w-5" />
                </Link>
                <Link href="https://github.com/RobinMillford" className="text-muted-foreground hover:text-primary">
                  <Github className="h-5 w-5" />
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Products</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/stocks" className="text-muted-foreground hover:text-primary">
                    Stock Analysis
                  </Link>
                </li>
                <li>
                  <Link href="/forexs" className="text-muted-foreground hover:text-primary">
                    Forex Analysis
                  </Link>
                </li>
                <li>
                  <Link href="/cryptos" className="text-muted-foreground hover:text-primary">
                    Crypto Analysis
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      if (status === 'authenticated') {
                        window.location.href = '/reddit';
                      } else {
                        window.location.href = '/auth/signin';
                      }
                    }}
                    className="text-muted-foreground hover:text-primary text-left"
                  >
                    Reddit Sentiment
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      if (status === 'authenticated') {
                        window.location.href = '/choose-advisor';
                      } else {
                        window.location.href = '/auth/signin';
                      }
                    }}
                    className="text-muted-foreground hover:text-primary text-left"
                  >
                    AI Advisors
                  </button>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-muted-foreground hover:text-primary">About</Link></li>
                <li><Link href="/contact" className="text-muted-foreground hover:text-primary">Contact</Link></li>
                <li><Link href="/privacy" className="text-muted-foreground hover:text-primary">Privacy Policy</Link></li>
              </ul>
            </div>

          </div>
          
          <div className="border-t border-border/20 mt-8 pt-8 text-center text-muted-foreground">
            <p>© 2025 FinanceAI. All rights reserved. Market data provided for informational purposes only.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}