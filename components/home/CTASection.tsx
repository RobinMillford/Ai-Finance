"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import Link from "next/link";

interface CTASectionProps {
  status: "authenticated" | "unauthenticated" | "loading";
}

export function CTASection({ status }: CTASectionProps) {
  const router = useRouter();

  const goAdvisor = () => {
    router.push(status === "authenticated" ? "/choose-advisor" : "/auth/signin");
  };

  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Transform Your Investment Strategy?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of investors who are already leveraging AI-powered
            insights and community intelligence to make smarter financial
            decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
                Explore Markets
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
