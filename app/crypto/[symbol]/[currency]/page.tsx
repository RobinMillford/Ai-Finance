"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CryptoSymbolCurrencyRedirect() {
  const params = useParams();
  const router = useRouter();
  const symbol = params?.symbol as string;
  const currency = params?.currency as string;

  useEffect(() => {
    if (symbol && currency) {
      // Combine symbol and currency into the format expected by the main crypto page
      // e.g., /crypto/888/USD -> /crypto/888%2FUSD
      const combinedSymbol = `${symbol}/${currency}`;
      const encodedSymbol = encodeURIComponent(combinedSymbol);
      router.replace(`/crypto/${encodedSymbol}`);
    }
  }, [symbol, currency, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
