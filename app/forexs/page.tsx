"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Newspaper, Brain, BarChart3, Search, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { debounce } from "lodash";

interface ForexPair {
  symbol: string;
  name: string;
  exchange: string;
  status: string; // Now represents currency_group (e.g., "Major", "Exotic")
  base_currency?: string;
  quote_currency?: string;
}

interface ForexResponse {
  pairs: ForexPair[];
  totalCount: number;
}

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
      await new Promise(resolve => setTimeout(resolve, 500));
      const response = await fetch(
        `/api/forexs?page=${page}&perPage=${perPage}¤cyGroup=${selectedType}&searchQuery=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const data: ForexResponse = await response.json();

      setAllForexPairs(data.pairs);
      setFilteredForexPairs(data.pairs);
      setTotalCount(data.totalCount);
      setTotalPages(Math.ceil(data.totalCount / perPage));

      // Fetch filter options from the first page (without filters) if not already set
      if (typeOptions.length === 0) {
        const optionsResponse = await fetch(`/api/forexs?page=1&perPage=${perPage}`);
        if (optionsResponse.ok) {
          const optionsData: ForexResponse = await optionsResponse.json();
          const types = Array.from(new Set(optionsData.pairs.map((pair: ForexPair) => pair.status))).sort();
          setTypeOptions(["All", ...types]);
        }
      }

      if (data.pairs.length === 0) {
        toast({
          title: "Warning",
          description: "No forex pairs found. Check your API key, rate limits, or filters.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Fetch error:", error.message);
      setAllForexPairs([]);
      setFilteredForexPairs([]);
      setTotalCount(0);
      setTotalPages(1);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch forex listings",
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
  const checkPairSupport = async (symbol: string) => {
    try {
      const response = await fetch(`/api/forex?symbol=${symbol}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch forex data");
      }
      return true; // Pair is supported
    } catch (error) {
      console.error(`Error checking support for ${symbol}:`, error.message);
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
                href="/forexs"
                className="flex items-center text-primary hover:text-primary/80"
              >
                <DollarSign className="h-6 w-6 mr-2" />
                <span className="font-semibold">Forex</span>
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
            <h1 className="text-2xl font-bold">Forex Market Analysis</h1>
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
                  placeholder="Search by symbol, name, or currency (e.g., EUR/USD)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <span className="flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Searching...
                  </span>
                ) : (
                  "Search Forex Pair"
                )}
              </Button>

              {/* Type Filter (now Currency Group) */}
              <div className="flex items-center gap-2">
                <label htmlFor="type-filter" className="text-sm font-medium">
                  Currency Group:
                </label>
                <select
                  id="type-filter"
                  value={selectedType}
                  onChange={(e) => handleTypeChange(e.target.value)}
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

          {/* Forex Listings */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                <h2 className="text-2xl font-semibold">
                  {searchQuery ? `Search Results (Page ${page})` : `Top Forex Listings (Page ${page})`}
                </h2>
              </div>
              <Button
                onClick={fetchForexPairs}
                disabled={loading}
                variant="outline"
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
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Symbol</th>
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Base Currency</th>
                    <th className="text-left py-3 px-4">Quote Currency</th>
                    <th className="text-left py-3 px-4">Exchange</th>
                    <th className="text-left py-3 px-4">Currency Group</th>
                    <th className="text-right py-3 px-4">Analyze</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForexPairs.length > 0 ? (
                    filteredForexPairs.map((pair, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{pair.symbol}</td>
                        <td className="py-3 px-4">{pair.name}</td>
                        <td className="py-3 px-4">{pair.base_currency || "N/A"}</td>
                        <td className="py-3 px-4">{pair.quote_currency || "N/A"}</td>
                        <td className="py-3 px-4">{pair.exchange}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              pair.status === "Major"
                                ? "bg-green-100 text-green-800"
                                : pair.status === "Exotic"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {pair.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/forex/${encodeURIComponent(pair.symbol)}`}
                            onClick={(e) => handleAnalyzeClick(pair.symbol, e)}
                          >
                            <Button variant="ghost" size="sm">Analyze</Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-3 px-4 text-center">
                        {loading ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            Loading forex pairs...
                          </span>
                        ) : (
                          "No forex pairs found"
                        )}
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