import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for time series data
const timeSeriesCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Utility function to delay execution (for retry)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request, { retries = 2, delayMs = 15000 } = {}) {
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  if (!ALPHA_VANTAGE_API_KEY) {
    console.error("ALPHA_VANTAGE_API_KEY is not set in environment variables");
    return NextResponse.json(
      { error: "Server configuration error: API key missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json(
      { error: "Stock symbol is required" },
      { status: 400 }
    );
  }

  // Check cache first
  const cacheKey = symbol.toUpperCase();
  const cachedData = timeSeriesCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && cachedData.timestamp && (now - cachedData.timestamp < CACHE_DURATION)) {
    console.log(`Returning cached time series data for symbol: ${symbol}`);
    return NextResponse.json(cachedData.data);
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

  try {
    console.log(`Fetching time series data for symbol ${symbol} from Alpha Vantage...`);
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(text); // Try parsing as JSON (Alpha Vantage error)
      } catch {
        errorData = { Information: "Unknown error from Alpha Vantage" };
      }
      console.error("Alpha Vantage API error:", errorData);

      if (errorData.Information && errorData.Information.includes("rate limit") && retries > 0) {
        console.log(`Alpha Vantage rate limit exceeded for symbol ${symbol}. Retrying in ${delayMs / 1000} seconds... (${retries} retries left)`);
        await delay(delayMs);
        return GET(request, { retries: retries - 1, delayMs });
      }

      return NextResponse.json(
        { error: errorData.Information || "Failed to fetch data from Alpha Vantage" },
        { status: 500 }
      );
    }

    const data = await response.json();
    if (data["Error Message"]) {
      console.error(`Invalid stock symbol: ${symbol}`);
      return NextResponse.json(
        { error: "Invalid stock symbol" },
        { status: 400 }
      );
    }

    if (!data["Time Series (Daily)"]) {
      console.error(`No time series data found for symbol: ${symbol}`);
      return NextResponse.json(
        { error: "No time series data available for this symbol" },
        { status: 404 }
      );
    }

    // Cache the data
    timeSeriesCache.set(cacheKey, { data, timestamp: now });
    console.log(`Successfully fetched and cached time series data for symbol ${symbol}`);

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching stock data for symbol ${symbol}:`, error.message);
    if (retries > 0) {
      console.log(`Error occurred with Alpha Vantage. Retrying in ${delayMs / 1000} seconds... (${retries} retries left)`);
      await delay(delayMs);
      return GET(request, { retries: retries - 1, delayMs });
    }
    return NextResponse.json(
      { error: "Failed to fetch stock data: " + error.message },
      { status: 500 }
    );
  }
}