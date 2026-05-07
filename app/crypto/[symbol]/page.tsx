"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";
import { BarChart3, MessageCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { marketThemes } from "@/lib/themes";
import { TechnicalChart } from "@/components/charts/TechnicalChart";

// Format large numbers with commas and appropriate precision for crypto
const formatCryptoNumber = (num: number | string | undefined): string => {
  if (num === undefined || num === null) return "N/A";
  const number = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(number)) return "N/A";

  if (number >= 1000000) {
    return `$${(number / 1000000).toFixed(2)}M`;
  } else if (number >= 1000) {
    return `$${(number / 1000).toFixed(2)}K`;
  } else if (number >= 1) {
    return `$${number.toFixed(2)}`;
  } else if (number >= 0.01) {
    return `$${number.toFixed(4)}`;
  } else {
    return `$${number.toFixed(8)}`;
  }
};

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

interface OverviewData {
  logo_base: string | null;
  logo_quote: string | null;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: number;
  lastUpdated: string;
}

interface CryptoData {
  timeSeries: {
    meta: {
      symbol: string;
      interval: string;
      currency_base: string;
      currency_quote: string;
      type: string;
    };
    values: Array<{
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume?: string;
    }>;
    status: string;
  };
  quote: {
    symbol: string;
    name: string;
    currency_base: string;
    currency_quote: string;
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    previous_close: string;
    change: string;
    percent_change: string;
    volume?: string;
  };
  price: {
    price: string;
  };
  eod: {
    symbol: string;
    currency_base: string;
    currency_quote: string;
    datetime: string;
    close: string;
  };
  overview: OverviewData;
  technicalIndicators: {
    rsi: number[];
    macd: {
      macdLine: number[];
      signalLine: number[];
      histogram: number[];
    };
    bollingerBands: {
      upper: number[];
      middle: number[];
      lower: number[];
    };
    adx: number[];
    atr: number[];
    aroon: {
      up: number[];
      down: number[];
    };
  };
  priceHistory: {
    date: string;
    close: number;
    adjustedClose: number;
  }[];
}

interface TechnicalIndicators {
  ema: {
    ema20: Array<{ datetime: string; ema: string }> | null;
    ema50: Array<{ datetime: string; ema: string }> | null;
  };
  rsi: Array<{ datetime: string; rsi: string }> | null;
  macd: Array<{
    datetime: string;
    macd: string;
    macd_signal: string;
    macd_hist: string;
  }> | null;
  bbands: Array<{
    datetime: string;
    upper_band: string;
    middle_band: string;
    lower_band: string;
  }> | null;
  atr: Array<{ datetime: string; atr: string }> | null;
  obv: Array<{ datetime: string; obv: string }> | null;
  supertrend: Array<{ datetime: string; supertrend: string }> | null;
}

