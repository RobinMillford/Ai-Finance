"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Linkedin, Github } from "lucide-react";

interface PageFooterProps {
  status: "authenticated" | "unauthenticated" | "loading";
}

export function PageFooter({ status }: PageFooterProps) {
  const router = useRouter();

  const goProtected = (path: string) => {
    router.push(status === "authenticated" ? path : "/auth/signin");
  };

  return (
    <footer className="border-t border-border/20 bg-background/50 backdrop-blur-md py-12 px-4">
      <div className="max-w-full mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-full blur opacity-30" />
                <BarChart3 className="h-8 w-8 text-primary relative z-10" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                FinanceAI
              </span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              AI-powered financial analysis platform providing real-time data,
              community sentiment, and expert insights for smarter investment
              decisions.
            </p>
            <div className="flex space-x-4">
              <Link
                href="https://www.linkedin.com/in/yamin-hossain-38a3b3263"
                className="text-muted-foreground hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com/RobinMillford"
                className="text-muted-foreground hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="font-semibold mb-4">Products</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/stocks" className="text-muted-foreground hover:text-primary">
                  Stock Analysis
                </Link>
              </li>
              <li>
                <Link href="/forexs" className="text-muted-foreground hover:text-primary">
                  Forex Analysis
                </Link>
              </li>
              <li>
                <Link href="/cryptos" className="text-muted-foreground hover:text-primary">
                  Crypto Analysis
                </Link>
              </li>
              <li>
                <button
                  onClick={() => goProtected("/reddit")}
                  className="text-muted-foreground hover:text-primary text-left"
                >
                  Reddit Sentiment
                </button>
              </li>
              <li>
                <button
                  onClick={() => goProtected("/choose-advisor")}
                  className="text-muted-foreground hover:text-primary text-left"
                >
                  AI Advisors
                </button>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/20 mt-8 pt-8 text-center text-muted-foreground">
          <p>
            © 2025 FinanceAI. All rights reserved. Market data provided for
            informational purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}
