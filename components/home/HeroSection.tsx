"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import type { Feature } from "./types";

interface HeroSectionProps {
  features: Feature[];
  activeFeature: number;
  setActiveFeature: (index: number) => void;
  status: "authenticated" | "unauthenticated" | "loading";
}

export function HeroSection({
  features,
  activeFeature,
  setActiveFeature,
  status,
}: HeroSectionProps) {
  const router = useRouter();

  const goAdvisor = () => {
    router.push(status === "authenticated" ? "/choose-advisor" : "/auth/signin");
  };

  const ActiveIcon = features[activeFeature].icon;

  return (
    <section className="py-20 px-4">
      <div className="max-w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-left"
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4 mr-2" />
              AI-Powered Financial Analysis
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                Smart
              </span>{" "}
              Market Analysis with AI
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl">
              Make informed decisions with real-time data on stocks, forex, and
              crypto, AI-powered insights,{" "}
              <span className="font-semibold text-primary">
                community sentiment analysis
              </span>
              , and comprehensive financial news.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 relative group"
                onClick={goAdvisor}
              >
                <span className="relative z-10 flex items-center">
                  Try AI Advisors
                  <Zap className="ml-2 h-4 w-4" />
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
              <Link href="/choose-market">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-primary/20 hover:bg-primary/10"
                >
                  View Markets
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Real-time Data</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>AI Insights</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Reddit Sentiment</span>
              </div>
            </div>
          </motion.div>

          {/* Right: rotating feature card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur-xl" />
            <div className="relative bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-primary/10 shadow-xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <div className="flex justify-center mb-6">
                    <div className="p-4 rounded-full bg-primary/10">
                      <ActiveIcon className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                    {features[activeFeature].title}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {features[activeFeature].description}
                  </p>
                  <Link href={features[activeFeature].link}>
                    <Button
                      variant="outline"
                      className="border-primary/20 hover:bg-primary/10"
                    >
                      Learn More
                    </Button>
                  </Link>
                </motion.div>
              </AnimatePresence>

              <div className="flex justify-center mt-6 space-x-2">
                {features.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveFeature(index)}
                    className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                      index === activeFeature ? "bg-primary" : "bg-primary/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
