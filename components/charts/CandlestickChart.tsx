"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, CandlestickData, Time } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CandlestickChartProps {
  symbol: string;
  data?: CandlestickData<Time>[];
  height?: number;
}

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export function CandlestickChart({ symbol, data, height = 400 }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: "transparent" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "#1F2937" },
        horzLines: { color: "#1F2937" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      timeScale: {
        borderColor: "#374151",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series with correct v4 API
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderVisible: true,
      wickVisible: true,
      borderColor: "#22C55E",
      wickColor: "#22C55E",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Add sample data if provided
    if (data && data.length > 0) {
      candlestickSeries.setData(data);
      setLoading(false);
    } else {
      // Generate sample data for demonstration
      const sampleData = generateSampleData();
      candlestickSeries.setData(sampleData);
      setLoading(false);
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, height]);

  const generateSampleData = (): CandlestickData<Time>[] => {
    const data: CandlestickData<Time>[] = [];
    const basePrice = 150;
    let currentPrice = basePrice;
    const now = new Date();

    for (let i = 90; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const timestamp = Math.floor(date.getTime() / 1000) as Time;

      const change = (Math.random() - 0.5) * 5;
      currentPrice += change;

      const open = currentPrice;
      const close = currentPrice + (Math.random() - 0.5) * 3;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;

      data.push({
        time: timestamp,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
      });
    }

    return data;
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    // In a real implementation, fetch data for the selected time range
    // For now, just fit the content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{symbol} Price Chart</h3>
        <div className="flex gap-1">
          {(["1D", "1W", "1M", "3M", "1Y", "ALL"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => handleTimeRangeChange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div ref={chartContainerRef} className="w-full" />
      )}

      <div className="mt-4 text-xs text-muted-foreground">
        <p>Interactive chart: Scroll to zoom, drag to pan</p>
      </div>
    </Card>
  );
}
