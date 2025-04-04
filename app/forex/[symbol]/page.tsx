"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";
import { Chart, Line } from "react-chartjs-2"; // Updated import: Replace Bar with Chart
import annotationPlugin from "chartjs-plugin-annotation";
import Image from "next/image";
import { BarChart3, MessageCircle } from "lucide-react";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

// Add theme colors at the top of the file after imports
const green500 = "#10B981";
const emerald600 = "#059669";
const whiteBg = "#F9FAFB";

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

  // Prepare chart data for time series
  const timeSeries = forexData.timeSeries.values ?? [];
  const labels = timeSeries.map((entry) => entry.datetime).reverse();
  const closingPrices = timeSeries.map((entry) => parseFloat(entry.close)).reverse();

  // Prepare SMA and Ichimoku data for overlay with null checks
  const sma20Data = technicalIndicators.sma.sma20?.map((entry) => parseFloat(entry.sma)).reverse() ?? [];
  const sma50Data = technicalIndicators.sma.sma50?.map((entry) => parseFloat(entry.sma)).reverse() ?? [];
  const tenkanSenData = technicalIndicators.ichimoku?.map((entry) => parseFloat(entry.tenkan_sen)).reverse() ?? [];
  const kijunSenData = technicalIndicators.ichimoku?.map((entry) => parseFloat(entry.kijun_sen)).reverse() ?? [];
  const senkouSpanAData = technicalIndicators.ichimoku?.map((entry) => parseFloat(entry.senkou_span_a)).reverse() ?? [];
  const senkouSpanBData = technicalIndicators.ichimoku?.map((entry) => parseFloat(entry.senkou_span_b)).reverse() ?? [];
  const chikouSpanData = technicalIndicators.ichimoku?.map((entry) => parseFloat(entry.chikou_span)).reverse() ?? [];

  // Closing Price Chart with SMA and Ichimoku
  const closingPriceData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Closing Price",
        data: closingPrices,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        fill: false,
      },
      {
        label: "20-Day SMA",
        data: sma20Data,
        borderColor: "rgb(255, 165, 0)",
        backgroundColor: "rgba(255, 165, 0, 0.5)",
        fill: false,
      },
      {
        label: "50-Day SMA",
        data: sma50Data,
        borderColor: "rgb(255, 69, 0)",
        backgroundColor: "rgba(255, 69, 0, 0.5)",
        fill: false,
      },
      {
        label: "Tenkan-sen (Ichimoku)",
        data: tenkanSenData,
        borderColor: "rgb(255, 0, 255)",
        backgroundColor: "rgba(255, 0, 255, 0.5)",
        fill: false,
      },
      {
        label: "Kijun-sen (Ichimoku)",
        data: kijunSenData,
        borderColor: "rgb(0, 255, 255)",
        backgroundColor: "rgba(0, 255, 255, 0.5)",
        fill: false,
      },
      {
        label: "Senkou Span A (Ichimoku)",
        data: senkouSpanAData,
        borderColor: "rgb(0, 255, 0)",
        backgroundColor: "rgba(0, 255, 0, 0.2)",
        fill: "+1",
      },
      {
        label: "Senkou Span B (Ichimoku)",
        data: senkouSpanBData,
        borderColor: "rgb(255, 0, 0)",
        backgroundColor: "rgba(255, 0, 0, 0.2)",
        fill: "-1",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#6B7280",
        },
      },
      title: {
        display: true,
        text: "Price History",
        color: "#6B7280",
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
        },
      },
      y: {
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
        },
      },
    },
  };

  // RSI Chart
  const rsiLabels = technicalIndicators.rsi?.map((entry) => entry.datetime).reverse() ?? [];
  const rsiData = technicalIndicators.rsi?.map((entry) => parseFloat(entry.rsi)).reverse() ?? [];

  const rsiChartData: ChartData<"line", number[], string> = {
    labels: rsiLabels,
    datasets: [
      {
        label: "RSI",
        data: rsiData,
        borderColor: "rgb(138, 43, 226)",
        backgroundColor: "rgba(138, 43, 226, 0.5)",
        fill: false,
      },
    ],
  };

  const rsiChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Relative Strength Index (RSI)",
      },
      annotation: {
        annotations: [
          {
            type: "line" as const,
            yMin: 70,
            yMax: 70,
            borderColor: "red",
            borderWidth: 1,
            label: {
              content: "Overbought (70)",
              display: true,
              position: "end" as const,
            },
          },
          {
            type: "line" as const,
            yMin: 30,
            yMax: 30,
            borderColor: "green",
            borderWidth: 1,
            label: {
              content: "Oversold (30)",
              display: true,
              position: "end" as const,
            },
          },
        ],
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

  // MACD Chart
  const macdLabels = technicalIndicators.macd?.map((entry) => entry.datetime).reverse() ?? [];
  const macdData = technicalIndicators.macd?.map((entry) => parseFloat(entry.macd)).reverse() ?? [];
  const macdSignalData = technicalIndicators.macd?.map((entry) => parseFloat(entry.macd_signal)).reverse() ?? [];
  const macdHistData = technicalIndicators.macd?.map((entry) => parseFloat(entry.macd_hist)).reverse() ?? [];

  const macdChartData: ChartData<"bar" | "line", number[], string> = {
    labels: macdLabels,
    datasets: [
      {
        label: "MACD",
        data: macdData,
        borderColor: "rgb(0, 191, 255)",
        backgroundColor: "rgba(0, 191, 255, 0.5)",
        fill: false,
        type: "line" as const,
      },
      {
        label: "Signal Line",
        data: macdSignalData,
        borderColor: "rgb(255, 165, 0)",
        backgroundColor: "rgba(255, 165, 0, 0.5)",
        fill: false,
        type: "line" as const,
      },
      {
        label: "Histogram",
        data: macdHistData,
        backgroundColor: "rgba(128, 128, 128, 0.5)",
        type: "bar" as const,
      },
    ],
  };

  const macdChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "MACD",
      },
    },
  };

  // ATR Chart
  const atrLabels = technicalIndicators.atr?.map((entry) => entry.datetime).reverse() ?? [];
  const atrData = technicalIndicators.atr?.map((entry) => parseFloat(entry.atr)).reverse() ?? [];

  const atrChartData: ChartData<"line", number[], string> = {
    labels: atrLabels,
    datasets: [
      {
        label: "ATR",
        data: atrData,
        borderColor: "rgb(255, 99, 71)",
        backgroundColor: "rgba(255, 99, 71, 0.5)",
        fill: false,
      },
    ],
  };

  const atrChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Average True Range (ATR)",
      },
    },
  };

  // Ichimoku Cloud Chart
  const ichimokuChartData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Closing Price",
        data: closingPrices,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        fill: false,
      },
      {
        label: "Tenkan-sen",
        data: tenkanSenData,
        borderColor: "rgb(255, 0, 255)",
        backgroundColor: "rgba(255, 0, 255, 0.5)",
        fill: false,
      },
      {
        label: "Kijun-sen",
        data: kijunSenData,
        borderColor: "rgb(0, 255, 255)",
        backgroundColor: "rgba(0, 255, 255, 0.5)",
        fill: false,
      },
      {
        label: "Senkou Span A",
        data: senkouSpanAData,
        borderColor: "rgb(0, 255, 0)",
        backgroundColor: "rgba(0, 255, 0, 0.2)",
        fill: "+1",
      },
      {
        label: "Senkou Span B",
        data: senkouSpanBData,
        borderColor: "rgb(255, 0, 0)",
        backgroundColor: "rgba(255, 0, 0, 0.2)",
        fill: "-1",
      },
      {
        label: "Chikou Span",
        data: chikouSpanData,
        borderColor: "rgb(128, 128, 128)",
        backgroundColor: "rgba(128, 128, 128, 0.5)",
        fill: false,
      },
    ],
  };

  const ichimokuChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Ichimoku Cloud",
      },
    },
  };

  // AROON Chart
  const aroonLabels = technicalIndicators.aroon?.map((entry) => entry.datetime).reverse() ?? [];
  const aroonUpData = technicalIndicators.aroon?.map((entry) => parseFloat(entry.aroon_up)).reverse() ?? [];
  const aroonDownData = technicalIndicators.aroon?.map((entry) => parseFloat(entry.aroon_down)).reverse() ?? [];

  const aroonChartData: ChartData<"line", number[], string> = {
    labels: aroonLabels,
    datasets: [
      {
        label: "Aroon Up",
        data: aroonUpData,
        borderColor: green500,
        backgroundColor: `${green500}80`,
        fill: false,
      },
      {
        label: "Aroon Down",
        data: aroonDownData,
        borderColor: emerald600,
        backgroundColor: `${emerald600}80`,
        fill: false,
      },
    ],
  };

  const aroonChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Aroon Indicator",
      },
      annotation: {
        annotations: [
          {
            type: "line" as const,
            yMin: 70,
            yMax: 70,
            borderColor: "blue",
            borderWidth: 1,
            label: {
              content: "Strong Trend (70)",
              display: true,
              position: "end" as const,
            },
          },
          {
            type: "line" as const,
            yMin: 30,
            yMax: 30,
            borderColor: "blue",
            borderWidth: 1,
            label: {
              content: "Weak Trend (30)",
              display: true,
              position: "end" as const,
            },
          },
        ],
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

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
        <section className="py-10 px-4 bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-full mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex justify-center items-center gap-4 mb-4">
                {overview.logo_base && overview.logo_quote ? (
                  <div className="flex gap-2">
                    <Image
                      src={overview.logo_base}
                      alt={`${symbol} base logo`}
                      width={25}
                      height={25}
                      className="rounded"
                    />
                    <Image
                      src={overview.logo_quote}
                      alt={`${symbol} quote logo`}
                      width={25}
                      height={25}
                      className="rounded"
                    />
                  </div>
                ) : null}
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
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Forex Pair Statistics</h2>
              </div>
              {forexData.quote ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p>
                      <strong>Current Price:</strong>{" "}
                      {forexData.price?.price
                        ? parseFloat(forexData.price.price).toFixed(4)
                        : "N/A"}
                    </p>
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
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Technical Indicators</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Moving Averages (SMA) */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Moving Averages</h3>
                  <p>
                    <strong>20-Day SMA:</strong>{" "}
                    {technicalIndicators.sma.sma20?.[0]?.sma
                      ? parseFloat(technicalIndicators.sma.sma20[0].sma).toFixed(4)
                      : "N/A"}
                  </p>
                  <p>
                    <strong>50-Day SMA:</strong>{" "}
                    {technicalIndicators.sma.sma50?.[0]?.sma
                      ? parseFloat(technicalIndicators.sma.sma50[0].sma).toFixed(4)
                      : "N/A"}
                  </p>
                </div>

                {/* RSI */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Relative Strength Index (RSI)</h3>
                  <p>
                    <strong>14-Day RSI:</strong>{" "}
                    {latestRsi?.rsi ? parseFloat(latestRsi.rsi).toFixed(2) : "N/A"}
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
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
                  </p>
                </div>

                {/* MACD */}
                <div>
                  <h3 className="text-lg font-medium mb-2">MACD</h3>
                  {latestMacd ? (
                    <>
                      <p>
                        <strong>MACD Line:</strong>{" "}
                        {parseFloat(latestMacd.macd).toFixed(4)}
                      </p>
                      <p>
                        <strong>Signal Line:</strong>{" "}
                        {parseFloat(latestMacd.macd_signal).toFixed(4)}
                      </p>
                      <p>
                        <strong>Histogram:</strong>{" "}
                        {parseFloat(latestMacd.macd_hist).toFixed(4)}
                      </p>
                      <p>
                        <strong>Interpretation:</strong>{" "}
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
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No MACD data available for {symbol}.
                    </p>
                  )}
                </div>

                {/* ATR */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Average True Range (ATR)</h3>
                  <p>
                    <strong>14-Day ATR:</strong>{" "}
                    {latestAtr?.atr ? parseFloat(latestAtr.atr).toFixed(4) : "N/A"}
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
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
                  </p>
                </div>

                {/* Ichimoku */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Ichimoku Cloud</h3>
                  {latestIchimoku ? (
                    <>
                      <p>
                        <strong>Tenkan-sen:</strong>{" "}
                        {parseFloat(latestIchimoku.tenkan_sen).toFixed(4)}
                      </p>
                      <p>
                        <strong>Kijun-sen:</strong>{" "}
                        {parseFloat(latestIchimoku.kijun_sen).toFixed(4)}
                      </p>
                      <p>
                        <strong>Senkou Span A:</strong>{" "}
                        {parseFloat(latestIchimoku.senkou_span_a).toFixed(4)}
                      </p>
                      <p>
                        <strong>Senkou Span B:</strong>{" "}
                        {parseFloat(latestIchimoku.senkou_span_b).toFixed(4)}
                      </p>
                      <p>
                        <strong>Interpretation:</strong>{" "}
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            ichimokuInterpretation.includes("Bullish")
                              ? "bg-green-100 text-green-800"
                              : ichimokuInterpretation.includes("Bearish")
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {ichimokuInterpretation}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No Ichimoku Cloud data available for {symbol}.
                    </p>
                  )}
                </div>

                {/* AROON */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Aroon Indicator</h3>
                  {latestAroon ? (
                    <>
                      <p>
                        <strong>Aroon Up:</strong>{" "}
                        {parseFloat(latestAroon.aroon_up).toFixed(2)}
                      </p>
                      <p>
                        <strong>Aroon Down:</strong>{" "}
                        {parseFloat(latestAroon.aroon_down).toFixed(2)}
                      </p>
                      <p>
                        <strong>Interpretation:</strong>{" "}
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
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No Aroon data available for {symbol}.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Time Series Data (Charts) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Time Series Data</h2>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">
                    Daily Closing Prices with Indicators
                  </h3>
                  <Line options={chartOptions} data={closingPriceData} />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Technical Indicator Charts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="relative group"
          >
            <div
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Technical Indicator Charts</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* RSI Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">
                    Relative Strength Index (RSI)
                  </h3>
                  {technicalIndicators.rsi ? (
                    <Line options={rsiChartOptions} data={rsiChartData} />
                  ) : (
                    <p className="text-muted-foreground">
                      No RSI data available for {symbol}.
                    </p>
                  )}
                </div>

                {/* MACD Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">MACD</h3>
                  {technicalIndicators.macd ? (
                    <Chart
                      type="bar"
                      options={macdChartOptions}
                      data={macdChartData as ChartData<"bar", number[], string>}
                    />
                  ) : (
                    <p className="text-muted-foreground">
                      No MACD data available for {symbol}.
                    </p>
                  )}
                </div>

                {/* ATR Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">
                    Average True Range (ATR)
                  </h3>
                  {technicalIndicators.atr ? (
                    <Line options={atrChartOptions} data={atrChartData} />
                  ) : (
                    <p className="text-muted-foreground">
                      No ATR data available for {symbol}.
                    </p>
                  )}
                </div>

                {/* Ichimoku Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">
                    Ichimoku Cloud
                  </h3>
                  {technicalIndicators.ichimoku ? (
                    <Line options={ichimokuChartOptions} data={ichimokuChartData} />
                  ) : (
                    <p className="text-muted-foreground">
                      No Ichimoku Cloud data available for {symbol}.
                    </p>
                  )}
                </div>

                {/* AROON Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">
                    Aroon Indicator
                  </h3>
                  {technicalIndicators.aroon ? (
                    <Line options={aroonChartOptions} data={aroonChartData} />
                  ) : (
                    <p className="text-muted-foreground">
                      No Aroon data available for {symbol}.
                    </p>
                  )}
                </div>
              </div>
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
          <Link href="/forexadvisor">
            <Button
              className="p-4 rounded-full shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </Link>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-sm font-medium px-3 py-1 rounded-lg shadow-md">
            Your Forex Advisor
          </div>
        </motion.div>
      </main>
    </div>
  );
}