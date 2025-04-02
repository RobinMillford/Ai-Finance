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

interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  currency?: string;
  country?: string;
}

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

  useEffect(() => {
    fetchStocks();
  }, []);

  useEffect(() => {
    let filtered = allStocks;

    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = allStocks.filter(
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

    const newTotalPages = Math.ceil(filtered.length / perPage);
    setTotalPages(newTotalPages > 0 ? newTotalPages : 1);

    if (page > newTotalPages) {
      setPage(newTotalPages > 0 ? newTotalPages : 1);
    }

    const paginatedStocks = filtered.slice((page - 1) * perPage, page * perPage);
    setFilteredStocks(paginatedStocks);
  }, [searchQuery, selectedExchange, selectedType, allStocks, page]);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await fetch("/api/stocks");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched data:", data);

      if (!Array.isArray(data)) {
        throw new Error("Invalid stock data format");
      }

      setAllStocks(data);
      setFilteredStocks(data.slice(0, perPage));

      const exchanges = Array.from(new Set(data.map((stock: Stock) => stock.exchange))).sort();
      const types = Array.from(new Set(data.map((stock: Stock) => stock.status))).sort();
      setExchangeOptions(["All", ...exchanges]);
      setTypeOptions(["All", ...types]);

      setTotalPages(Math.ceil(data.length / perPage));
    } catch (error) {
      console.error("Fetch error:", error.message);
      setAllStocks([]);
      setFilteredStocks([]);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch stock listings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = debounce(async () => {
    if (!searchQuery.trim()) {
      fetchStocks();
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await fetch(`/api/stock?symbol=${searchQuery.toUpperCase()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();

      const timeSeries = data["Time Series (Daily)"];
      if (!timeSeries) {
        throw new Error("No data available for this stock");
      }

      const stock: Stock = {
        symbol: searchQuery.toUpperCase(),
        name: data["Meta Data"]["2. Symbol"] || "Unknown Stock",
        exchange: data["Meta Data"]["6. Exchange"] || "N/A",
        status: "Common Stock",
      };

      setAllStocks([stock]);
      setFilteredStocks([stock]);
      setTotalPages(1);
      setPage(1);
      setExchangeOptions(["All", stock.exchange]);
      setTypeOptions(["All", stock.status]);
      toast({
        title: "Stock Found",
        description: `Showing data for ${stock.symbol}`,
        variant: "default",
      });
    } catch (error) {
      console.error("Search error:", error.message);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch stock data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, 1000);

  const handleSearch = () => {
    debouncedSearch();
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
                Stock Market Analysis
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                Explore real-time stock data, filter by exchange and type, and dive into detailed analysis for your favorite stocks.
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
                    placeholder="Search by symbol or name (e.g., AAPL)"
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
                    "Search Stock"
                  )}
                </Button>

                {/* Exchange Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="exchange-filter" className="text-sm font-medium text-muted-foreground">
                    Exchange:
                  </label>
                  <select
                    id="exchange-filter"
                    value={selectedExchange}
                    onChange={(e) => setSelectedExchange(e.target.value)}
                    className="border border-muted rounded-lg px-3 py-2 bg-background text-foreground focus:ring-2 focus:ring-primary"
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
                  <label htmlFor="type-filter" className="text-sm font-medium text-muted-foreground">
                    Type:
                  </label>
                  <select
                    id="type-filter"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
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

          {/* Stock Listings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative group"
          >
            {/* Gradient background effect for the stock listings card */}
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-semibold">
                    {searchQuery ? `Search Results (Page ${page})` : `Top Stock Listings (Page ${page})`}
                  </h2>
                </div>
                <Button
                  onClick={fetchStocks}
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
                      <th className="text-left py-3 px-4 text-muted-foreground">Exchange</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-muted-foreground">Analyze</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.length > 0 ? (
                      filteredStocks.map((stock, index) => (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="border-b border-muted hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium">{stock.symbol}</td>
                          <td className="py-3 px-4">{stock.name}</td>
                          <td className="py-3 px-4">{stock.exchange}</td>
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
                          <td className="py-3 px-4 text-right">
                            <Link href={`/stock/${stock.symbol}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-indigo-700 flex items-center gap-1"
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
                        <td colSpan={5} className="py-3 px-4 text-center text-muted-foreground">
                          {loading ? (
                            <span className="flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin mr-2" />
                              Loading stocks...
                            </span>
                          ) : (
                            "No stocks found"
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
          <Link href="/stockadvisor">
            <Button
              className="p-4 rounded-full shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-300"
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </Link>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-sm font-medium px-3 py-1 rounded-lg shadow-md">
            Your Stock Advisor
          </div>
        </motion.div>
      </main>
    </div>
  );
}