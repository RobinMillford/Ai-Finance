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
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]); // Filtered stocks based on search
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState(""); // Search input state
  const { toast } = useToast();

  useEffect(() => {
    fetchStocks(page);
  }, [page]);

  useEffect(() => {
    // Filter stocks based on search query
    if (searchQuery.trim() === "") {
      setFilteredStocks(stocks);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = stocks.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(lowerQuery) ||
          stock.name.toLowerCase().includes(lowerQuery)
      );
      setFilteredStocks(filtered);
    }
  }, [searchQuery, stocks]);

  const fetchStocks = async (pageNum: number) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const response = await fetch(`/api/stocks?page=${pageNum}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error.includes("rate limit")) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched data:", data);

      if (!Array.isArray(data.stocks)) {
        throw new Error("Invalid stock data format");
      }

      setStocks(data.stocks);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error("Fetch error:", error.message);
      setStocks([]);
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
    if (!searchQuery.trim()) return; // Do nothing if search query is empty

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const response = await fetch(`/api/stock?symbol=${searchQuery.toUpperCase()}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error.includes("rate limit")) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        }
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
        exchange: "N/A",
        status: "Stock",
      };

      setStocks([stock]);
      setFilteredStocks([stock]);
      setTotalPages(1);
      setPage(1);
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
  }, 1000); // Debounce for 1 second

  const handleSearch = () => {
    debouncedSearch();
  };

  // Generate page options for dropdown (1 to totalPages)
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
          {/* Search Bar */}
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
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
                onClick={() => fetchStocks(page)}
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
                    <th className="text-right py-3 px-4">Action</th>
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
                              stock.status === "Stock"
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