"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthStatus } from "@/components/AuthStatus";

interface PageHeaderProps {
  status: "authenticated" | "unauthenticated" | "loading";
}

export function PageHeader({ status }: PageHeaderProps) {
  const router = useRouter();

  const goProtected = (path: string) => {
    router.push(status === "authenticated" ? path : "/auth/signin");
  };

  return (
    <header className="relative z-10 border-b border-border/20 bg-background/50 backdrop-blur-md">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-full blur opacity-30" />
              <BarChart3 className="h-8 w-8 text-primary relative z-10" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              FinanceAI
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/choose-market"
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Markets
            </Link>
            <Link
              href="/news"
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              News
            </Link>
            <button
              onClick={() => goProtected("/reddit")}
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Sentiment
            </button>
            <button
              onClick={() => goProtected("/choose-advisor")}
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              AI Advisors
            </button>
            <Link
              href="/about"
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Contact
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <AuthStatus />
            <Link href="/choose-market">
              <Button className="bg-primary hover:bg-primary/90 relative group hidden sm:flex">
                <span className="relative z-10">Get Started</span>
                <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </Link>
            <Button
              variant="outline"
              className="border-primary/20 hover:bg-primary/10 sm:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
