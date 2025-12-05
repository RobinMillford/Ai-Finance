"use client";

import { Card } from "@/components/ui/card";
import { useState } from "react";

interface HeatmapCell {
  symbol: string;
  name: string;
  change: number;
  sector: string;
}

export function MarketHeatmap() {
  // Sample market data
  const marketData: HeatmapCell[] = [
    // Technology
    { symbol: "AAPL", name: "Apple", change: 2.5, sector: "Technology" },
    { symbol: "MSFT", name: "Microsoft", change: 1.8, sector: "Technology" },
    { symbol: "GOOGL", name: "Google", change: -0.5, sector: "Technology" },
    { symbol: "META", name: "Meta", change: 3.2, sector: "Technology" },
    { symbol: "NVDA", name: "NVIDIA", change: 5.1, sector: "Technology" },
    { symbol: "TSLA", name: "Tesla", change: -2.3, sector: "Technology" },
    
    // Finance
    { symbol: "JPM", name: "JP Morgan", change: 0.8, sector: "Finance" },
    { symbol: "BAC", name: "Bank of America", change: -1.2, sector: "Finance" },
    { symbol: "WFC", name: "Wells Fargo", change: 1.5, sector: "Finance" },
    { symbol: "GS", name: "Goldman Sachs", change: 2.1, sector: "Finance" },
    
    // Healthcare
    { symbol: "JNJ", name: "Johnson & Johnson", change: 0.3, sector: "Healthcare" },
    { symbol: "UNH", name: "UnitedHealth", change: 1.9, sector: "Healthcare" },
    { symbol: "PFE", name: "Pfizer", change: -1.8, sector: "Healthcare" },
    { symbol: "ABBV", name: "AbbVie", change: 0.7, sector: "Healthcare" },
    
    // Energy
    { symbol: "XOM", name: "Exxon Mobil", change: -0.9, sector: "Energy" },
    { symbol: "CVX", name: "Chevron", change: -1.5, sector: "Energy" },
    { symbol: "COP", name: "ConocoPhillips", change: 0.4, sector: "Energy" },
    
    // Consumer
    { symbol: "AMZN", name: "Amazon", change: 2.8, sector: "Consumer" },
    { symbol: "WMT", name: "Walmart", change: 0.6, sector: "Consumer" },
    { symbol: "HD", name: "Home Depot", change: 1.2, sector: "Consumer" },
    { symbol: "MCD", name: "McDonald's", change: -0.3, sector: "Consumer" },
  ];

  const getColor = (change: number) => {
    if (change > 3) return "bg-green-600";
    if (change > 1.5) return "bg-green-500";
    if (change > 0) return "bg-green-400";
    if (change > -1.5) return "bg-red-400";
    if (change > -3) return "bg-red-500";
    return "bg-red-600";
  };

  const getTextColor = (change: number) => {
    return Math.abs(change) > 1 ? "text-white" : "text-gray-900";
  };

  // Group by sector
  const sectors = Array.from(new Set(marketData.map(d => d.sector)));

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Market Heatmap</h3>
        <p className="text-sm text-muted-foreground">
          Color intensity shows % change (Green = Up, Red = Down)
        </p>
      </div>

      <div className="space-y-6">
        {sectors.map((sector) => {
          const sectorStocks = marketData.filter(d => d.sector === sector);
          
          return (
            <div key={sector}>
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                {sector}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {sectorStocks.map((stock) => (
                  <div
                    key={stock.symbol}
                    className={`
                      ${getColor(stock.change)}
                      ${getTextColor(stock.change)}
                      p-3 rounded-lg transition-all hover:scale-105 cursor-pointer
                      flex flex-col justify-between min-h-[80px]
                    `}
                    title={`${stock.name}: ${stock.change > 0 ? '+' : ''}${stock.change}%`}
                  >
                    <div className="font-bold text-sm">{stock.symbol}</div>
                    <div className="text-xs opacity-90 truncate">{stock.name}</div>
                    <div className="font-semibold text-sm mt-1">
                      {stock.change > 0 ? '+' : ''}{stock.change}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 rounded"></div>
          <span>Strong Gain (&gt;3%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded"></div>
          <span>Gain (0-3%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-400 rounded"></div>
          <span>Loss (0-3%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-600 rounded"></div>
          <span>Strong Loss (&gt;3%)</span>
        </div>
      </div>
    </Card>
  );
}
