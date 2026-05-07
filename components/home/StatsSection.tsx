"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { LineChart, Globe, Bitcoin } from "lucide-react";
import { ElementType } from "react";

interface StatCardProps {
  value: string;
  label: string;
  icon: ElementType;
}

const StatCard = memo(function StatCard({ value, label, icon: Icon }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="glass p-6 rounded-xl border border-primary/10 shadow-md"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          {value}+
        </span>
      </div>
      <p className="text-muted-foreground">{label}</p>
    </motion.div>
  );
});

interface StatsSectionProps {
  stockCount: number;
  forexCount: number;
  cryptoCount: number;
}

function fmt(n: number): string {
  if (n === undefined || n === null) return "0";
  return n >= 1000 ? (n / 1000).toFixed(1) + "K" : n.toString();
}

export function StatsSection({ stockCount, forexCount, cryptoCount }: StatsSectionProps) {
  return (
    <section className="py-12 px-4">
      <div className="max-w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6"
        >
          <StatCard value={fmt(stockCount)} label="Listed Stocks" icon={LineChart} />
          <StatCard value={fmt(forexCount)} label="Forex Pairs" icon={Globe} />
          <StatCard value={fmt(cryptoCount)} label="Crypto Pairs" icon={Bitcoin} />
        </motion.div>
      </div>
    </section>
  );
}
