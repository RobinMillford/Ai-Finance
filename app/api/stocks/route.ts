import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Interface for Stock to improve type safety
interface Stock {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  country: string;
  status: string;
}

// In-memory cache for stock listings
let cachedStocks: Stock[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function GET() {
  const TWELVE_DATA_API_KEY = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
  if (!TWELVE_DATA_API_KEY) {
    console.error("TWELVE_DATA_API_KEY is not set in environment variables");
    return NextResponse.json(
      { error: "Server configuration error: API key missing" },
      { status: 500 }
    );
  }

  console.log("Fetching stock listings...");

  // Check if cache is valid
  const now = Date.now();
  if (cachedStocks && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    console.log("Returning cached stock listings...");
    return NextResponse.json(cachedStocks);
  }

  // Define the top 10 exchanges to fetch
  const exchanges = [
    "NYSE",      // New York Stock Exchange (USA)
    "NASDAQ"    // NASDAQ (USA)
  ];

  const allStocks = new Map<string, Stock>(); // Use a Map to avoid duplicates (key: symbol)

  for (const exchange of exchanges) {
    const url = `https://api.twelvedata.com/stocks?source=docs&exchange=${exchange}&apikey=${TWELVE_DATA_API_KEY}`;

    try {
      console.log(`Fetching stock listings for ${exchange} from Twelve Data...`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Twelve Data API error for ${exchange}:`, errorData);
        // Skip this exchange if it fails (e.g., might not be supported in free tier)
        continue;
      }

      const data = await response.json();
      if (data.status !== "ok") {
        console.error(`Twelve Data API error for ${exchange}:`, data);
        continue;
      }

      // Transform and add stocks to the Map
      data.data.forEach((stock: any) => {
        // Only add the stock if we haven't seen this symbol yet
        if (!allStocks.has(stock.symbol)) {
          allStocks.set(stock.symbol, {
            symbol: stock.symbol,
            name: stock.name,
            currency: stock.currency,
            exchange: stock.exchange,
            country: stock.country,
            status: stock.type,
          });
        }
      });

      console.log(`Successfully fetched ${data.data.length} stocks from ${exchange}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching stock listings for ${exchange}:`, errorMessage);
      // Continue to the next exchange if this one fails
      continue;
    }
  }

  // Convert Map values to array
  const stocks = Array.from(allStocks.values());

  if (stocks.length === 0) {
    return NextResponse.json(
      { error: "No stock listings fetched from any exchange" },
      { status: 500 }
    );
  }

  // Update cache
  cachedStocks = stocks;
  cacheTimestamp = Date.now();
  console.log("Stock listings cached successfully");

  return NextResponse.json(stocks);
}