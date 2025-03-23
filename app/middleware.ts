import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`Middleware triggered for pathname: ${pathname}`); // Debug log

  // Check if the URL matches /forex/[symbol] with an unencoded forward slash
  if (pathname.startsWith("/forex/")) {
    const symbol = pathname.split("/forex/")[1];
    if (symbol && symbol.includes("/") && !symbol.includes("%2F")) {
      console.log(`Rewriting unencoded symbol: ${symbol}`); // Debug log
      // Encode the symbol and rewrite the URL
      const encodedSymbol = encodeURIComponent(symbol);
      const newPathname = `/forex/${encodedSymbol}`;
      console.log(`Rewritten to: ${newPathname}`); // Debug log
      return NextResponse.rewrite(new URL(newPathname, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/forex/:path*"],
};