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
  BarController,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";
import { Chart, Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import Image from "next/image";
import { BarChart3, ArrowRight, MessageCircle, MessageSquare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { RedditSocialSentiment } from "@/components/reddit-social-sentiment";
import { marketThemes } from "@/lib/themes";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

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

interface OverviewData {
  logo: string | null;
  logo_base: string | null;
  logo_quote: string | null;
}

interface StockData {
  timeSeries?: {
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
  quote?: {
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
  price?: {
    price: string;
  } | null;
  eod?: {
    symbol: string;
    exchange: string;
    mic_code: string;
    currency: string;
    datetime: string;
    close: string;
  } | null;
}

interface TechnicalIndicators {
  ema: {
    ema20: Array<{ datetime: string; ema: string }> | null;
    ema50: Array<{ datetime: string; ema: string }> | null;
  };
  rsi: Array<{ datetime: string; rsi: string }> | null;
  macd: Array<{ datetime: string; macd: string; macd_signal: string; macd_hist: string }> | null;
  bbands: Array<{ datetime: string; upper_band: string; middle_band: string; lower_band: string }> | null;
  adx: Array<{ datetime: string; adx: string }> | null;
  atr: Array<{ datetime: string; atr: string }> | null;
  aroon: Array<{ datetime: string; aroon_up: string; aroon_down: string }> | null;
}

export default function StockDetails() {
  const params = useParams();
  const symbol = params.symbol as string;
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const theme = marketThemes.stock;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMessage(null);
      let partialDataAvailable = false;

      try {
        // Fetch overview data (US stocks only)
        try {
          const overviewResponse = await fetch(`/api/overview?symbol=${symbol}`);
          if (overviewResponse.ok) {
            const overviewData = await overviewResponse.json();
            setOverview(overviewData);
            partialDataAvailable = true;
          }
        } catch (error) {
          console.warn("Overview fetch failed:", error);
        }

        // Fetch stock data from primary endpoint
        let stockResponse = await fetch(`/api/stock?symbol=${symbol}`);
        if (!stockResponse.ok) {
          const errorData = await stockResponse.json();
          console.warn("Primary stock fetch failed:", errorData.error || "Unknown error");

          // Fallback: Try Twelve Data API for US stocks
          const twelveDataUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=30&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          const twelveResponse = await fetch(twelveDataUrl);
          if (twelveResponse.ok) {
            const twelveData = await twelveResponse.json();
            console.log("Twelve Data Response:", twelveData);
            if (twelveData.status === "ok" && twelveData.values) {
              setStockData({
                timeSeries: {
                  meta: {
                    symbol: twelveData.meta.symbol,
                    interval: twelveData.meta.interval,
                    currency: twelveData.meta.currency || "USD",
                    exchange_timezone: twelveData.meta.exchange_timezone || "America/New_York",
                    exchange: twelveData.meta.exchange || "NASDAQ",
                    mic_code: twelveData.meta.mic_code || "XNAS",
                    type: twelveData.meta.type || "Common Stock",
                  },
                  values: twelveData.values,
                  status: twelveData.status,
                },
              });
              partialDataAvailable = true;
            } else {
              setErrorMessage(
                twelveData.message || "This symbol is not supported by the free Twelve Data plan, which only includes US stocks (e.g., AAPL, MSFT)."
              );
            }
          } else {
            setErrorMessage("Failed to fetch data from Twelve Data. Ensure the symbol is a valid US stock.");
          }
        } else {
          const stockData = await stockResponse.json();
          setStockData(stockData);
          partialDataAvailable = true;
        }

        // Fetch technical indicators
        try {
          const indicatorsResponse = await fetch(`/api/technical-indicators?symbol=${symbol}`);
          if (indicatorsResponse.ok) {
            const indicatorsData = await indicatorsResponse.json();
            setTechnicalIndicators(indicatorsData);
            partialDataAvailable = true;
          }
        } catch (error) {
          console.warn("Technical indicators fetch failed:", error);
          // Fallback: Fetch RSI from Twelve Data for US stocks
          const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY}`;
          const rsiResponse = await fetch(rsiUrl);
          if (rsiResponse.ok) {
            const rsiData = await rsiResponse.json();
            if (rsiData.status === "ok" && rsiData.values) {
              setTechnicalIndicators({
                ema: { ema20: null, ema50: null },
                rsi: rsiData.values,
                macd: null,
                bbands: null,
                adx: null,
                atr: null,
                aroon: null,
              });
              partialDataAvailable = true;
            }
          }
        }

        if (!partialDataAvailable && !errorMessage) {
          setErrorMessage(`No data available for ${symbol}. This service only supports US stocks with the free Twelve Data plan. Try "AAPL" or "MSFT".`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error fetching data:", errorMessage);
        setErrorMessage(`Error: ${errorMessage}. This service is limited to US stocks on the free plan.`);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
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
        <p className="text-muted-foreground">
          Fetching data for {symbol}... This may take up to 2 minutes due to API rate limits.
        </p>
      </div>
    );
  }

  if (!stockData && !technicalIndicators && errorMessage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">
          {errorMessage}{" "}
          <a href="https://twelvedata.com/pricing" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
            Upgrade your plan
          </a>{" "}
          for broader market support.
        </p>
      </div>
    );
  }

  // Prepare chart data (with fallbacks for missing data)
  const timeSeries = stockData?.timeSeries?.values || [];
  const labels = timeSeries.length ? timeSeries.map((entry) => entry.datetime).reverse() : [];
  const closingPrices = timeSeries.length ? timeSeries.map((entry) => parseFloat(entry.close)).reverse() : [];
  const adjustedClosingPrices = timeSeries.length
    ? timeSeries.map((entry) => parseFloat(entry.adjusted_close || entry.close)).reverse()
    : [];

  const ema20Data = technicalIndicators?.ema?.ema20
    ? technicalIndicators.ema.ema20.map((entry) => parseFloat(entry.ema)).reverse()
    : [];
  const ema50Data = technicalIndicators?.ema?.ema50
    ? technicalIndicators.ema.ema50.map((entry) => parseFloat(entry.ema)).reverse()
    : [];
  const bbandsUpper = technicalIndicators?.bbands
    ? technicalIndicators.bbands.map((entry) => parseFloat(entry.upper_band)).reverse()
    : [];
  const bbandsMiddle = technicalIndicators?.bbands
    ? technicalIndicators.bbands.map((entry) => parseFloat(entry.middle_band)).reverse()
    : [];
  const bbandsLower = technicalIndicators?.bbands
    ? technicalIndicators.bbands.map((entry) => parseFloat(entry.lower_band)).reverse()
    : [];

  const closingPriceData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Closing Price",
        data: closingPrices,
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      ...(ema20Data.length
        ? [{ 
            label: "20-Day EMA", 
            data: ema20Data, 
            borderColor: theme.secondary, 
            backgroundColor: `${theme.secondary}20`, 
            fill: false,
            borderDash: [5, 5],
            pointRadius: 0,
          }]
        : []),
      ...(ema50Data.length
        ? [{ 
            label: "50-Day EMA", 
            data: ema50Data, 
            borderColor: "#8B5CF6", 
            backgroundColor: "rgba(139, 92, 246, 0.2)", 
            fill: false,
            borderDash: [5, 5],
            pointRadius: 0,
          }]
        : []),
      ...(bbandsUpper.length
        ? [{ 
            label: "Bollinger Upper Band", 
            data: bbandsUpper, 
            borderColor: "#EC4899", 
            backgroundColor: "rgba(236, 72, 153, 0.1)", 
            fill: false,
            pointRadius: 0,
          }]
        : []),
      ...(bbandsMiddle.length
        ? [{ 
            label: "Bollinger Middle Band", 
            data: bbandsMiddle, 
            borderColor: "#9CA3AF", 
            backgroundColor: "rgba(156, 163, 175, 0.1)", 
            fill: false,
            pointRadius: 0,
          }]
        : []),
      ...(bbandsLower.length
        ? [{ 
            label: "Bollinger Lower Band", 
            data: bbandsLower, 
            borderColor: "#EC4899", 
            backgroundColor: "rgba(236, 72, 153, 0.1)", 
            fill: false,
            pointRadius: 0,
          }]
        : []),
    ],
  };

  const adjustedClosingPriceData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Adjusted Closing Price",
        data: adjustedClosingPrices,
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
          },
        }
      },
      title: { 
        display: true, 
        text: `${symbol} Price History`,
        color: "#f3f4f6",
        font: {
          size: 16,
        }
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(30, 41, 59, 0.9)",
        titleColor: "#f3f4f6",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(75, 85, 99, 0.5)",
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      },
      y: {
        grid: {
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 10,
          },
          callback: function(value: any) {
            return "$" + value;
          }
        }
      }
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
    },
    barPercentage: 0.8,
    categoryPercentage: 0.9
  };

  const rsiLabels = technicalIndicators?.rsi?.map((entry) => entry.datetime).reverse() || [];
  const rsiData = technicalIndicators?.rsi?.map((entry) => parseFloat(entry.rsi)).reverse() || [];
  const rsiChartData: ChartData<"line", number[], string> = {
    labels: rsiLabels,
    datasets: [
      {
        label: "RSI",
        data: rsiData,
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };
  const rsiChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
          },
        }
      },
      title: { 
        display: true, 
        text: "Relative Strength Index (RSI)",
        color: "#f3f4f6",
        font: {
          size: 16,
        }
      },
      annotation: {
        annotations: [
          { 
            type: "line" as const, 
            yMin: 70, 
            yMax: 70, 
            borderColor: "rgba(239, 68, 68, 0.8)", 
            borderWidth: 1, 
            borderDash: [6, 6],
            label: { 
              content: "Overbought (70)", 
              display: true, 
              position: "end" as const, 
              color: "#f3f4f6",
              backgroundColor: "rgba(30, 41, 59, 0.8)",
            } 
          },
          { 
            type: "line" as const, 
            yMin: 30, 
            yMax: 30, 
            borderColor: "rgba(34, 197, 94, 0.8)", 
            borderWidth: 1, 
            borderDash: [6, 6],
            label: { 
              content: "Oversold (30)", 
              display: true, 
              position: "end" as const, 
              color: "#f3f4f6",
              backgroundColor: "rgba(30, 41, 59, 0.8)",
            } 
          },
        ],
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(30, 41, 59, 0.9)",
        titleColor: "#f3f4f6",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(75, 85, 99, 0.5)",
        borderWidth: 1,
      }
    },
    scales: { 
      y: { 
        min: 0, 
        max: 100,
        grid: {
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      },
      x: {
        grid: {
          display: false,
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      }
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
    },
    barPercentage: 0.8,
    categoryPercentage: 0.9
  };

  const macdLabels = technicalIndicators?.macd?.map((entry) => entry.datetime).reverse() || [];
  const macdData = technicalIndicators?.macd?.map((entry) => parseFloat(entry.macd)).reverse() || [];
  const macdSignalData = technicalIndicators?.macd?.map((entry) => parseFloat(entry.macd_signal)).reverse() || [];
  const macdHistData = technicalIndicators?.macd?.map((entry) => parseFloat(entry.macd_hist)).reverse() || [];
  const macdChartData: ChartData<"bar" | "line", number[], string> = {
    labels: macdLabels,
    datasets: [
      ...(macdData.length
        ? [{ 
            label: "MACD", 
            data: macdData, 
            borderColor: theme.primary, 
            backgroundColor: `${theme.primary}20`, 
            fill: false, 
            type: "line" as const,
            tension: 0.4,
            pointRadius: 0,
          }]
        : []),
      ...(macdSignalData.length
        ? [{ 
            label: "Signal Line", 
            data: macdSignalData, 
            borderColor: theme.secondary, 
            backgroundColor: `${theme.secondary}20`, 
            fill: false, 
            type: "line" as const,
            borderDash: [5, 5],
            pointRadius: 0,
          }]
        : []),
      ...(macdHistData.length
        ? [{ 
            label: "Histogram", 
            data: macdHistData, 
            backgroundColor: (context: any) => {
              const value = context.dataset.data[context.dataIndex];
              return value > 0 ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)";
            },
            type: "bar" as const,
          }]
        : []),
    ],
  };
  const macdChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
          },
        }
      },
      title: { 
        display: true, 
        text: "MACD",
        color: "#f3f4f6",
        font: {
          size: 16,
        }
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(30, 41, 59, 0.9)",
        titleColor: "#f3f4f6",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(75, 85, 99, 0.5)",
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      },
      y: {
        grid: {
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      }
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
    },
    barPercentage: 0.8,
    categoryPercentage: 0.9
  };

  const adxLabels = technicalIndicators?.adx?.map((entry) => entry.datetime).reverse() || [];
  const adxData = technicalIndicators?.adx?.map((entry) => parseFloat(entry.adx)).reverse() || [];
  const adxChartData: ChartData<"line", number[], string> = {
    labels: adxLabels,
    datasets: [
      {
        label: "ADX",
        data: adxData,
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };
  const adxChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
          },
        }
      },
      title: { 
        display: true, 
        text: "Average Directional Index (ADX)",
        color: "#f3f4f6",
        font: {
          size: 16,
        }
      },
      annotation: {
        annotations: [
          { 
            type: "line" as const, 
            yMin: 25, 
            yMax: 25, 
            borderColor: "rgba(59, 130, 246, 0.8)", 
            borderWidth: 1, 
            borderDash: [6, 6],
            label: { 
              content: "Strong Trend (25)", 
              display: true, 
              position: "end" as const,
              color: "#f3f4f6",
              backgroundColor: "rgba(30, 41, 59, 0.8)",
            } 
          },
        ],
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(30, 41, 59, 0.9)",
        titleColor: "#f3f4f6",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(75, 85, 99, 0.5)",
        borderWidth: 1,
      }
    },
    scales: { 
      y: { 
        min: 0, 
        max: 100,
        grid: {
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      },
      x: {
        grid: {
          display: false,
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      }
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
    },
  };

  const atrLabels = technicalIndicators?.atr?.map((entry) => entry.datetime).reverse() || [];
  const atrData = technicalIndicators?.atr?.map((entry) => parseFloat(entry.atr)).reverse() || [];
  const atrChartData: ChartData<"line", number[], string> = {
    labels: atrLabels,
    datasets: [
      {
        label: "ATR",
        data: atrData,
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };
  const atrChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
          },
        }
      },
      title: { 
        display: true, 
        text: "Average True Range (ATR)",
        color: "#f3f4f6",
        font: {
          size: 16,
        }
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(30, 41, 59, 0.9)",
        titleColor: "#f3f4f6",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(75, 85, 99, 0.5)",
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      },
      y: {
        grid: {
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      }
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
    },
  };

  const aroonLabels = technicalIndicators?.aroon?.map((entry) => entry.datetime).reverse() || [];
  const aroonUpData = technicalIndicators?.aroon?.map((entry) => parseFloat(entry.aroon_up)).reverse() || [];
  const aroonDownData = technicalIndicators?.aroon?.map((entry) => parseFloat(entry.aroon_down)).reverse() || [];
  const aroonChartData: ChartData<"line", number[], string> = {
    labels: aroonLabels,
    datasets: [
      ...(aroonUpData.length
        ? [{ 
            label: "Aroon Up", 
            data: aroonUpData, 
            borderColor: "#10B981", 
            backgroundColor: "rgba(16, 185, 129, 0.2)", 
            fill: false,
            tension: 0.4,
            pointRadius: 0,
          }]
        : []),
      ...(aroonDownData.length
        ? [{ 
            label: "Aroon Down", 
            data: aroonDownData, 
            borderColor: "#EF4444", 
            backgroundColor: "rgba(239, 68, 68, 0.2)", 
            fill: false,
            tension: 0.4,
            pointRadius: 0,
          }]
        : []),
    ],
  };
  const aroonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: "top" as const,
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
          },
        }
      },
      title: { 
        display: true, 
        text: "Aroon Indicator",
        color: "#f3f4f6",
        font: {
          size: 16,
        }
      },
      annotation: {
        annotations: [
          { 
            type: "line" as const, 
            yMin: 70, 
            yMax: 70, 
            borderColor: "rgba(59, 130, 246, 0.8)", 
            borderWidth: 1, 
            borderDash: [6, 6],
            label: { 
              content: "Strong Trend (70)", 
              display: true, 
              position: "end" as const,
              color: "#f3f4f6",
              backgroundColor: "rgba(30, 41, 59, 0.8)",
            } 
          },
          { 
            type: "line" as const, 
            yMin: 30, 
            yMax: 30, 
            borderColor: "rgba(59, 130, 246, 0.8)", 
            borderWidth: 1, 
            borderDash: [6, 6],
            label: { 
              content: "Weak Trend (30)", 
              display: true, 
              position: "end" as const,
              color: "#f3f4f6",
              backgroundColor: "rgba(30, 41, 59, 0.8)",
            } 
          },
        ],
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(30, 41, 59, 0.9)",
        titleColor: "#f3f4f6",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(75, 85, 99, 0.5)",
        borderWidth: 1,
      }
    },
    scales: { 
      y: { 
        min: 0, 
        max: 100,
        grid: {
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      },
      x: {
        grid: {
          display: false,
          color: "rgba(75, 85, 99, 0.2)"
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: "#9ca3af",
          font: {
            size: 10,
          }
        }
      }
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
    },
  };

  const eodDateFormatted = stockData?.eod?.datetime
    ? new Date(stockData.eod.datetime).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "N/A";

  const latestRsi = technicalIndicators?.rsi?.[0] || null;
  const rsiValue = latestRsi ? parseFloat(latestRsi.rsi) : null;
  let rsiInterpretation = "N/A";
  if (rsiValue !== null) {
    if (rsiValue > 70) rsiInterpretation = "Overbought";
    else if (rsiValue < 30) rsiInterpretation = "Oversold";
    else rsiInterpretation = "Neutral";
  }

  const latestMacd = technicalIndicators?.macd?.[0] || null;
  let macdInterpretation = "N/A";
  if (latestMacd) {
    const macdLine = parseFloat(latestMacd.macd);
    const signalLine = parseFloat(latestMacd.macd_signal);
    if (macdLine > signalLine) macdInterpretation = "Bullish (Buy Signal)";
    else if (macdLine < signalLine) macdInterpretation = "Bearish (Sell Signal)";
    else macdInterpretation = "Neutral";
  }

  const latestAdx = technicalIndicators?.adx?.[0] || null;
  const adxValue = latestAdx ? parseFloat(latestAdx.adx) : null;
  let adxInterpretation = "N/A";
  if (adxValue !== null) {
    if (adxValue > 25) adxInterpretation = "Strong Trend";
    else if (adxValue < 20) adxInterpretation = "Weak Trend";
    else adxInterpretation = "Neutral";
  }

  const latestAtr = technicalIndicators?.atr?.[0] || null;
  const atrValue = latestAtr ? parseFloat(latestAtr.atr) : null;
  const latestClose = stockData?.quote ? parseFloat(stockData.quote.close) : null;
  let atrInterpretation = "N/A";
  if (atrValue !== null && latestClose !== null) {
    const atrPercent = (atrValue / latestClose) * 100;
    if (atrPercent > 2) atrInterpretation = `High Volatility (${atrPercent.toFixed(2)}% of price)`;
    else if (atrPercent < 1) atrInterpretation = `Low Volatility (${atrPercent.toFixed(2)}% of price)`;
    else atrInterpretation = `Moderate Volatility (${atrPercent.toFixed(2)}% of price)`;
  }

  const latestAroon = technicalIndicators?.aroon?.[0] || null;
  let aroonInterpretation = "N/A";
  if (latestAroon) {
    const aroonUp = parseFloat(latestAroon.aroon_up);
    const aroonDown = parseFloat(latestAroon.aroon_down);
    if (aroonUp > 70 && aroonDown < 30) aroonInterpretation = "Strong Uptrend";
    else if (aroonDown > 70 && aroonUp < 30) aroonInterpretation = "Strong Downtrend";
    else if (aroonUp > aroonDown) aroonInterpretation = "Bullish Trend Developing";
    else if (aroonDown > aroonUp) aroonInterpretation = "Bearish Trend Developing";
    else aroonInterpretation = "Neutral (Consolidation)";
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">FinanceAI</span>
            </div>
            <div className="flex space-x-4">
              <Link href="/choose-market">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-accent">Other Markets</Button>
              </Link>
              <Link href="/stocks">
                <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white">Back to Stock Listings</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <section className="py-10 px-4 bg-gradient-to-b from-background to-accent/20 rounded-xl mb-8">
          <div className="max-w-full mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="flex justify-center items-center gap-4 mb-4">
                {overview?.logo ? (
                  <div className="bg-white p-2 rounded-full shadow-lg">
                    <Image src={overview.logo} alt={`${symbol} logo`} width={60} height={60} className="rounded-full" />
                  </div>
                ) : overview?.logo_base && overview?.logo_quote ? (
                  <div className="flex gap-2">
                    <div className="bg-white p-2 rounded-full shadow-lg">
                      <Image src={overview.logo_base} alt={`${symbol} base logo`} width={30} height={30} className="rounded-full" />
                    </div>
                    <div className="bg-white p-2 rounded-full shadow-lg">
                      <Image src={overview.logo_quote} alt={`${symbol} quote logo`} width={30} height={30} className="rounded-full" />
                    </div>
                  </div>
                ) : null}
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
                  {symbol} - {stockData?.quote?.name || "Unknown"}
                </h1>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Detailed analysis for {symbol} (US stocks only, powered by Twelve Data free plan).
              </p>
              {errorMessage && (
                <p className="text-red-400 mt-2">
                  {errorMessage}
                </p>
              )}
            </motion.div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6">
          {stockData?.quote && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <Card className="relative p-6 bg-card border-border rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">Stock Statistics</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-accent/10 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <div className="flex items-center mt-1">
                      <p className="text-2xl font-bold text-foreground">
                        {stockData.price?.price ? `$${parseFloat(stockData.price.price).toFixed(2)}` : "N/A"}
                      </p>
                      {stockData.quote && (
                        <span className={`ml-2 flex items-center text-sm ${getTrendInfo(stockData.quote.change).color}`}>
                          {getTrendInfo(stockData.quote.change).icon}
                          <span className="ml-1">
                            {parseFloat(stockData.quote.change || "0").toFixed(2)} ({parseFloat(stockData.quote.percent_change || "0").toFixed(2)}%)
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-accent/10 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">52-Week Range</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      ${parseFloat(stockData.quote.fifty_two_week?.low || "0").toFixed(2)} - ${parseFloat(stockData.quote.fifty_two_week?.high || "0").toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="bg-accent/10 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Volume</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {stockData.quote.volume != null ? formatNumber(parseInt(stockData.quote.volume)) : "N/A"}
                    </p>
                  </div>
                  
                  <div className="bg-accent/10 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Average Volume</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {stockData.quote.average_volume != null ? formatNumber(parseInt(stockData.quote.average_volume)) : "N/A"}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 text-muted-foreground">
                  <div>
                    <p><strong className="text-blue-500">EOD Price ({eodDateFormatted}):</strong> {stockData.eod?.close ? `$${parseFloat(stockData.eod.close).toFixed(2)}` : "N/A"}</p>
                    <p><strong className="text-blue-500">Latest Close:</strong> ${parseFloat(stockData.quote.close || "0").toFixed(2)}</p>
                    <p><strong className="text-blue-500">Latest Open:</strong> ${parseFloat(stockData.quote.open || "0").toFixed(2)}</p>
                    <p><strong className="text-blue-500">Daily High:</strong> ${parseFloat(stockData.quote.high || "0").toFixed(2)}</p>
                    <p><strong className="text-blue-500">Daily Low:</strong> ${parseFloat(stockData.quote.low || "0").toFixed(2)}</p>
                  </div>
                  <div>
                    <p><strong className="text-blue-500">Previous Close:</strong> ${parseFloat(stockData.quote.previous_close || "0").toFixed(2)}</p>
                    <p><strong className="text-blue-500">Change:</strong> {parseFloat(stockData.quote.change || "0").toFixed(2)} ({parseFloat(stockData.quote.percent_change || "0").toFixed(2)}%)</p>
                    <p><strong className="text-blue-500">Volume:</strong> {stockData.quote.volume != null ? parseInt(stockData.quote.volume).toLocaleString("en-US") : "N/A"}</p>
                    <p><strong className="text-blue-500">Average Volume:</strong> {stockData.quote.average_volume != null ? parseInt(stockData.quote.average_volume).toLocaleString("en-US") : "N/A"}</p>
                  </div>
                  <div>
                    <p><strong className="text-blue-500">52-Week Low Change:</strong> ${parseFloat(stockData.quote.fifty_two_week?.low_change || "0").toFixed(2)} ({parseFloat(stockData.quote.fifty_two_week?.low_change_percent || "0").toFixed(2)}%)</p>
                    <p><strong className="text-blue-500">52-Week High Change:</strong> ${parseFloat(stockData.quote.fifty_two_week?.high_change || "0").toFixed(2)} ({parseFloat(stockData.quote.fifty_two_week?.high_change_percent || "0").toFixed(2)}%)</p>
                    <p><strong className="text-blue-500">Exchange:</strong> {stockData.quote.exchange || "N/A"}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Reddit Social Sentiment Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative group"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <Card className="relative p-6 bg-card border-border rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Reddit Community Sentiment</h2>
              </div>
              <RedditSocialSentiment symbol={symbol} compact={false} showSearch={false} />
            </Card>
          </motion.div>

          {technicalIndicators && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <Card className="relative p-6 bg-card border-border rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">Technical Indicators Summary</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(technicalIndicators.ema?.ema20 || technicalIndicators.ema?.ema50) && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                        Moving Averages
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">20-Day EMA</p>
                          <p className="font-medium">
                            {technicalIndicators.ema.ema20 && technicalIndicators.ema.ema20[0] ? `$${parseFloat(technicalIndicators.ema.ema20[0].ema).toFixed(2)}` : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">50-Day EMA</p>
                          <p className="font-medium">
                            {technicalIndicators.ema.ema50 && technicalIndicators.ema.ema50[0] ? `$${parseFloat(technicalIndicators.ema.ema50[0].ema).toFixed(2)}` : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {technicalIndicators.rsi && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rsiInterpretation === "Overbought" ? "bg-red-100 text-red-800" : 
                            rsiInterpretation === "Oversold" ? "bg-green-100 text-green-800" : 
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {rsiInterpretation}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {technicalIndicators.macd && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                        MACD
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">MACD Line</p>
                          <p className="font-medium">
                            {latestMacd ? parseFloat(latestMacd.macd).toFixed(2) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Signal Line</p>
                          <p className="font-medium">
                            {latestMacd ? parseFloat(latestMacd.macd_signal).toFixed(2) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Interpretation</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            macdInterpretation.includes("Bullish") ? "bg-green-100 text-green-800" : 
                            macdInterpretation.includes("Bearish") ? "bg-red-100 text-red-800" : 
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {macdInterpretation}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {technicalIndicators.bbands && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                        Bollinger Bands
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Upper Band</p>
                          <p className="font-medium">
                            {technicalIndicators.bbands[0] ? `$${parseFloat(technicalIndicators.bbands[0].upper_band).toFixed(2)}` : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Middle Band</p>
                          <p className="font-medium">
                            {technicalIndicators.bbands[0] ? `$${parseFloat(technicalIndicators.bbands[0].middle_band).toFixed(2)}` : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Lower Band</p>
                          <p className="font-medium">
                            {technicalIndicators.bbands[0] ? `$${parseFloat(technicalIndicators.bbands[0].lower_band).toFixed(2)}` : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {technicalIndicators.adx && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                        Average Directional Index (ADX)
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">14-Day ADX</p>
                          <p className="font-medium">
                            {latestAdx ? parseFloat(latestAdx.adx).toFixed(2) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Interpretation</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            adxInterpretation === "Strong Trend" ? "bg-green-100 text-green-800" : 
                            adxInterpretation === "Weak Trend" ? "bg-red-100 text-red-800" : 
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {adxInterpretation}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {technicalIndicators.atr && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                        Average True Range (ATR)
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">14-Day ATR</p>
                          <p className="font-medium">
                            {latestAtr ? parseFloat(latestAtr.atr).toFixed(2) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Interpretation</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            atrInterpretation.includes("High") ? "bg-red-100 text-red-800" : 
                            atrInterpretation.includes("Low") ? "bg-green-100 text-green-800" : 
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {atrInterpretation}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {technicalIndicators.aroon && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <h3 className="text-lg font-medium mb-3 text-foreground flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                        Aroon Indicator
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Aroon Up</p>
                          <p className="font-medium">
                            {latestAroon ? parseFloat(latestAroon.aroon_up).toFixed(2) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Aroon Down</p>
                          <p className="font-medium">
                            {latestAroon ? parseFloat(latestAroon.aroon_down).toFixed(2) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Interpretation</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            aroonInterpretation.includes("Uptrend") ? "bg-green-100 text-green-800" : 
                            aroonInterpretation.includes("Downtrend") ? "bg-red-100 text-red-800" : 
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {aroonInterpretation}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {stockData?.timeSeries && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <Card className="relative p-6 bg-card border-border rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">Price History & Technical Indicators</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                  <div className="h-full">
                    <h3 className="text-lg font-medium mb-4 text-foreground">Daily Closing Prices with EMA and BBANDS</h3>
                    <div className="h-80">
                      <Line options={chartOptions} data={closingPriceData} />
                    </div>
                  </div>
                  <div className="h-full">
                    <h3 className="text-lg font-medium mb-4 text-foreground">Daily Adjusted Closing Prices</h3>
                    <div className="h-80">
                      <Line options={chartOptions} data={adjustedClosingPriceData} />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {technicalIndicators && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.9 }} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <Card className="relative p-6 bg-card border-border rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">Technical Indicator Charts</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {technicalIndicators.rsi && (
                    <div className="h-96">
                      <h3 className="text-lg font-medium mb-4 text-foreground">Relative Strength Index (RSI)</h3>
                      <div className="h-80">
                        <Line options={rsiChartOptions} data={rsiChartData} />
                      </div>
                    </div>
                  )}
                  {technicalIndicators.macd && (
                    <div className="h-96">
                      <h3 className="text-lg font-medium mb-4 text-foreground">MACD</h3>
                      <div className="h-80">
                        <Chart
                          type="bar"
                          options={macdChartOptions}
                          data={macdChartData as ChartData<"bar", number[], string>}
                        />
                      </div>
                    </div>
                  )}
                  {technicalIndicators.adx && (
                    <div className="h-96">
                      <h3 className="text-lg font-medium mb-4 text-foreground">Average Directional Index (ADX)</h3>
                      <div className="h-80">
                        <Line options={adxChartOptions} data={adxChartData} />
                      </div>
                    </div>
                  )}
                  {technicalIndicators.atr && (
                    <div className="h-96">
                      <h3 className="text-lg font-medium mb-4 text-foreground">Average True Range (ATR)</h3>
                      <div className="h-80">
                        <Line options={atrChartOptions} data={atrChartData} />
                      </div>
                    </div>
                  )}
                  {technicalIndicators.aroon && (
                    <div className="h-96">
                      <h3 className="text-lg font-medium mb-4 text-foreground">Aroon Indicator</h3>
                      <div className="h-80">
                        <Line options={aroonChartOptions} data={aroonChartData} />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        <motion.div className="fixed bottom-6 right-6 z-50 group" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 1 }} whileHover={{ scale: 1.1 }}>
          <Link href="/stockadvisor">
            <Button className="p-4 rounded-full shadow-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-300">
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </Link>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-card text-foreground text-sm font-medium px-3 py-1 rounded-lg shadow-md">Your Stock Advisor</div>
        </motion.div>
      </main>
    </div>
  );
}