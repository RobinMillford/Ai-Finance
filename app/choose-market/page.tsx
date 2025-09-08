"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, Bitcoin, ArrowRight, ChevronRight, Sparkles, Zap, LineChart, Globe, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Market data for the cards
const markets = [
  {
    icon: BarChart3,
    title: "Stocks",
    description: "Analyze real-time stock data from global exchanges with detailed insights and technical indicators.",
    link: "/stocks",
    color: "blue",
    gradient: "from-blue-500 to-indigo-600",
    features: ["Real-time data", "Technical indicators", "Historical analysis", "Market trends"],
  },
  {
    icon: DollarSign,
    title: "Forex",
    description: "Dive into forex market analysis with real-time data on major, minor, and exotic currency pairs.",
    link: "/forexs",
    color: "green",
    gradient: "from-green-500 to-emerald-600",
    features: ["Major pairs", "Minor pairs", "Exotic pairs", "Currency strength"],
  },
  {
    icon: Bitcoin,
    title: "Crypto",
    description: "Explore cryptocurrency pairs with comprehensive market data and exchange information.",
    link: "/cryptos",
    color: "orange",
    gradient: "from-orange-500 to-yellow-600",
    features: ["Popular coins", "Exchange data", "Market cap", "Trading volume"],
  },
];

// Market Card Component
const MarketCard = ({ icon: Icon, title, description, link, gradient, features, color, isActive, onClick }: any) => {
  // Function to get the correct bullet point color class
  const getBulletPointClass = () => {
    switch (color) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-green-500";
      case "orange":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  // Function to get the correct border color class for detail view
  const getBorderClass = () => {
    switch (color) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-green-500";
      case "orange":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className={`relative group cursor-pointer ${isActive ? 'z-10' : 'z-0'}`}
      onClick={onClick}
    >
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500`}></div>
      <Card className={`relative p-6 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-all duration-300 border border-primary/10 shadow-lg ${isActive ? 'ring-2 ring-primary' : ''}`}>
        <div className="flex flex-col items-start gap-4">
          <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient} shadow-md`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-muted-foreground">{description}</p>
          <ul className="space-y-2 mt-2">
            {features.map((feature: string, index: number) => (
              <li key={index} className="flex items-center text-sm text-muted-foreground">
                <div className={`w-1.5 h-1.5 rounded-full ${getBulletPointClass()} mr-2`}></div>
                {feature}
              </li>
            ))}
          </ul>
          <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform duration-300 mt-2">
            Explore <ChevronRight className="ml-1 h-4 w-4" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// Market Detail Component
const MarketDetail = ({ market, onBack }: any) => {
  // Function to get the correct bullet point color class
  const getBulletPointClass = () => {
    switch (market.color) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-green-500";
      case "orange":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      <div className={`absolute -inset-4 bg-gradient-to-r ${market.gradient} rounded-2xl blur-xl opacity-20`}></div>
      <Card className="relative p-8 bg-card/80 backdrop-blur-sm border border-primary/10 shadow-xl">
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-6 hover:bg-primary/10"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to markets
        </Button>
        
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className={`p-4 rounded-xl bg-gradient-to-br ${market.gradient} shadow-lg`}>
            <market.icon className="h-12 w-12 text-white" />
          </div>
          
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-4">{market.title} Market</h2>
            <p className="text-muted-foreground mb-6">{market.description}</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {market.features.map((feature: string, index: number) => (
                <div key={index} className="flex items-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className={`w-2 h-2 rounded-full ${getBulletPointClass()} mr-3`}></div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            
            <Link href={market.link}>
              <Button size="lg" className={`bg-gradient-to-r ${market.gradient} hover:opacity-90 transition-opacity w-full sm:w-auto`}>
                Explore {market.title} Market
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default function ChooseMarket() {
  const [activeMarket, setActiveMarket] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);

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
              <Link href="/news">
                <Button variant="ghost" className="hover:bg-primary/10">News</Button>
              </Link>
              <Link href="/reddit">
                <Button variant="ghost" className="hover:bg-primary/10">Reddit Sentiment</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" className="hover:bg-primary/10">AI Advisors</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="border-primary/20 hover:bg-primary/10">Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
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
                Market Selection
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                Choose Your Market
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Select a market to explore real-time data, technical indicators, and AI-powered insights tailored to your investment needs.
              </p>
            </motion.div>

            {/* Market Selection or Detail View */}
            <AnimatePresence mode="wait">
              {activeMarket === null ? (
                <motion.div
                  key="market-selection"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
                >
                  {markets.map((market, index) => (
                    <MarketCard 
                      key={index} 
                      {...market} 
                      isActive={false}
                      onClick={() => setActiveMarket(index)}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="market-detail"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-4xl mx-auto"
                >
                  <MarketDetail 
                    market={markets[activeMarket]} 
                    onBack={() => setActiveMarket(null)} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}