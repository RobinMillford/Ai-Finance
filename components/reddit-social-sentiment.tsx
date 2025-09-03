"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Search, 
  Loader2, 
  ExternalLink,
  Users,
  ArrowUp,
  ArrowDown,
  Eye,
  Calendar,
  BarChart3,
  Brain,
  Sparkles
} from "lucide-react";
import Link from "next/link";

// Interfaces
interface RedditSentiment {
  label: "Bullish" | "Bearish" | "Neutral";
  score: number;
  confidence: "High" | "Medium" | "Low";
  words: {
    positive: string[];
    negative: string[];
  };
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  permalink: string;
  url: string;
  subreddit: string;
  ups: number;
  downs: number;
  upvote_ratio: number;
  sentiment: RedditSentiment;
  relevance_score: number;
}

interface RedditSummary {
  total_posts: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  bullish_percentage: number;
  bearish_percentage: number;
  neutral_percentage: number;
  average_sentiment_score: number;
  overall_sentiment: "Bullish" | "Bearish" | "Neutral";
  confidence: "High" | "Medium" | "Low";
}

interface RedditData {
  symbol: string;
  posts: RedditPost[];
  summary: RedditSummary;
}

interface RedditSocialSentimentProps {
  symbol?: string;
  compact?: boolean;
  showSearch?: boolean;
}

