"use client";

import { useMemo, memo } from "react";
import { Card } from "@/components/ui/card";
import {
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

interface ValuationHolding {
  symbol: string;
  costBasis: number;
  marketValue: number | null;
  unrealizedPL: number | null;
  unrealizedPLPercent: number | null;
}

export interface PortfolioHistoryPoint {
  date: string;
  value: number;
}

interface PortfolioAnalyticsProps {
  portfolioName: string;
  /** Real valuation from /api/portfolio/[id]/valuation. */
  holdings: ValuationHolding[];
  /** Real historical value from persisted candles (optional). */
  history?: PortfolioHistoryPoint[];
  /** True when the history covers only part of the holdings. */
  historyPartial?: boolean;
}

/**
 * Portfolio analytics over REAL data only:
 *  - allocation / P&L from live-quote valuation (§21–§24);
 *  - the value-over-time chart is built from persisted candles via
 *    portfolioHistory — no interpolated or invented series. When history is
 *    unavailable the chart area says so explicitly.
 */
export const PortfolioAnalytics = memo(function PortfolioAnalytics({
  portfolioName,
  holdings,
  history,
  historyPartial,
}: PortfolioAnalyticsProps) {
  const valued = useMemo(
    () =>
      holdings.map((h) => ({
        ...h,
        // Valued at market when known; fall back to cost for allocation view
        // (labeled below) so the pie never silently misstates weights.
        displayValue: h.marketValue ?? h.costBasis,
      })),
    [holdings]
  );

  const totalValue = useMemo(
    () => valued.reduce((s, h) => s + (h.marketValue ?? 0), 0),
    [valued]
  );
  const totalCost = useMemo(() => valued.reduce((s, h) => s + h.costBasis, 0), [valued]);
  const totalPL = useMemo(
    () => valued.reduce((s, h) => s + (h.unrealizedPL ?? 0), 0),
    [valued]
  );
  const allValued = valued.every((h) => h.marketValue !== null);

  const pieData = useMemo(
    () => valued.map((h) => ({ name: h.symbol, value: h.displayValue })),
    [valued]
  );

  const plData = useMemo(
    () =>
      valued.map((h) => ({
        symbol: h.symbol,
        pl: h.unrealizedPL === null ? 0 : parseFloat(h.unrealizedPL.toFixed(2)),
        unavailable: h.unrealizedPL === null,
      })),
    [valued]
  );

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Value</p>
          <p className="text-3xl font-bold text-green-500">
            {allValued
              ? `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "—"}
          </p>
          {!allValued && (
            <p className="text-xs text-muted-foreground mt-1">
              Some quotes unavailable
            </p>
          )}
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="text-3xl font-bold">
            ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total P&L</p>
          <p
            className={`text-3xl font-bold ${
              !allValued ? "" : totalPL >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {!allValued
              ? "—"
              : `${totalPL >= 0 ? "+" : "−"}$${Math.abs(totalPL).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}`}
            {allValued && totalCost > 0 && (
              <span className="text-sm ml-2">
                ({((totalPL / totalCost) * 100).toFixed(2)}%)
              </span>
            )}
          </p>
        </Card>
      </div>

      {/* Portfolio Value Over Time — REAL persisted-candle history */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{portfolioName} Value Over Time</h3>
        {history && history.length > 1 ? (
          <>
            {historyPartial && (
              <p className="text-xs text-muted-foreground mb-2">
                Note: history covers only holdings with available price data.
              </p>
            )}
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis
                  stroke="#9CA3AF"
                  tickFormatter={(v: number) =>
                    `$${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                  formatter={(value: unknown) => [
                    `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    "Portfolio value",
                  ]}
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
          </>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            Historical value is not available yet — price history is collected
            as you use the app and stored per symbol.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Asset Allocation</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Holdings without a live quote are shown at cost.
          </p>
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
            <BarChart data={plData}>
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
              <Bar dataKey="pl" fill="#3B82F6" name="Unrealized P&L ($)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
});
