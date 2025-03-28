"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import Image from "next/image";

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

interface OverviewData {
  logo_base: string | null;
  logo_quote: string | null;
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
}

interface TechnicalIndicators {
  ema: {
    ema20: Array<{ datetime: string; ema: string }> | null;
    ema50: Array<{ datetime: string; ema: string }> | null;
  };
  rsi: Array<{ datetime: string; rsi: string }> | null;
  mfi: Array<{ datetime: string; mfi: string }> | null;
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
  supertrend: Array<{ datetime: string; supertrend: string }> | null;
  obv: Array<{ datetime: string; obv: string }> | null;
  ad: Array<{ datetime: string; ad: string }> | null;
  adosc: Array<{ datetime: string; adosc: string }> | null;
  kama: Array<{ datetime: string; kama: string }> | null;
  vwap: Array<{ datetime: string; vwap: string }> | null;
  ichimoku: Array<{
    datetime: string;
    tenkan_sen: string;
    kijun_sen: string;
    senkou_span_a: string;
    senkou_span_b: string;
    chikou_span: string;
  }> | null;
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
          <p className="mb-4">Cryptocurrency pair symbol is missing.</p>
          <Link href="/cryptos">
            <Button variant="primary">Back to Crypto Listings</Button>
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
      } catch (error) {
        console.error("Error fetching data:", error.message);
        toast({
          title: "Error",
          description: error.message || "Failed to fetch crypto data",
          variant: "destructive",
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
        <p>Fetching technical indicators for {symbol}... This may take up to 3-4 minutes due to API rate limits.</p>
      </div>
    );
  }

  if (!overview || !cryptoData || !cryptoData.timeSeries || !technicalIndicators) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">
            No data available for {symbol}. This cryptocurrency pair may not be supported by the data provider.
            <br />
            Try a different pair, such as <Link href="/crypto/BTC%2FUSD" className="text-primary underline">BTC/USD</Link>.
          </p>
          <Link href="/cryptos">
            <Button variant="primary">Back to Crypto Listings</Button>
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

  // Prepare EMA, BBANDS, VWAP, Supertrend, and Ichimoku Cloud data for overlay
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
  const vwapData = technicalIndicators.vwap
    ? technicalIndicators.vwap.map((entry) => parseFloat(entry.vwap)).reverse()
    : [];
  const supertrendData = technicalIndicators.supertrend
    ? technicalIndicators.supertrend.map((entry) => parseFloat(entry.supertrend)).reverse()
    : [];
  const ichimokuTenkanSen = technicalIndicators.ichimoku
    ? technicalIndicators.ichimoku.map((entry) => parseFloat(entry.tenkan_sen)).reverse()
    : [];
  const ichimokuKijunSen = technicalIndicators.ichimoku
    ? technicalIndicators.ichimoku.map((entry) => parseFloat(entry.kijun_sen)).reverse()
    : [];
  const ichimokuSenkouSpanA = technicalIndicators.ichimoku
    ? technicalIndicators.ichimoku.map((entry) => parseFloat(entry.senkou_span_a)).reverse()
    : [];
  const ichimokuSenkouSpanB = technicalIndicators.ichimoku
    ? technicalIndicators.ichimoku.map((entry) => parseFloat(entry.senkou_span_b)).reverse()
    : [];
  const ichimokuChikouSpan = technicalIndicators.ichimoku
    ? technicalIndicators.ichimoku.map((entry) => parseFloat(entry.chikou_span)).reverse()
    : [];

  // Closing Price Chart with EMA, BBANDS, VWAP, Supertrend, and Ichimoku Cloud
  const closingPriceData = {
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
        label: "VWAP",
        data: vwapData,
        borderColor: "rgb(255, 215, 0)",
        backgroundColor: "rgba(255, 215, 0, 0.5)",
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
      {
        label: "Ichimoku Tenkan-sen",
        data: ichimokuTenkanSen,
        borderColor: "rgb(255, 69, 0)",
        backgroundColor: "rgba(255, 69, 0, 0.5)",
        fill: false,
      },
      {
        label: "Ichimoku Kijun-sen",
        data: ichimokuKijunSen,
        borderColor: "rgb(0, 128, 0)",
        backgroundColor: "rgba(0, 128, 0, 0.5)",
        fill: false,
      },
      {
        label: "Ichimoku Senkou Span A",
        data: ichimokuSenkouSpanA,
        borderColor: "rgb(0, 255, 127)",
        backgroundColor: "rgba(0, 255, 127, 0.2)",
        fill: "+1",
      },
      {
        label: "Ichimoku Senkou Span B",
        data: ichimokuSenkouSpanB,
        borderColor: "rgb(255, 20, 147)",
        backgroundColor: "rgba(255, 20, 147, 0.2)",
        fill: false,
      },
      {
        label: "Ichimoku Chikou Span",
        data: ichimokuChikouSpan,
        borderColor: "rgb(138, 43, 226)",
        backgroundColor: "rgba(138, 43, 226, 0.5)",
        fill: false,
      },
    ],
  };

  const chartOptions = {
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

  const rsiChartData = {
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

  // MFI Chart
  const mfiLabels = technicalIndicators.mfi
    ? technicalIndicators.mfi.map((entry) => entry.datetime).reverse()
    : [];
  const mfiData = technicalIndicators.mfi
    ? technicalIndicators.mfi.map((entry) => parseFloat(entry.mfi)).reverse()
    : [];

  const mfiChartData = {
    labels: mfiLabels,
    datasets: [
      {
        label: "MFI",
        data: mfiData,
        borderColor: "rgb(255, 20, 147)",
        backgroundColor: "rgba(255, 20, 147, 0.5)",
        fill: false,
      },
    ],
  };

  const mfiChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Money Flow Index (MFI)" },
      annotation: {
        annotations: [
          {
            type: "line",
            yMin: 80,
            yMax: 80,
            borderColor: "red",
            borderWidth: 1,
            label: { content: "Overbought (80)", display: true, position: "end" },
          },
          {
            type: "line",
            yMin: 20,
            yMax: 20,
            borderColor: "green",
            borderWidth: 1,
            label: { content: "Oversold (20)", display: true, position: "end" },
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

  const macdChartData = {
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

  const atrChartData = {
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
      legend: { position: "top" as const },
      title: { display: true, text: "Average True Range (ATR)" },
    },
  };

  // Supertrend Chart
  const supertrendChartData = {
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

  const supertrendChartOptions = {
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

  const obvChartData = {
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

  const obvChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "On-Balance Volume (OBV)" },
    },
  };

  // AD Chart
  const adLabels = technicalIndicators.ad
    ? technicalIndicators.ad.map((entry) => entry.datetime).reverse()
    : [];
  const adData = technicalIndicators.ad
    ? technicalIndicators.ad.map((entry) => parseFloat(entry.ad)).reverse()
    : [];

  const adChartData = {
    labels: adLabels,
    datasets: [
      {
        label: "AD",
        data: adData,
        borderColor: "rgb(0, 128, 0)",
        backgroundColor: "rgba(0, 128, 0, 0.5)",
        fill: false,
      },
    ],
  };

  const adChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Accumulation/Distribution (AD)" },
    },
  };

  // ADOSC Chart
  const adoscLabels = technicalIndicators.adosc
    ? technicalIndicators.adosc.map((entry) => entry.datetime).reverse()
    : [];
  const adoscData = technicalIndicators.adosc
    ? technicalIndicators.adosc.map((entry) => parseFloat(entry.adosc)).reverse()
    : [];

  const adoscChartData = {
    labels: adoscLabels,
    datasets: [
      {
        label: "ADOSC",
        data: adoscData,
        borderColor: "rgb(34, 139, 34)",
        backgroundColor: "rgba(34, 139, 34, 0.5)",
        fill: false,
      },
    ],
  };

  const adoscChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Chaikin Oscillator (ADOSC)" },
      annotation: {
        annotations: [
          {
            type: "line",
            yMin: 0,
            yMax: 0,
            borderColor: "black",
            borderWidth: 1,
            label: { content: "Neutral (0)", display: true, position: "end" },
          },
        ],
      },
    },
  };

  // KAMA Chart
  const kamaLabels = technicalIndicators.kama
    ? technicalIndicators.kama.map((entry) => entry.datetime).reverse()
    : [];
  const kamaData = technicalIndicators.kama
    ? technicalIndicators.kama.map((entry) => parseFloat(entry.kama)).reverse()
    : [];

  const kamaChartData = {
    labels: kamaLabels,
    datasets: [
      {
        label: "KAMA",
        data: kamaData,
        borderColor: "rgb(255, 215, 0)",
        backgroundColor: "rgba(255, 215, 0, 0.5)",
        fill: false,
      },
    ],
  };

  const kamaChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Kaufman's Adaptive Moving Average (KAMA)" },
    },
  };

  // VWAP Chart
  const vwapChartData = {
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
        label: "VWAP",
        data: vwapData,
        borderColor: "rgb(255, 215, 0)",
        backgroundColor: "rgba(255, 215, 0, 0.5)",
        fill: false,
      },
    ],
  };

  const vwapChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Volume Weighted Average Price (VWAP)" },
    },
  };

  // Ichimoku Cloud Chart
  const ichimokuChartData = {
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
        label: "Ichimoku Tenkan-sen",
        data: ichimokuTenkanSen,
        borderColor: "rgb(255, 69, 0)",
        backgroundColor: "rgba(255, 69, 0, 0.5)",
        fill: false,
      },
      {
        label: "Ichimoku Kijun-sen",
        data: ichimokuKijunSen,
        borderColor: "rgb(0, 128, 0)",
        backgroundColor: "rgba(0, 128, 0, 0.5)",
        fill: false,
      },
      {
        label: "Ichimoku Senkou Span A",
        data: ichimokuSenkouSpanA,
        borderColor: "rgb(0, 255, 127)",
        backgroundColor: "rgba(0, 255, 127, 0.2)",
        fill: "+1",
      },
      {
        label: "Ichimoku Senkou Span B",
        data: ichimokuSenkouSpanB,
        borderColor: "rgb(255, 20, 147)",
        backgroundColor: "rgba(255, 20, 147, 0.2)",
        fill: false,
      },
      {
        label: "Ichimoku Chikou Span",
        data: ichimokuChikouSpan,
        borderColor: "rgb(138, 43, 226)",
        backgroundColor: "rgba(138, 43, 226, 0.5)",
        fill: false,
      },
    ],
  };

  const ichimokuChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Ichimoku Cloud" },
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

  // MFI Interpretation
  const latestMfi = technicalIndicators.mfi ? technicalIndicators.mfi[0] : null;
  const mfiValue = latestMfi ? parseFloat(latestMfi.mfi) : null;
  let mfiInterpretation = "N/A";
  if (mfiValue !== null) {
    if (mfiValue > 80) {
      mfiInterpretation = "Overbought";
    } else if (mfiValue < 20) {
      mfiInterpretation = "Oversold";
    } else {
      mfiInterpretation = "Neutral";
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

  // AD Interpretation
  const latestAd = technicalIndicators.ad ? technicalIndicators.ad[0] : null;
  const adValue = latestAd ? parseFloat(latestAd.ad) : null;
  let adInterpretation = "N/A";
  if (
    adValue !== null &&
    latestClose !== null &&
    technicalIndicators.ad &&
    technicalIndicators.ad.length > 1 &&
    timeSeries.length >= 2
  ) {
    const previousAd = parseFloat(technicalIndicators.ad[1].ad);
    const previousClose = parseFloat(timeSeries[timeSeries.length - 2].close);
    const priceDirection = latestClose > previousClose ? "Up" : "Down";
    const adDirection = adValue > previousAd ? "Up" : "Down";
    if (priceDirection === adDirection) {
      adInterpretation = `Confirmation (${priceDirection} trend supported by volume)`;
    } else {
      adInterpretation = `Divergence (Price ${priceDirection}, AD ${adDirection})`;
    }
  }

  // ADOSC Interpretation
  const latestAdosc = technicalIndicators.adosc ? technicalIndicators.adosc[0] : null;
  const adoscValue = latestAdosc ? parseFloat(latestAdosc.adosc) : null;
  let adoscInterpretation = "N/A";
  if (adoscValue !== null) {
    if (adoscValue > 0) {
      adoscInterpretation = "Buying Pressure (Accumulation)";
    } else if (adoscValue < 0) {
      adoscInterpretation = "Selling Pressure (Distribution)";
    } else {
      adoscInterpretation = "Neutral";
    }
  }

  // KAMA Interpretation
  const latestKama = technicalIndicators.kama ? technicalIndicators.kama[0] : null;
  const kamaValue = latestKama ? parseFloat(latestKama.kama) : null;
  let kamaInterpretation = "N/A";
  if (kamaValue !== null && latestClose !== null) {
    if (latestClose > kamaValue) {
      kamaInterpretation = "Bullish (Price > KAMA)";
    } else if (latestClose < kamaValue) {
      kamaInterpretation = "Bearish (Price < KAMA)";
    } else {
      kamaInterpretation = "Neutral";
    }
  }

  // VWAP Interpretation
  const latestVwap = technicalIndicators.vwap ? technicalIndicators.vwap[0] : null;
  const vwapValue = latestVwap ? parseFloat(latestVwap.vwap) : null;
  let vwapInterpretation = "N/A";
  if (vwapValue !== null && latestClose !== null) {
    if (latestClose > vwapValue) {
      vwapInterpretation = `Above VWAP (Bullish)`;
    } else if (latestClose < vwapValue) {
      vwapInterpretation = `Below VWAP (Bearish)`;
    } else {
      vwapInterpretation = `At VWAP (Neutral)`;
    }
  }

  // Ichimoku Cloud Interpretation
  const latestIchimoku = technicalIndicators.ichimoku ? technicalIndicators.ichimoku[0] : null;
  let ichimokuInterpretation = "N/A";
  if (latestIchimoku && latestClose !== null) {
    const tenkanSen = parseFloat(latestIchimoku.tenkan_sen);
    const kijunSen = parseFloat(latestIchimoku.kijun_sen);
    const senkouSpanA = parseFloat(latestIchimoku.senkou_span_a);
    const senkouSpanB = parseFloat(latestIchimoku.senkou_span_b);
    const cloudTop = Math.max(senkouSpanA, senkouSpanB);
    const cloudBottom = Math.min(senkouSpanA, senkouSpanB);

    if (latestClose > cloudTop && tenkanSen > kijunSen) {
      ichimokuInterpretation = "Bullish (Price above cloud, Tenkan-sen > Kijun-sen)";
    } else if (latestClose < cloudBottom && tenkanSen < kijunSen) {
      ichimokuInterpretation = "Bearish (Price below cloud, Tenkan-sen < Kijun-sen)";
    } else {
      ichimokuInterpretation = "Neutral (Price in cloud or mixed signals)";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/cryptos" className="text-primary hover:text-primary/80">
              <Button variant="ghost">Back to Crypto Listings</Button>
            </Link>
            <div className="flex items-center gap-4">
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
              <h1 className="text-2xl md:text-3xl font-bold">
                {symbol} - {cryptoData.quote?.name || "Unknown"}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-6">
          {/* Crypto Statistics */}
          <Card className="p-6">
            <h2 className="text-xl md:text-2xl font-semibold mb-4">Cryptocurrency Pair Statistics</h2>
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
                <p><strong>Latest Close:</strong> {parseFloat(cryptoData.quote.close || "0").toFixed(8)}</p>
                <p><strong>Latest Open:</strong> {parseFloat(cryptoData.quote.open || "0").toFixed(8)}</p>
                <p><strong>Daily High:</strong> {parseFloat(cryptoData.quote.high || "0").toFixed(8)}</p>
                <p><strong>Daily Low:</strong> {parseFloat(cryptoData.quote.low || "0").toFixed(8)}</p>
              </div>
              <div>
                <p><strong>Previous Close:</strong> {parseFloat(cryptoData.quote.previous_close || "0").toFixed(8)}</p>
                <p><strong>Change:</strong> {parseFloat(cryptoData.quote.change || "0").toFixed(8)} ({parseFloat(cryptoData.quote.percent_change || "0").toFixed(2)}%)</p>
                <p><strong>Base Currency:</strong> {cryptoData.quote.currency_base || "N/A"}</p>
                <p><strong>Quote Currency:</strong> {cryptoData.quote.currency_quote || "N/A"}</p>
                <p><strong>Latest Volume:</strong> {cryptoData.quote.volume || "N/A"}</p>
              </div>
            </div>
          </Card>

          {/* Technical Indicators (Numerical Summaries) */}
          <Card className="p-6">
            <h2 className="text-xl md:text-2xl font-semibold mb-4">Technical Indicators</h2>
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
                <p><strong>Interpretation:</strong> {emaInterpretation}</p>
              </div>

              {/* RSI */}
              <div>
                <h3 className="text-lg font-medium mb-2">Relative Strength Index (RSI)</h3>
                <p>
                  <strong>14-Day RSI:</strong>{" "}
                  {latestRsi ? parseFloat(latestRsi.rsi).toFixed(2) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {rsiInterpretation}</p>
              </div>

              {/* MFI */}
              <div>
                <h3 className="text-lg font-medium mb-2">Money Flow Index (MFI)</h3>
                <p>
                  <strong>14-Day MFI:</strong>{" "}
                  {latestMfi ? parseFloat(latestMfi.mfi).toFixed(2) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {mfiInterpretation}</p>
              </div>

              {/* MACD */}
              <div>
                <h3 className="text-lg font-medium mb-2">MACD</h3>
                {latestMacd ? (
                  <>
                    <p><strong>MACD Line:</strong> {parseFloat(latestMacd.macd).toFixed(8)}</p>
                    <p><strong>Signal Line:</strong> {parseFloat(latestMacd.macd_signal).toFixed(8)}</p>
                    <p><strong>Histogram:</strong> {parseFloat(latestMacd.macd_hist).toFixed(8)}</p>
                    <p><strong>Interpretation:</strong> {macdInterpretation}</p>
                  </>
                ) : (
                  <p>No MACD data available for {symbol}.</p>
                )}
              </div>

              {/* BBANDS */}
              <div>
                <h3 className="text-lg font-medium mb-2">Bollinger Bands</h3>
                {latestBbands ? (
                  <>
                    <p><strong>Upper Band:</strong> {parseFloat(latestBbands.upper_band).toFixed(8)}</p>
                    <p><strong>Middle Band:</strong> {parseFloat(latestBbands.middle_band).toFixed(8)}</p>
                    <p><strong>Lower Band:</strong> {parseFloat(latestBbands.lower_band).toFixed(8)}</p>
                    <p><strong>Interpretation:</strong> {bbandsInterpretation}</p>
                  </>
                ) : (
                  <p>No Bollinger Bands data available for {symbol}.</p>
                )}
              </div>

              {/* ATR */}
              <div>
                <h3 className="text-lg font-medium mb-2">Average True Range (ATR)</h3>
                <p>
                  <strong>14-Day ATR:</strong>{" "}
                  {latestAtr ? parseFloat(latestAtr.atr).toFixed(8) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {atrInterpretation}</p>
              </div>

              {/* Supertrend */}
              <div>
                <h3 className="text-lg font-medium mb-2">Supertrend</h3>
                <p>
                  <strong>Latest Supertrend:</strong>{" "}
                  {latestSupertrend ? parseFloat(latestSupertrend.supertrend).toFixed(8) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {supertrendInterpretation}</p>
              </div>

              {/* OBV */}
              <div>
                <h3 className="text-lg font-medium mb-2">On-Balance Volume (OBV)</h3>
                <p>
                  <strong>Latest OBV:</strong>{" "}
                  {latestObv ? parseFloat(latestObv.obv).toFixed(0) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {obvInterpretation}</p>
              </div>

              {/* AD */}
              <div>
                <h3 className="text-lg font-medium mb-2">Accumulation/Distribution (AD)</h3>
                <p>
                  <strong>Latest AD:</strong>{" "}
                  {latestAd ? parseFloat(latestAd.ad).toFixed(0) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {adInterpretation}</p>
              </div>

              {/* ADOSC */}
              <div>
                <h3 className="text-lg font-medium mb-2">Chaikin Oscillator (ADOSC)</h3>
                <p>
                  <strong>Latest ADOSC:</strong>{" "}
                  {latestAdosc ? parseFloat(latestAdosc.adosc).toFixed(2) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {adoscInterpretation}</p>
              </div>

              {/* KAMA */}
              <div>
                <h3 className="text-lg font-medium mb-2">Kaufman's Adaptive Moving Average (KAMA)</h3>
                <p>
                  <strong>Latest KAMA:</strong>{" "}
                  {latestKama ? parseFloat(latestKama.kama).toFixed(8) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {kamaInterpretation}</p>
              </div>

              {/* VWAP */}
              <div>
                <h3 className="text-lg font-medium mb-2">Volume Weighted Average Price (VWAP)</h3>
                <p>
                  <strong>Latest VWAP:</strong>{" "}
                  {latestVwap ? parseFloat(latestVwap.vwap).toFixed(8) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {vwapInterpretation}</p>
              </div>

              {/* Ichimoku Cloud */}
              <div>
                <h3 className="text-lg font-medium mb-2">Ichimoku Cloud</h3>
                {latestIchimoku ? (
                  <>
                    <p><strong>Tenkan-sen:</strong> {parseFloat(latestIchimoku.tenkan_sen).toFixed(8)}</p>
                    <p><strong>Kijun-sen:</strong> {parseFloat(latestIchimoku.kijun_sen).toFixed(8)}</p>
                    <p><strong>Senkou Span A:</strong> {parseFloat(latestIchimoku.senkou_span_a).toFixed(8)}</p>
                    <p><strong>Senkou Span B:</strong> {parseFloat(latestIchimoku.senkou_span_b).toFixed(8)}</p>
                    <p><strong>Chikou Span:</strong> {parseFloat(latestIchimoku.chikou_span).toFixed(8)}</p>
                    <p><strong>Interpretation:</strong> {ichimokuInterpretation}</p>
                  </>
                ) : (
                  <p>No Ichimoku Cloud data available for {symbol}.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Time Series Data (Charts) */}
          <Card className="p-6">
            <h2 className="text-xl md:text-2xl font-semibold mb-4">Time Series Data</h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Daily Closing Prices with Indicators</h3>
                {timeSeries.length > 0 ? (
                  <Line options={chartOptions} data={closingPriceData} />
                ) : (
                  <p>No historical data available for {symbol}.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Technical Indicator Charts */}
          <Card className="p-6">
            <h2 className="text-xl md:text-2xl font-semibold mb-4">Technical Indicator Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Relative Strength Index (RSI)</h3>
                {technicalIndicators.rsi ? (
                  <Line options={rsiChartOptions} data={rsiChartData} />
                ) : (
                  <p>No RSI data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Money Flow Index (MFI)</h3>
                {technicalIndicators.mfi ? (
                  <Line options={mfiChartOptions} data={mfiChartData} />
                ) : (
                  <p>No MFI data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">MACD</h3>
                {technicalIndicators.macd ? (
                  <Bar options={macdChartOptions} data={macdChartData} />
                ) : (
                  <p>No MACD data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Average True Range (ATR)</h3>
                {technicalIndicators.atr ? (
                  <Line options={atrChartOptions} data={atrChartData} />
                ) : (
                  <p>No ATR data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Supertrend</h3>
                {technicalIndicators.supertrend ? (
                  <Line options={supertrendChartOptions} data={supertrendChartData} />
                ) : (
                  <p>No Supertrend data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">On-Balance Volume (OBV)</h3>
                {technicalIndicators.obv ? (
                  <Line options={obvChartOptions} data={obvChartData} />
                ) : (
                  <p>No OBV data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Accumulation/Distribution (AD)</h3>
                {technicalIndicators.ad ? (
                  <Line options={adChartOptions} data={adChartData} />
                ) : (
                  <p>No AD data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Chaikin Oscillator (ADOSC)</h3>
                {technicalIndicators.adosc ? (
                  <Line options={adoscChartOptions} data={adoscChartData} />
                ) : (
                  <p>No ADOSC data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Kaufman's Adaptive Moving Average (KAMA)</h3>
                {technicalIndicators.kama ? (
                  <Line options={kamaChartOptions} data={kamaChartData} />
                ) : (
                  <p>No KAMA data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Volume Weighted Average Price (VWAP)</h3>
                {technicalIndicators.vwap ? (
                  <Line options={vwapChartOptions} data={vwapChartData} />
                ) : (
                  <p>No VWAP data available for {symbol}.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Ichimoku Cloud</h3>
                {technicalIndicators.ichimoku ? (
                  <Line options={ichimokuChartOptions} data={ichimokuChartData} />
                ) : (
                  <p>No Ichimoku Cloud data available for {symbol}.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}