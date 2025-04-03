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
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
}

interface CachedNews {
  articles: NewsArticle[];
  timestamp: number;
  query: string;
  category: string;
}

interface SentimentResult {
  label: "Positive" | "Negative" | "Neutral";
  score: number;
}

export default function News() {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");
  const { toast } = useToast();

  const perPage = 12; // 12 articles per page
  const categories = ["All", "Stocks", "Economy", "Banking", "Markets"];
  const sentiment = new Sentiment();

  // Calculate total pages based on fetched articles
  const totalPages = Math.ceil(newsArticles.length / perPage);

  // Get articles for the current page
  const paginatedArticles = newsArticles.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const analyzeSentiment = (title: string, description: string | null): SentimentResult => {
    const text = `${title} ${description ?? ""}`.trim();
    const result = sentiment.analyze(text);
    const score = result.score ?? 0;
    return score > 0 ? { label: "Positive", score } : score < 0 ? { label: "Negative", score } : { label: "Neutral", score };
  };

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      const queries = ["finance", "stocks", "economy", "banking", "markets"].map(q => category !== "All" ? category.toLowerCase() : q);
      if (searchQuery) queries.push(searchQuery);
      const allArticles: NewsArticle[] = [];
      const cacheKey = `news_${searchQuery}_${category}`;

      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsedData: CachedNews = JSON.parse(cachedData);
          const now = Date.now();
          if (now - parsedData.timestamp < 60 * 60 * 1000) { // 1-hour cache
            setNewsArticles(parsedData.articles);
            setLoading(false);
            return;
          }
        } catch (error: unknown) {
          console.warn("Failed to parse cached news:", error);
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        for (const query of queries) {
          const url = `/api/news?q=${encodeURIComponent(query + " -crypto -cryptocurrency -bitcoin -ethereum")}&pageSize=100`; // Max fetch
          const response = await fetch(url);
          if (!response.ok) continue;
          const data = await response.json();
          if (data.status === "ok") {
            const articles = (data.articles ?? []).map((article: NewsArticle) => ({
              ...article,
              description: article.description ?? null,
              urlToImage: article.urlToImage ?? null,
            }));
            allArticles.push(...articles);
          }
        }

        const uniqueArticles = Array.from(new Map(allArticles.map(item => [item.url, item])).values());
        setNewsArticles(uniqueArticles);
        setCurrentPage(1); // Reset to first page on new fetch

        const cacheData: CachedNews = { articles: uniqueArticles, timestamp: Date.now(), query: searchQuery, category };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (error: unknown) {
        console.error("Error fetching news:", error);
        toast({ title: "Error", description: "Failed to fetch news articles", variant: "destructive" });
        setNewsArticles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [searchQuery, category, toast]);

  const handleSearch = () => {
    setCurrentPage(1); // Reset to page 1 on search
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setCurrentPage(1); // Reset to page 1 on category change
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top on page change
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
      <header className="border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">FinanceAI</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market"><Button variant="ghost">Analyze Markets</Button></Link>
              <Link href="/choose-advisor"><Button variant="ghost">AI Advisors</Button></Link>
              <Link href="/"><Button variant="outline">Back Home</Button></Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="py-10 px-4 bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-full mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">
                Finance News
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mt-4">
                Stay updated with the latest financial news, covering markets, stocks, economy, banking, and more.
              </p>
            </motion.div>
          </div>
        </section>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <Card className="p-6 bg-card">
            <div className="flex items-center gap-4 flex-wrap">
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
                  <span className="flex items-center"><Loader2 className="h-5 w-5 animate-spin mr-2" />Searching...</span>
                ) : (
                  "Search News"
                )}
              </Button>
              <div className="flex items-center gap-2">
                <label htmlFor="category-filter" className="text-sm font-medium text-muted-foreground">Category:</label>
                <select
                  id="category-filter"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="border border-muted rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary"
                  disabled={loading}
                >
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
          <section className="py-8">
            {newsArticles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedArticles.map((article, index) => {
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
                          {article.urlToImage ? (
                            <div className="relative h-48 w-full mb-4">
                              <Image src={article.urlToImage} alt={article.title ?? "News Image"} layout="fill" objectFit="cover" className="rounded-lg" />
                            </div>
                          ) : (
                            <div className="relative h-48 w-full mb-4 bg-gray-200 flex items-center justify-center rounded-lg">
                              <span className="text-muted-foreground">No Image Available</span>
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-semibold">{article.title ?? "Untitled"}</h3>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                sentimentResult.label === "Positive" ? "bg-green-100 text-green-800" :
                                sentimentResult.label === "Negative" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {sentimentResult.label}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-sm mb-4">{article.description ?? "No description available"}</p>
                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{article.source?.name ?? "Unknown Source"}</span>
                            <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Date Unknown"}</span>
                          </div>
                          <a href={article.url ?? "#"} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center text-primary hover:underline">
                            Read More <ExternalLink className="h-4 w-4 ml-1" />
                          </a>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center mt-6">
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                      variant="outline"
                      className="border border-muted hover:bg-muted/50"
                    >
                      ⬅ Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-lg text-muted-foreground">Page {currentPage} of {totalPages}</span>
                      <select
                        value={currentPage}
                        onChange={(e) => handlePageChange(parseInt(e.target.value))}
                        className="border border-muted rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary"
                        disabled={loading}
                      >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <option key={pageNum} value={pageNum}>{pageNum}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                      variant="outline"
                      className="border border-muted hover:bg-muted/50"
                    >
                      Next ➡
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground">No finance news available at the moment. Please try again later.</p>
              </div>
            )}
          </section>
        </motion.div>
      </main>
    </div>
  );
}