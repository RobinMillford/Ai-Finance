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
  TrendingUp, 
  ChevronRight, 
  RefreshCw, 
  LineChart, 
  Filter,
  TrendingDown,
  Minus,
  Plus,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { debounce } from "lodash";
import { AddToWatchlistDialog } from "@/components/AddToWatchlistDialog";
import { AddToPortfolioDialog } from "@/components/AddToPortfolioDialog";
import { marketThemes } from "@/lib/themes";

// Defined locally to avoid import conflicts with React.MouseEvent vs Global MouseEvent
interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  currency?: string;
  country?: string;
  price?: string;
  change?: string;
  percent_change?: string;
  volume?: string;
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isWatchDialogOpen, setIsWatchDialogOpen] = useState(false);
  const [selectedWatchStock, setSelectedWatchStock] = useState<Stock | null>(null);
  const perPage = 50;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const theme = marketThemes.stock;

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
      setPage(1); // Reset to page 1 when search query changes
    }, 500),
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-blue-50/20 p-4 md:p-6">
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                      Stock Market
                    </h1>
                    <p className="text-muted-foreground mt-1">Explore and analyze stock market data</p>
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
                  <Link href="/stockadvisor">
                    <Button className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                      <span className="relative z-10 flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        <span className="hidden sm:inline">Stock Advisor</span>
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
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
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-400" />
                  <Input
                    type="text"
                    placeholder="Search stocks by symbol or name..."
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 h-12 bg-background border border-input focus:border-blue-500 focus:ring-blue-500 text-foreground placeholder-muted-foreground rounded-xl shadow-sm"
                  />
                </div>

                {/* Exchange Filter */}
                <div className="flex items-center gap-2 bg-secondary px-4 rounded-xl">
                  <Filter className="h-5 w-5 text-blue-500" />
                  <label htmlFor="exchange-filter" className="text-sm font-medium text-foreground whitespace-nowrap">
                    Exchange:
                  </label>
                  <select
                    id="exchange-filter"
                    value={selectedExchange}
                    onChange={(e) => {
                      setSelectedExchange(e.target.value);
                      setPage(1); 
                    }}
                    className="border-0 bg-transparent py-2 text-foreground focus:ring-0 focus:ring-blue-500"
                    disabled={loading}
                  >
                    {exchangeOptions.map((exchange) => (
                      <option key={exchange} value={exchange} className="text-foreground bg-background">
                        {exchange}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-2 bg-secondary px-4 rounded-xl">
                  <Filter className="h-5 w-5 text-blue-500" />
                  <label htmlFor="type-filter" className="text-sm font-medium text-foreground whitespace-nowrap">
                    Type:
                  </label>
                  <select
                    id="type-filter"
                    value={selectedType}
                    onChange={(e) => {
                      setSelectedType(e.target.value);
                      setPage(1);
                    }}
                    className="border-0 bg-transparent py-2 text-foreground focus:ring-0 focus:ring-blue-500"
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
                  onClick={fetchStocks}
                  disabled={loading}
                  variant="outline"
                  className="border-input text-foreground hover:bg-accent rounded-xl"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stock Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <Card className="relative bg-card border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-600/5"></div>
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                    <LineChart className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                    {searchQuery ? `Search Results (Page ${page})` : `Top Stock Listings (Page ${page})`}
                  </h2>
                </div>
                <Button
                  onClick={fetchStocks}
                  disabled={loading}
                  variant="outline"
                  className="border-blue-300 text-blue-600 hover:bg-blue-100 rounded-xl"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
              </div>

              {/* Responsive Grid for Stock Listings */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredStocks.length > 0 ? (
                    filteredStocks.map((stock, index) => (
                      <motion.div
                        key={stock.symbol}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all duration-300 p-4 bg-card"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg text-blue-600">{stock.symbol}</h3>
                            <p className="text-sm text-muted-foreground">{stock.name}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stock.status === "Common Stock"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                              : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100"
                            }`}>
                            {stock.status}
                          </span>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Exchange</p>
                            <p className="text-sm font-medium text-foreground">{stock.exchange}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Change</p>
                            <div className="flex items-center">
                              {stock.change ? (
                                <>
                                  <span className={`text-sm font-medium ${getTrendInfo(stock.percent_change).color}`}>
                                    {parseFloat(stock.percent_change || "0").toFixed(2)}%
                                  </span>
                                  <span className={`ml-1 ${getTrendInfo(stock.percent_change).color}`}>
                                    {getTrendInfo(stock.percent_change).icon}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">N/A</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStock(stock);
                              setIsAddDialogOpen(true);
                            }}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>

                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWatchStock(stock);
                              setIsWatchDialogOpen(true);
                            }}
                            className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white"
                          >
                            <Star className="h-4 w-4 mr-1" />
                            Watch
                          </Button>

                          <Link
                            href={`/stock/${stock.symbol}`}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full group relative overflow-hidden rounded-lg border-input text-foreground hover:bg-accent transition-all"
                            >
                              <span className="relative z-10 flex items-center justify-center gap-1">
                                Analyze
                                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                              </span>
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <p className="text-muted-foreground">No stocks found</p>
                    </div>
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
        
        {selectedStock && (
          <AddToPortfolioDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            asset={{
              symbol: selectedStock.symbol,
              name: selectedStock.name,
              type: "stock",
              exchange: selectedStock.exchange,
            }}
          />
        )}

        {selectedWatchStock && (
          <AddToWatchlistDialog
            open={isWatchDialogOpen}
            onOpenChange={setIsWatchDialogOpen}
            asset={{
              symbol: selectedWatchStock.symbol,
              name: selectedWatchStock.name,
              type: "stock",
            }}
          />
        )}
      </motion.div>
    </div>
  );
}