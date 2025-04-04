"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Newspaper, Brain, BarChart3, DollarSign, Bitcoin, ArrowRight, ChevronRight, Sparkles, Zap, LineChart, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import React from "react";

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
    <Link href={link}>
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
    </Link>
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
      setStocks(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch stock listings",
        variant: "destructive",
      });
    }
  };

  const fetchForexPairs = async () => {
    try {
      const response = await fetch("/api/forexs?page=1&perPage=1000");
      const data = await response.json();
      setForexPairs(data.pairs || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch forex listings",
        variant: "destructive",
      });
    }
  };

  const fetchCryptoPairs = async () => {
    try {
      const response = await fetch("/api/cryptos");
      const data = await response.json();
      setCryptoPairs(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch crypto listings",
        variant: "destructive",
      });
    }
  };

  const features = [
    {
      icon: BarChart3,
      title: "Real-Time Stock Data",
      description: "Access live market data and comprehensive stock information from global exchanges.",
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
      description: "Get intelligent insights and predictions powered by advanced machine learning algorithms.",
      link: "/choose-advisor",
    },
    {
      icon: Newspaper,
      title: "Financial News",
      description: "Stay informed with the latest market news and expert analysis.",
      link: "/news",
    },
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
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" className="hover:bg-primary/10">Analyze Markets</Button>
              </Link>
              <Link href="/news">
                <Button variant="ghost" className="hover:bg-primary/10">News</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" className="hover:bg-primary/10">AI Advisors</Button>
              </Link>
              <Link href="/choose-market">
                <Button className="bg-primary hover:bg-primary/90 relative group">
                  <span className="relative z-10">Get Started</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </Button>
              </Link>
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
                  Make informed decisions with real-time data on stocks, forex, and crypto, AI-powered insights, and comprehensive financial news analysis.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/choose-advisor">
                    <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 relative group">
                      <span className="relative z-10 flex items-center">
                        Try AI Advisors
                        <Zap className="ml-2 h-4 w-4" />
                      </span>
                      <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    </Button>
                  </Link>
                  <Link href="/choose-market">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary/20 hover:bg-primary/10">
                      View Markets
                    </Button>
                  </Link>
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
              <StatCard value={stocks.length || 0} label="Listed Stocks" icon={LineChart} />
              <StatCard value={forexPairs.length || 0} label="Forex Pairs" icon={Globe} />
              <StatCard value={cryptoPairs.length || 0} label="Crypto Pairs" icon={Bitcoin} />
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
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Comprehensive tools and insights to make smart investment decisions.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <FeatureCard key={index} {...feature} delay={index * 0.1} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}