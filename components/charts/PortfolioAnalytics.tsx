"use client";

import { useMemo, memo } from "react";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Holding {
  symbol: string;
  quantity: number;
  purchasePrice: number;
  currentPrice?: number;
}

interface PortfolioAnalyticsProps {
  holdings: Holding[];
  portfolioName: string;
}

export const PortfolioAnalytics = memo(function PortfolioAnalytics({ holdings, portfolioName }: PortfolioAnalyticsProps) {
  // Calculate portfolio metrics with memoization
  const { assetData, totalValue, totalCost, totalPL } = useMemo(() => {
    const calculateMetrics = () => {
      let totalValue = 0;
      let totalCost = 0;

      const assetData = holdings.map((holding) => {
        const currentPrice = holding.currentPrice || holding.purchasePrice;
        const value = currentPrice * holding.quantity;
        const cost = holding.purchasePrice * holding.quantity;
        const pl = value - cost;

        totalValue += value;
        totalCost += cost;

        return {
          symbol: holding.symbol,
          value: parseFloat(value.toFixed(2)),
          cost: parseFloat(cost.toFixed(2)),
          pl: parseFloat(pl.toFixed(2)),
          plPercent: parseFloat(((pl / cost) * 100).toFixed(2)),
        };
      });

      return { assetData, totalValue, totalCost, totalPL: totalValue - totalCost };
    };

    return calculateMetrics();
  }, [holdings]);

  // Generate sample performance data with memoization
  const performanceData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const growth = totalCost * (1 + (i / 29) * (totalPL / totalCost));
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: parseFloat(growth.toFixed(2)),
      };
    });
  }, [totalCost, totalPL]);

  // Prepare pie chart data with memoization
  const pieData = useMemo(() => {
    return assetData.map((asset) => ({
      name: asset.symbol,
      value: asset.value,
    }));
  }, [assetData]);

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Value</p>
          <p className="text-3xl font-bold text-green-500">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="text-3xl font-bold">
            ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total P&L</p>
          <p className={`text-3xl font-bold ${totalPL >= 0 ? "text-green-500" : "text-red-500"}`}>
            ${Math.abs(totalPL).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            <span className="text-sm ml-2">
              ({((totalPL / totalCost) * 100).toFixed(2)}%)
            </span>
          </p>
        </Card>
      </div>

      {/* Portfolio Value Over Time */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Value Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={performanceData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Allocation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* P&L by Asset */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">P&L by Asset</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={assetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="symbol" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="pl" fill="#3B82F6" name="Profit/Loss ($)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
});
