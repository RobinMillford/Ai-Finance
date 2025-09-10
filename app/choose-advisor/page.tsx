"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, Bitcoin, ArrowRight, ChevronRight, Sparkles, Zap, Brain, ArrowLeft, Search, Filter, Sliders } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

// Advisor data for the cards
const advisors = [
  {
    icon: BarChart3,
    title: "Stocks Advisor",
    description: "Get expert insights on stocks with real-time data and technical analysis from global exchanges.",
    link: "/stockadvisor",
    color: "blue",
    gradient: "from-blue-500 to-indigo-600",
    features: ["Technical analysis", "Market trends", "Investment strategies", "Risk assessment"],
    expertise: "Stock market expert with deep knowledge of global exchanges and market dynamics.",
    accuracy: "95%",
  },
  {
    icon: DollarSign,
    title: "Forex Advisor",
    description: "Your guide to forex markets, offering real-time analysis on currency pairs and trading strategies.",
    link: "/forexadvisor",
    color: "green",
    gradient: "from-green-500 to-emerald-600",
    features: ["Currency analysis", "Exchange rate predictions", "Trading strategies", "Market sentiment"],
    expertise: "Forex specialist with expertise in currency markets and international finance.",
    accuracy: "92%",
  },
  {
    icon: Bitcoin,
    title: "Crypto Advisor",
    description: "Navigate the crypto world with detailed market data and insights on cryptocurrency pairs.",
    link: "/cryptoadvisor",
    color: "orange",
    gradient: "from-orange-500 to-yellow-600",
    features: ["Crypto analysis", "Blockchain insights", "Trading strategies", "Market trends"],
    expertise: "Cryptocurrency expert with deep understanding of blockchain technology and digital assets.",
    accuracy: "88%",
  },
];

// Advisor Card Component
const AdvisorCard = ({ icon: Icon, title, description, link, gradient, features, color, isActive, onClick }: any) => (
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
              <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500 mr-2`}></div>
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

// Advisor Detail Component
const AdvisorDetail = ({ advisor, onBack }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.3 }}
    className="relative"
  >
    <div className={`absolute -inset-4 bg-gradient-to-r ${advisor.gradient} rounded-2xl blur-xl opacity-20`}></div>
    <Card className="relative p-8 bg-card/80 backdrop-blur-sm border border-primary/10 shadow-xl">
      <Button 
        variant="ghost" 
        size="sm" 
        className="mb-6 hover:bg-primary/10"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to advisors
      </Button>
      
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className={`p-4 rounded-xl bg-gradient-to-br ${advisor.gradient} shadow-lg`}>
          <advisor.icon className="h-12 w-12 text-white" />
        </div>
        
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-4">{advisor.title}</h2>
          <p className="text-muted-foreground mb-6">{advisor.description}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {advisor.features.map((feature: string, index: number) => (
              <div key={index} className="flex items-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className={`w-2 h-2 rounded-full bg-${advisor.color}-500 mr-3`}></div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 mb-8">
            <h3 className="font-semibold mb-2">Expertise</h3>
            <p className="text-muted-foreground">{advisor.expertise}</p>
          </div>
          
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-semibold">Accuracy Rate</h3>
              <p className="text-muted-foreground">Based on historical predictions</p>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              {advisor.accuracy}
            </div>
          </div>
          
          <Link href={advisor.link}>
            <Button size="lg" className={`bg-gradient-to-r ${advisor.gradient} hover:opacity-90 transition-opacity w-full sm:w-auto`}>
              Start with {advisor.title}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  </motion.div>
);

export default function ChooseAdvisor() {
  const [activeAdvisor, setActiveAdvisor] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredAdvisors, setFilteredAdvisors] = useState(advisors);
  const { data: session, status } = useSession();

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/signin';
    }
  }, [status]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = advisors.filter(advisor => 
        advisor.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        advisor.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAdvisors(filtered);
    } else {
      setFilteredAdvisors(advisors);
    }
  }, [searchTerm]);

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
                <Brain className="h-8 w-8 text-primary relative z-10" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">FinanceAI</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/news">
                <Button variant="ghost" className="hover:bg-primary/10">News</Button>
              </Link>
              <Link href="/choose-market">
                <Button variant="ghost" className="hover:bg-primary/10">Markets</Button>
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
                AI-Powered Advisors
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                Choose Your Advisor
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Pick an AI-powered advisor to get tailored insights and real-time data for your financial queries.
              </p>
            </motion.div>

            {/* Search and Filter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="max-w-2xl mx-auto mb-12"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search advisors..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-card/50 border border-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <Filter className="h-5 w-5" />
                </Button>
              </div>
            </motion.div>

            {/* Advisor Selection or Detail View */}
            <AnimatePresence mode="wait">
              {activeAdvisor === null ? (
                <motion.div
                  key="advisor-selection"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
                >
                  {filteredAdvisors.map((advisor, index) => (
                    <AdvisorCard 
                      key={index} 
                      {...advisor} 
                      isActive={false}
                      onClick={() => setActiveAdvisor(index)}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="advisor-detail"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-4xl mx-auto"
                >
                  <AdvisorDetail 
                    advisor={advisors[activeAdvisor]} 
                    onBack={() => setActiveAdvisor(null)} 
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