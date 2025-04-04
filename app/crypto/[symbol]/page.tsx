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
  ChartOptions,
} from "chart.js";
import { Chart, Line, Bar } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import Image from "next/image";
import { BarChart3, MessageCircle } from "lucide-react";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { toast } from "react-hot-toast";

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

// Theme colors
const orange500 = "#F97316"; // Tailwind from-orange-500
const yellow600 = "#CA8A04"; // Tailwind to-yellow-600
const whiteBg = "#F9FAFB"; // Light background

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
  const labels = timeSeries.map((entry) => entry.datetime).reverse();
  const closingPrices = timeSeries.map((entry) => parseFloat(entry.close)).reverse();

  // Prepare EMA, BBANDS, and Supertrend data for overlay
  const ema20Data = technicalIndicators.ema.ema20
    ? technicalIndicators.ema.ema20.map((entry) => parseFloat(entry.ema)).reverse()
    : [];
  const ema50Data = technicalIndicators.ema.ema50
    ? technicalIndicators.ema.ema50.map((entry) => parseFloat(entry.ema)).reverse()
    : [];
  const bbandsUpper = technicalIndicators.bbands
    ? technicalIndicators.bbands.map((entry) => parseFloat(entry.upper_band)).reverse()
    : [];
  const bbandsMiddle = technicalIndicators.bbands
    ? technicalIndicators.bbands.map((entry) => parseFloat(entry.middle_band)).reverse()
    : [];
  const bbandsLower = technicalIndicators.bbands
    ? technicalIndicators.bbands.map((entry) => parseFloat(entry.lower_band)).reverse()
    : [];
  const supertrendData = technicalIndicators.supertrend
    ? technicalIndicators.supertrend.map((entry) => parseFloat(entry.supertrend)).reverse()
    : [];

  // Closing Price Chart with EMA, BBANDS, and Supertrend
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
        label: "20-Day EMA",
        data: ema20Data,
        borderColor: "rgb(0, 191, 255)",
        backgroundColor: "rgba(0, 191, 255, 0.5)",
        fill: false,
      },
      {
        label: "50-Day EMA",
        data: ema50Data,
        borderColor: "rgb(0, 0, 255)",
        backgroundColor: "rgba(0, 0, 255, 0.5)",
        fill: false,
      },
      {
        label: "Bollinger Upper Band",
        data: bbandsUpper,
        borderColor: "rgb(128, 0, 128)",
        backgroundColor: "rgba(128, 0, 128, 0.5)",
        fill: false,
      },
      {
        label: "Bollinger Middle Band",
        data: bbandsMiddle,
        borderColor: "rgb(128, 128, 128)",
        backgroundColor: "rgba(128, 128, 128, 0.5)",
        fill: false,
      },
      {
        label: "Bollinger Lower Band",
        data: bbandsLower,
        borderColor: "rgb(128, 0, 128)",
        backgroundColor: "rgba(128, 0, 128, 0.5)",
        fill: false,
      },
      {
        label: "Supertrend",
        data: supertrendData,
        borderColor: "rgb(255, 0, 0)",
        backgroundColor: "rgba(255, 0, 0, 0.5)",
        fill: false,
        pointRadius: 3,
        pointStyle: "circle",
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: `${symbol} Price History with Indicators` },
    },
  };

  // RSI Chart
  const rsiLabels = technicalIndicators.rsi
    ? technicalIndicators.rsi.map((entry) => entry.datetime).reverse()
    : [];
  const rsiData = technicalIndicators.rsi
    ? technicalIndicators.rsi.map((entry) => parseFloat(entry.rsi)).reverse()
    : [];

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

  const rsiChartOptions: ChartOptions<"line"> & {
    plugins: {
      annotation: {
        annotations: AnnotationOptions<"line">[];
      };
    };
  } = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Relative Strength Index (RSI)" },
      annotation: {
        annotations: [
          {
            type: "line",
            yMin: 70,
            yMax: 70,
            borderColor: "red",
            borderWidth: 1,
            label: { content: "Overbought (70)", display: true, position: "end" },
          },
          {
            type: "line",
            yMin: 30,
            yMax: 30,
            borderColor: "green",
            borderWidth: 1,
            label: { content: "Oversold (30)", display: true, position: "end" },
          },
        ],
      },
    },
    scales: { y: { min: 0, max: 100 } },
  };

  // MACD Chart
  const macdLabels = technicalIndicators.macd
    ? technicalIndicators.macd.map((entry) => entry.datetime).reverse()
    : [];
  const macdData = technicalIndicators.macd
    ? technicalIndicators.macd.map((entry) => parseFloat(entry.macd)).reverse()
    : [];
  const macdSignalData = technicalIndicators.macd
    ? technicalIndicators.macd.map((entry) => parseFloat(entry.macd_signal)).reverse()
    : [];
  const macdHistData = technicalIndicators.macd
    ? technicalIndicators.macd.map((entry) => parseFloat(entry.macd_hist)).reverse()
    : [];

  const macdChartData: ChartData<"bar" | "line", number[], string> = {
    labels: macdLabels,
    datasets: [
      {
        type: "line" as const,
        label: "MACD",
        data: macdData,
        borderColor: "rgb(0, 191, 255)",
        backgroundColor: "rgba(0, 191, 255, 0.5)",
        fill: false,
      },
      {
        type: "line" as const,
        label: "Signal Line",
        data: macdSignalData,
        borderColor: "rgb(255, 165, 0)",
        backgroundColor: "rgba(255, 165, 0, 0.5)",
        fill: false,
      },
      {
        type: "bar" as const,
        label: "Histogram",
        data: macdHistData,
        backgroundColor: "rgba(128, 128, 128, 0.5)",
      },
    ],
  };

  const macdChartOptions: ChartOptions<"bar"> = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "MACD" },
    },
  };

  // ATR Chart
  const atrLabels = technicalIndicators.atr
    ? technicalIndicators.atr.map((entry) => entry.datetime).reverse()
    : [];
  const atrData = technicalIndicators.atr
    ? technicalIndicators.atr.map((entry) => parseFloat(entry.atr)).reverse()
    : [];

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

  const atrChartOptions: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Average True Range (ATR)" },
    },
  };

  // Supertrend Chart
  const supertrendChartData: ChartData<"line", number[], string> = {
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
        label: "Supertrend",
        data: supertrendData,
        borderColor: "rgb(255, 0, 0)",
        backgroundColor: "rgba(255, 0, 0, 0.5)",
        fill: false,
        pointRadius: 3,
        pointStyle: "circle",
      },
    ],
  };

  const supertrendChartOptions: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Supertrend" },
    },
  };

  // OBV Chart
  const obvLabels = technicalIndicators.obv
    ? technicalIndicators.obv.map((entry) => entry.datetime).reverse()
    : [];
  const obvData = technicalIndicators.obv
    ? technicalIndicators.obv.map((entry) => parseFloat(entry.obv)).reverse()
    : [];

  const obvChartData: ChartData<"line", number[], string> = {
    labels: obvLabels,
    datasets: [
      {
        label: "OBV",
        data: obvData,
        borderColor: "rgb(70, 130, 180)",
        backgroundColor: "rgba(70, 130, 180, 0.5)",
        fill: false,
      },
    ],
  };

  const obvChartOptions: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "On-Balance Volume (OBV)" },
    },
  };

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
                <Button variant="ghost">Analyze Market</Button>
              </Link>
              <Link href="/cryptos">
                <Button variant="outline">Back to Crypto Listings</Button>
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
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">
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
              className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Cryptocurrency Pair Statistics</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p>
                    <strong>Current Price:</strong>{" "}
                    {cryptoData.price?.price
                      ? parseFloat(cryptoData.price.price).toFixed(8)
                      : "N/A"}
                  </p>
                  <p>
                    <strong>EOD Price ({eodDateFormatted}):</strong>{" "}
                    {cryptoData.eod?.close
                      ? parseFloat(cryptoData.eod.close).toFixed(8)
                      : "N/A"}
                  </p>
                  <p>
                    <strong>Latest Close:</strong>{" "}
                    {parseFloat(cryptoData.quote.close || "0").toFixed(8)}
                  </p>
                  <p>
                    <strong>Latest Open:</strong>{" "}
                    {parseFloat(cryptoData.quote.open || "0").toFixed(8)}
                  </p>
                  <p>
                    <strong>Daily High:</strong>{" "}
                    {parseFloat(cryptoData.quote.high || "0").toFixed(8)}
                  </p>
                  <p>
                    <strong>Daily Low:</strong>{" "}
                    {parseFloat(cryptoData.quote.low || "0").toFixed(8)}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Previous Close:</strong>{" "}
                    {parseFloat(cryptoData.quote.previous_close || "0").toFixed(8)}
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
              className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Technical Indicators</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* EMA */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Exponential Moving Averages</h3>
                  <p>
                    <strong>20-Day EMA:</strong>{" "}
                    {latestEma20 ? parseFloat(latestEma20.ema).toFixed(8) : "N/A"}
                  </p>
                  <p>
                    <strong>50-Day EMA:</strong>{" "}
                    {latestEma50 ? parseFloat(latestEma50.ema).toFixed(8) : "N/A"}
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
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
                  </p>
                </div>

                {/* RSI */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Relative Strength Index (RSI)</h3>
                  <p>
                    <strong>14-Day RSI:</strong>{" "}
                    {latestRsi ? parseFloat(latestRsi.rsi).toFixed(2) : "N/A"}
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
                        {parseFloat(latestMacd.macd).toFixed(8)}
                      </p>
                      <p>
                        <strong>Signal Line:</strong>{" "}
                        {parseFloat(latestMacd.macd_signal).toFixed(8)}
                      </p>
                      <p>
                        <strong>Histogram:</strong>{" "}
                        {parseFloat(latestMacd.macd_hist).toFixed(8)}
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

                {/* BBANDS */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Bollinger Bands</h3>
                  {latestBbands ? (
                    <>
                      <p>
                        <strong>Upper Band:</strong>{" "}
                        {parseFloat(latestBbands.upper_band).toFixed(8)}
                      </p>
                      <p>
                        <strong>Middle Band:</strong>{" "}
                        {parseFloat(latestBbands.middle_band).toFixed(8)}
                      </p>
                      <p>
                        <strong>Lower Band:</strong>{" "}
                        {parseFloat(latestBbands.lower_band).toFixed(8)}
                      </p>
                      <p>
                        <strong>Interpretation:</strong>{" "}
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
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No Bollinger Bands data available for {symbol}.
                    </p>
                  )}
                </div>

                {/* ATR */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Average True Range (ATR)</h3>
                  <p>
                    <strong>14-Day ATR:</strong>{" "}
                    {latestAtr ? parseFloat(latestAtr.atr).toFixed(8) : "N/A"}
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

                {/* Supertrend */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Supertrend</h3>
                  <p>
                    <strong>Latest Supertrend:</strong>{" "}
                    {latestSupertrend ? parseFloat(latestSupertrend.supertrend).toFixed(8) : "N/A"}
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
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
                  </p>
                </div>

                {/* OBV */}
                <div>
                  <h3 className="text-lg font-medium mb-2">On-Balance Volume (OBV)</h3>
                  <p>
                    <strong>Latest OBV:</strong>{" "}
                    {latestObv ? parseFloat(latestObv.obv).toFixed(0) : "N/A"}
                  </p>
                  <p>
                    <strong>Interpretation:</strong>{" "}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        obvInterpretation.includes("Confirmation")
                          ? "bg-green-100 text-green-800"
                          : obvInterpretation.includes("Divergence")
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {obvInterpretation}
                    </span>
                  </p>
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
              className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Time Series Data</h2>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">
                    Daily Closing Prices with Indicators
                  </h3>
                  {timeSeries.length > 0 ? (
                    <Line options={chartOptions} data={closingPriceData} />
                  ) : (
                    <p className="text-muted-foreground">
                      No historical data available for {symbol}.
                    </p>
                  )}
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
              className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"
            ></div>
            <Card className="relative p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold">Technical Indicator Charts</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">MACD</h3>
                  {technicalIndicators.macd ? (
                    <Bar data={macdChartData as ChartData<"bar", number[], string>} options={macdChartOptions} />
                  ) : (
                    <p className="text-muted-foreground">
                      No MACD data available for {symbol}.
                    </p>
                  )}
                </div>

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

                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">Supertrend</h3>
                  {technicalIndicators.supertrend ? (
                    <Line options={supertrendChartOptions} data={supertrendChartData} />
                  ) : (
                    <p className="text-muted-foreground">
                      No Supertrend data available for {symbol}.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2 text-muted-foreground">
                    On-Balance Volume (OBV)
                  </h3>
                  {technicalIndicators.obv ? (
                    <Line options={obvChartOptions} data={obvChartData} />
                  ) : (
                    <p className="text-muted-foreground">
                      No OBV data available for {symbol}.
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
          <Link href="/cryptoadvisor">
            <Button
              className="p-4 rounded-full shadow-lg bg-gradient-to-r from-orange-500 to-yellow-600 hover:from-orange-600 hover:to-yellow-700 transition-all duration-300"
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </Link>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-sm font-medium px-3 py-1 rounded-lg shadow-md">
            Your Crypto Advisor
          </div>
        </motion.div>
      </main>
    </div>
  );
}