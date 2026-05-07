"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  TrendingUp,
  Users,
  Brain,
  Zap,
  ArrowRight,
} from "lucide-react";

interface SentimentSectionProps {
  status: "authenticated" | "unauthenticated" | "loading";
}

export function SentimentSection({ status }: SentimentSectionProps) {
  const router = useRouter();

  const goReddit = () => {
    router.push(status === "authenticated" ? "/reddit" : "/auth/signin");
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-background/80 to-primary/5">
      <div className="max-w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <MessageSquare className="h-4 w-4 mr-2" />
            Community Intelligence
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Reddit Social Sentiment Analysis
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Harness the power of community discussions to gauge market sentiment
            across stocks, forex, and crypto.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Feature list */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Card className="p-8 bg-card/80 backdrop-blur-sm border border-primary/10 shadow-xl h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold">Community-Driven Insights</h3>
              </div>

              <div className="space-y-6">
                {[
                  {
                    icon: TrendingUp,
                    color: "bg-green-100 dark:bg-green-900/20",
                    iconColor: "text-green-600",
                    title: "Real-Time Sentiment Tracking",
                    desc: "Monitor bullish and bearish sentiment across 15+ financial subreddits including r/investing, r/stocks, and r/cryptocurrency.",
                  },
                  {
                    icon: Users,
                    color: "bg-blue-100 dark:bg-blue-900/20",
                    iconColor: "text-blue-600",
                    title: "Multi-Market Coverage",
                    desc: "Analyze sentiment for stocks (AAPL, TSLA), crypto (BTC, ETH), and forex pairs (EUR/USD, GBP/USD) with specialized algorithms.",
                  },
                  {
                    icon: Brain,
                    color: "bg-purple-100 dark:bg-purple-900/20",
                    iconColor: "text-purple-600",
                    title: "AI-Powered Analysis",
                    desc: "Advanced NLP identifies financial keywords and context to provide accurate sentiment classification.",
                  },
                  {
                    icon: Zap,
                    color: "bg-orange-100 dark:bg-orange-900/20",
                    iconColor: "text-orange-600",
                    title: "Actionable Signals",
                    desc: "Receive alerts when community sentiment reaches extreme levels that historically precede price movements.",
                  },
                ].map(({ icon: Icon, color, iconColor, title, desc }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-full ${color}`}>
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{title}</h4>
                      <p className="text-muted-foreground text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-border/50">
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90"
                  onClick={goReddit}
                >
                  Explore Reddit Sentiment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Mock sentiment card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-indigo-600/20 rounded-2xl blur-xl" />
            <Card className="relative p-6 bg-card/80 backdrop-blur-sm border border-primary/10 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">AAPL Community Sentiment</h3>
                <Badge
                  variant="outline"
                  className="text-green-600 bg-green-100 dark:bg-green-900/20 border-0"
                >
                  Bullish
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { pct: "65%", label: "Bullish", bg: "bg-green-50 dark:bg-green-900/20", color: "text-green-600" },
                  { pct: "20%", label: "Bearish", bg: "bg-red-50 dark:bg-red-900/20", color: "text-red-600" },
                  { pct: "15%", label: "Neutral", bg: "bg-gray-50 dark:bg-gray-800", color: "text-gray-600" },
                ].map(({ pct, label, bg, color }) => (
                  <div key={label} className={`text-center p-4 rounded-lg ${bg}`}>
                    <div className={`text-2xl font-bold ${color}`}>{pct}</div>
                    <div className="text-sm text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {[
                  {
                    sub: "r/stocks • Bullish",
                    ago: "2h ago",
                    text: "AAPL breaking new highs! Apple's latest earnings beat expectations by 15%",
                    tags: ["+earnings", "+beats"],
                    tagColor: "text-green-600 bg-green-50 dark:bg-green-900/20",
                  },
                  {
                    sub: "r/investing • Bearish",
                    ago: "5h ago",
                    text: "Concerns about iPhone sales growth in China market weighing on AAPL",
                    tags: ["-sales", "-china"],
                    tagColor: "text-red-600 bg-red-50 dark:bg-red-900/20",
                  },
                  {
                    sub: "r/SecurityAnalysis • Neutral",
                    ago: "1d ago",
                    text: "AAPL's balance sheet remains strong with $150B in cash reserves",
                    tags: ["+balance sheet", "+cash"],
                    tagColor: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
                    bg: "bg-blue-50/50 dark:bg-blue-900/10",
                  },
                ].map(({ sub, ago, text, tags, tagColor, bg }) => (
                  <div
                    key={sub}
                    className={`p-4 rounded-lg border border-border/50 ${bg ?? ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{sub}</span>
                      <span className="text-xs text-muted-foreground">{ago}</span>
                    </div>
                    <p className="text-sm font-medium mb-2 line-clamp-1">{text}</p>
                    <div className="flex gap-1">
                      {tags.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className={`text-xs ${tagColor}`}
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border/50 text-center">
                <p className="text-sm text-muted-foreground">
                  Based on 42 recent posts • High confidence
                </p>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Accuracy stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <Card className="p-8 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border border-blue-500/20">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">
                How Community Sentiment Drives Investment Decisions
              </h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Our AI analyzes thousands of Reddit posts daily to identify
                sentiment trends that often precede market movements by hours or
                days.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { val: "87%", label: "Accuracy in sentiment classification", color: "text-blue-600" },
                  { val: "2.3x", label: "Faster signal detection vs traditional news", color: "text-green-600" },
                  { val: "15+", label: "Financial subreddits monitored", color: "text-purple-600" },
                ].map(({ val, label, color }) => (
                  <div key={val} className="p-4 rounded-lg bg-white/50 dark:bg-black/20">
                    <div className={`text-3xl font-bold ${color} mb-2`}>{val}</div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
