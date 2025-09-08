"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart3, 
  Loader2, 
  Search, 
  MessageCircle, 
  ChevronRight, 
  Bitcoin, 
  RefreshCw, 
  Filter,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { debounce } from "lodash";
import { marketThemes } from "@/lib/themes";

interface CryptoPair {
  symbol: string;
  currency_base: string;
  currency_quote: string;
  available_exchanges: string[];
  price?: string;
  change?: string;
  percent_change?: string;
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

export default function CryptoList() {
  const [allCryptoPairs, setAllCryptoPairs] = useState<CryptoPair[]>([]);
  const [filteredCryptoPairs, setFilteredCryptoPairs] = useState<CryptoPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [quoteCurrencyFilter, setQuoteCurrencyFilter] = useState("All");
  const [quoteCurrencyOptions, setQuoteCurrencyOptions] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const perPage = 50;
  const theme = marketThemes.crypto;

  // Fetch all crypto pairs on mount
  useEffect(() => {
    fetchCryptoPairs();
  }, []);

  // Update filtered crypto pairs when filters or page changes
  useEffect(() => {
    let filtered = allCryptoPairs;

    // Apply search filter
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (pair) =>
          pair.symbol.toLowerCase().includes(lowerQuery) ||
          pair.currency_base.toLowerCase().includes(lowerQuery) ||
          pair.currency_quote.toLowerCase().includes(lowerQuery)
      );
    }

    // Apply quote currency filter
    if (quoteCurrencyFilter !== "All") {
      filtered = filtered.filter((pair) => pair.currency_quote === quoteCurrencyFilter);
    }

    // Calculate pagination
    const newTotalPages = Math.ceil(filtered.length / perPage) || 1;
    setTotalPages(newTotalPages);

    // Adjust page if needed
    if (page > newTotalPages) {
      setPage(newTotalPages);
    }

    // Apply pagination
    const paginatedPairs = filtered.slice((page - 1) * perPage, page * perPage);
    setFilteredCryptoPairs(paginatedPairs);
  }, [searchQuery, quoteCurrencyFilter, allCryptoPairs, page]);

  const fetchCryptoPairs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cryptos`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || `HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle the data
      const pairs = Array.isArray(data) ? data : [];
      setAllCryptoPairs(pairs);
      setFilteredCryptoPairs(pairs.slice(0, perPage));
      
      // Extract unique quote currencies for the filter
      if (quoteCurrencyOptions.length === 0) {
        const uniqueQuoteCurrencies = Array.from(
          new Set(pairs.map((pair) => pair.currency_quote))
        ).sort();
        setQuoteCurrencyOptions(['All', ...uniqueQuoteCurrencies]);
      }
      
      setTotalPages(Math.ceil(pairs.length / perPage));
      setPage(1); // Reset to first page on new fetch
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching cryptocurrency pairs:', errorMessage);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to fetch cryptocurrency pairs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [perPage, toast, quoteCurrencyOptions.length]);

  const debouncedSearch = debounce((query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to page 1 when search query changes
  }, 500);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const handleQuoteCurrencyChange = (value: string) => {
    setQuoteCurrencyFilter(value);
    setPage(1); // Reset to page 1 when filter changes
  };

  const handleAnalyze = async (symbol: string) => {
    try {
      const response = await fetch(`/api/cryptos?symbol=${symbol}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Cryptocurrency pair ${symbol} is not supported`);
      }
      router.push(`/crypto/${encodeURIComponent(symbol)}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error validating symbol ${symbol}:`, errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading && allCryptoPairs.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="flex items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading cryptocurrency pairs...
        </span>
      </div>
    );
  }

  if (!Array.isArray(allCryptoPairs) || allCryptoPairs.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No cryptocurrency pairs available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-amber-50/20 p-4 md:p-6">
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-yellow-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-600 shadow-lg">
                    <Bitcoin className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-yellow-700 bg-clip-text text-transparent">
                      Crypto Market
                    </h1>
                    <p className="text-muted-foreground mt-1">Explore and analyze cryptocurrency pairs</p>
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
                  <Link href="/cryptoadvisor">
                    <Button className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-yellow-600 px-4 py-2 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                      <span className="relative z-10 flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        <span className="hidden sm:inline">Crypto Advisor</span>
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-yellow-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-orange-400" />
                  <Input
                    type="text"
                    placeholder="Search crypto pairs by symbol or name..."
                    onChange={handleSearch}
                    className="pl-10 h-12 bg-background border border-input focus:border-orange-500 focus:ring-orange-500 text-foreground placeholder-muted-foreground rounded-xl shadow-sm"
                  />
                </div>

                {/* Quote Currency Filter */}
                <div className="flex items-center gap-2 bg-secondary px-4 rounded-xl">
                  <Filter className="h-5 w-5 text-amber-500" />
                  <label htmlFor="quote-currency-filter" className="text-sm font-medium text-foreground whitespace-nowrap">
                    Quote Currency:
                  </label>
                  <select
                    id="quote-currency-filter"
                    value={quoteCurrencyFilter}
                    onChange={(e) => handleQuoteCurrencyChange(e.target.value)}
                    className="border-0 bg-transparent py-2 text-foreground focus:ring-0 focus:ring-amber-500"
                    disabled={loading}
                  >
                    {quoteCurrencyOptions.map((currency) => (
                      <option key={currency} value={currency} className="text-foreground bg-background">
                        {currency === "All" ? "All Quote Currencies" : currency}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={fetchCryptoPairs}
                  disabled={loading}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-2 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="hidden sm:inline">Refreshing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-5 w-5" />
                        <span className="hidden sm:inline">Refresh</span>
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Crypto Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-yellow-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-600">
                    <Bitcoin className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold bg-gradient-to-r from-orange-600 to-yellow-700 bg-clip-text text-transparent">
                    {searchQuery ? `Search Results (Page ${page})` : `Top Crypto Listings (Page ${page})`}
                  </h2>
                </div>
                <Button
                  onClick={fetchCryptoPairs}
                  disabled={loading}
                  variant="outline"
                  className="border-input text-foreground hover:bg-accent rounded-xl"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
              </div>

              {/* Responsive Grid for Crypto Listings */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredCryptoPairs.length > 0 ? (
                    filteredCryptoPairs.map((pair, index) => (
                      <motion.div
                        key={pair.symbol}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-all duration-300 p-4 bg-card"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg text-orange-600">{pair.symbol}</h3>
                            <p className="text-sm text-muted-foreground">{pair.currency_base}/{pair.currency_quote}</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Base Currency</p>
                            <p className="text-sm font-medium text-foreground">{pair.currency_base}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Quote Currency</p>
                            <p className="text-sm font-medium text-foreground">{pair.currency_quote}</p>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground">Exchanges</p>
                          <p className="text-sm text-muted-foreground">{pair.available_exchanges.join(", ")}</p>
                        </div>
                        
                        <div className="mt-4">
                          <Link href={`/crypto/${encodeURIComponent(pair.symbol)}`} className="block">
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
                        <Bitcoin className="h-12 w-12 text-gray-300 mb-3 dark:text-gray-800" />
                        <p className="text-lg font-medium">No crypto pairs found</p>
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