export function RedditSocialSentiment({ 
  symbol: initialSymbol, 
  compact = false, 
  showSearch = true 
}: RedditSocialSentimentProps) {
  const [symbol, setSymbol] = useState(initialSymbol || "");
  const [searchSymbol, setSearchSymbol] = useState("");
  const [redditData, setRedditData] = useState<RedditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch Reddit data
  const fetchRedditData = async (targetSymbol: string) => {
    if (!targetSymbol.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/reddit?symbol=${encodeURIComponent(targetSymbol)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      
      const data: RedditData = await response.json();
      setRedditData(data);
      setSymbol(targetSymbol.toUpperCase());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      toast({
        title: "Error",
        description: `Failed to fetch Reddit data: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    if (searchSymbol.trim()) {
      fetchRedditData(searchSymbol.trim());
    }
  };

  // Auto-fetch if symbol is provided
  useEffect(() => {
    if (initialSymbol && !redditData) {
      fetchRedditData(initialSymbol);
    }
  }, [initialSymbol]);

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Get sentiment color and icon
  const getSentimentDisplay = (sentiment: RedditSentiment) => {
    switch (sentiment.label) {
      case "Bullish":
        return {
          color: "text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400",
          icon: TrendingUp,
          borderColor: "border-green-500"
        };
      case "Bearish":
        return {
          color: "text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400",
          icon: TrendingDown,
          borderColor: "border-red-500"
        };
      default:
        return {
          color: "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
          icon: Minus,
          borderColor: "border-gray-500"
        };
    }
  };

  // Get overall sentiment color
  const getOverallSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "Bullish":
        return "from-green-500 to-emerald-600";
      case "Bearish":
        return "from-red-500 to-rose-600";
      default:
        return "from-blue-500 to-indigo-600";
    }
  };

  if (compact && redditData) {
    return (
      <Card className="p-4 bg-card/80 backdrop-blur-sm border border-primary/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="font-semibold">Reddit Sentiment</span>
          </div>
          <Badge 
            variant="outline" 
            className={`${getSentimentDisplay(redditData.summary as any).color} border-0`}
          >
            {redditData.summary.overall_sentiment}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <div className="text-green-600 font-bold">{redditData.summary.bullish_percentage}%</div>
            <div className="text-muted-foreground">Bullish</div>
          </div>
          <div className="text-center">
            <div className="text-red-600 font-bold">{redditData.summary.bearish_percentage}%</div>
            <div className="text-muted-foreground">Bearish</div>
          </div>
          <div className="text-center">
            <div className="text-gray-600 font-bold">{redditData.summary.neutral_percentage}%</div>
            <div className="text-muted-foreground">Neutral</div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Based on {redditData.summary.total_posts} posts • {redditData.summary.confidence} confidence
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Section */}
      {showSearch && (
        <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold">Reddit Social Sentiment</h3>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Enter symbol (e.g., AAPL, BTC, EURUSD)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Analyze"
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <BarChart3 className="h-5 w-5" />
            <span>Error: {error}</span>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Analyzing Reddit sentiment for {searchSymbol || symbol}...</p>
        </Card>
      )}

      {/* Reddit Data Display */}
      {redditData && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Summary Card */}
          <div className="relative group">
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${getOverallSentimentColor(redditData.summary.overall_sentiment)} rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-500`}></div>
            <Card className="relative p-6 bg-card/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{redditData.symbol} Reddit Sentiment</h2>
                    <p className="text-muted-foreground">Community discussion analysis</p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-lg px-4 py-2 ${getSentimentDisplay(redditData.summary as any).color} border-0`}
                >
                  {redditData.summary.overall_sentiment}
                </Badge>
              </div>

              {/* Sentiment Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-2xl font-bold text-green-600">{redditData.summary.bullish_count}</div>
                  <div className="text-sm text-muted-foreground">Bullish Posts</div>
                  <div className="text-lg font-semibold text-green-600">{redditData.summary.bullish_percentage}%</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <div className="text-2xl font-bold text-red-600">{redditData.summary.bearish_count}</div>
                  <div className="text-sm text-muted-foreground">Bearish Posts</div>
                  <div className="text-lg font-semibold text-red-600">{redditData.summary.bearish_percentage}%</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="text-2xl font-bold text-gray-600">{redditData.summary.neutral_count}</div>
                  <div className="text-sm text-muted-foreground">Neutral Posts</div>
                  <div className="text-lg font-semibold text-gray-600">{redditData.summary.neutral_percentage}%</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-2xl font-bold text-blue-600">{redditData.summary.total_posts}</div>
                  <div className="text-sm text-muted-foreground">Total Posts</div>
                  <div className="text-lg font-semibold text-blue-600">{redditData.summary.confidence} Confidence</div>
                </div>
              </div>

              {/* Sentiment Score */}
              <div className="flex items-center justify-center gap-4 p-4 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Average Sentiment Score:</span>
                <span className={`text-xl font-bold ${
                  redditData.summary.average_sentiment_score > 0 ? 'text-green-600' : 
                  redditData.summary.average_sentiment_score < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {redditData.summary.average_sentiment_score > 0 ? '+' : ''}{redditData.summary.average_sentiment_score}
                </span>
              </div>
            </Card>
          </div>

          {/* Posts List */}
          <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">Recent Discussions</h3>
            </div>

            <div className="space-y-4">
              {redditData.posts.slice(0, 10).map((post, index) => {
                const sentimentDisplay = getSentimentDisplay(post.sentiment);
                const SentimentIcon = sentimentDisplay.icon;
                
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="relative group"
                  >
                    <div className={`absolute -inset-0.5 ${sentimentDisplay.borderColor} rounded-lg blur opacity-0 group-hover:opacity-50 transition duration-300`}></div>
                    <div className="relative p-4 rounded-lg border border-border/50 hover:border-border transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              r/{post.subreddit}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${sentimentDisplay.color} border-0`}
                            >
                              <SentimentIcon className="h-3 w-3 mr-1" />
                              {post.sentiment.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {post.sentiment.confidence} confidence
                            </span>
                          </div>
                          
                          <h4 className="font-semibold text-sm mb-2 line-clamp-2">
                            {post.title}
                          </h4>
                          
                          {post.selftext && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {post.selftext}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              u/{post.author}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(post.created_utc)}
                            </div>
                            <div className="flex items-center gap-1">
                              <ArrowUp className="h-3 w-3" />
                              {post.score}
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {post.num_comments}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <div className="text-sm font-semibold">
                              Score: {post.sentiment.score > 0 ? '+' : ''}{post.sentiment.score}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Relevance: {post.relevance_score}
                            </div>
                          </div>
                          
                          <Link href={post.permalink} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="text-xs">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                      
                      {/* Sentiment Keywords */}
                      {(post.sentiment.words.positive.length > 0 || post.sentiment.words.negative.length > 0) && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex flex-wrap gap-1">
                            {post.sentiment.words.positive.slice(0, 3).map((word, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20">
                                +{word}
                              </Badge>
                            ))}
                            {post.sentiment.words.negative.slice(0, 3).map((word, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20">
                                -{word}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            {redditData.posts.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No Reddit discussions found for {redditData.symbol}</p>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}