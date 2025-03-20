"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";

// In-memory cache for company overview data
const overviewCache = new Map<string, any>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface TimeSeriesDataPoint {
  date: string;
  close: number;
  adjustedClose: number;
}

interface StockStats {
  latestClose: number;
  latestAdjustedClose: number;
  highestClose: number;
  lowestClose: number;
  averageVolume: number;
  exchange: string;
}

interface CompanyOverview {
  Symbol: string;
  Name: string;
  Description: string;
  Exchange: string;
  MarketCapitalization: string;
  PERatio: string;
  DividendYield: string;
  "52WeekHigh": string;
  "52WeekLow": string;
}

export default function StockPage() {
  const { symbol } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeSeriesError, setTimeSeriesError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const retryDelay = 15000; // 15 seconds delay between retries to avoid Alpha Vantage rate limit

  useEffect(() => {
    if (symbol) {
      fetchStockData(symbol as string);
    }
  }, [symbol, retryCount]);

  const fetchStockData = async (stockSymbol: string) => {
    setLoading(true);
    setTimeSeriesError(null);
    setOverviewError(null);
    setTimeSeriesData([]);
    setStats(null);
    setOverview(null);

    // Fetch company overview
    let overviewData = null;
    try {
      const now = Date.now();
      const cachedOverview = overviewCache.get(stockSymbol);
      if (cachedOverview && cachedOverview.timestamp && (now - cachedOverview.timestamp < CACHE_DURATION)) {
        console.log(`Using cached overview data for ${stockSymbol}`);
        overviewData = cachedOverview.data;
      } else {
        const overviewResponse = await fetch(`/api/overview?symbol=${stockSymbol}`).then(res => res.json());
        if (overviewResponse.error || !overviewResponse.Symbol) {
          throw new Error(overviewResponse.error || "No company overview available for this stock");
        }
        overviewData = overviewResponse;
        overviewCache.set(stockSymbol, { data: overviewResponse, timestamp: now });
      }
      setOverview(overviewData);
    } catch (error) {
      console.error("Overview fetch error:", error.message);
      setOverviewError(error.message || "Failed to fetch company overview");
    }

    // Fetch time series data
    try {
      const timeSeriesResponse = await fetch(`/api/stock?symbol=${stockSymbol}`).then(res => res.json());
      if (timeSeriesResponse.error) {
        throw new Error(timeSeriesResponse.error);
      }

      const timeSeries = timeSeriesResponse["Time Series (Daily)"];
      if (!timeSeries) {
        throw new Error("No time series data available for this stock");
      }

      const chartData: TimeSeriesDataPoint[] = Object.entries(timeSeries)
        .map(([date, values]: [string, any]) => ({
          date,
          close: parseFloat(values["4. close"]),
          adjustedClose: parseFloat(values["5. adjusted close"]),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const closes = chartData.map(d => d.close);
      const adjustedCloses = chartData.map(d => d.adjustedClose);
      const volumes = Object.values(timeSeries).map((v: any) => parseInt(v["6. volume"]));
      const stats: StockStats = {
        latestClose: closes[closes.length - 1],
        latestAdjustedClose: adjustedCloses[adjustedCloses.length - 1],
        highestClose: Math.max(...closes),
        lowestClose: Math.min(...closes),
        averageVolume: volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length,
        exchange: timeSeriesResponse["Meta Data"]["6. Exchange"] || "N/A",
      };

      setTimeSeriesData(chartData);
      setStats(stats);
    } catch (error) {
      console.error("Time series fetch error:", error.message);
      setTimeSeriesError(error.message || "Failed to fetch time series data");
    } finally {
      setLoading(false);
    }

    // If both fetches failed, check retries
    if (timeSeriesError && overviewError && retryCount < maxRetries) {
      toast({
        title: "Retrying",
        description: `Failed to fetch data. Retrying (${retryCount + 1}/${maxRetries})...`,
        variant: "default",
      });
      setTimeout(() => setRetryCount(retryCount + 1), retryDelay);
    } else if (timeSeriesError && overviewError) {
      toast({
        title: "Error",
        description: "Failed to fetch both company overview and time series data",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    if (symbol) {
      setRetryCount(0);
      fetchStockData(symbol as string);
    }
  };

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
            </div>
            <h1 className="text-2xl font-bold">{symbol} Stock Analysis</h1>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-l mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center">
            <div className="flex justify-center items-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* Show Company Overview if available */}
            {overview && !overviewError ? (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Company Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Symbol</p>
                    <p className="text-lg font-medium">{overview.Symbol}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-lg font-medium">{overview.Name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Exchange</p>
                    <p className="text-lg font-medium">{overview.Exchange}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Market Cap</p>
                    <p className="text-lg font-medium">
                      {overview.MarketCapitalization !== "N/A"
                        ? `$${parseFloat(overview.MarketCapitalization).toLocaleString()}`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">P/E Ratio</p>
                    <p className="text-lg font-medium">{overview.PERatio}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dividend Yield</p>
                    <p className="text-lg font-medium">{overview.DividendYield}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">52-Week High</p>
                    <p className="text-lg font-medium">{overview["52WeekHigh"]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">52-Week Low</p>
                    <p className="text-lg font-medium">{overview["52WeekLow"]}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-base">{overview.Description}</p>
                </div>
              </Card>
            ) : (
              overviewError && (
                <div className="text-center text-red-500">
                  <p>{overviewError}</p>
                </div>
              )
            )}

            {/* Show Stock Statistics and Charts if available */}
            {timeSeriesData.length > 0 && stats && !timeSeriesError ? (
              <>
                {/* Stats Card */}
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Stock Statistics</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Latest Close</p>
                      <p className="text-lg font-medium">${stats.latestClose.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Latest Adjusted Close</p>
                      <p className="text-lg font-medium">${stats.latestAdjustedClose.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Highest Close</p>
                      <p className="text-lg font-medium">${stats.highestClose.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lowest Close</p>
                      <p className="text-lg font-medium">${stats.lowestClose.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Average Volume</p>
                      <p className="text-lg font-medium">{Math.round(stats.averageVolume).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Exchange</p>
                      <p className="text-lg font-medium">{stats.exchange}</p>
                    </div>
                  </div>
                </Card>

                {/* Regular Closing Price Chart */}
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Daily Closing Prices</h2>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="close" stroke="#8884d8" name="Closing Price" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Adjusted Closing Price Chart */}
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Daily Adjusted Closing Prices</h2>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="adjustedClose" stroke="#82ca9d" name="Adjusted Closing Price" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            ) : (
              timeSeriesError && (
                <div className="text-center text-red-500">
                  <p>{timeSeriesError}</p>
                </div>
              )
            )}

            {/* Show a fallback message only if both sections are unavailable */}
            {timeSeriesError && overviewError && (
              <div className="text-center">
                <p className="text-red-500">No data available for {symbol}.</p>
                <Button onClick={handleRefresh} variant="outline" className="mt-4">
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}