"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Loader2, Search } from "lucide-react";
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
        <span className="flex items-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading cryptocurrency pairs...
        </span>
      </div>
    );
  }

  if (!Array.isArray(allCryptoPairs) || allCryptoPairs.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>No cryptocurrency pairs available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center text-primary hover:text-primary/80">
              <Button variant="ghost">Back to Home</Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold">Cryptocurrency Market Analysis</h1>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-6">
          {/* Search and Filter Bar */}
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  type="text"
                  placeholder="Search by symbol, base, or quote currency (e.g., BTC/USD)"
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
                  "Search Crypto Pair"
                )}
              </Button>

              {/* Quote Currency Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="quote-currency-filter" className="text-sm font-medium">
                  Quote Currency:
                </label>
                <select
                  id="quote-currency-filter"
                  value={quoteCurrencyFilter}
                  onChange={(e) => handleQuoteCurrencyChange(e.target.value)}
                  className="border rounded px-2 py-1"
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

          {/* Crypto Listings */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                <h2 className="text-2xl md:text-3xl font-semibold">
                  {searchQuery ? `Search Results (Page ${page})` : `Top Crypto Listings (Page ${page})`}
                </h2>
              </div>
              <Button onClick={fetchCryptoPairs} disabled={loading} variant="outline">
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
                    <th className="text-left py-3 px-4">Base Currency</th>
                    <th className="text-left py-3 px-4">Quote Currency</th>
                    <th className="text-left py-3 px-4">Available Exchanges</th>
                    <th className="text-right py-3 px-4">Analyze</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCryptoPairs.length > 0 ? (
                    filteredCryptoPairs.map((pair, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{pair.symbol}</td>
                        <td className="py-3 px-4">{pair.currency_base}</td>
                        <td className="py-3 px-4">{pair.currency_quote}</td>
                        <td className="py-3 px-4">{pair.available_exchanges.join(", ")}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAnalyze(pair.symbol)}
                          >
                            Analyze
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-center">
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