// Utility function to fetch with retry on rate limit
const fetchWithRetry = async (
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 60000 // 60 seconds
): Promise<Response> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url);
    if (response.status === 429) {
      const delay = baseDelay * attempt; // Exponential backoff: 60s, 120s, 180s
      console.log(`Rate limit exceeded. Retrying in ${delay / 1000} seconds... (Attempt ${attempt}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    return response;
  }
  throw new Error("Max retries reached due to rate limit (429)");
};

export default function CryptoDetails() {
  const params = useParams();
  const encodedSymbol = params?.symbol as string;
  const symbol = encodedSymbol ? decodeURIComponent(encodedSymbol) : null;
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [cryptoData, setCryptoData] = useState<CryptoData | null>(null);
  const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const theme = marketThemes.crypto;

  if (!symbol) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">Cryptocurrency pair symbol is missing.</p>
          <Link href="/cryptos">
            <Button variant="outline">Back to Crypto Listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  useEffect(() => {

    if (!symbol) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        console.log(`Fetching data for symbol: ${symbol}`);

        // Fetch Overview Data
        const overviewResponse = await fetchWithRetry(`/api/overview?symbol=${symbol}`);
        if (!overviewResponse.ok) {
          const contentType = overviewResponse.headers.get("content-type");
          let errorMessage = `Failed to fetch overview data: ${overviewResponse.status} ${overviewResponse.statusText}`;
          if (contentType && contentType.includes("application/json")) {
            const errorData = await overviewResponse.json();
            errorMessage = errorData.error || errorMessage;
          }
          throw new Error(errorMessage);
        }
        const overviewData = await overviewResponse.json();
        setOverview(overviewData);

        // Fetch Crypto Data
        const cryptoResponse = await fetchWithRetry(`/api/crypto?symbol=${symbol}`);
        if (!cryptoResponse.ok) {
          const contentType = cryptoResponse.headers.get("content-type");
          let errorMessage = `Failed to fetch crypto data: ${cryptoResponse.status} ${cryptoResponse.statusText}`;
          if (contentType && contentType.includes("application/json")) {
            const errorData = await cryptoResponse.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage += " (Received non-JSON response)";
          }
          throw new Error(errorMessage);
        }
        const cryptoData = await cryptoResponse.json();
        console.log("Fetched cryptoData:", cryptoData);
        setCryptoData(cryptoData);

        // Fetch Technical Indicators
        const indicatorsResponse = await fetchWithRetry(`/api/crypto-technical-indicators?symbol=${symbol}`);
        if (!indicatorsResponse.ok) {
          const contentType = indicatorsResponse.headers.get("content-type");
          let errorMessage = `Failed to fetch technical indicators: ${indicatorsResponse.status} ${indicatorsResponse.statusText}`;
          if (contentType && contentType.includes("application/json")) {
            const errorData = await indicatorsResponse.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage += " (Received non-JSON response)";
          }
          throw new Error(errorMessage);
        }
        const indicatorsData = await indicatorsResponse.json();
        setTechnicalIndicators(indicatorsData);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error fetching data:", errorMessage);
        toast({
          title: "Error",
          description: errorMessage || "Failed to fetch crypto data",
          variant: "destructive"
        });
        setOverview(null);
        setCryptoData(null);
        setTechnicalIndicators(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">
          Fetching technical indicators for {symbol}... This may take up to 2 minutes due to API rate limits.
        </p>
      </div>
    );
  }

  if (!overview || !cryptoData || !cryptoData.timeSeries || !technicalIndicators) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">
            No data available for {symbol}. This cryptocurrency pair may not be supported by the data provider.
            <br />
            Try a different pair, such as{" "}
            <Link href="/crypto/BTC%2FUSD" className="text-primary underline">
              BTC/USD
            </Link>.
          </p>
          <Link href="/cryptos">
            <Button variant="outline">Back to Crypto Listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Prepare chart data for time series
  const timeSeries = cryptoData.timeSeries.values || [];
  console.log("timeSeries:", timeSeries);

  // Format the EOD date
  const eodDateFormatted = cryptoData.eod?.datetime
    ? new Date(cryptoData.eod.datetime).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  // EMA Interpretation
  const latestEma20 = technicalIndicators.ema.ema20 ? technicalIndicators.ema.ema20[0] : null;
  const latestEma50 = technicalIndicators.ema.ema50 ? technicalIndicators.ema.ema50[0] : null;
  let emaInterpretation = "N/A";
  if (latestEma20 && latestEma50) {
    const ema20Value = parseFloat(latestEma20.ema);
    const ema50Value = parseFloat(latestEma50.ema);
    if (ema20Value > ema50Value) {
      emaInterpretation = "Bullish (EMA20 > EMA50)";
    } else if (ema20Value < ema50Value) {
      emaInterpretation = "Bearish (EMA20 < EMA50)";
    } else {
      emaInterpretation = "Neutral";
    }
  }

  // RSI Interpretation
  const latestRsi = technicalIndicators.rsi ? technicalIndicators.rsi[0] : null;
  const rsiValue = latestRsi ? parseFloat(latestRsi.rsi) : null;
  let rsiInterpretation = "N/A";
  if (rsiValue !== null) {
    if (rsiValue > 70) {
      rsiInterpretation = "Overbought";
    } else if (rsiValue < 30) {
      rsiInterpretation = "Oversold";
    } else {
      rsiInterpretation = "Neutral";
    }
  }

  // MACD Interpretation
  const latestMacd = technicalIndicators.macd ? technicalIndicators.macd[0] : null;
  let macdInterpretation = "N/A";
  if (latestMacd) {
    const macdLine = parseFloat(latestMacd.macd);
    const signalLine = parseFloat(latestMacd.macd_signal);
    if (macdLine > signalLine) {
      macdInterpretation = "Bullish (Buy Signal)";
    } else if (macdLine < signalLine) {
      macdInterpretation = "Bearish (Sell Signal)";
    } else {
      macdInterpretation = "Neutral";
    }
  }

  // BBANDS Interpretation
  const latestBbands = technicalIndicators.bbands ? technicalIndicators.bbands[0] : null;
  const latestClose = cryptoData?.quote?.close ? parseFloat(cryptoData.quote.close) : null;
  let bbandsInterpretation = "N/A";
  if (latestBbands && latestClose !== null) {
    const upperBand = parseFloat(latestBbands.upper_band);
    const lowerBand = parseFloat(latestBbands.lower_band);
    if (latestClose > upperBand) {
      bbandsInterpretation = "Above Upper Band (Overbought)";
    } else if (latestClose < lowerBand) {
      bbandsInterpretation = "Below Lower Band (Oversold)";
    } else {
      bbandsInterpretation = "Within Bands";
    }
  }

  // ATR Interpretation
  const latestAtr = technicalIndicators.atr ? technicalIndicators.atr[0] : null;
  const atrValue = latestAtr ? parseFloat(latestAtr.atr) : null;
  let atrInterpretation = "N/A";
  if (atrValue !== null && latestClose !== null) {
    const atrPercent = (atrValue / latestClose) * 100;
    if (atrPercent > 2) {
      atrInterpretation = `High Volatility (${atrPercent.toFixed(2)}% of price)`;
    } else if (atrPercent < 1) {
      atrInterpretation = `Low Volatility (${atrPercent.toFixed(2)}% of price)`;
    } else {
      atrInterpretation = `Moderate Volatility (${atrPercent.toFixed(2)}% of price)`;
    }
  }

  // Supertrend Interpretation
  const latestSupertrend = technicalIndicators.supertrend ? technicalIndicators.supertrend[0] : null;
  const supertrendValue = latestSupertrend ? parseFloat(latestSupertrend.supertrend) : null;
  let supertrendInterpretation = "N/A";
  if (supertrendValue !== null && latestClose !== null) {
    if (latestClose > supertrendValue) {
      supertrendInterpretation = `Bullish (Price > Supertrend)`;
    } else {
      supertrendInterpretation = `Bearish (Price < Supertrend)`;
    }
  }

  // OBV Interpretation
  const latestObv = technicalIndicators.obv ? technicalIndicators.obv[0] : null;
  const obvValue = latestObv ? parseFloat(latestObv.obv) : null;
  let obvInterpretation = "N/A";
  if (
    obvValue !== null &&
    latestClose !== null &&
    technicalIndicators.obv &&
    technicalIndicators.obv.length > 1 &&
    timeSeries.length >= 2
  ) {
    const previousObv = parseFloat(technicalIndicators.obv[1].obv);
    const previousClose = parseFloat(timeSeries[timeSeries.length - 2].close);
    const priceDirection = latestClose > previousClose ? "Up" : "Down";
    const obvDirection = obvValue > previousObv ? "Up" : "Down";
    if (priceDirection === obvDirection) {
      obvInterpretation = `Confirmation (${priceDirection} trend supported by volume)`;
    } else {
      obvInterpretation = `Divergence (Price ${priceDirection}, OBV ${obvDirection})`;
    }
  }

  // ---------------------------------------------------------------------------
  // Recharts data preparation (useMemo for performance)
  // ---------------------------------------------------------------------------

  // Price History + EMA + Bollinger Bands + Supertrend overlay
  const priceChartData = useMemo(() => {
    const reversedSeries = [...timeSeries].reverse();
    const ema20Map = new Map(
      (technicalIndicators.ema.ema20 ?? []).map((e) => [e.datetime, parseFloat(e.ema)])
    );
    const ema50Map = new Map(
      (technicalIndicators.ema.ema50 ?? []).map((e) => [e.datetime, parseFloat(e.ema)])
    );
    const bbandsMap = new Map(
      (technicalIndicators.bbands ?? []).map((e) => [
        e.datetime,
        {
          upper: parseFloat(e.upper_band),
          middle: parseFloat(e.middle_band),
          lower: parseFloat(e.lower_band),
        },
      ])
    );
    const supertrendMap = new Map(
      (technicalIndicators.supertrend ?? []).map((e) => [e.datetime, parseFloat(e.supertrend)])
    );

    return reversedSeries.map((entry) => ({
      date: entry.datetime,
      close: parseFloat(entry.close),
      ema20: ema20Map.get(entry.datetime) ?? null,
      ema50: ema50Map.get(entry.datetime) ?? null,
      bbUpper: bbandsMap.get(entry.datetime)?.upper ?? null,
      bbMiddle: bbandsMap.get(entry.datetime)?.middle ?? null,
      bbLower: bbandsMap.get(entry.datetime)?.lower ?? null,
      supertrend: supertrendMap.get(entry.datetime) ?? null,
    }));
  }, [timeSeries, technicalIndicators]);

  // Supertrend standalone chart (price + supertrend)
  const supertrendChartData = useMemo(() => {
    const reversedSeries = [...timeSeries].reverse();
    const supertrendMap = new Map(
      (technicalIndicators.supertrend ?? []).map((e) => [e.datetime, parseFloat(e.supertrend)])
    );
    return reversedSeries.map((entry) => ({
      date: entry.datetime,
      close: parseFloat(entry.close),
      supertrend: supertrendMap.get(entry.datetime) ?? null,
    }));
  }, [timeSeries, technicalIndicators]);

  // RSI
  const rsiChartData = useMemo(() => {
    if (!technicalIndicators.rsi) return [];
    return [...technicalIndicators.rsi].reverse().map((entry) => ({
      date: entry.datetime,
      rsi: parseFloat(entry.rsi),
    }));
  }, [technicalIndicators]);

  // MACD
  const macdChartData = useMemo(() => {
    if (!technicalIndicators.macd) return [];
    return [...technicalIndicators.macd].reverse().map((entry) => ({
      date: entry.datetime,
      macd: parseFloat(entry.macd),
      signal: parseFloat(entry.macd_signal),
      histogram: parseFloat(entry.macd_hist),
    }));
  }, [technicalIndicators]);

  // ATR
  const atrChartData = useMemo(() => {
    if (!technicalIndicators.atr) return [];
    return [...technicalIndicators.atr].reverse().map((entry) => ({
      date: entry.datetime,
      atr: parseFloat(entry.atr),
    }));
  }, [technicalIndicators]);

  // OBV
  const obvChartData = useMemo(() => {
    if (!technicalIndicators.obv) return [];
    return [...technicalIndicators.obv].reverse().map((entry) => ({
      date: entry.datetime,
      obv: parseFloat(entry.obv),
    }));
  }, [technicalIndicators]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-amber-500" />
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-600">FinanceAI</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-accent">Analyze Market</Button>
              </Link>
              <Link href="/cryptos">
                <Button variant="outline" className="border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white">Back to Crypto Listings</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Hero Section */}
        <section className="py-10 px-4 bg-gradient-to-b from-background to-muted/20 rounded-xl mb-8">
          <div className="max-w-full mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex justify-center items-center gap-4 mb-4">
                {overview.logo_base && overview.logo_quote ? (
                  <div className="flex gap-2">
                    <div className="bg-white p-2 rounded-full shadow-lg">
                      <Image
                        src={overview.logo_base}
                        alt={`${symbol} base logo`}
                        width={30}
                        height={30}
                        className="rounded-full"
                      />
                    </div>
                    <div className="bg-white p-2 rounded-full shadow-lg">
                      <Image
                        src={overview.logo_quote}
                        alt={`${symbol} quote logo`}
                        width={30}
                        height={30}
                        className="rounded-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {symbol.split('/').map((currency, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-sm px-3 py-2 rounded-full shadow-lg"
                      >
                        {currency}
                      </div>
                    ))}
                  </div>
                )}
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-600">
                  {symbol} - {cryptoData.quote?.name || "Unknown"}
                </h1>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Dive into detailed analysis for {symbol}, including real-time price data, technical indicators, and historical trends.
              </p>
            </motion.div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6">
          {/* Crypto Statistics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card border-border rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Cryptocurrency Pair Statistics</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Current Price</p>
                  <div className="flex items-center mt-1">
                    <p className="text-2xl font-bold text-foreground">
                      {cryptoData.price?.price
                        ? formatCryptoNumber(parseFloat(cryptoData.price.price))
                        : "N/A"}
                    </p>
                    {cryptoData.quote && (
                      <span className={`ml-2 flex items-center text-sm ${getTrendInfo(cryptoData.quote.change).color}`}>
                        {getTrendInfo(cryptoData.quote.change).icon}
                        <span className="ml-1">
                          {parseFloat(cryptoData.quote.change || "0").toFixed(8)} ({parseFloat(cryptoData.quote.percent_change || "0").toFixed(2)}%)
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">24h Range</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {formatCryptoNumber(parseFloat(cryptoData.quote.low || "0"))} - {formatCryptoNumber(parseFloat(cryptoData.quote.high || "0"))}
                  </p>
                </div>

                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Volume (24h)</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {cryptoData.quote.volume ? formatCryptoNumber(parseFloat(cryptoData.quote.volume)) : "N/A"}
                  </p>
                </div>

                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Currencies</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {cryptoData.quote.currency_base}/{cryptoData.quote.currency_quote}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                <div>
                  <p>
                    <strong>EOD Price ({eodDateFormatted}):</strong>{" "}
                    {cryptoData.eod?.close
                      ? formatCryptoNumber(parseFloat(cryptoData.eod.close))
                      : "N/A"}
                  </p>
                  <p>
                    <strong>Latest Close:</strong>{" "}
                    {formatCryptoNumber(parseFloat(cryptoData.quote.close || "0"))}
                  </p>
                  <p>
                    <strong>Latest Open:</strong>{" "}
                    {formatCryptoNumber(parseFloat(cryptoData.quote.open || "0"))}
                  </p>
                  <p>
                    <strong>Daily High:</strong>{" "}
                    {formatCryptoNumber(parseFloat(cryptoData.quote.high || "0"))}
                  </p>
                  <p>
                    <strong>Daily Low:</strong>{" "}
                    {formatCryptoNumber(parseFloat(cryptoData.quote.low || "0"))}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Previous Close:</strong>{" "}
                    {formatCryptoNumber(parseFloat(cryptoData.quote.previous_close || "0"))}
                  </p>
                  <p>
                    <strong>Change:</strong>{" "}
                    {parseFloat(cryptoData.quote.change || "0").toFixed(8)} (
                    {parseFloat(cryptoData.quote.percent_change || "0").toFixed(2)}%)
                  </p>
                  <p>
                    <strong>Base Currency:</strong>{" "}
                    {cryptoData.quote.currency_base || "N/A"}
                  </p>
                  <p>
                    <strong>Quote Currency:</strong>{" "}
                    {cryptoData.quote.currency_quote || "N/A"}
                  </p>
                  <p>
                    <strong>Latest Volume:</strong>{" "}
                    {cryptoData.quote.volume || "N/A"}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Technical Indicators (Numerical Summaries) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card border-border rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Technical Indicators Summary</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* EMA */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-amber-500" />
                    Exponential Moving Averages
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">20-Day EMA</p>
                      <p className="font-medium">
                        {latestEma20 ? formatCryptoNumber(parseFloat(latestEma20.ema)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">50-Day EMA</p>
                      <p className="font-medium">
                        {latestEma50 ? formatCryptoNumber(parseFloat(latestEma50.ema)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          emaInterpretation.includes("Bullish")
                            ? "bg-green-100 text-green-800"
                            : emaInterpretation.includes("Bearish")
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {emaInterpretation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RSI */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-amber-500" />
                    Relative Strength Index (RSI)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">14-Day RSI</p>
                      <p className="font-medium">
                        {latestRsi ? parseFloat(latestRsi.rsi).toFixed(2) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rsiInterpretation === "Overbought"
                            ? "bg-red-100 text-red-800"
                            : rsiInterpretation === "Oversold"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {rsiInterpretation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MACD */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-amber-500" />
                    MACD
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">MACD Line</p>
                      <p className="font-medium">
                        {latestMacd ? parseFloat(latestMacd.macd).toFixed(8) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Signal Line</p>
                      <p className="font-medium">
                        {latestMacd ? parseFloat(latestMacd.macd_signal).toFixed(8) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          macdInterpretation.includes("Bullish")
                            ? "bg-green-100 text-green-800"
                            : macdInterpretation.includes("Bearish")
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {macdInterpretation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BBANDS */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-amber-500" />
                    Bollinger Bands
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Upper Band</p>
                      <p className="font-medium">
                        {latestBbands ? formatCryptoNumber(parseFloat(latestBbands.upper_band)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Middle Band</p>
                      <p className="font-medium">
                        {latestBbands ? formatCryptoNumber(parseFloat(latestBbands.middle_band)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lower Band</p>
                      <p className="font-medium">
                        {latestBbands ? formatCryptoNumber(parseFloat(latestBbands.lower_band)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          bbandsInterpretation.includes("Overbought")
                            ? "bg-red-100 text-red-800"
                            : bbandsInterpretation.includes("Oversold")
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {bbandsInterpretation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ATR */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-amber-500" />
                    Average True Range (ATR)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">14-Day ATR</p>
                      <p className="font-medium">
                        {latestAtr ? parseFloat(latestAtr.atr).toFixed(8) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          atrInterpretation.includes("High")
                            ? "bg-red-100 text-red-800"
                            : atrInterpretation.includes("Low")
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {atrInterpretation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Supertrend */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-amber-500" />
                    Supertrend
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="font-medium">
                        {latestSupertrend ? formatCryptoNumber(parseFloat(latestSupertrend.supertrend)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          supertrendInterpretation.includes("Bullish")
                            ? "bg-green-100 text-green-800"
                            : supertrendInterpretation.includes("Bearish")
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {supertrendInterpretation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* OBV */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-amber-500" />
                    On-Balance Volume (OBV)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="font-medium">
                        {latestObv ? formatCryptoNumber(parseFloat(latestObv.obv)) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {obvInterpretation}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Charts Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card border-border rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Technical Indicator Charts</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Price History with EMA + Bollinger Bands + Supertrend */}
                <TechnicalChart
                  data={priceChartData}
                  title="Price History with Indicators"
                  height={320}
                  yTickFormatter={(v) => `$${v}`}
                  datasets={[
                    { key: "close", label: "Closing Price", color: theme.primary },
                    { key: "ema20", label: "20-Day EMA", color: "#f59e0b", dashed: true },
                    { key: "ema50", label: "50-Day EMA", color: "#10b981", dashed: true },
                    { key: "bbUpper", label: "BB Upper", color: "#6366f1", dashed: true },
                    { key: "bbMiddle", label: "BB Middle", color: "#6366f1", dashed: true },
                    { key: "bbLower", label: "BB Lower", color: "#6366f1", dashed: true },
                    { key: "supertrend", label: "Supertrend", color: "#ef4444" },
                  ]}
                />

                {/* Supertrend standalone */}
                <TechnicalChart
                  data={supertrendChartData}
                  title="Supertrend"
                  height={320}
                  yTickFormatter={(v) => `$${v}`}
                  datasets={[
                    { key: "close", label: "Closing Price", color: theme.primary },
                    {
                      key: "supertrend",
                      label: "Supertrend",
                      color: "#ef4444",
                      barColorFn: (value) =>
                        latestClose !== null && value < latestClose ? "#22c55e" : "#ef4444",
                    },
                  ]}
                />

                {/* RSI */}
                <TechnicalChart
                  data={rsiChartData}
                  title="Relative Strength Index (RSI)"
                  height={320}
                  yDomain={[0, 100]}
                  datasets={[
                    { key: "rsi", label: "RSI", color: "#f59e0b" },
                  ]}
                  referenceLines={[
                    { y: 70, color: "#ef4444", label: "Overbought (70)" },
                    { y: 30, color: "#22c55e", label: "Oversold (30)" },
                  ]}
                />

                {/* MACD */}
                <TechnicalChart
                  data={macdChartData}
                  title="MACD"
                  height={320}
                  datasets={[
                    { key: "histogram", label: "Histogram", color: "#22c55e", type: "bar", barColorFn: (v) => (v >= 0 ? "#22c55e" : "#ef4444") },
                    { key: "macd", label: "MACD", color: "#3b82f6" },
                    { key: "signal", label: "Signal", color: "#f59e0b", dashed: true },
                  ]}
                />

                {/* ATR */}
                <TechnicalChart
                  data={atrChartData}
                  title="Average True Range (ATR)"
                  height={320}
                  datasets={[
                    { key: "atr", label: "ATR", color: "#ec4899" },
                  ]}
                />

                {/* OBV */}
                <TechnicalChart
                  data={obvChartData}
                  title="On-Balance Volume (OBV)"
                  height={320}
                  datasets={[
                    { key: "obv", label: "OBV", color: "#06b6d4" },
                  ]}
                />
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div className="fixed bottom-6 right-6 z-50 group" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 1 }} whileHover={{ scale: 1.1 }}>
          <Link href="/cryptoadvisor">
            <Button className="p-4 rounded-full shadow-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transition-all duration-300">
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </Link>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-card text-foreground text-sm font-medium px-3 py-1 rounded-lg shadow-md">Your Crypto Advisor</div>
        </motion.div>
      </main>
    </div>
  );
}
