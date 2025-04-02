"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Loader2, Search, ArrowRight, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { debounce } from "lodash";

interface ForexPair {
  symbol: string;
  name: string;
  exchange: string;
  status: string; // Represents currency_group (e.g., "Major", "Exotic")
  base_currency?: string;
  quote_currency?: string;
}

interface ForexResponse {
  pairs: ForexPair[];
  totalCount: number;
}

export default function Forex() {
  const [allForexPairs, setAllForexPairs] = useState<ForexPair[]>([]);
  const [filteredForexPairs, setFilteredForexPairs] = useState<ForexPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const { toast } = useToast();
  const perPage = 50;

  useEffect(() => {
    fetchForexPairs();
  }, [page, selectedType, searchQuery]); // Fetch new data when page, filters, or search query change

  const fetchForexPairs = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await fetch(
        `/api/forexs?page=${page}&perPage=${perPage}&currencyGroup=${selectedType}&searchQuery=${encodeURIComponent(
          searchQuery
        )}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data: ForexResponse = await response.json();

      setAllForexPairs(data.pairs);
      setFilteredForexPairs(data.pairs);
      setTotalCount(data.totalCount);
      setTotalPages(Math.ceil(data.totalCount / perPage));

      // Fetch filter options from the first page (without filters) if not already set
      if (typeOptions.length === 0) {
        const optionsResponse = await fetch(`/api/forexs?page=1&perPage=${perPage}`);
        if (optionsResponse.ok) {
          const optionsData: ForexResponse = await optionsResponse.json();
          const types = Array.from(
            new Set(optionsData.pairs.map((pair: ForexPair) => pair.status))
          ).sort();
          setTypeOptions(["All", ...types]);
        }
      }

      if (data.pairs.length === 0) {
        toast({
          title: "Warning",
          description: "No forex pairs found. Check your API key, rate limits, or filters.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Fetch error:", error.message);
      setAllForexPairs([]);
      setFilteredForexPairs([]);
      setTotalCount(0);
      setTotalPages(1);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch forex listings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(() => {
    setPage(1); // Reset to page 1 when search query changes
    fetchForexPairs();
  }, 1000);

  const handleSearch = () => {
    debouncedSearch();
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setPage(1); // Reset to page 1 when filter changes
  };

  // Function to check if a Forex pair is supported
  const checkPairSupport = async (symbol: string) => {
    try {
      const response = await fetch(`/api/forex?symbol=${symbol}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch forex data");
      }
      return true; // Pair is supported
    } catch (error) {
      console.error(`Error checking support for ${symbol}:`, error.message);
      return false; // Pair is unsupported
    }
  };

  // Handle the "Analyze" button click
  const handleAnalyzeClick = async (symbol: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    const isSupported = await checkPairSupport(symbol);
    if (!isSupported) {
      e.preventDefault(); // Prevent navigation
      toast({
        title: "Unsupported Forex Pair",
        description: `The Forex pair ${symbol} is not supported at this time. Try a major pair like EUR/USD.`,
        variant: "destructive",
      });
    }
  };

  const pageOptions = Array.from({ length: totalPages }, (_, i) => i + 1);

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
                <Button variant="ghost">Other Markets</Button>
              </Link>
              <Link href="/choose-advisor">
                <Button variant="ghost">AI Advisors</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Hero Section */}
        <section className="py-10 px-4 bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-full mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">
                Forex Market Analysis
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Explore real-time forex pair data, filter by currency group, and dive into detailed analysis for your favorite pairs.
              </p>
            </motion.div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6">
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
                    placeholder="Search by symbol, name, or currency (e.g., EUR/USD)"
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
                    "Search Forex Pair"
                  )}
                </Button>

                {/* Type Filter (Currency Group) */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="type-filter"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Currency Group:
                  </label>
                  <select
                    id="type-filter"
                    value={selectedType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="border border-muted rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary"
                    disabled={loading}
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Forex Listings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-semibold">
                    {searchQuery
                      ? `Search Results (Page ${page})`
                      : `Top Forex Listings (Page ${page})`}
                  </h2>
                </div>
                <Button
                  onClick={fetchForexPairs}
                  disabled={loading}
                  variant="outline"
                  className="border border-muted hover:bg-muted/50"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-3 px-4 text-muted-foreground">Symbol</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Name</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Base Currency</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Quote Currency</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Exchange</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Currency Group</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Analyze</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredForexPairs.length > 0 ? (
                      filteredForexPairs.map((pair, index) => (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="border-b border-muted hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium">{pair.symbol}</td>
                          <td className="py-3 px-4">{pair.name}</td>
                          <td className="py-3 px-4">{pair.base_currency || "N/A"}</td>
                          <td className="py-3 px-4">{pair.quote_currency || "N/A"}</td>
                          <td className="py-3 px-4">{pair.exchange}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                pair.status === "Major"
                                  ? "bg-green-100 text-green-800"
                                  : pair.status === "Exotic"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {pair.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/forex/${encodeURIComponent(pair.symbol)}`}
                              onClick={(e) => handleAnalyzeClick(pair.symbol, e)}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-emerald-700 flex items-center gap-1"
                              >
                                Analyze
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-3 px-4 text-center text-muted-foreground">
                          {loading ? (
                            <span className="flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin mr-2" />
                              Loading forex pairs...
                            </span>
                          ) : (
                            "No forex pairs found"
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
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
                    {pageOptions.map((pageNum) => (
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
            </Card>
          </motion.div>
        </div>

        {/* Floating Chatbot Logo */}
        <motion.div
          className="fixed bottom-6 right-6 z-50 group"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          whileHover={{ scale: 1.1 }}
        >
          <Link href="/forexadvisor">
            <Button
              className="p-4 rounded-full shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </Link>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-sm font-medium px-3 py-1 rounded-lg shadow-md">
            Your Forex Advisor
          </div>
        </motion.div>
      </main>
    </div>
  );
}