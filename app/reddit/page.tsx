"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RedditSocialSentiment } from "@/components/reddit-social-sentiment";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { 
  MessageSquare, 
  BarChart3, 
  Brain, 
  TrendingUp, 
  Users, 
  Sparkles, 
  Activity,
  Globe,
  ArrowRight
} from "lucide-react";

// Popular symbols for quick analysis
const POPULAR_SYMBOLS = {
  stocks: ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META', 'AMD'],
  crypto: ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP', 'MATIC', 'AVAX'],
  forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF']
};

const TRENDING_TOPICS = [
  'SPY', 'QQQ', 'IWM', 'VTI', 'GME', 'AMC', 'PLTR', 'COIN'
];

interface QuickSymbolProps {
  symbol: string;
  category: string;
  onClick: (symbol: string) => void;
}

const QuickSymbol = ({ symbol, category, onClick }: QuickSymbolProps) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={() => onClick(symbol)}
    className="p-3 rounded-lg border border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
  >
    <div className="text-sm font-semibold">{symbol}</div>
    <div className="text-xs text-muted-foreground capitalize">{category}</div>
  </motion.button>
);

export default function RedditSocialPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { toast } = useToast();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('reddit-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse recent searches:', error);
      }
    }
  }, []);

  // Handle symbol selection
  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    
    // Add to recent searches
    const updated = [symbol, ...recentSearches.filter(s => s !== symbol)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem('reddit-recent-searches', JSON.stringify(updated));
    
    toast({
      title: "Analyzing Reddit Sentiment",
      description: `Fetching community discussions for ${symbol}...`,
    });
  };

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
                <MessageSquare className="h-8 w-8 text-primary relative z-10" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Reddit Social Sentiment
              </span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" className="hover:bg-primary/10">Markets</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" className="hover:bg-primary/10">AI Advisors</Button>
              </Link>
              <Link href="/news">
                <Button variant="ghost" className="hover:bg-primary/10">News</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="border-primary/20 hover:bg-primary/10">Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4 mr-2" />
              Community-Driven Market Intelligence
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
              Reddit Social Sentiment Analysis
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Analyze community discussions across financial subreddits. Get real-time sentiment analysis for stocks, crypto, and forex from Reddit's investment communities.
            </p>
          </motion.div>

          {/* Features Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Brain className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold">AI-Powered Analysis</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Advanced sentiment analysis using financial-specific keywords and context understanding.
              </p>
            </Card>

            <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold">Multi-Community Coverage</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Analyzes discussions from 15+ financial subreddits including r/investing, r/stocks, r/cryptocurrency.
              </p>
            </Card>

            <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold">Real-Time Insights</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Live sentiment tracking with bullish/bearish classification and confidence scores.
              </p>
            </Card>
          </motion.div>

          {/* Quick Access Symbols */}
          {!selectedSymbol && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-semibold">Quick Analysis</h2>
                </div>
                
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Searches</h3>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((symbol) => (
                        <Button
                          key={symbol}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSymbolClick(symbol)}
                          className="border-primary/20 hover:bg-primary/10"
                        >
                          {symbol}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Topics */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Trending on Reddit</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {TRENDING_TOPICS.map((symbol) => (
                      <QuickSymbol
                        key={symbol}
                        symbol={symbol}
                        category="trending"
                        onClick={handleSymbolClick}
                      />
                    ))}
                  </div>
                </div>

                {/* Popular Stocks */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Popular Stocks</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {POPULAR_SYMBOLS.stocks.map((symbol) => (
                      <QuickSymbol
                        key={symbol}
                        symbol={symbol}
                        category="stock"
                        onClick={handleSymbolClick}
                      />
                    ))}
                  </div>
                </div>

                {/* Popular Crypto */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Popular Crypto</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {POPULAR_SYMBOLS.crypto.map((symbol) => (
                      <QuickSymbol
                        key={symbol}
                        symbol={symbol}
                        category="crypto"
                        onClick={handleSymbolClick}
                      />
                    ))}
                  </div>
                </div>

                {/* Popular Forex */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Popular Forex</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {POPULAR_SYMBOLS.forex.map((symbol) => (
                      <QuickSymbol
                        key={symbol}
                        symbol={symbol}
                        category="forex"
                        onClick={handleSymbolClick}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Tip: Forex discussions often use EUR/USD format or mention currencies individually
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Reddit Sentiment Analysis Component */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <RedditSocialSentiment 
              symbol={selectedSymbol}
              showSearch={true}
            />
          </motion.div>

          {/* Back to Quick Analysis */}
          {selectedSymbol && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <Button
                onClick={() => setSelectedSymbol("")}
                variant="outline"
                className="border-primary/20 hover:bg-primary/10"
              >
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                Back to Quick Analysis
              </Button>
            </motion.div>
          )}

          {/* Educational Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">How Reddit Sentiment Analysis Works</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold mb-2 text-green-600">What We Analyze</h3>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Post titles and content</li>
                    <li>• Financial-specific keywords</li>
                    <li>• Community engagement metrics</li>
                    <li>• Symbol mentions and context</li>
                    <li>• Upvote/downvote ratios</li>
                    <li>• Forex: EUR/USD, EURUSD, or currency mentions</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2 text-blue-600">Sentiment Classifications</h3>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• <strong>Bullish:</strong> Positive sentiment, buy signals</li>
                    <li>• <strong>Bearish:</strong> Negative sentiment, sell signals</li>
                    <li>• <strong>Neutral:</strong> Mixed or unclear sentiment</li>
                    <li>• <strong>Confidence:</strong> High/Medium/Low based on data</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Note on Forex:</strong> Forex pairs on Reddit may appear as EURUSD, EUR/USD, or discussions about individual currencies like EUR or USD. 
                  Our system searches multiple subreddits including r/Forex, r/forextrading, and r/daytrading for comprehensive coverage.
                  <br /><br />
                  <strong>Disclaimer:</strong> Reddit sentiment analysis is for informational purposes only and should not be considered as financial advice. 
                  Community sentiment can be volatile and may not reflect actual market conditions. Always conduct your own research before making investment decisions.
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}