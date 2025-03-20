"use client";

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, Newspaper } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Analysis {
  symbol: string;
  price: string;
  news: Array<{ headline: string; summary: string; }>;
  sentiment: string;
}

export default function AdvisorPage() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState(searchParams.get('symbol') || '');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (symbol) {
      analyzeStock();
    }
  }, []);

  const analyzeStock = async () => {
    if (!symbol) {
      toast({
        title: "Error",
        description: "Please enter a stock symbol",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/analyze?symbol=${symbol}`);
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze stock",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-primary hover:text-primary/80">
            ← Back to Stocks
          </Link>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Brain className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">AI Stock Advisor</h1>
          </div>

          <div className="flex gap-4 mb-8">
            <Input
              placeholder="Enter stock symbol (e.g., AAPL)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="max-w-xs"
            />
            <Button onClick={analyzeStock} disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>

          {analysis && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <h2 className="text-xl font-medium">Stock Analysis</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Symbol</p>
                  <p className="text-lg font-medium">{analysis.symbol}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Price</p>
                  <p className="text-lg font-medium">${analysis.price}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Newspaper className="h-5 w-5" />
                  <h2 className="text-xl font-medium">Recent News & Sentiment</h2>
                </div>
                <div className="bg-muted p-4 rounded-lg mb-4">
                  <p className="text-sm text-muted-foreground">Overall Sentiment</p>
                  <p className="text-lg font-medium">{analysis.sentiment}</p>
                </div>
                <div className="space-y-4">
                  {analysis.news.map((item, index) => (
                    <div key={index} className="border-b pb-4 last:border-0">
                      <h3 className="font-medium mb-2">{item.headline}</h3>
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}