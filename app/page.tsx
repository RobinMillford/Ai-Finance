"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Newspaper, Brain, BarChart3, DollarSign, Bitcoin, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

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

const FeatureCard = ({ icon: Icon, title, description, link }: any) => (
  <motion.div whileHover={{ scale: 1.05, rotateY: 10 }} className="relative group">
    <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
    <Link href={link}>
      <Card className="relative p-6 bg-card hover:bg-card/80 transition-colors">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>
        <p className="text-muted-foreground mb-4">{description}</p>
        <div className="flex items-center text-primary hover:text-primary/80">
          Learn more <ArrowRight className="ml-2 h-4 w-4" />
        </div>
      </Card>
    </Link>
  </motion.div>
);

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [forexPairs, setForexPairs] = useState<ForexPair[]>([]);
  const [cryptoPairs, setCryptoPairs] = useState<CryptoPair[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchStocks();
    fetchForexPairs();
    fetchCryptoPairs();
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
      link: "/advisor",
    },
    {
      icon: Newspaper,
      title: "Financial News",
      description: "Stay informed with the latest market news and expert analysis.",
      link: "/news",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
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
              <Link href="/advisor">
                <Button variant="ghost">AI Advisor</Button>
              </Link>
              <Link href="/choose-market">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="max-w-full mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">
                Smart Market Analysis with AI
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Make informed decisions with real-time data on stocks, forex, and crypto, AI-powered insights, and comprehensive financial news analysis.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex justify-center gap-4"
            >
              <Link href="/advisor">
                <Button size="lg" className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700">
                  Try AI Advisor
                </Button>
              </Link>
              <Link href="/choose-market">
                <Button size="lg" variant="outline">
                  View Markets
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 bg-muted/50">
          <div className="max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Everything you need to make smart investment decisions in one place.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                >
                  <FeatureCard {...feature} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 px-4">
          <div className="max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center"
            >
              <div>
                <h3 className="text-4xl md:text-5xl font-bold mb-2">{stocks.length || 0}+</h3>
                <p className="text-lg md:text-xl text-muted-foreground">Listed Stocks</p>
              </div>
              <div>
                <h3 className="text-4xl md:text-5xl font-bold mb-2">{forexPairs.length || 0}+</h3>
                <p className="text-lg md:text-xl text-muted-foreground">Forex Pairs</p>
              </div>
              <div>
                <h3 className="text-4xl md:text-5xl font-bold mb-2">{cryptoPairs.length || 0}+</h3>
                <p className="text-lg md:text-xl text-muted-foreground">Crypto Pairs</p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}