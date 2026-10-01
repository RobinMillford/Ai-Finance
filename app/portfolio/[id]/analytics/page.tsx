"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

// Lazy load heavy chart components
const PortfolioAnalytics = dynamic(
  () => import("@/components/charts/PortfolioAnalytics").then(mod => ({ default: mod.PortfolioAnalytics })),
  { loading: () => <ChartSkeleton height={600} />, ssr: false }
);

const CorrelationMatrix = dynamic(
  () => import("@/components/charts/CorrelationMatrix").then(mod => ({ default: mod.CorrelationMatrix })),
  { loading: () => <ChartSkeleton height={400} />, ssr: false }
);

const MarketHeatmap = dynamic(
  () => import("@/components/charts/MarketHeatmap").then(mod => ({ default: mod.MarketHeatmap })),
  { loading: () => <ChartSkeleton height={500} />, ssr: false }
);

interface Holding {
  symbol: string;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string;
}

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  holdings: Holding[];
}

interface Valuation {
  holdings: {
    symbol: string;
    costBasis: number;
    marketValue: number | null;
    unrealizedPL: number | null;
    unrealizedPLPercent: number | null;
  }[];
  history?: { date: string; value: number }[];
  historyPartial?: boolean;
}

export default function PortfolioAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && params.id) {
      fetchPortfolio();
      fetchValuation();
    }
  }, [status, params.id, router]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`/api/portfolio/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      } else {
        router.push("/portfolio");
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchValuation = async () => {
    try {
      // history=1 → real historical value from persisted candles.
      const res = await fetch(`/api/portfolio/${params.id}/valuation?history=1&days=180`);
      if (res.ok) {
        setValuation(await res.json());
      }
    } catch (error) {
      console.error("Error fetching valuation:", error);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!portfolio) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold">{portfolio.name} Analytics</h1>
            {portfolio.description && (
              <p className="text-muted-foreground mt-2">{portfolio.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/portfolio/${params.id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Portfolio
          </Button>
        </motion.div>

        {/* Analytics Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {portfolio.holdings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No holdings in this portfolio yet. Add some holdings to see analytics.
              </p>
              <Button onClick={() => router.push(`/portfolio/${params.id}`)}>
                Go to Portfolio
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <PortfolioAnalytics
                portfolioName={portfolio.name}
                holdings={
                  valuation?.holdings ??
                  portfolio.holdings.map((h) => ({
                    symbol: h.symbol,
                    costBasis: h.quantity * h.purchasePrice,
                    marketValue: null,
                    unrealizedPL: null,
                    unrealizedPLPercent: null,
                  }))
                }
                history={valuation?.history}
                historyPartial={valuation?.historyPartial}
              />

              {/* Correlation Matrix */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <CorrelationMatrix
                  assets={portfolio.holdings.map(h => h.symbol)}
                />
              </motion.div>

              {/* Market Heatmap */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <MarketHeatmap />
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
