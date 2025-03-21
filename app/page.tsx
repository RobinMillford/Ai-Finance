"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Newspaper, Brain, BarChart3, Search } from "lucide-react";
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

export default function Home() {
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
      await new Promise(resolve => setTimeout(resolve, 500));
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
      await new Promise(resolve => setTimeout(resolve, 500));
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
        <div className="max-w-l mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-8">
              <Link
                href="/"
                className="flex items-center text-primary hover:text-primary/80"
              >
                <BarChart3 className="h-6 w-6 mr-2" />
                <span className="font-semibold">Stocks</span>
              </Link>
              <Link
                href="/news"
                className="flex items-center text-primary hover:text-primary/80"
              >
                <Newspaper className="h-6 w-6 mr-2" />
                <span className="font-semibold">News</span>
              </Link>
              <Link
                href="/advisor"
                className="flex items-center text-primary hover:text-primary/80"
              >
                <Brain className="h-6 w-6 mr-2" />
                <span className="font-semibold">AI Advisor</span>
              </Link>
            </div>
            <h1 className="text-2xl font-bold">Stock Market Analysis</h1>
          </div>
        </div>
      </header>

      <main className="max-w-l mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-6">
          {/* Search and Filter Bar */}
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  type="text"
                  placeholder="Search by symbol or name (e.g., AAPL)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? "Searching..." : "Search Stock"}
              </Button>

              {/* Exchange Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="exchange-filter" className="text-sm font-medium">
                  Exchange:
                </label>
                <select
                  id="exchange-filter"
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value)}
                  className="border rounded px-2 py-1"
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
                <label htmlFor="type-filter" className="text-sm font-medium">
                  Type:
                </label>
                <select
                  id="type-filter"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="border rounded px-2 py-1"
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

          {/* Stock Listings */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                <h2 className="text-2xl font-semibold">
                  {searchQuery ? `Search Results (Page ${page})` : `Top Stock Listings (Page ${page})`}
                </h2>
              </div>
              <Button
                onClick={fetchStocks}
                disabled={loading}
                variant="outline"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Symbol</th>
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Exchange</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-right py-3 px-4">Analyze</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.length > 0 ? (
                    filteredStocks.map((stock, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{stock.symbol}</td>
                        <td className="py-3 px-4">{stock.name}</td>
                        <td className="py-3 px-4">{stock.exchange}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              stock.status === "Common Stock"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {stock.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/stock/${stock.symbol}`}>
                            <Button variant="ghost" size="sm">Analyze</Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-center">
                        {loading ? "Loading..." : "No stocks found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex justify-between mt-5">
              <Button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1 || loading}
                variant="outline"
              >
                ⬅ Previous
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-lg">Page:</span>
                <select
                  value={page}
                  onChange={(e) => setPage(parseInt(e.target.value))}
                  className="border rounded px-2 py-1"
                  disabled={loading}
                >
                  {pageOptions.map((pageNum) => (
                    <option key={pageNum} value={pageNum}>
                      {pageNum}
                    </option>
                  ))}
                </select>
                <span className="text-lg">of {totalPages}</span>
              </div>

              <Button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages || loading}
                variant="outline"
              >
                Next ➡
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}