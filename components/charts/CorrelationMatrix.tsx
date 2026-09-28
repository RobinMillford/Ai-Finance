"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";

interface CorrelationEntry {
  a: string;
  b: string;
  correlation: number | null;
  observations: number;
}

interface CorrelationsResponse {
  symbols: string[];
  correlations: CorrelationEntry[];
  seriesMissing: string[];
}

interface CorrelationMatrixProps {
  assets: string[];
}

/**
 * Asset correlation matrix backed by REAL data: /api/analytics/correlations
 * computes pairwise correlations from persisted daily candles via the
 * deterministic analytics engine. Pairs with insufficient overlapping history
 * show "—" (genuinely unavailable) instead of an invented number.
 */
export function CorrelationMatrix({ assets }: CorrelationMatrixProps) {
  const [entries, setEntries] = useState<CorrelationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const uniqueAssets = useMemo(() => [...new Set(assets)], [assets]);

  useEffect(() => {
    if (uniqueAssets.length < 2) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetch(`/api/analytics/correlations?symbols=${uniqueAssets.join(",")}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: CorrelationsResponse) => {
        if (!cancelled) setEntries(data.correlations);
      })
      .catch((error) => {
        console.error("Error fetching correlations:", error);
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uniqueAssets]);

  // Lookup map: "A|B" → correlation (null = unavailable).
  const byPair = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const e of entries) {
      m.set(`${e.a}|${e.b}`, e.correlation);
      m.set(`${e.b}|${e.a}`, e.correlation);
    }
    return m;
  }, [entries]);

  const getColor = (correlation: number) => {
    if (correlation > 0.7) return "bg-green-600 text-white";
    if (correlation > 0.4) return "bg-green-500 text-white";
    if (correlation > 0) return "bg-green-400 text-gray-900";
    if (correlation > -0.4) return "bg-red-400 text-gray-900";
    if (correlation > -0.7) return "bg-red-500 text-white";
    return "bg-red-600 text-white";
  };

  if (uniqueAssets.length === 0) {
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
          Computed from daily price history (1 = perfect positive, -1 = perfect negative)
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">
          Computing correlations from stored price history…
        </p>
      ) : failed ? (
        <p className="text-destructive text-center py-8">
          Correlation data is unavailable right now.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-semibold"></th>
                {uniqueAssets.map((asset) => (
                  <th key={asset} className="p-2 text-center text-sm font-semibold">
                    {asset}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueAssets.map((rowAsset, i) => (
                <tr key={rowAsset}>
                  <td className="p-2 text-sm font-semibold">{rowAsset}</td>
                  {uniqueAssets.map((colAsset, j) => {
                    if (i === j) {
                      return (
                        <td key={colAsset} className="p-0">
                          <div className="bg-muted p-2 text-center text-sm font-medium">1.00</div>
                        </td>
                      );
                    }
                    const r = byPair.get(`${rowAsset}|${colAsset}`);
                    return (
                      <td key={colAsset} className="p-0">
                        <div
                          className={`p-2 text-center text-sm font-medium transition-all hover:scale-105 ${
                            r === null || r === undefined
                              ? "bg-muted text-muted-foreground"
                              : getColor(r)
                          }`}
                          title={
                            r === null || r === undefined
                              ? `${rowAsset} vs ${colAsset}: insufficient overlapping history`
                              : `${rowAsset} vs ${colAsset}: ${r.toFixed(3)}`
                          }
                        >
                          {r === null || r === undefined ? "—" : r.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
        <p className="text-muted-foreground">
          “—” means insufficient overlapping price history to compute a reliable
          correlation (requires at least 20 shared observations).
        </p>
      </div>
    </Card>
  );
}
