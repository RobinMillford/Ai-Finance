"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.562 21.8 24 17.302 24 12 24 5.373 18.627 0 12 0z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

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
                <LinkedinIcon className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com/RobinMillford"
                className="text-muted-foreground hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon className="h-5 w-5" />
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
