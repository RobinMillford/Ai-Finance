"use client";

import { Card } from "@/components/ui/card";
import { useMemo } from "react";

interface CorrelationMatrixProps {
  assets: string[];
}

export function CorrelationMatrix({ assets }: CorrelationMatrixProps) {
  // Calculate correlation matrix (simplified - in real app, use actual price data)
  const correlationData = useMemo(() => {
    const matrix: number[][] = [];
    
    for (let i = 0; i < assets.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < assets.length; j++) {
        if (i === j) {
          matrix[i][j] = 1; // Perfect correlation with itself
        } else {
          // Generate random correlation between -1 and 1
          // In real app, calculate from actual price data
          matrix[i][j] = parseFloat((Math.random() * 2 - 1).toFixed(2));
        }
      }
    }
    
    return matrix;
  }, [assets]);

  const getColor = (correlation: number) => {
    const absCorr = Math.abs(correlation);
    
    if (correlation > 0.7) return "bg-green-600 text-white";
    if (correlation > 0.4) return "bg-green-500 text-white";
    if (correlation > 0) return "bg-green-400 text-gray-900";
    if (correlation > -0.4) return "bg-red-400 text-gray-900";
    if (correlation > -0.7) return "bg-red-500 text-white";
    return "bg-red-600 text-white";
  };

  if (assets.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Asset Correlation Matrix</h3>
        <p className="text-muted-foreground text-center py-8">
          Add holdings to your portfolio to see correlation analysis
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Asset Correlation Matrix</h3>
        <p className="text-sm text-muted-foreground">
          Shows how assets move together (1 = perfect positive, -1 = perfect negative)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-sm font-semibold"></th>
              {assets.map((asset) => (
                <th key={asset} className="p-2 text-center text-sm font-semibold">
                  {asset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((rowAsset, i) => (
              <tr key={rowAsset}>
                <td className="p-2 text-sm font-semibold">{rowAsset}</td>
                {assets.map((colAsset, j) => (
                  <td key={colAsset} className="p-0">
                    <div
                      className={`
                        ${getColor(correlationData[i][j])}
                        p-2 text-center text-sm font-medium
                        transition-all hover:scale-110 cursor-pointer
                      `}
                      title={`${rowAsset} vs ${colAsset}: ${correlationData[i][j]}`}
                    >
                      {correlationData[i][j].toFixed(2)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 rounded"></div>
          <span>Strong Positive (&gt;0.7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded"></div>
          <span>Positive (0-0.7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-400 rounded"></div>
          <span>Negative (0 to -0.7)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-600 rounded"></div>
          <span>Strong Negative (&lt;-0.7)</span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
        <p className="font-semibold mb-1">💡 Diversification Tip:</p>
        <p className="text-muted-foreground">
          Assets with low or negative correlation help reduce portfolio risk. 
          Aim for a mix of assets that don't all move in the same direction.
        </p>
      </div>
    </Card>
  );
}
