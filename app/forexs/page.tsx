"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart3, 
  Loader2, 
  Search, 
  MessageCircle, 
  TrendingUp, 
  ChevronRight, 
  DollarSign, 
  RefreshCw, 
  Globe, 
  Filter,
  TrendingDown,
  Minus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { debounce } from "lodash";
import { marketThemes } from "@/lib/themes";

interface ForexPair {
  symbol: string;
  name: string;
  exchange: string;
  status: string; // Represents currency_group (e.g., "Major", "Exotic")
  base_currency?: string;
  quote_currency?: string;
  price?: string;
  change?: string;
  percent_change?: string;
}

interface ForexResponse {
  pairs: ForexPair[];
  totalCount: number;
}

// Get trend indicator with color coding
const getTrendInfo = (value: number | string | undefined) => {
  if (value === undefined || value === null) return { icon: <Minus className="w-4 h-4" />, color: "text-gray-500" };
  const number = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(number)) return { icon: <Minus className="w-4 h-4" />, color: "text-gray-500" };
  
  if (number > 0) {
    return { icon: <TrendingUp className="w-4 h-4" />, color: "text-green-500" };
  } else if (number < 0) {
    return { icon: <TrendingDown className="w-4 h-4" />, color: "text-red-500" };
  }
  return { icon: <Minus className="w-4 h-4" />, color: "text-gray-500" };
};

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
  const theme = marketThemes.forex;

  useEffect(() => {
    fetchForexPairs();
  }, [page, selectedType, searchQuery]); // Fetch new data when page, filters, or search query change

  const fetchForexPairs = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay
      const response = await fetch(
        `/api/forexs?page=${page}&perPage=${perPage}&currencyGroup=${encodeURIComponent(
          selectedType
        )}&searchQuery=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || `HTTP error! Status: ${response.status}`);
      }
      const data: ForexResponse = await response.json();

      const pairs = data.pairs ?? [];
      setAllForexPairs(pairs);
      setFilteredForexPairs(pairs); // Use the filtered data from the API
      setTotalCount(data.totalCount ?? 0);
      setTotalPages(Math.ceil((data.totalCount ?? 0) / perPage));

      // Fetch filter options from the first page (without filters) if not already set
      if (typeOptions.length === 0) {
        const optionsResponse = await fetch(`/api/forexs?page=1&perPage=${perPage}`);
        if (optionsResponse.ok) {
          const optionsData: ForexResponse = await optionsResponse.json();
          const types = Array.from(
            new Set((optionsData.pairs ?? []).map((pair: ForexPair) => pair.status ?? "Unknown"))
          ).sort();
          setTypeOptions(["All", ...types]);
        } else {
          console.warn("Failed to fetch type options, using defaults.");
          setTypeOptions(["All", "Major", "Exotic", "Minor"]); // Fallback options
        }
      }

      if (pairs.length === 0) {
        toast({
          title: "Warning",
          description: "No forex pairs found. Check your API key, rate limits, or filters.",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Fetch error:", errorMessage);
      setAllForexPairs([]);
      setFilteredForexPairs([]);
      setTotalCount(0);
      setTotalPages(1);
      toast({
        title: "Error",
        description: errorMessage || "Failed to fetch forex listings",
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
  const checkPairSupport = async (symbol: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/forex?symbol=${symbol}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed to fetch forex data");
      }
      return true; // Pair is supported
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error checking support for ${symbol}:`, errorMessage);
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
    <div className="min-h-screen bg-gradient-to-br from-background to-emerald-50/20 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                    <Globe className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-700 bg-clip-text text-transparent">
                      Forex Market
                    </h1>
                    <p className="text-muted-foreground mt-1">Explore and analyze foreign exchange pairs</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/choose-market">
                    <Button variant="outline" className="border-input text-foreground hover:bg-accent">
                      Other Markets
                    </Button>
                  </Link>
                  <Link href="/choose-advisor">
                    <Button variant="outline" className="border-input text-foreground hover:bg-accent">
                      AI Advisors
                    </Button>
                  </Link>
                  <Link href="/forexadvisor">
                    <Button className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                      <span className="relative z-10 flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        <span className="hidden sm:inline">Forex Advisor</span>
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" className="border-input text-foreground hover:bg-accent">
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                  <Input
                    type="text"
                    placeholder="Search forex pairs by symbol or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 bg-background border border-input focus:border-green-500 focus:ring-green-500 text-foreground placeholder-muted-foreground rounded-xl shadow-sm"
                  />
                </div>

                {/* Type Filter (Currency Group) */}
                <div className="flex items-center gap-2 bg-secondary px-4 rounded-xl">
                  <Filter className="h-5 w-5 text-green-500" />
                  <label htmlFor="type-filter" className="text-sm font-medium text-foreground whitespace-nowrap">
                    Currency Group:
                  </label>
                  <select
                    id="type-filter"
                    value={selectedType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="border-0 bg-transparent py-2 text-foreground focus:ring-0 focus:ring-green-500"
                    disabled={loading}
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type} className="text-foreground bg-background">
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="hidden sm:inline">Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-5 w-5" />
                        <span className="hidden sm:inline">Search</span>
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Forex Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                    <Globe className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold bg-gradient-to-r from-green-600 to-emerald-700 bg-clip-text text-transparent">
                    {searchQuery ? `Search Results (Page ${page})` : `Top Forex Listings (Page ${page})`}
                  </h2>
                </div>
                <Button
                  onClick={fetchForexPairs}
                  disabled={loading}
                  variant="outline"
                  className="border-input text-foreground hover:bg-accent rounded-xl"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
              </div>

              {/* Responsive Grid for Forex Listings */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredForexPairs.length > 0 ? (
                    filteredForexPairs.map((pair, index) => (
                      <motion.div
                        key={pair.symbol}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="rounded-xl border border-green-100 shadow-sm hover:shadow-md transition-all duration-300 p-4 bg-card"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg text-green-600">{pair.symbol}</h3>
                            <p className="text-sm text-muted-foreground">{pair.name}</p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              pair.status === "Major"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                : pair.status === "Minor"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                            }`}
                          >
                            {pair.status}
                          </span>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Base</p>
                            <p className="text-sm font-medium text-foreground">{pair.base_currency || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Quote</p>
                            <p className="text-sm font-medium text-foreground">{pair.quote_currency || "N/A"}</p>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <Link 
                            href={`/forex/${encodeURIComponent(pair.symbol)}`}
                            onClick={(e) => handleAnalyzeClick(pair.symbol, e)}
                            className="block"
                          >
                            <Button
                              variant="outline"
                              className="w-full group relative overflow-hidden rounded-lg border-input text-foreground hover:bg-accent transition-all"
                            >
                              <span className="relative z-10 flex items-center justify-center gap-2">
                                Analyze
                                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                              </span>
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full py-12 text-center"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Globe className="h-12 w-12 text-gray-300 mb-3 dark:text-gray-800" />
                        <p className="text-lg font-medium">No forex pairs found</p>
                        <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  variant="outline"
                  className="border-input text-foreground hover:bg-accent rounded-xl px-6"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Page</span>
                  <div className="rounded-lg px-3 py-1 font-semibold bg-secondary text-secondary-foreground">
                    {page}
                  </div>
                  <span className="font-medium text-foreground">of</span>
                  <div className="rounded-lg px-3 py-1 font-semibold bg-secondary text-secondary-foreground">
                    {totalPages}
                  </div>
                </div>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  variant="outline"
                  className="border-input text-foreground hover:bg-accent rounded-xl px-6"
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}