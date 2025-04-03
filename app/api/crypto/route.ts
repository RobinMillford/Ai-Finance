import { NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for crypto data (symbol -> data)
const cryptoCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Utility function to fetch with retry on rate limit
const fetchWithRetry = async (
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 60000 // 60 seconds
): Promise<Response> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url);
    if (response.status === 429) {
      const delay = baseDelay * attempt; // Exponential backoff: 60s, 120s, 180s
      console.log(
        `Rate limit exceeded for URL ${url}. Retrying in ${delay / 1000} seconds... (Attempt ${attempt}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to fetch data: ${response.status} - ${errorData.message || response.statusText}`
      );
    }
    return response;
  }
  throw new Error("Max retries reached due to rate limit (429)");
};

export async function GET(request: Request) {
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
  const cachedData = cryptoCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached crypto data for symbol: ${symbol}`);
    return NextResponse.json(cachedData.data);
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
    if (!apiKey) {
      console.error("TWELVE_DATA_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "API key is not configured" },
        { status: 500 }
      );
    }

    // Fetch Quote Data
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`;
    console.log(`Fetching quote data for symbol: ${symbol} from Twelve Data...`);
    const quoteResponse = await fetchWithRetry(quoteUrl);
    const quoteData = await quoteResponse.json();
    console.log(`Successfully fetched quote data for symbol: ${symbol}`);

    // Fetch Price Data
    const priceUrl = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`;
    console.log(`Fetching price data for symbol: ${symbol} from Twelve Data...`);
    const priceResponse = await fetchWithRetry(priceUrl);
    const priceData = await priceResponse.json();
    console.log(`Successfully fetched price data for symbol: ${symbol}`);

    // Fetch EOD Data
    const eodUrl = `https://api.twelvedata.com/eod?symbol=${symbol}&apikey=${apiKey}`;
    console.log(`Fetching EOD data for symbol: ${symbol} from Twelve Data...`);
    const eodResponse = await fetchWithRetry(eodUrl);
    const eodData = await eodResponse.json();
    console.log(`Successfully fetched EOD data for symbol: ${symbol}`);

    // Fetch Time Series Data
    const timeSeriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=10&apikey=${apiKey}`; // Reduced outputsize to 10
    console.log(`Fetching time series data for symbol: ${symbol} from Twelve Data...`);
    const timeSeriesResponse = await fetchWithRetry(timeSeriesUrl);
    const timeSeriesData = await timeSeriesResponse.json();
    console.log("timeSeriesData:", timeSeriesData);
    console.log(`Successfully fetched time series data for symbol: ${symbol}`);

    // Construct the response
    const response = {
      timeSeries: {
        meta: {
          symbol: timeSeriesData.meta?.symbol || symbol,
          interval: timeSeriesData.meta?.interval || "1day",
          currency_base: symbol.split("/")[0],
          currency_quote: symbol.split("/")[1],
          type: "crypto",
        },
        values: timeSeriesData.values || [],
        status: timeSeriesData.status || "ok",
      },
      quote: {
        symbol: quoteData.symbol || symbol,
        name: quoteData.name || "Unknown",
        currency_base: symbol.split("/")[0],
        currency_quote: symbol.split("/")[1],
        datetime: quoteData.datetime || new Date().toISOString().split("T")[0],
        open: quoteData.open || "0",
        high: quoteData.high || "0",
        low: quoteData.low || "0",
        close: quoteData.close || "0",
        previous_close: quoteData.previous_close || "0",
        change: quoteData.change || "0",
        percent_change: quoteData.percent_change || "0",
        volume: quoteData.volume || "0",
      },
      price: {
        price: priceData.price || "0",
      },
      eod: {
        symbol: eodData.symbol || symbol,
        currency_base: symbol.split("/")[0],
        currency_quote: symbol.split("/")[1],
        datetime: eodData.datetime || new Date().toISOString().split("T")[0],
        close: eodData.close || "0",
      },
    };

    // Cache the result
    cryptoCache.set(cacheKey, { data: response, timestamp: now });
    console.log(`Successfully fetched and cached crypto data for symbol: ${symbol}`);

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching crypto data for symbol ${symbol}:`, errorMessage);
    return NextResponse.json(
      { error: `Failed to fetch crypto data: ${errorMessage}` },
      { status: 500 }
    );
  }
}