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
  logo: string | null; // For equities
  logo_base: string | null; // For crypto/forex
  logo_quote: string | null; // For crypto/forex
}

interface StockData {
  timeSeries: {
    meta: {
      symbol: string;
      interval: string;
      currency: string;
      exchange_timezone: string;
      exchange: string;
      mic_code: string;
      type: string;
    };
    values: Array<{
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      adjusted_close?: string;
    }>;
    status: string;
  };
  quote: {
    symbol: string;
    name: string;
    exchange: string;
    currency: string;
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
    previous_close: string;
    change: string;
    percent_change: string;
    average_volume?: string;
    fifty_two_week: {
      low: string;
      high: string;
      low_change: string;
      high_change: string;
      low_change_percent: string;
      high_change_percent: string;
      range: string;
    };
  } | null;
  price: {
    price: string;
  } | null;
  eod: {
    symbol: string;
    exchange: string;
    mic_code: string;
    currency: string;
    datetime: string;
    close: string;
  } | null;
}

interface TechnicalIndicators {
  stoch: Array<{
    datetime: string;
    slow_k: string;
    slow_d: string;
  }> | null;
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
  ema: {
    ema20: Array<{
      datetime: string;
      ema: string;
    }> | null;
    ema50: Array<{
      datetime: string;
      ema: string;
    }> | null;
  };
  rsi: Array<{
    datetime: string;
    rsi: string;
  }> | null;
  percentB: Array<{
    datetime: string;
    percent_b: string;
  }> | null;
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
  adx: Array<{
    datetime: string;
    adx: string;
  }> | null;
}

