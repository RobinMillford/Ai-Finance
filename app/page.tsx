"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/home/PageHeader";
import { HeroSection } from "@/components/home/HeroSection";
import { StatsSection } from "@/components/home/StatsSection";
import { SentimentSection } from "@/components/home/SentimentSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { EnhancedFeaturesSection } from "@/components/home/EnhancedFeaturesSection";
import { CTASection } from "@/components/home/CTASection";
import { PageFooter } from "@/components/home/PageFooter";
import { HOME_FEATURES } from "@/components/home/constants";

interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
}

interface ForexPair {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  base_currency?: string;
  quote_currency?: string;
}

interface CryptoPair {
  symbol: string;
  currency_base: string;
  currency_quote: string;
  available_exchanges: string[];
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [forexPairs, setForexPairs] = useState<ForexPair[]>([]);
  const [cryptoPairs, setCryptoPairs] = useState<CryptoPair[]>([]);
  const [activeFeature, setActiveFeature] = useState(0);
  const { toast } = useToast();
  const { status } = useSession();

  useEffect(() => {
    fetchStocks();
    fetchForexPairs();
    fetchCryptoPairs();

    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % HOME_FEATURES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchStocks = async () => {
    try {
      const res = await fetch("/api/stocks");
      const data = await res.json();
      setStocks(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "Failed to fetch stock listings", variant: "destructive" });
      setStocks([]);
    }
  };

  const fetchForexPairs = async () => {
    try {
      const res = await fetch("/api/forexs?page=1&perPage=1000");
      const data = await res.json();
      setForexPairs(Array.isArray(data.pairs) ? data.pairs : []);
    } catch {
      toast({ title: "Error", description: "Failed to fetch forex listings", variant: "destructive" });
      setForexPairs([]);
    }
  };

  const fetchCryptoPairs = async () => {
    try {
      const res = await fetch("/api/cryptos");
      const data = await res.json();
      setCryptoPairs(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "Failed to fetch crypto listings", variant: "destructive" });
      setCryptoPairs([]);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90" />
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-20 right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-20 left-1/3 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
        </div>
      </div>

      <PageHeader status={status} />

      <main className="relative z-10">
        <HeroSection
          features={HOME_FEATURES}
          activeFeature={activeFeature}
          setActiveFeature={setActiveFeature}
          status={status}
        />
        <StatsSection
          stockCount={stocks.length}
          forexCount={forexPairs.length}
          cryptoCount={cryptoPairs.length}
        />
        <SentimentSection status={status} />
        <FeaturesSection features={HOME_FEATURES} status={status} />
        <EnhancedFeaturesSection
          stockCount={stocks.length}
          forexCount={forexPairs.length}
          cryptoCount={cryptoPairs.length}
        />
        <CTASection status={status} />
      </main>

      <PageFooter status={status} />
    </div>
  );
}
