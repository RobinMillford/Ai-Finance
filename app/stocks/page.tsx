"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Loader2, Search, ArrowRight, MessageCircle, TrendingUp, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { debounce } from "lodash";

interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  currency?: string;
  country?: string;
}

// Theme colors
const blue500 = "#3B82F6";
const indigo600 = "#4F46E5";
const whiteBg = "#F9FAFB";
const gradientStart = "#3B82F6";
const gradientEnd = "#4F46E5";

export default function Stocks() {
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [exchangeOptions, setExchangeOptions] = useState<string[]>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const { toast } = useToast();
  const perPage = 50;

  // Fetch all stocks on mount
  useEffect(() => {
    fetchStocks();
  }, []);

  // Update filtered stocks when filters or page changes
  useEffect(() => {
    let filtered = allStocks;

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(lowerQuery) ||
          stock.name.toLowerCase().includes(lowerQuery)
      );
    }

    if (selectedExchange !== "All") {
      filtered = filtered.filter((stock) => stock.exchange === selectedExchange);
    }

    if (selectedType !== "All") {
      filtered = filtered.filter((stock) => stock.status === selectedType);
    }

    const newTotalPages = Math.ceil(filtered.length / perPage) || 1;
    setTotalPages(newTotalPages);

    if (page > newTotalPages) {
      setPage(newTotalPages);
    }

    const paginatedStocks = filtered.slice((page - 1) * perPage, page * perPage);
    setFilteredStocks(paginatedStocks);
  }, [searchQuery, selectedExchange, selectedType, allStocks, page]);

  // Fetch all stocks from API
  const fetchStocks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stocks");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data: Stock[] = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid stock data format");
      }

      setAllStocks(data);
      setFilteredStocks(data.slice(0, perPage));

      const exchanges = ["All", ...Array.from(new Set(data.map((stock) => stock.exchange))).sort()];
      const types = ["All", ...Array.from(new Set(data.map((stock) => stock.status))).sort()];
      setExchangeOptions(exchanges);
      setTypeOptions(types);
      setTotalPages(Math.ceil(data.length / perPage) || 1);
      setPage(1); // Reset to first page on new fetch
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Fetch error:", errorMessage);
      setAllStocks([]);
      setFilteredStocks([]);
      toast({
        title: "Error",
        description: errorMessage || "Failed to fetch stock listings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Debounced search function to filter stocks
  const handleSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
    }, 500),
    []
  );

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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                  Stock Market
                </h1>
              </div>
              <div className="flex space-x-4">
                <Link href="/choose-market">
                  <Button variant="ghost" className="text-foreground hover:text-blue-500">
                    Other Markets
                  </Button>
                </Link>
                <Link href="/choose-advisor">
                  <Button variant="ghost" className="text-foreground hover:text-blue-500">
                    AI Advisors
                  </Button>
                </Link>
                <Link href="/stockadvisor">
                  <Button
                    className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2 text-white transition-all hover:scale-105"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Stock Advisor
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-50">
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search stocks by symbol or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-blue-200 focus:border-blue-500 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Exchange Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="exchange-filter" className="text-sm font-medium text-gray-600">
                  Exchange:
                </label>
                <select
                  id="exchange-filter"
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value)}
                  className="border border-blue-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                >
                  {exchangeOptions.map((exchange) => (
                    <option key={exchange} value={exchange}>
                      {exchange}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="type-filter" className="text-sm font-medium text-gray-600">
                  Type:
                </label>
                <select
                  id="type-filter"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="border border-blue-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

        {/* Stock Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative p-6 bg-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                  {searchQuery ? `Search Results (Page ${page})` : `Top Stock Listings (Page ${page})`}
                </h2>
              </div>
              <Button
                onClick={fetchStocks}
                disabled={loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2 text-white transition-all hover:scale-105"
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
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Symbol</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Exchange</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-medium">Analyze</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredStocks.length > 0 ? (
                      filteredStocks.map((stock, index) => (
                        <motion.tr
                          key={stock.symbol}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-blue-600">{stock.symbol}</td>
                          <td className="py-3 px-4 text-foreground">{stock.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{stock.exchange}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                stock.status === "Common Stock"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-indigo-100 text-indigo-800"
                              }`}
                            >
                              {stock.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Link href={`/stock/${stock.symbol}`}>
                              <Button
                                variant="ghost"
                                className="group relative overflow-hidden rounded-lg hover:bg-blue-50"
                              >
                                <span className="relative z-10 flex items-center gap-2 text-blue-600">
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
                          No stocks found
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
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2 text-white transition-all hover:scale-105 disabled:opacity-50"
              >
                Previous
              </Button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-2 text-white transition-all hover:scale-105 disabled:opacity-50"
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