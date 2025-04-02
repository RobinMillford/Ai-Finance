"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Loader2, Search, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { debounce } from "lodash";

interface CryptoPair {
  symbol: string;
  currency_base: string;
  currency_quote: string;
  available_exchanges: string[];
}

export default function CryptoList() {
  const [allCryptoPairs, setAllCryptoPairs] = useState<CryptoPair[]>([]);
  const [filteredCryptoPairs, setFilteredCryptoPairs] = useState<CryptoPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [quoteCurrencyFilter, setQuoteCurrencyFilter] = useState("All");
  const [quoteCurrencyOptions, setQuoteCurrencyOptions] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const perPage = 50;

  useEffect(() => {
    fetchCryptoPairs();
  }, [page, quoteCurrencyFilter, searchQuery]);

  const fetchCryptoPairs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cryptos");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch cryptocurrency pairs");
      }
      const data = await response.json();
      console.log("API response from /api/cryptos:", JSON.stringify(data, null, 2));
      if (!Array.isArray(data)) {
        throw new Error("Expected an array of cryptocurrency pairs, but received: " + JSON.stringify(data));
      }

      // Set quote currency options if not already set
      if (quoteCurrencyOptions.length === 0) {
        const currencies = Array.from(new Set(data.map((pair: CryptoPair) => pair.currency_quote))).sort();
        setQuoteCurrencyOptions(["All", ...currencies]);
      }

      // Apply client-side filtering for search and quote currency
      let filtered = data;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (pair: CryptoPair) =>
            pair.symbol.toLowerCase().includes(query) ||
            pair.currency_base.toLowerCase().includes(query) ||
            pair.currency_quote.toLowerCase().includes(query)
        );
      }
      if (quoteCurrencyFilter !== "All") {
        filtered = filtered.filter((pair: CryptoPair) => pair.currency_quote === quoteCurrencyFilter);
      }

      // Apply pagination
      const startIndex = (page - 1) * perPage;
      const paginatedPairs = filtered.slice(startIndex, startIndex + perPage);

      setAllCryptoPairs(filtered);
      setFilteredCryptoPairs(paginatedPairs);
      setTotalCount(filtered.length);
      setTotalPages(Math.ceil(filtered.length / perPage));

      if (paginatedPairs.length === 0 && filtered.length > 0) {
        // If the current page is empty due to filtering, reset to page 1
        setPage(1);
      }
    } catch (error) {
      console.error("Error fetching cryptocurrency pairs:", error.message);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch cryptocurrency pairs",
        variant: "destructive",
      });
      setAllCryptoPairs([]);
      setFilteredCryptoPairs([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(() => {
    setPage(1); // Reset to page 1 when search query changes
    fetchCryptoPairs();
  }, 1000);

  const handleSearch = () => {
    debouncedSearch();
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
    } catch (error) {
      console.error(`Error validating symbol ${symbol}:`, error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const pageOptions = Array.from({ length: totalPages }, (_, i) => i + 1);

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
              {/* <Link href="/news">
                <Button variant="ghost">News</Button>
              </Link> */}
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

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <section className="py-10 px-4 bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-full mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">
                Cryptocurrency Market Analysis
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Explore real-time cryptocurrency pair data, filter by quote currency, and dive into detailed analysis for your favorite pairs.
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
                    placeholder="Search by symbol, base, or quote currency (e.g., BTC/USD)"
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
                    "Search Crypto Pair"
                  )}
                </Button>

                {/* Quote Currency Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="quote-currency-filter" className="text-sm font-medium text-muted-foreground">
                    Quote Currency:
                  </label>
                  <select
                    id="quote-currency-filter"
                    value={quoteCurrencyFilter}
                    onChange={(e) => handleQuoteCurrencyChange(e.target.value)}
                    className="border border-muted rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary"
                    disabled={loading}
                  >
                    {quoteCurrencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency === "All" ? "All Quote Currencies" : currency}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Crypto Listings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-semibold">
                    {searchQuery ? `Search Results (Page ${page})` : `Top Crypto Listings (Page ${page})`}
                  </h2>
                </div>
                <Button
                  onClick={fetchCryptoPairs}
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
                      <th className="text-left py-3 px-4 text-muted-foreground">Base Currency</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Quote Currency</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Available Exchanges</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Analyze</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCryptoPairs.length > 0 ? (
                      filteredCryptoPairs.map((pair, index) => (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="border-b border-muted hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium">{pair.symbol}</td>
                          <td className="py-3 px-4">{pair.currency_base}</td>
                          <td className="py-3 px-4">{pair.currency_quote}</td>
                          <td className="py-3 px-4">{pair.available_exchanges.join(", ")}</td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAnalyze(pair.symbol)}
                              className="text-orange-600 hover:text-yellow-700 flex items-center gap-1"
                            >
                              Analyze
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-3 px-4 text-center text-muted-foreground">
                          {loading ? (
                            <span className="flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin mr-2" />
                              Loading crypto pairs...
                            </span>
                          ) : (
                            "No crypto pairs found"
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
      </main>
    </div>
  );
}