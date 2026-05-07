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

// Format large numbers with commas
const formatNumber = (num: number | string | undefined): string => {
  if (num === undefined || num === null) return "N/A";
  const number = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(number)) return "N/A";

  if (number >= 1000000) {
    return `$${(number / 1000000).toFixed(2)}M`;
  } else if (number >= 1000) {
    return `$${(number / 1000).toFixed(2)}K`;
  }
  return `$${number.toFixed(2)}`;
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

// Add theme colors at the top of the file after imports
const green500 = "#10B981";
const emerald600 = "#059669";

interface OverviewData {
  logo_base: string | null;
  logo_quote: string | null;
}

interface ForexData {
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
  } | null;
  price: {
    price: string;
  } | null;
  eod: {
    symbol: string;
    currency_base: string;
    currency_quote: string;
    datetime: string;
    close: string;
  } | null;
}

interface TechnicalIndicators {
  sma: {
    sma20: Array<{
      datetime: string;
      sma: string;
    }> | null;
    sma50: Array<{
      datetime: string;
      sma: string;
    }> | null;
  };
  rsi: Array<{
    datetime: string;
    rsi: string;
  }> | null;
  macd: Array<{
    datetime: string;
    macd: string;
    macd_signal: string;
    macd_hist: string;
  }> | null;
  atr: Array<{
    datetime: string;
    atr: string;
  }> | null;
  ichimoku: Array<{
    datetime: string;
    tenkan_sen: string;
    kijun_sen: string;
    senkou_span_a: string;
    senkou_span_b: string;
    chikou_span: string;
  }> | null;
  aroon: Array<{
    datetime: string;
    aroon_up: string;
    aroon_down: string;
  }> | null;
}

