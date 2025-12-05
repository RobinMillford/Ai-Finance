"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";

interface PriceChartProps {
  symbol: string;
  data?: any[];
}

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export function PriceChart({ symbol, data }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");

  // Generate sample OHLC data
  const generateSampleData = () => {
    const data = [];
    const basePrice = 150;
    let currentPrice = basePrice;
    const now = new Date();

    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const change = (Math.random() - 0.5) * 5;
      currentPrice += change;

      const open = currentPrice;
      const close = currentPrice + (Math.random() - 0.5) * 3;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;

      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.floor(Math.random() * 1000000) + 500000,
      });
    }

    return data;
  };

  const chartData = data || generateSampleData();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.date}</p>
          <div className="space-y-1 text-sm">
            <p>Open: <span className="font-medium">${data.open}</span></p>
            <p>High: <span className="font-medium text-green-500">${data.high}</span></p>
            <p>Low: <span className="font-medium text-red-500">${data.low}</span></p>
            <p>Close: <span className="font-medium">${data.close}</span></p>
            <p>Volume: <span className="font-medium">{(data.volume / 1000000).toFixed(2)}M</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{symbol} Price Chart</h3>
        <div className="flex gap-1">
          {(["1D", "1W", "1M", "3M", "1Y", "ALL"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          
          {/* High-Low bars */}
          <Bar
            dataKey={(data: any) => [data.low, data.high]}
            fill="#3B82F6"
            opacity={0.3}
            barSize={2}
          />
          
          {/* Close price line */}
          <Line
            type="monotone"
            dataKey="close"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-muted-foreground">
        <p>Interactive price chart with high/low range and closing price</p>
      </div>
    </Card>
  );
}
