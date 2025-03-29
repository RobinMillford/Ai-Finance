"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";
import { BarChart3, ExternalLink, Search, Loader2 } from "lucide-react";
import Sentiment from "sentiment";

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: {
    name: string;
  };
}

interface CachedNews {
  articles: NewsArticle[];
  timestamp: number;
  query: string;
  category: string;
  page: number;
}

interface SentimentResult {
  label: "Positive" | "Negative" | "Neutral";
  score: number;
}

export default function News() {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();
  const perPage = 10; // Number of articles per page

  const categories = ["All", "Stocks", "Economy", "Banking", "Markets"];

  // Initialize the sentiment analyzer
  const sentiment = new Sentiment();

  // Function to analyze sentiment of an article
  const analyzeSentiment = (title: string, description: string): SentimentResult => {
    const text = `${title} ${description || ""}`.trim();
    const result = sentiment.analyze(text);
    const score = result.score;

    if (score > 0) {
      return { label: "Positive", score };
    } else if (score < 0) {
      return { label: "Negative", score };
    } else {
      return { label: "Neutral", score };
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);

      // Check cache first
      const cacheKey = `news_${searchQuery}_${category}_${page}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedData: CachedNews = JSON.parse(cachedData);
        const now = Date.now();
        const cacheAge = now - parsedData.timestamp;
        const cacheDuration = 60 * 60 * 1000; // 1 hour in milliseconds

        if (cacheAge < cacheDuration) {
          setNewsArticles(parsedData.articles);
          setTotalPages(Math.ceil(100 / perPage)); // NewsAPI free tier limits to 100 results
          setLoading(false);
          return;
        }
      }

      try {
        const apiKey = process.env.NEXT_PUBLIC_NEWSAPI_KEY;
        if (!apiKey) {
          throw new Error("NewsAPI key is missing. Please add it to your .env.local file.");
        }

        // Build the query
        let query = "finance";
        if (category !== "All") {
          query = category.toLowerCase();
        }
        if (searchQuery) {
          query += ` ${searchQuery}`;
        }
        // Exclude crypto-related terms
        query += " -crypto -cryptocurrency -bitcoin -ethereum";

        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${perPage}&page=${page}&apiKey=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data.status === "ok") {
          const articles = data.articles;
          setNewsArticles(articles);
          setTotalPages(Math.ceil(100 / perPage)); // NewsAPI free tier limits to 100 results

          // Cache the results
          const cacheData: CachedNews = {
            articles,
            timestamp: Date.now(),
            query: searchQuery,
            category,
            page,
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } else {
          throw new Error(data.message || "Failed to fetch news articles");
        }
      } catch (error) {
        console.error("Error fetching news:", error.message);
        toast({
          title: "Error",
          description: error.message || "Failed to fetch news articles",
          variant: "destructive",
        });
        setNewsArticles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [searchQuery, category, page, toast]);

  const handleSearch = () => {
    setPage(1); // Reset to page 1 on new search
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1); // Reset to page 1 on category change
  };

  if (loading && newsArticles.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="flex items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading finance news...
        </span>
      </div>
    );
  }

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
                <Button variant="ghost" className="bg-muted">
                  News
                </Button>
              </Link>
              <Link href="/advisor">
                <Button variant="ghost">AI Advisor</Button>
              </Link>
              <Link href="/cryptos">
                <Button variant="outline">Crypto Listings</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <section className="py-10 px-4 bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-full mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">
                Finance News
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mt-4">
                Stay updated with the latest financial news, covering markets, stocks, economy, banking, and more.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Search and Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <Card className="p-6 bg-card">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  type="text"
                  placeholder="Search finance news (e.g., stock market, economy)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border border-muted rounded-lg focus:ring-2 focus:ring-primary"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
              >
                {loading ? (
                  <span className="flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Searching...
                  </span>
                ) : (
                  "Search News"
                )}
              </Button>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="category-filter" className="text-sm font-medium text-muted-foreground">
                  Category:
                </label>
                <select
                  id="category-filter"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="border border-muted rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary"
                  disabled={loading}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* News Articles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <section className="py-8">
            {newsArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsArticles.map((article, index) => {
                  const sentimentResult = analyzeSentiment(article.title, article.description);
                  return (
                    <motion.div
                      key={article.url}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                      className="relative group"
                    >
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                      <Card className="relative p-4 bg-card">
                        {article.urlToImage && (
                          <div className="relative h-48 w-full mb-4">
                            <Image
                              src={article.urlToImage}
                              alt={article.title}
                              layout="fill"
                              objectFit="cover"
                              className="rounded-lg"
                            />
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-semibold">{article.title}</h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              sentimentResult.label === "Positive"
                                ? "bg-green-100 text-green-800"
                                : sentimentResult.label === "Negative"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {sentimentResult.label}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm mb-4">{article.description}</p>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>{article.source.name}</span>
                          <span>
                            {new Date(article.publishedAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex items-center text-primary hover:underline"
                        >
                          Read More <ExternalLink className="h-4 w-4 ml-1" />
                        </a>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground">
                  No finance news available at the moment. Please try again later.
                </p>
              </div>
            )}
          </section>
        </motion.div>

        {/* Pagination Controls */}
        {newsArticles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex justify-between mt-6"
          >
            <Button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1 || loading}
              variant="outline"
              className="border border-muted hover:bg-muted/50"
            >
              ⬅ Previous
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-lg text-muted-foreground">Page:</span>
              <select
                value={page}
                onChange={(e) => setPage(parseInt(e.target.value))}
                className="border border-muted rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary"
                disabled={loading}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <option key={pageNum} value={pageNum}>
                    {pageNum}
                  </option>
                ))}
              </select>
              <span className="text-lg text-muted-foreground">of {totalPages}</span>
            </div>

            <Button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages || loading}
              variant="outline"
              className="border border-muted hover:bg-muted/50"
            >
              Next ➡
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}