"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, Bitcoin, ArrowRight } from "lucide-react";
import Link from "next/link";

// Market data for the cards
const markets = [
  {
    icon: BarChart3,
    title: "Stocks",
    description: "Analyze real-time stock data from global exchanges with detailed insights and technical indicators.",
    link: "/stocks",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    icon: DollarSign,
    title: "Forex",
    description: "Dive into forex market analysis with real-time data on major, minor, and exotic currency pairs.",
    link: "/forexs",
    gradient: "from-green-500 to-emerald-600",
  },
  {
    icon: Bitcoin,
    title: "Crypto",
    description: "Explore cryptocurrency pairs with comprehensive market data and exchange information.",
    link: "/cryptos",
    gradient: "from-orange-500 to-yellow-600",
  },
];

// Market Card Component
const MarketCard = ({ icon: Icon, title, description, link, gradient }: any) => (
  <motion.div
    whileHover={{ scale: 1.05, rotateY: 5 }}
    whileTap={{ scale: 0.95 }}
    className="relative group"
  >
    {/* Gradient background effect on hover */}
    <div
      className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200`}
    ></div>
    <Card className="relative p-6 bg-card hover:bg-card/80 transition-colors">
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient}`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-2xl font-semibold">{title}</h3>
      </div>
      <p className="text-muted-foreground mb-6">{description}</p>
      <Link href={link}>
        <Button
          className={`w-full bg-gradient-to-r ${gradient} hover:opacity-90 transition-opacity`}
        >
          Select Market
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </Link>
    </Card>
  </motion.div>
);

export default function ChooseMarket() {
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
              <Link href="/news">
                <Button variant="ghost">News</Button>
              </Link>
              <Link href="/advisor">
                <Button variant="ghost">AI Advisor</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-full mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">
                Choose Your Market
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
                Select a market to explore real-time data, technical indicators, and AI-powered insights tailored to your investment needs.
              </p>
            </motion.div>

            {/* Market Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {markets.map((market, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.2 }}
                >
                  <MarketCard {...market} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}