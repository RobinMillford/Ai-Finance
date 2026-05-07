"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ChevronRight, Sparkles } from "lucide-react";
import type { Feature } from "./types";
import { PROTECTED_FEATURES } from "./constants";

interface FeatureCardProps {
  feature: Feature;
  delay: number;
  status: "authenticated" | "unauthenticated" | "loading";
}

function FeatureCard({ feature, delay, status }: FeatureCardProps) {
  const router = useRouter();
  const { icon: Icon, title, description, link } = feature;

  const handleClick = () => {
    const isProtected = PROTECTED_FEATURES.includes(title);
    if (isProtected && status !== "authenticated") {
      router.push("/auth/signin");
    } else {
      router.push(link);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5 }}
      className="relative group"
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
      <button onClick={handleClick} className="w-full text-left">
        <Card className="relative p-6 glass hover:bg-card/90 transition-all duration-300 border border-primary/10 shadow-lg">
          <div className="flex flex-col items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gradient">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
            <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform duration-300">
              Explore <ChevronRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </Card>
      </button>
    </motion.div>
  );
}

interface FeaturesSectionProps {
  features: Feature[];
  status: "authenticated" | "unauthenticated" | "loading";
}

export function FeaturesSection({ features, status }: FeaturesSectionProps) {
  return (
    <section className="py-20 px-4">
      <div className="max-w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4 mr-2" />
            Powerful Features
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need for Smart Investing
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Comprehensive tools and insights combining real-time data, AI
            analysis, and community sentiment to make smart investment decisions.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              delay={index * 0.1}
              status={status}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
