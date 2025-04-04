"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Loader2, Search, ArrowRight, MessageCircle, TrendingUp, ChevronRight, DollarSign } from "lucide-react";
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

// Theme colors - Forex themed
const green500 = "#10B981"; // Tailwind from-green-500
const emerald600 = "#059669"; // Tailwind to-emerald-600
const whiteBg = "#F9FAFB"; // Light background

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
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay
      const response = await fetch(
        `/api/forexs?page=${page}&perPage=${perPage}¤cyGroup=${selectedType}&searchQuery=${encodeURIComponent(
          searchQuery
        )}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || `HTTP error! Status: ${response.status}`);
      }
      const data: ForexResponse = await response.json();

      const pairs = data.pairs ?? [];
      setAllForexPairs(pairs);
      setFilteredForexPairs(pairs);
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                  Forex Market
                </h1>
              </div>
              <div className="flex space-x-4">
                <Link href="/choose-market">
                  <Button variant="ghost" className="text-foreground hover:text-green-500">
                    Other Markets
                  </Button>
                </Link>
                <Link href="/choose-advisor">
                  <Button variant="ghost" className="text-foreground hover:text-green-500">
                    AI Advisors
                  </Button>
                </Link>
                <Link href="/forexadvisor">
                  <Button
                    className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2 text-white transition-all hover:scale-105"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Forex Advisor
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="border-green-500 text-green-500 hover:bg-green-50">
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search forex pairs by symbol or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-green-200 focus:border-green-500 focus:ring-green-500 text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Type Filter (Currency Group) */}
              <div className="flex items-center gap-2">
                <label htmlFor="type-filter" className="text-sm font-medium text-gray-600">
                  Currency Group:
                </label>
                <select
                  id="type-filter"
                  value={selectedType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="border border-green-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={loading}
                >
                  {typeOptions.map((type) => (
                    <option key={type} value={type} className="text-gray-900">
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleSearch}
                disabled={loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2 text-white transition-all hover:scale-105"
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
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Forex Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                  {searchQuery ? `Search Results (Page ${page})` : `Top Forex Listings (Page ${page})`}
                </h2>
              </div>
              <Button
                onClick={fetchForexPairs}
                disabled={loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2 text-white transition-all hover:scale-105"
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
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Symbol</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Base Currency</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Quote Currency</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Group</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Analyze</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredForexPairs.length > 0 ? (
                      filteredForexPairs.map((pair, index) => (
                        <motion.tr
                          key={pair.symbol}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="border-b border-gray-100 hover:bg-green-50/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-green-600">{pair.symbol}</td>
                          <td className="py-3 px-4 text-foreground">{pair.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{pair.base_currency || "N/A"}</td>
                          <td className="py-3 px-4 text-muted-foreground">{pair.quote_currency || "N/A"}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                pair.status === "Major"
                                  ? "bg-green-100 text-green-800"
                                  : pair.status === "Minor"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {pair.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Link 
                              href={`/forex/${encodeURIComponent(pair.symbol)}`}
                              onClick={(e) => handleAnalyzeClick(pair.symbol, e)}
                            >
                              <Button
                                variant="ghost"
                                className="group relative overflow-hidden rounded-lg hover:bg-green-50"
                              >
                                <span className="relative z-10 flex items-center gap-2 text-green-600">
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
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          No forex pairs found
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
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2 text-white transition-all hover:scale-105 disabled:opacity-50"
              >
                Previous
              </Button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2 text-white transition-all hover:scale-105 disabled:opacity-50"
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