export default function ForexDetails() {
  const params = useParams();
  const encodedSymbol = params?.symbol as string | undefined;
  const symbol: string | null = encodedSymbol ? decodeURIComponent(encodedSymbol) : null;
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [forexData, setForexData] = useState<ForexData | null>(null);
  const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const theme = marketThemes.forex;

  if (!symbol) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">Forex pair symbol is missing.</p>
          <Link href="/forexs">
            <Button variant="outline">Back to Forex Listings</Button>
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
        const overviewResponse = await fetch(`/api/overview?symbol=${symbol}`);
        if (!overviewResponse.ok) {
          const errorData = await overviewResponse.json();
          throw new Error(errorData.error || "Failed to fetch overview data");
        }
        const overviewData: OverviewData = await overviewResponse.json();
        console.log("Overview data:", overviewData);
        setOverview(overviewData);

        const forexResponse = await fetch(`/api/forex?symbol=${symbol}`);
        if (!forexResponse.ok) {
          const errorData = await forexResponse.json();
          throw new Error(errorData.error || "Failed to fetch forex data");
        }
        const forexData: ForexData = await forexResponse.json();
        console.log("Forex data:", forexData);
        setForexData(forexData);

        const indicatorsResponse = await fetch(`/api/forex-technical-indicators?symbol=${symbol}`);
        if (!indicatorsResponse.ok) {
          const errorData = await indicatorsResponse.json();
          throw new Error(errorData.error || "Failed to fetch technical indicators");
        }
        const indicatorsData: TechnicalIndicators = await indicatorsResponse.json();
        console.log("Technical indicators:", indicatorsData);
        setTechnicalIndicators(indicatorsData);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error fetching data:", errorMessage);
        toast({
          title: "Error",
          description: errorMessage || "Failed to fetch forex data",
          variant: "destructive",
        });
        setForexData(null);
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

  if (!overview || !forexData || !forexData.timeSeries || !forexData.quote || !technicalIndicators) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-muted-foreground">
            No data available for {symbol}. This Forex pair may not be supported.
          </p>
          <Link href="/forexs">
            <Button variant="outline">Back to Forex Listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Prepare base time series arrays (reversed = chronological order)
  const timeSeries = forexData.timeSeries.values ?? [];
  const reversedTimeSeries = [...timeSeries].reverse();

  // Build aligned lookup maps for indicator data keyed by datetime
  const sma20Map = new Map(
    (technicalIndicators.sma.sma20 ?? []).map((e) => [e.datetime, parseFloat(e.sma)])
  );
  const sma50Map = new Map(
    (technicalIndicators.sma.sma50 ?? []).map((e) => [e.datetime, parseFloat(e.sma)])
  );
  const ichimokuMap = new Map(
    (technicalIndicators.ichimoku ?? []).map((e) => [
      e.datetime,
      {
        tenkan: parseFloat(e.tenkan_sen),
        kijun: parseFloat(e.kijun_sen),
        senkou_a: parseFloat(e.senkou_span_a),
        senkou_b: parseFloat(e.senkou_span_b),
        chikou: parseFloat(e.chikou_span),
      },
    ])
  );

  // --- useMemo chart data arrays ---

  // Closing Price + SMA + Ichimoku overlay chart
  const priceChartData = useMemo(() => {
    return reversedTimeSeries.map((entry) => {
      const ichi = ichimokuMap.get(entry.datetime);
      return {
        date: entry.datetime,
        close: parseFloat(entry.close),
        sma20: sma20Map.get(entry.datetime) ?? null,
        sma50: sma50Map.get(entry.datetime) ?? null,
        tenkan: ichi?.tenkan ?? null,
        kijun: ichi?.kijun ?? null,
        senkou_a: ichi?.senkou_a ?? null,
        senkou_b: ichi?.senkou_b ?? null,
        chikou: ichi?.chikou ?? null,
      };
    });
  }, [forexData, technicalIndicators]);

  // Ichimoku Cloud standalone chart (same underlying data)
  const ichimokuChartData = useMemo(() => {
    return reversedTimeSeries.map((entry) => {
      const ichi = ichimokuMap.get(entry.datetime);
      return {
        date: entry.datetime,
        close: parseFloat(entry.close),
        tenkan: ichi?.tenkan ?? null,
        kijun: ichi?.kijun ?? null,
        senkou_a: ichi?.senkou_a ?? null,
        senkou_b: ichi?.senkou_b ?? null,
        chikou: ichi?.chikou ?? null,
      };
    });
  }, [forexData, technicalIndicators]);

  // RSI chart data
  const rsiChartData = useMemo(() => {
    return (technicalIndicators.rsi ?? [])
      .slice()
      .reverse()
      .map((entry) => ({
        date: entry.datetime,
        rsi: parseFloat(entry.rsi),
      }));
  }, [technicalIndicators]);

  // MACD chart data
  const macdChartData = useMemo(() => {
    return (technicalIndicators.macd ?? [])
      .slice()
      .reverse()
      .map((entry) => ({
        date: entry.datetime,
        macd: parseFloat(entry.macd),
        signal: parseFloat(entry.macd_signal),
        histogram: parseFloat(entry.macd_hist),
      }));
  }, [technicalIndicators]);

  // ATR chart data
  const atrChartData = useMemo(() => {
    return (technicalIndicators.atr ?? [])
      .slice()
      .reverse()
      .map((entry) => ({
        date: entry.datetime,
        atr: parseFloat(entry.atr),
      }));
  }, [technicalIndicators]);

  // Aroon chart data
  const aroonChartData = useMemo(() => {
    return (technicalIndicators.aroon ?? [])
      .slice()
      .reverse()
      .map((entry) => ({
        date: entry.datetime,
        aroon_up: parseFloat(entry.aroon_up),
        aroon_down: parseFloat(entry.aroon_down),
      }));
  }, [technicalIndicators]);

  // Format the EOD date
  const eodDateFormatted = forexData.eod?.datetime
    ? new Date(forexData.eod.datetime).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  // RSI Interpretation
  const latestRsi = technicalIndicators.rsi?.[0] ?? null;
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
  const latestMacd = technicalIndicators.macd?.[0] ?? null;
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

  // ATR Interpretation
  const latestAtr = technicalIndicators.atr?.[0] ?? null;
  const atrValue = latestAtr ? parseFloat(latestAtr.atr) : null;
  const latestClose = forexData.quote ? parseFloat(forexData.quote.close) : null;
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

  // Ichimoku Interpretation
  const latestIchimoku = technicalIndicators.ichimoku?.[0] ?? null;
  let ichimokuInterpretation = "N/A";
  if (latestIchimoku && latestClose !== null) {
    const tenkanSen = parseFloat(latestIchimoku.tenkan_sen);
    const kijunSen = parseFloat(latestIchimoku.kijun_sen);
    const senkouSpanA = parseFloat(latestIchimoku.senkou_span_a);
    const senkouSpanB = parseFloat(latestIchimoku.senkou_span_b);
    const cloudTop = Math.max(senkouSpanA, senkouSpanB);
    const cloudBottom = Math.min(senkouSpanA, senkouSpanB);

    if (latestClose > cloudTop) {
      ichimokuInterpretation = "Bullish (Price above Cloud)";
    } else if (latestClose < cloudBottom) {
      ichimokuInterpretation = "Bearish (Price below Cloud)";
    } else {
      ichimokuInterpretation = "Neutral (Price in Cloud)";
    }

    if (tenkanSen > kijunSen) {
      ichimokuInterpretation += ", Bullish Momentum (Tenkan > Kijun)";
    } else if (tenkanSen < kijunSen) {
      ichimokuInterpretation += ", Bearish Momentum (Tenkan < Kijun)";
    }
  }

  // AROON Interpretation
  const latestAroon = technicalIndicators.aroon?.[0] ?? null;
  let aroonInterpretation = "N/A";
  if (latestAroon) {
    const aroonUp = parseFloat(latestAroon.aroon_up);
    const aroonDown = parseFloat(latestAroon.aroon_down);

    if (aroonUp > 70 && aroonDown < 30) {
      aroonInterpretation = "Strong Uptrend";
    } else if (aroonDown > 70 && aroonUp < 30) {
      aroonInterpretation = "Strong Downtrend";
    } else if (aroonUp > aroonDown) {
      aroonInterpretation = "Bullish Trend Developing";
    } else if (aroonDown > aroonUp) {
      aroonInterpretation = "Bearish Trend Developing";
    } else {
      aroonInterpretation = "Neutral (Consolidation)";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-500 to-emerald-600">FinanceAI</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-accent">Other Markets</Button>
              </Link>
              <Link href="/forexs">
                <Button
                  variant="outline"
                  className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-colors"
                >
                  Back to Forex Listings
                </Button>
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
                        className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold text-sm px-3 py-2 rounded-full shadow-lg"
                      >
                        {currency}
                      </div>
                    ))}
                  </div>
                )}
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-500 to-emerald-600">
                  {symbol} - {forexData.quote.name || "Unknown"}
                </h1>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Dive into detailed analysis for {symbol}, including real-time price data, technical indicators, and historical trends.
              </p>
            </motion.div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6">
          {/* Forex Statistics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card border-border rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Forex Pair Statistics</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Current Price</p>
                  <div className="flex items-center mt-1">
                    <p className="text-2xl font-bold text-foreground">
                      {forexData.price?.price
                        ? parseFloat(forexData.price.price).toFixed(4)
                        : "N/A"}
                    </p>
                    {forexData.quote && (
                      <span className={`ml-2 flex items-center text-sm ${getTrendInfo(forexData.quote.change).color}`}>
                        {getTrendInfo(forexData.quote.change).icon}
                        <span className="ml-1">
                          {parseFloat(forexData.quote.change || "0").toFixed(4)} ({parseFloat(forexData.quote.percent_change || "0").toFixed(2)}%)
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Daily Range</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {parseFloat(forexData.quote.low || "0").toFixed(4)} - {parseFloat(forexData.quote.high || "0").toFixed(4)}
                  </p>
                </div>

                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Previous Close</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {parseFloat(forexData.quote.previous_close || "0").toFixed(4)}
                  </p>
                </div>

                <div className="bg-accent/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Currencies</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {forexData.quote.currency_base}/{forexData.quote.currency_quote}
                  </p>
                </div>
              </div>

              {forexData.quote ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  <div>
                    <p>
                      <strong>EOD Price ({eodDateFormatted}):</strong>{" "}
                      {forexData.eod?.close
                        ? parseFloat(forexData.eod.close).toFixed(4)
                        : "N/A"}
                    </p>
                    <p>
                      <strong>Latest Close:</strong>{" "}
                      {parseFloat(forexData.quote.close || "0").toFixed(4)}
                    </p>
                    <p>
                      <strong>Latest Open:</strong>{" "}
                      {parseFloat(forexData.quote.open || "0").toFixed(4)}
                    </p>
                    <p>
                      <strong>Daily High:</strong>{" "}
                      {parseFloat(forexData.quote.high || "0").toFixed(4)}
                    </p>
                    <p>
                      <strong>Daily Low:</strong>{" "}
                      {parseFloat(forexData.quote.low || "0").toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>Previous Close:</strong>{" "}
                      {parseFloat(forexData.quote.previous_close || "0").toFixed(4)}
                    </p>
                    <p>
                      <strong>Change:</strong>{" "}
                      {parseFloat(forexData.quote.change || "0").toFixed(4)} (
                      {parseFloat(forexData.quote.percent_change || "0").toFixed(2)}%)
                    </p>
                    <p>
                      <strong>Base Currency:</strong>{" "}
                      {forexData.quote.currency_base || "N/A"}
                    </p>
                    <p>
                      <strong>Quote Currency:</strong>{" "}
                      {forexData.quote.currency_quote || "N/A"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No statistics available for {symbol}.
                </p>
              )}
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
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card border-border rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Technical Indicators Summary</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Moving Averages (SMA) */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                    Moving Averages
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">20-Day SMA</p>
                      <p className="font-medium">
                        {technicalIndicators.sma.sma20?.[0]?.sma
                          ? parseFloat(technicalIndicators.sma.sma20[0].sma).toFixed(4)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">50-Day SMA</p>
                      <p className="font-medium">
                        {technicalIndicators.sma.sma50?.[0]?.sma
                          ? parseFloat(technicalIndicators.sma.sma50[0].sma).toFixed(4)
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RSI */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                    Relative Strength Index (RSI)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">14-Day RSI</p>
                      <p className="font-medium">
                        {latestRsi?.rsi ? parseFloat(latestRsi.rsi).toFixed(2) : "N/A"}
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
                    <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                    MACD
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">MACD Line</p>
                      <p className="font-medium">
                        {latestMacd?.macd ? parseFloat(latestMacd.macd).toFixed(4) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Signal Line</p>
                      <p className="font-medium">
                        {latestMacd?.macd_signal ? parseFloat(latestMacd.macd_signal).toFixed(4) : "N/A"}
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

                {/* ATR */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                    Average True Range (ATR)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">14-Day ATR</p>
                      <p className="font-medium">
                        {latestAtr?.atr ? parseFloat(latestAtr.atr).toFixed(4) : "N/A"}
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

                {/* Ichimoku */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                    Ichimoku Cloud
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Tenkan-sen</p>
                      <p className="font-medium">
                        {latestIchimoku?.tenkan_sen ? parseFloat(latestIchimoku.tenkan_sen).toFixed(4) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Kijun-sen</p>
                      <p className="font-medium">
                        {latestIchimoku?.kijun_sen ? parseFloat(latestIchimoku.kijun_sen).toFixed(4) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {ichimokuInterpretation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AROON */}
                <div className="bg-accent/10 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                    Aroon Indicator
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Aroon Up</p>
                      <p className="font-medium">
                        {latestAroon?.aroon_up ? parseFloat(latestAroon.aroon_up).toFixed(2) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aroon Down</p>
                      <p className="font-medium">
                        {latestAroon?.aroon_down ? parseFloat(latestAroon.aroon_down).toFixed(2) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interpretation</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          aroonInterpretation.includes("Uptrend")
                            ? "bg-green-100 text-green-800"
                            : aroonInterpretation.includes("Downtrend")
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {aroonInterpretation}
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
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card border-border rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Technical Indicator Charts</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Price History with SMA + Ichimoku overlay */}
                <TechnicalChart
                  data={priceChartData}
                  title="Price History with Indicators"
                  datasets={[
                    { key: "close", label: "Closing Price", color: "#10B981" },
                    { key: "sma20", label: "20-Day SMA", color: "#f59e0b", dashed: true },
                    { key: "sma50", label: "50-Day SMA", color: "#10b981", dashed: true },
                    { key: "tenkan", label: "Tenkan-sen", color: "#3b82f6" },
                    { key: "kijun", label: "Kijun-sen", color: "#f59e0b" },
                    { key: "senkou_a", label: "Senkou Span A", color: "#22c55e", dashed: true },
                    { key: "senkou_b", label: "Senkou Span B", color: "#ef4444", dashed: true },
                    { key: "chikou", label: "Chikou Span", color: "#a855f7", dashed: true },
                  ]}
                  height={320}
                />

                {/* Ichimoku Cloud standalone */}
                <TechnicalChart
                  data={ichimokuChartData}
                  title="Ichimoku Cloud"
                  datasets={[
                    { key: "close", label: "Closing Price", color: "#10B981" },
                    { key: "tenkan", label: "Tenkan-sen", color: "#3b82f6" },
                    { key: "kijun", label: "Kijun-sen", color: "#f59e0b" },
                    { key: "senkou_a", label: "Senkou Span A", color: "#22c55e", dashed: true },
                    { key: "senkou_b", label: "Senkou Span B", color: "#ef4444", dashed: true },
                    { key: "chikou", label: "Chikou Span", color: "#a855f7", dashed: true },
                  ]}
                  height={320}
                />

                {/* RSI */}
                <TechnicalChart
                  data={rsiChartData}
                  title="Relative Strength Index (RSI)"
                  datasets={[
                    { key: "rsi", label: "RSI", color: "#f59e0b" },
                  ]}
                  yDomain={[0, 100]}
                  referenceLines={[
                    { y: 70, color: "#ef4444", label: "Overbought (70)" },
                    { y: 30, color: "#22c55e", label: "Oversold (30)" },
                  ]}
                  height={320}
                />

                {/* MACD */}
                <TechnicalChart
                  data={macdChartData}
                  title="MACD"
                  datasets={[
                    {
                      key: "histogram",
                      label: "Histogram",
                      color: "#22c55e",
                      type: "bar",
                      barColorFn: (value: number) => (value >= 0 ? "#22c55e" : "#ef4444"),
                    },
                    { key: "macd", label: "MACD", color: "#3b82f6" },
                    { key: "signal", label: "Signal Line", color: "#f59e0b", dashed: true },
                  ]}
                  height={320}
                />

                {/* ATR */}
                <TechnicalChart
                  data={atrChartData}
                  title="Average True Range (ATR)"
                  datasets={[
                    { key: "atr", label: "ATR", color: "#ec4899" },
                  ]}
                  height={320}
                />

                {/* Aroon */}
                <TechnicalChart
                  data={aroonChartData}
                  title="Aroon Indicator"
                  datasets={[
                    { key: "aroon_up", label: "Aroon Up", color: "#22c55e" },
                    { key: "aroon_down", label: "Aroon Down", color: "#ef4444" },
                  ]}
                  yDomain={[0, 100]}
                  referenceLines={[
                    { y: 70, color: "#3b82f6", label: "Strong Trend (70)" },
                    { y: 30, color: "#3b82f6", label: "Weak Trend (30)" },
                  ]}
                  height={320}
                />
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div className="fixed bottom-6 right-6 z-50 group" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 1 }} whileHover={{ scale: 1.1 }}>
          <Link href="/forexadvisor">
            <Button className="p-4 rounded-full shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300">
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </Link>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-card text-foreground text-sm font-medium px-3 py-1 rounded-lg shadow-md">Your Forex Advisor</div>
        </motion.div>
      </main>
    </div>
  );
}