export default function StockDetails() {
  const params = useParams();
  const symbol = params.symbol as string;
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch overview data (logo only)
        const overviewResponse = await fetch(`/api/overview?symbol=${symbol}`);
        if (!overviewResponse.ok) {
          const errorData = await overviewResponse.json();
          throw new Error(errorData.error || "Failed to fetch overview data");
        }
        const overviewData = await overviewResponse.json();
        setOverview(overviewData);

        // Fetch stock data (time series + quote + price + eod)
        const stockResponse = await fetch(`/api/stock?symbol=${symbol}`);
        if (!stockResponse.ok) {
          const errorData = await stockResponse.json();
          throw new Error(errorData.error || "Failed to fetch stock data");
        }
        const stockData = await stockResponse.json();
        setStockData(stockData);

        // Fetch technical indicators
        const indicatorsResponse = await fetch(`/api/technical-indicators?symbol=${symbol}`);
        if (!indicatorsResponse.ok) {
          const errorData = await indicatorsResponse.json();
          throw new Error(errorData.error || "Failed to fetch technical indicators");
        }
        const indicatorsData = await indicatorsResponse.json();
        setTechnicalIndicators(indicatorsData);
      } catch (error) {
        console.error("Error fetching data:", error.message);
        toast({
          title: "Error",
          description: error.message || "Failed to fetch stock data",
          variant: "destructive",
        });
        setStockData(null);
        setTechnicalIndicators(null);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchData();
    }
  }, [symbol, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!overview || !stockData || !stockData.timeSeries || !stockData.quote || !technicalIndicators) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>No data available for {symbol}</p>
      </div>
    );
  }

  // Prepare chart data for time series
  const timeSeries = stockData.timeSeries.values || [];
  const labels = timeSeries.map((entry) => entry.datetime).reverse();
  const closingPrices = timeSeries.map((entry) => parseFloat(entry.close)).reverse();
  const adjustedClosingPrices = timeSeries
    .map((entry) => parseFloat(entry.adjusted_close || entry.close))
    .reverse();

  // Prepare SMA and EMA data for overlay
  const sma20Data = technicalIndicators.sma.sma20
    ? technicalIndicators.sma.sma20.map((entry) => parseFloat(entry.sma)).reverse()
    : [];
  const sma50Data = technicalIndicators.sma.sma50
    ? technicalIndicators.sma.sma50.map((entry) => parseFloat(entry.sma)).reverse()
    : [];
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

  // Closing Price Chart with SMA, EMA, and BBANDS
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
    ],
  };

  const adjustedClosingPriceData = {
    labels,
    datasets: [
      {
        label: "Adjusted Closing Price",
        data: adjustedClosingPrices,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `${symbol} Price History`,
      },
    },
  };

  // STOCH Chart
  const stochLabels = technicalIndicators.stoch
    ? technicalIndicators.stoch.map((entry) => entry.datetime).reverse()
    : [];
  const stochKData = technicalIndicators.stoch
    ? technicalIndicators.stoch.map((entry) => parseFloat(entry.slow_k)).reverse()
    : [];
  const stochDData = technicalIndicators.stoch
    ? technicalIndicators.stoch.map((entry) => parseFloat(entry.slow_d)).reverse()
    : [];

  const stochChartData = {
    labels: stochLabels,
    datasets: [
      {
        label: "Slow %K",
        data: stochKData,
        borderColor: "rgb(255, 215, 0)",
        backgroundColor: "rgba(255, 215, 0, 0.5)",
        fill: false,
      },
      {
        label: "Slow %D",
        data: stochDData,
        borderColor: "rgb(0, 255, 127)",
        backgroundColor: "rgba(0, 255, 127, 0.5)",
        fill: false,
      },
    ],
  };

  const stochChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Stochastic Oscillator (STOCH)",
      },
      annotation: {
        annotations: [
          {
            type: "line",
            yMin: 80,
            yMax: 80,
            borderColor: "red",
            borderWidth: 1,
            label: {
              content: "Overbought (80)",
              display: true,
              position: "end",
            },
          },
          {
            type: "line",
            yMin: 20,
            yMax: 20,
            borderColor: "green",
            borderWidth: 1,
            label: {
              content: "Oversold (20)",
              display: true,
              position: "end",
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
            type: "line",
            yMin: 70,
            yMax: 70,
            borderColor: "red",
            borderWidth: 1,
            label: {
              content: "Overbought (70)",
              display: true,
              position: "end",
            },
          },
          {
            type: "line",
            yMin: 30,
            yMax: 30,
            borderColor: "green",
            borderWidth: 1,
            label: {
              content: "Oversold (30)",
              display: true,
              position: "end",
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

  // PERCENT_B Chart
  const percentBLabels = technicalIndicators.percentB
    ? technicalIndicators.percentB.map((entry) => entry.datetime).reverse()
    : [];
  const percentBData = technicalIndicators.percentB
    ? technicalIndicators.percentB.map((entry) => parseFloat(entry.percent_b)).reverse()
    : [];

  const percentBChartData = {
    labels: percentBLabels,
    datasets: [
      {
        label: "%B",
        data: percentBData,
        borderColor: "rgb(255, 20, 147)",
        backgroundColor: "rgba(255, 20, 147, 0.5)",
        fill: false,
      },
    ],
  };

  const percentBChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "%B Indicator",
      },
      annotation: {
        annotations: [
          {
            type: "line",
            yMin: 1,
            yMax: 1,
            borderColor: "red",
            borderWidth: 1,
            label: {
              content: "Upper Band (1)",
              display: true,
              position: "end",
            },
          },
          {
            type: "line",
            yMin: 0,
            yMax: 0,
            borderColor: "green",
            borderWidth: 1,
            label: {
              content: "Lower Band (0)",
              display: true,
              position: "end",
            },
          },
        ],
      },
    },
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
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "MACD",
      },
    },
  };

  // ADX Chart
  const adxLabels = technicalIndicators.adx
    ? technicalIndicators.adx.map((entry) => entry.datetime).reverse()
    : [];
  const adxData = technicalIndicators.adx
    ? technicalIndicators.adx.map((entry) => parseFloat(entry.adx)).reverse()
    : [];

  const adxChartData = {
    labels: adxLabels,
    datasets: [
      {
        label: "ADX",
        data: adxData,
        borderColor: "rgb(34, 139, 34)",
        backgroundColor: "rgba(34, 139, 34, 0.5)",
        fill: false,
      },
    ],
  };

  const adxChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Average Directional Index (ADX)",
      },
      annotation: {
        annotations: [
          {
            type: "line",
            yMin: 25,
            yMax: 25,
            borderColor: "blue",
            borderWidth: 1,
            label: {
              content: "Strong Trend (25)",
              display: true,
              position: "end",
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
  const eodDateFormatted = stockData.eod?.datetime
    ? new Date(stockData.eod.datetime).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  // STOCH Interpretation (using latest value)
  const latestStoch = technicalIndicators.stoch ? technicalIndicators.stoch[0] : null;
  const stochK = latestStoch ? parseFloat(latestStoch.slow_k) : null;
  const stochD = latestStoch ? parseFloat(latestStoch.slow_d) : null;
  let stochInterpretation = "N/A";
  if (stochK !== null && stochD !== null) {
    if (stochK > 80 && stochD > 80) {
      stochInterpretation = "Overbought";
    } else if (stochK < 20 && stochD < 20) {
      stochInterpretation = "Oversold";
    } else if (stochK > stochD) {
      stochInterpretation = "Bullish Crossover";
    } else if (stochK < stochD) {
      stochInterpretation = "Bearish Crossover";
    } else {
      stochInterpretation = "Neutral";
    }
  }

  // RSI Interpretation (using latest value)
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

  // PERCENT_B Interpretation (using latest value)
  const latestPercentB = technicalIndicators.percentB ? technicalIndicators.percentB[0] : null;
  const percentBValue = latestPercentB ? parseFloat(latestPercentB.percent_b) : null;
  let percentBInterpretation = "N/A";
  if (percentBValue !== null) {
    if (percentBValue > 1) {
      percentBInterpretation = "Above Upper Band (Overbought)";
    } else if (percentBValue < 0) {
      percentBInterpretation = "Below Lower Band (Oversold)";
    } else {
      percentBInterpretation = "Within Bands";
    }
  }

  // MACD Interpretation (using latest value)
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

  // ADX Interpretation (using latest value)
  const latestAdx = technicalIndicators.adx ? technicalIndicators.adx[0] : null;
  const adxValue = latestAdx ? parseFloat(latestAdx.adx) : null;
  let adxInterpretation = "N/A";
  if (adxValue !== null) {
    if (adxValue > 25) {
      adxInterpretation = "Strong Trend";
    } else if (adxValue < 20) {
      adxInterpretation = "Weak Trend";
    } else {
      adxInterpretation = "Neutral";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-l mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-primary hover:text-primary/80">
              <Button variant="ghost">Back to Stock Listings</Button>
            </Link>
            <div className="flex items-center gap-4">
              {/* Display logo(s) next to the symbol */}
              {overview.logo ? (
                <Image
                  src={overview.logo}
                  alt={`${symbol} logo`}
                  width={50}
                  height={50}
                  className="rounded"
                />
              ) : overview.logo_base && overview.logo_quote ? (
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
              <h1 className="text-2xl font-bold">
                {symbol} - {stockData.quote.name || "Unknown"}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-l mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-6">
          {/* Stock Statistics */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Stock Statistics</h2>
            {stockData.quote ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p>
                    <strong>Current Price:</strong>{" "}
                    {stockData.price?.price
                      ? `$${parseFloat(stockData.price.price).toFixed(2)}`
                      : "N/A"}
                  </p>
                  <p>
                    <strong>EOD Price ({eodDateFormatted}):</strong>{" "}
                    {stockData.eod?.close
                      ? `$${parseFloat(stockData.eod.close).toFixed(2)}`
                      : "N/A"}
                  </p>
                  <p><strong>Latest Close:</strong> ${parseFloat(stockData.quote.close || "0").toFixed(2)}</p>
                  <p><strong>Latest Open:</strong> ${parseFloat(stockData.quote.open || "0").toFixed(2)}</p>
                  <p><strong>Daily High:</strong> ${parseFloat(stockData.quote.high || "0").toFixed(2)}</p>
                  <p><strong>Daily Low:</strong> ${parseFloat(stockData.quote.low || "0").toFixed(2)}</p>
                </div>
                <div>
                  <p><strong>Previous Close:</strong> ${parseFloat(stockData.quote.previous_close || "0").toFixed(2)}</p>
                  <p><strong>Change:</strong> {parseFloat(stockData.quote.change || "0").toFixed(2)} ({parseFloat(stockData.quote.percent_change || "0").toFixed(2)}%)</p>
                  <p>
                    <strong>Volume:</strong>{" "}
                    {stockData.quote.volume != null
                      ? parseInt(stockData.quote.volume).toLocaleString("en-US")
                      : "N/A"}
                  </p>
                  <p>
                    <strong>Average Volume:</strong>{" "}
                    {stockData.quote.average_volume != null
                      ? parseInt(stockData.quote.average_volume).toLocaleString("en-US")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p><strong>52-Week Range:</strong> ${parseFloat(stockData.quote.fifty_two_week?.low || "0").toFixed(2)} - ${parseFloat(stockData.quote.fifty_two_week?.high || "0").toFixed(2)}</p>
                  <p><strong>52-Week Low Change:</strong> ${parseFloat(stockData.quote.fifty_two_week?.low_change || "0").toFixed(2)} ({parseFloat(stockData.quote.fifty_two_week?.low_change_percent || "0").toFixed(2)}%)</p>
                  <p><strong>52-Week High Change:</strong> ${parseFloat(stockData.quote.fifty_two_week?.high_change || "0").toFixed(2)} ({parseFloat(stockData.quote.fifty_two_week?.high_change_percent || "0").toFixed(2)}%)</p>
                  <p><strong>Exchange:</strong> {stockData.quote.exchange || "N/A"}</p>
                </div>
              </div>
            ) : (
              <p>No stock statistics available for {symbol}.</p>
            )}
          </Card>

          {/* Technical Indicators (Numerical Summaries) */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Technical Indicators</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* STOCH */}
              <div>
                <h3 className="text-lg font-medium mb-2">Stochastic Oscillator (STOCH)</h3>
                {latestStoch ? (
                  <>
                    <p><strong>Slow %K:</strong> {parseFloat(latestStoch.slow_k).toFixed(2)}</p>
                    <p><strong>Slow %D:</strong> {parseFloat(latestStoch.slow_d).toFixed(2)}</p>
                    <p><strong>Interpretation:</strong> {stochInterpretation}</p>
                  </>
                ) : (
                  <p>No STOCH data available for {symbol}.</p>
                )}
              </div>

              {/* Moving Averages (SMA and EMA) */}
              <div>
                <h3 className="text-lg font-medium mb-2">Moving Averages</h3>
                <p>
                  <strong>20-Day SMA:</strong>{" "}
                  {technicalIndicators.sma.sma20 && technicalIndicators.sma.sma20[0]
                    ? `$${parseFloat(technicalIndicators.sma.sma20[0].sma).toFixed(2)}`
                    : "N/A"}
                </p>
                <p>
                  <strong>50-Day SMA:</strong>{" "}
                  {technicalIndicators.sma.sma50 && technicalIndicators.sma.sma50[0]
                    ? `$${parseFloat(technicalIndicators.sma.sma50[0].sma).toFixed(2)}`
                    : "N/A"}
                </p>
                <p>
                  <strong>20-Day EMA:</strong>{" "}
                  {technicalIndicators.ema.ema20 && technicalIndicators.ema.ema20[0]
                    ? `$${parseFloat(technicalIndicators.ema.ema20[0].ema).toFixed(2)}`
                    : "N/A"}
                </p>
                <p>
                  <strong>50-Day EMA:</strong>{" "}
                  {technicalIndicators.ema.ema50 && technicalIndicators.ema.ema50[0]
                    ? `$${parseFloat(technicalIndicators.ema.ema50[0].ema).toFixed(2)}`
                    : "N/A"}
                </p>
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

              {/* PERCENT_B */}
              <div>
                <h3 className="text-lg font-medium mb-2">%B Indicator</h3>
                <p>
                  <strong>%B:</strong>{" "}
                  {latestPercentB ? parseFloat(latestPercentB.percent_b).toFixed(2) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {percentBInterpretation}</p>
              </div>

              {/* MACD */}
              <div>
                <h3 className="text-lg font-medium mb-2">MACD</h3>
                {latestMacd ? (
                  <>
                    <p><strong>MACD Line:</strong> {parseFloat(latestMacd.macd).toFixed(2)}</p>
                    <p><strong>Signal Line:</strong> {parseFloat(latestMacd.macd_signal).toFixed(2)}</p>
                    <p><strong>Histogram:</strong> {parseFloat(latestMacd.macd_hist).toFixed(2)}</p>
                    <p><strong>Interpretation:</strong> {macdInterpretation}</p>
                  </>
                ) : (
                  <p>No MACD data available for {symbol}.</p>
                )}
              </div>

              {/* BBANDS */}
              <div>
                <h3 className="text-lg font-medium mb-2">Bollinger Bands</h3>
                {technicalIndicators.bbands && technicalIndicators.bbands[0] ? (
                  <>
                    <p><strong>Upper Band:</strong> ${parseFloat(technicalIndicators.bbands[0].upper_band).toFixed(2)}</p>
                    <p><strong>Middle Band:</strong> ${parseFloat(technicalIndicators.bbands[0].middle_band).toFixed(2)}</p>
                    <p><strong>Lower Band:</strong> ${parseFloat(technicalIndicators.bbands[0].lower_band).toFixed(2)}</p>
                  </>
                ) : (
                  <p>No Bollinger Bands data available for {symbol}.</p>
                )}
              </div>

              {/* ADX */}
              <div>
                <h3 className="text-lg font-medium mb-2">Average Directional Index (ADX)</h3>
                <p>
                  <strong>14-Day ADX:</strong>{" "}
                  {latestAdx ? parseFloat(latestAdx.adx).toFixed(2) : "N/A"}
                </p>
                <p><strong>Interpretation:</strong> {adxInterpretation}</p>
              </div>
            </div>
          </Card>

          {/* Time Series Data (Charts) */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Time Series Data</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Daily Closing Prices with SMA, EMA, and BBANDS</h3>
                <Line options={chartOptions} data={closingPriceData} />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Daily Adjusted Closing Prices</h3>
                <Line options={chartOptions} data={adjustedClosingPriceData} />
              </div>
            </div>
          </Card>

          {/* Technical Indicator Charts */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Technical Indicator Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* STOCH Chart */}
              <div>
                <h3 className="text-lg font-medium mb-2">Stochastic Oscillator (STOCH)</h3>
                {technicalIndicators.stoch ? (
                  <Line options={stochChartOptions} data={stochChartData} />
                ) : (
                  <p>No STOCH data available for {symbol}.</p>
                )}
              </div>

              {/* RSI Chart */}
              <div>
                <h3 className="text-lg font-medium mb-2">Relative Strength Index (RSI)</h3>
                {technicalIndicators.rsi ? (
                  <Line options={rsiChartOptions} data={rsiChartData} />
                ) : (
                  <p>No RSI data available for {symbol}.</p>
                )}
              </div>

              {/* PERCENT_B Chart */}
              <div>
                <h3 className="text-lg font-medium mb-2">%B Indicator</h3>
                {technicalIndicators.percentB ? (
                  <Line options={percentBChartOptions} data={percentBChartData} />
                ) : (
                  <p>No %B data available for {symbol}.</p>
                )}
              </div>

              {/* MACD Chart */}
              <div>
                <h3 className="text-lg font-medium mb-2">MACD</h3>
                {technicalIndicators.macd ? (
                  <Bar options={macdChartOptions} data={macdChartData} />
                ) : (
                  <p>No MACD data available for {symbol}.</p>
                )}
              </div>

              {/* ADX Chart */}
              <div>
                <h3 className="text-lg font-medium mb-2">Average Directional Index (ADX)</h3>
                {technicalIndicators.adx ? (
                  <Line options={adxChartOptions} data={adxChartData} />
                ) : (
                  <p>No ADX data available for {symbol}.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}