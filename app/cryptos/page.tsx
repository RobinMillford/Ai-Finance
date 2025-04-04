"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Loader2, Search, ArrowRight, MessageCircle, ChevronRight, Coins } from "lucide-react";
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

// Theme colors - Crypto themed
const orange500 = "#F97316"; // Tailwind from-orange-500
const yellow600 = "#CA8A04"; // Tailwind to-yellow-600
const whiteBg = "#F9FAFB"; // Light background

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
        throw new Error(
          "Expected an array of cryptocurrency pairs, but received: " + JSON.stringify(data)
        );
      }

      // Set quote currency options if not already set
      if (quoteCurrencyOptions.length === 0) {
        const currencies = Array.from(
          new Set(data.map((pair: CryptoPair) => pair.currency_quote))
        ).sort();
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
        filtered = filtered.filter(
          (pair: CryptoPair) => pair.currency_quote === quoteCurrencyFilter
        );
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error fetching cryptocurrency pairs:", errorMessage);
      toast({
        title: "Error",
        description: errorMessage || "Failed to fetch cryptocurrency pairs",
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
    <div className="min-h-screen p-6 bg-background">
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600">
                  <Coins className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-yellow-600 bg-clip-text text-transparent">
                  Crypto Market
                </h1>
              </div>
              <div className="flex space-x-4">
                <Link href="/choose-market">
                  <Button variant="ghost" className="text-foreground hover:text-orange-500">
                    Other Markets
                  </Button>
                </Link>
                <Link href="/choose-advisor">
                  <Button variant="ghost" className="text-foreground hover:text-orange-500">
                    AI Advisors
                  </Button>
                </Link>
                <Link href="/cryptoadvisor">
                  <Button
                    className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-2 text-white transition-all hover:scale-105"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Crypto Advisor
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-50">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search crypto pairs by symbol or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-orange-200 focus:border-orange-500 focus:ring-orange-500 text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Quote Currency Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="quote-currency-filter" className="text-sm font-medium text-gray-600">
                  Quote Currency:
                </label>
                <select
                  id="quote-currency-filter"
                  value={quoteCurrencyFilter}
                  onChange={(e) => handleQuoteCurrencyChange(e.target.value)}
                  className="border border-orange-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  disabled={loading}
                >
                  {quoteCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency} className="text-gray-900">
                      {currency === "All" ? "All Quote Currencies" : currency}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleSearch}
                disabled={loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-2 text-white transition-all hover:scale-105"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      Search
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Crypto Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-orange-500 to-yellow-600 bg-clip-text text-transparent">
                  {searchQuery ? `Search Results (Page ${page})` : `Top Crypto Listings (Page ${page})`}
                </h2>
              </div>
              <Button
                onClick={fetchCryptoPairs}
                disabled={loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-2 text-white transition-all hover:scale-105"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-5 w-5" />
                      Refresh
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Symbol</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Base Currency</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Quote Currency</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Available Exchanges</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Analyze</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredCryptoPairs.length > 0 ? (
                      filteredCryptoPairs.map((pair, index) => (
                        <motion.tr
                          key={pair.symbol}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="border-b border-gray-100 hover:bg-orange-50/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-orange-600">{pair.symbol}</td>
                          <td className="py-3 px-4 text-foreground">{pair.currency_base}</td>
                          <td className="py-3 px-4 text-muted-foreground">{pair.currency_quote}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {pair.available_exchanges.join(", ")}
                          </td>
                          <td className="py-3 px-4">
                            <Link href={`/crypto/${encodeURIComponent(pair.symbol)}`}>
                              <Button
                                variant="ghost"
                                className="group relative overflow-hidden rounded-lg hover:bg-orange-50"
                              >
                                <span className="relative z-10 flex items-center gap-2 text-orange-600">
                                  Analyze
                                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </span>
                              </Button>
                            </Link>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-100"
                      >
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No crypto pairs found
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-2 text-white transition-all hover:scale-105 disabled:opacity-50"
              >
                Previous
              </Button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-500 to-yellow-600 px-6 py-2 text-white transition-all hover:scale-105 disabled:opacity-50"
              >
                Next
              </Button>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}