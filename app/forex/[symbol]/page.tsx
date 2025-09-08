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
  BarController,
} from "chart.js";
import { Chart, Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import Image from "next/image";
import { BarChart3, MessageCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { marketThemes } from "@/lib/themes";

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
  annotationPlugin,
  BarController
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
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "20-Day SMA",
        data: sma20Data,
        borderColor: "#FFA500",
        backgroundColor: "rgba(255, 165, 0, 0.2)",
        fill: false,
        borderDash: [5, 5],
        pointRadius: 0,
      },
      {
        label: "50-Day SMA",
        data: sma50Data,
        borderColor: "#FF4500",
        backgroundColor: "rgba(255, 69, 0, 0.2)",
        fill: false,
        borderDash: [5, 5],
        pointRadius: 0,
      },
      {
        label: "Tenkan-sen (Ichimoku)",
        data: tenkanSenData,
        borderColor: "#FF00FF",
        backgroundColor: "rgba(255, 0, 255, 0.2)",
        fill: false,
        pointRadius: 0,
      },
      {
        label: "Kijun-sen (Ichimoku)",
        data: kijunSenData,
        borderColor: "#00FFFF",
        backgroundColor: "rgba(0, 255, 255, 0.2)",
        fill: false,
        pointRadius: 0,
      },
      {
        label: "Senkou Span A (Ichimoku)",
        data: senkouSpanAData,
        borderColor: "#00FF00",
        backgroundColor: "rgba(0, 255, 0, 0.1)",
        fill: "+1",
        pointRadius: 0,
      },
      {
        label: "Senkou Span B (Ichimoku)",
        data: senkouSpanBData,
        borderColor: "#FF0000",
        backgroundColor: "rgba(255, 0, 0, 0.1)",
        fill: "-1",
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
          color: "#6B7280",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: `${symbol} Price History`,
        color: "#6B7280",
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
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
      y: {
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          },
          callback: function(value: any) {
            return value;
          }
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
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
          color: "#6B7280",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: "Relative Strength Index (RSI)",
        color: "#6B7280",
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
            },
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
            },
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
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
      x: {
        grid: {
          display: false,
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
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
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        type: "line" as const,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "Signal Line",
        data: macdSignalData,
        borderColor: theme.secondary,
        backgroundColor: `${theme.secondary}20`,
        fill: false,
        type: "line" as const,
        borderDash: [5, 5],
        pointRadius: 0,
      },
      {
        label: "Histogram",
        data: macdHistData,
        backgroundColor: (context: any) => {
          const value = context.dataset.data[context.dataIndex];
          return value > 0 ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)";
        },
        type: "bar" as const,
      },
    ],
  };

  const macdChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#6B7280",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: "MACD",
        color: "#6B7280",
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
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
      y: {
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
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
          color: "#6B7280",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: "Average True Range (ATR)",
        color: "#6B7280",
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
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
      y: {
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
    },
  };

  // Ichimoku Cloud Chart
  const ichimokuChartData: ChartData<"line", number[], string> = {
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
      {
        label: "Tenkan-sen",
        data: tenkanSenData,
        borderColor: "#FF00FF",
        backgroundColor: "rgba(255, 0, 255, 0.2)",
        fill: false,
        pointRadius: 0,
      },
      {
        label: "Kijun-sen",
        data: kijunSenData,
        borderColor: "#00FFFF",
        backgroundColor: "rgba(0, 255, 255, 0.2)",
        fill: false,
        pointRadius: 0,
      },
      {
        label: "Senkou Span A",
        data: senkouSpanAData,
        borderColor: "#00FF00",
        backgroundColor: "rgba(0, 255, 0, 0.1)",
        fill: "+1",
        pointRadius: 0,
      },
      {
        label: "Senkou Span B",
        data: senkouSpanBData,
        borderColor: "#FF0000",
        backgroundColor: "rgba(255, 0, 0, 0.1)",
        fill: "-1",
        pointRadius: 0,
      },
      {
        label: "Chikou Span",
        data: chikouSpanData,
        borderColor: "#808080",
        backgroundColor: "rgba(128, 128, 128, 0.2)",
        fill: false,
        pointRadius: 0,
      },
    ],
  };

  const ichimokuChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#6B7280",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: "Ichimoku Cloud",
        color: "#6B7280",
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
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
      y: {
        grid: {
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
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
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "Aroon Down",
        data: aroonDownData,
        borderColor: theme.secondary,
        backgroundColor: `${theme.secondary}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };

  const aroonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#6B7280",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: "Aroon Indicator",
        color: "#6B7280",
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
            },
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
            },
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
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
      x: {
        grid: {
          display: false,
          color: "rgba(107, 114, 128, 0.1)",
        },
        ticks: {
          color: "#6B7280",
          font: {
            size: 10,
          }
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false
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
                <div className="h-96">
                  <h3 className="text-lg font-medium mb-4 text-foreground">Price History with Indicators</h3>
                  <div className="h-80">
                    <Line options={chartOptions} data={closingPriceData} />
                  </div>
                </div>
                <div className="h-96">
                  <h3 className="text-lg font-medium mb-4 text-foreground">Ichimoku Cloud</h3>
                  <div className="h-80">
                    <Line options={ichimokuChartOptions} data={ichimokuChartData} />
                  </div>
                </div>
                <div className="h-96">
                  <h3 className="text-lg font-medium mb-4 text-foreground">Relative Strength Index (RSI)</h3>
                  <div className="h-80">
                    <Line options={rsiChartOptions} data={rsiChartData} />
                  </div>
                </div>
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
                <div className="h-96">
                  <h3 className="text-lg font-medium mb-4 text-foreground">Average True Range (ATR)</h3>
                  <div className="h-80">
                    <Line options={atrChartOptions} data={atrChartData} />
                  </div>
                </div>
                <div className="h-96">
                  <h3 className="text-lg font-medium mb-4 text-foreground">Aroon Indicator</h3>
                  <div className="h-80">
                    <Line options={aroonChartOptions} data={aroonChartData} />
                  </div>
                </div>
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