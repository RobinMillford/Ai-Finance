import {
  BarChart3,
  DollarSign,
  Bitcoin,
  Brain,
  MessageSquare,
  Newspaper,
  TrendingUp,
  Users,
  Zap,
  Globe,
} from "lucide-react";
import type { Feature, EnhancedFeature } from "./types";

export const HOME_FEATURES: Feature[] = [
  {
    icon: BarChart3,
    title: "Real-Time Stock Data",
    description:
      "Access live market data and comprehensive stock information from global exchanges with technical indicators.",
    link: "/stocks",
  },
  {
    icon: DollarSign,
    title: "Forex Market Analysis",
    description:
      "Analyze forex pairs with real-time data, categorized by currency groups like Major and Exotic.",
    link: "/forexs",
  },
  {
    icon: Bitcoin,
    title: "Cryptocurrency Insights",
    description:
      "Explore crypto pairs with detailed market data and exchange information.",
    link: "/cryptos",
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description:
      "Get intelligent insights and predictions powered by advanced machine learning algorithms with comprehensive technical and fundamental analysis.",
    link: "/choose-advisor",
  },
  {
    icon: MessageSquare,
    title: "Reddit Social Sentiment",
    description:
      "Analyze community discussions and sentiment from 15+ financial subreddits for informed decision making with real-time bullish/bearish tracking.",
    link: "/reddit",
  },
  {
    icon: Newspaper,
    title: "Financial News",
    description:
      "Stay updated with the latest financial news and market analysis from trusted sources with AI-powered summarization.",
    link: "/news",
  },
];

export const PROTECTED_FEATURES = ["Reddit Social Sentiment", "AI-Powered Analysis"];

export function getEnhancedFeatures(
  stockCount: number,
  forexCount: number,
  cryptoCount: number
): EnhancedFeature[] {
  const fmt = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(1) + "K" : n.toString();

  return [
    {
      icon: TrendingUp,
      title: "Multi-Market Analysis",
      description:
        "Unified platform for stocks, forex, and crypto analysis with cross-market correlation insights.",
    },
    {
      icon: Users,
      title: "Community Intelligence",
      description:
        "Harness the power of Reddit sentiment across 15+ financial communities for contrarian signals.",
    },
    {
      icon: Zap,
      title: "Real-Time Alerts",
      description:
        "Get instant notifications on market-moving events, technical breakouts, and sentiment shifts.",
    },
    {
      icon: Globe,
      title: "Global Market Coverage",
      description: `Comprehensive data on ${fmt(stockCount)}+ stocks, ${fmt(forexCount)}+ forex pairs, and ${fmt(cryptoCount)}+ cryptocurrencies.`,
    },
  ];
}
