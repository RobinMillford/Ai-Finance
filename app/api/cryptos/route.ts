import { NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for cryptocurrency pairs list
const cryptoCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Utility function to fetch with retry on rate limit
async function fetchWithRetry(url: string, maxRetries: number = 3, retryDelayMs: number = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          console.warn(`Rate limit hit for URL: ${url}. Retrying (${attempt}/${maxRetries}) after ${retryDelayMs}ms...`);
          if (attempt === maxRetries) {
            throw new Error("Rate limit exceeded after maximum retries");
          }
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }
        throw new Error(`API error: ${JSON.stringify(errorData)}`);
      }
      return await response.json();
    } catch (error: unknown) {
      if (attempt === maxRetries) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Fetch attempt ${attempt} failed for URL: ${url}. Retrying after ${retryDelayMs}ms...`, errorMessage);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error("Unexpected error in fetchWithRetry");
}

export async function GET(request: Request) {
  const TWELVE_DATA_API_KEY = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
  if (!TWELVE_DATA_API_KEY) {
    console.error("TWELVE_DATA_API_KEY is not set in environment variables");
    return NextResponse.json(
      { error: "Server configuration error: API key missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  // Check cache for the full list of cryptocurrencies
  const cacheKey = "crypto_list";
  const cachedData = cryptoCache.get(cacheKey);
  const now = Date.now();

  let cryptoPairs: Array<{
    symbol: string;
    available_exchanges: string[];
    currency_base: string;
    currency_quote: string;
  }> = [];

  // Fetch the list if not in cache or cache is expired
  if (!cachedData || now - cachedData.timestamp > CACHE_DURATION) {
    try {
      const url = `https://api.twelvedata.com/cryptocurrencies?apikey=${TWELVE_DATA_API_KEY}`;
      console.log("Fetching cryptocurrency pairs from Twelve Data...");
      const data = await fetchWithRetry(url);
      console.log("API response from /cryptocurrencies:", JSON.stringify(data, null, 2)); // Debug log

      // Check if the response is an object with an array of pairs
      let pairsArray: Array<{
        symbol: string;
        available_exchanges: string[];
        currency_base: string;
        currency_quote: string;
      }> = [];
      if (Array.isArray(data)) {
        pairsArray = data;
      } else if (data && typeof data === "object") {
        // Check for common property names or default array
        if (Array.isArray(data.data)) {
          pairsArray = data.data;
        } else if (Array.isArray(data.values)) {
          pairsArray = data.values;
        } else {
          // If the object has a default array as its first enumerable property
          const firstKey = Object.keys(data)[0];
          if (Array.isArray(data[firstKey]) && firstKey !== "count" && firstKey !== "status") {
            pairsArray = data[firstKey];
          } else {
            throw new Error("Could not find an array of cryptocurrency pairs in the response: " + JSON.stringify(data));
          }
        }
      } else {
        throw new Error("Expected an array or object with an array of cryptocurrency pairs, but received: " + JSON.stringify(data));
      }

      // Remove duplicates based on symbol
      const seenSymbols = new Set<string>();
      cryptoPairs = pairsArray.filter((pair) => {
        if (seenSymbols.has(pair.symbol)) {
          console.log(`Duplicate symbol found and removed: ${pair.symbol}`);
          return false;
        }
        seenSymbols.add(pair.symbol);
        return true;
      });

      // Cache the result
      cryptoCache.set(cacheKey, { data: cryptoPairs, timestamp: now });
      console.log("Successfully fetched and cached cryptocurrency pairs");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error fetching cryptocurrency pairs:", errorMessage);
      return NextResponse.json(
        { error: "Failed to fetch cryptocurrency pairs: " + errorMessage },
        { status: 500 }
      );
    }
  } else {
    console.log("Returning cached cryptocurrency pairs");
    cryptoPairs = cachedData.data;
  }

  // If a symbol is provided, validate it and return its details
  if (symbol) {
    const upperSymbol = symbol.toUpperCase();
    const pair = cryptoPairs.find((p) => p.symbol.toUpperCase() === upperSymbol);
    if (!pair) {
      return NextResponse.json(
        { error: `Cryptocurrency pair ${symbol} is not supported` },
        { status: 404 }
      );
    }

    // Fetch real-time price for the symbol
    try {
      const priceUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching real-time data for symbol: ${symbol} from Twelve Data...`);
      const priceData = await fetchWithRetry(priceUrl);

      if (priceData.status === "error") {
        throw new Error(priceData.message || "Failed to fetch real-time data");
      }

      return NextResponse.json({
        symbol: pair.symbol,
        currency_base: pair.currency_base,
        currency_quote: pair.currency_quote,
        available_exchanges: pair.available_exchanges,
        price: parseFloat(priceData.close),
        percent_change: parseFloat(priceData.percent_change),
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching real-time data for symbol ${symbol}:`, errorMessage);
      return NextResponse.json(
        { error: `Failed to fetch real-time data for ${symbol}: ${errorMessage}` },
        { status: 500 }
      );
    }
  }

  // If no symbol is provided, return the full list of cryptocurrency pairs
  return NextResponse.json(cryptoPairs);
}