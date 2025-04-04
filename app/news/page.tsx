"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";
import { BarChart3, ExternalLink, Search, Loader2, Filter, Calendar, Newspaper, TrendingUp, Building2, Building, ArrowLeft, ArrowRight, ChevronRight, Sparkles, Brain, Clock, Share2, Bookmark } from "lucide-react";
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

// Category data with icons
const categories = [
  { name: "All", icon: Newspaper },
  { name: "Stocks", icon: TrendingUp },
  { name: "Economy", icon: Building2 },
  { name: "Banking", icon: Building },
  { name: "Markets", icon: BarChart3 },
];

export default function News() {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { toast } = useToast();

  const perPage = 9; // 9 articles per page for better grid layout
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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

  const handleArticleClick = (article: NewsArticle) => {
    setSelectedArticle(article);
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
  };

  if (loading && newsArticles.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <span className="text-muted-foreground">Loading finance news...</span>
        </div>
      </div>
    );
  }

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
              <Link href="/choose-market">
                <Button variant="ghost" className="hover:bg-primary/10">Markets</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost" className="hover:bg-primary/10">Advisors</Button>
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
        <section className="py-16 px-4">
          <div className="max-w-full mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4 mr-2" />
                Real-Time Financial News
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                Finance News
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Stay updated with the latest financial news, covering markets, stocks, economy, banking, and more.
              </p>
            </motion.div>

            {/* Search and Filter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="max-w-4xl mx-auto mb-12"
            >
              <Card className="p-6 bg-card/80 backdrop-blur-sm border border-primary/10 shadow-lg">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full">
                    <Input
                      type="text"
                      placeholder="Search finance news (e.g., stock market, economy)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border border-primary/10 rounded-lg focus:ring-2 focus:ring-primary/20 bg-background/50"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 transition-opacity w-full md:w-auto"
                  >
                    {loading ? (
                      <span className="flex items-center"><Loader2 className="h-5 w-5 animate-spin mr-2" />Searching...</span>
                    ) : (
                      "Search News"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="border-primary/10 hover:bg-primary/10"
                  >
                    <Filter className="h-5 w-5 mr-2" />
                    Filters
                  </Button>
                </div>

                {/* Category Filters */}
                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4 pt-4 border-t border-primary/10 overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => {
                          const Icon = cat.icon;
                          return (
                            <Button
                              key={cat.name}
                              variant={category === cat.name ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleCategoryChange(cat.name)}
                              className={`${
                                category === cat.name 
                                  ? "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90" 
                                  : "border-primary/10 hover:bg-primary/10"
                              }`}
                            >
                              <Icon className="h-4 w-4 mr-2" />
                              {cat.name}
                            </Button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>

            {/* News Articles Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="max-w-7xl mx-auto"
            >
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
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="relative group cursor-pointer"
                          onClick={() => handleArticleClick(article)}
                        >
                          <div className={`absolute -inset-0.5 bg-gradient-to-r ${
                            sentimentResult.label === "Positive" ? "from-green-500 to-emerald-600" :
                            sentimentResult.label === "Negative" ? "from-red-500 to-rose-600" : "from-blue-500 to-indigo-600"
                          } rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500`}></div>
                          <Card className="relative h-full p-4 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-all duration-300 border border-primary/10 shadow-lg">
                            {article.urlToImage ? (
                              <div className="relative h-48 w-full mb-4 overflow-hidden rounded-lg">
                                <Image 
                                  src={article.urlToImage} 
                                  alt={article.title ?? "News Image"} 
                                  layout="fill" 
                                  objectFit="cover" 
                                  className="group-hover:scale-105 transition-transform duration-500" 
                                />
                              </div>
                            ) : (
                              <div className="relative h-48 w-full mb-4 bg-primary/5 flex items-center justify-center rounded-lg">
                                <Newspaper className="h-12 w-12 text-primary/30" />
                              </div>
                            )}
                            <div className="flex flex-col h-full">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                  {article.source.name}
                                </span>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    sentimentResult.label === "Positive" ? "bg-green-100 text-green-800" :
                                    sentimentResult.label === "Negative" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {sentimentResult.label}
                                </span>
                              </div>
                              <h3 className="text-lg font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                {article.title ?? "Untitled"}
                              </h3>
                              <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                                {article.description ?? "No description available"}
                              </p>
                              <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                                <div className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatDate(article.publishedAt)}
                                </div>
                                <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform duration-300">
                                  Read more <ChevronRight className="ml-1 h-3 w-3" />
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Newspaper className="h-16 w-16 text-primary/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No news articles found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filters</p>
                </div>
              )}
            </motion.div>
          </div>
        </section>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-4 mb-2 gap-2 relative z-20">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="border-primary/10 hover:bg-primary/10 relative z-20"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <div className="flex items-center gap-1 relative z-20">
              {/* First page */}
              <Button
                variant={currentPage === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(1)}
                className={`w-10 h-10 relative z-20 ${
                  currentPage === 1 
                    ? "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90" 
                    : "border-primary/10 hover:bg-primary/10"
                }`}
              >
                1
              </Button>
              
              {/* Ellipsis after first page */}
              {currentPage > 3 && (
                <span className="px-2 text-muted-foreground relative z-20">...</span>
              )}
              
              {/* Pages around current page */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show current page, one before and one after
                  return page === currentPage || 
                         page === currentPage - 1 || 
                         page === currentPage + 1;
                })
                .filter(page => page > 1 && page < totalPages) // Exclude first and last page
                .map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 relative z-20 ${
                      currentPage === page 
                        ? "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90" 
                        : "border-primary/10 hover:bg-primary/10"
                    }`}
                  >
                    {page}
                  </Button>
                ))}
              
              {/* Ellipsis before last page */}
              {currentPage < totalPages - 2 && (
                <span className="px-2 text-muted-foreground relative z-20">...</span>
              )}
              
              {/* Last page */}
              {totalPages > 1 && (
                <Button
                  variant={currentPage === totalPages ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  className={`w-10 h-10 relative z-20 ${
                    currentPage === totalPages 
                      ? "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90" 
                      : "border-primary/10 hover:bg-primary/10"
                  }`}
                >
                  {totalPages}
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="border-primary/10 hover:bg-primary/10 relative z-20"
            >
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </main>

      {/* Article Detail Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={handleCloseArticle}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-card rounded-xl shadow-2xl border border-primary/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-card/80 backdrop-blur-sm border-b border-primary/10">
                <h2 className="text-xl font-semibold">{selectedArticle.source.name}</h2>
                <Button variant="ghost" size="icon" onClick={handleCloseArticle}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="p-6">
                {selectedArticle.urlToImage && (
                  <div className="relative h-64 w-full mb-6 overflow-hidden rounded-lg">
                    <Image 
                      src={selectedArticle.urlToImage} 
                      alt={selectedArticle.title ?? "News Image"} 
                      layout="fill" 
                      objectFit="cover" 
                    />
                  </div>
                )}
                
                <h1 className="text-2xl font-bold mb-4">{selectedArticle.title}</h1>
                
                <div className="flex items-center text-sm text-muted-foreground mb-6">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatDate(selectedArticle.publishedAt)}
                </div>
                
                <p className="text-muted-foreground mb-6">
                  {selectedArticle.description}
                </p>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  <Button variant="outline" size="sm" className="border-primary/10 hover:bg-primary/10">
                    <Bookmark className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" size="sm" className="border-primary/10 hover:bg-primary/10">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
                
                <a 
                  href={selectedArticle.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary hover:underline"
                >
                  Read full article <ExternalLink className="h-4 w-4 ml-1" />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}