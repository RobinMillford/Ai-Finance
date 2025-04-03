import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for forex data (symbol -> forex data)
const forexCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol parameter is required" },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = symbol.toUpperCase();
  const cachedData = forexCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached forex data for symbol: ${symbol}`);
    return NextResponse.json(cachedData.data);
  }

  try {
    // Fetch time series data
    const timeSeriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=5000&apikey=${TWELVE_DATA_API_KEY}`;
    console.log(`Fetching time series data for symbol: ${symbol} from Twelve Data...`);
    const timeSeriesResponse = await fetch(timeSeriesUrl);
    if (!timeSeriesResponse.ok) {
      const errorData = await timeSeriesResponse.json();
      console.error(`Twelve Data API error for time series (${symbol}):`, errorData);
      return NextResponse.json(
        { error: errorData.message || "Failed to fetch time series data from Twelve Data" },
        { status: 500 }
      );
    }
    const timeSeriesData = await timeSeriesResponse.json();

    if (!timeSeriesData.values || timeSeriesData.status !== "ok") {
      console.error(`No time series data found for symbol: ${symbol}`);
      return NextResponse.json(
        { error: "No time series data found for symbol: " + symbol },
        { status: 404 }
      );
    }

    // Fetch quote data
    let quoteData = null;
    try {
      const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching quote data for symbol: ${symbol} from Twelve Data...`);
      const quoteResponse = await fetch(quoteUrl);
      if (!quoteResponse.ok) {
        const errorData = await quoteResponse.json();
        console.error(`Twelve Data API error for quote (${symbol}):`, errorData);
        throw new Error("Failed to fetch quote data");
      }
      quoteData = await quoteResponse.json();
      console.log(`Successfully fetched quote data for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching quote data for symbol ${symbol}:`, errorMessage);
      // Continue with null quote data
    }

    // Fetch current price data
    let priceData = null;
    try {
      const priceUrl = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching current price data for symbol: ${symbol} from Twelve Data...`);
      const priceResponse = await fetch(priceUrl);
      if (!priceResponse.ok) {
        const errorData = await priceResponse.json();
        console.error(`Twelve Data API error for price (${symbol}):`, errorData);
        throw new Error("Failed to fetch price data");
      }
      priceData = await priceResponse.json();
      console.log(`Successfully fetched current price data for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching current price data for symbol ${symbol}:`, errorMessage);
      // Continue with null price data
    }

    // Fetch EOD data
    let eodData = null;
    try {
      const eodUrl = `https://api.twelvedata.com/eod?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching EOD data for symbol: ${symbol} from Twelve Data...`);
      const eodResponse = await fetch(eodUrl);
      if (!eodResponse.ok) {
        const errorData = await eodResponse.json();
        console.error(`Twelve Data API error for EOD (${symbol}):`, errorData);
        throw new Error("Failed to fetch EOD data");
      }
      eodData = await eodResponse.json();
      console.log(`Successfully fetched EOD data for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching EOD data for symbol ${symbol}:`, errorMessage);
      // Continue with null EOD data
    }

    // Combine all data
    const forexData = {
      timeSeries: timeSeriesData,
      quote: quoteData,
      price: priceData,
      eod: eodData,
    };

    // Cache the result
    forexCache.set(cacheKey, { data: forexData, timestamp: now });
    console.log(`Successfully fetched and cached forex data for symbol: ${symbol}`);

    return NextResponse.json(forexData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching forex data for symbol ${symbol}:`, errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch forex data: " + errorMessage },
      { status: 500 }
    );
  }
}