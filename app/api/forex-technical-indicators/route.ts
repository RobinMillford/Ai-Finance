import { NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for technical indicators data (symbol -> indicators data)
const indicatorsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Rate limit: 8 requests per minute (60 seconds / 8 = 7.5 seconds per request)
// We'll use 17 seconds to be safe
const REQUEST_DELAY_MS = 17000; // 17 seconds delay between requests

// Utility function to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility function to fetch with retry on rate limit
async function fetchWithRetry(url: string, maxRetries: number = 3, retryDelayMs: number = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          console.warn(
            `Rate limit hit for URL: ${url}. Retrying (${attempt}/${maxRetries}) after ${retryDelayMs}ms...`
          );
          if (attempt === maxRetries) {
            throw new Error("Rate limit exceeded after maximum retries");
          }
          await delay(retryDelayMs);
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
      console.warn(
        `Fetch attempt ${attempt} failed for URL: ${url}. Retrying after ${retryDelayMs}ms...`,
        errorMessage
      );
      await delay(retryDelayMs);
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

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol parameter is required" },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = symbol.toUpperCase();
  const cachedData = indicatorsCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached technical indicators for symbol: ${symbol}`);
    return NextResponse.json(cachedData.data);
  }

  try {
    // Initialize data objects
    let smaData = { sma20: null, sma50: null };
    let rsiData = null;
    let macdData = null;
    let atrData = null;
    let ichimokuData = null;
    let aroonData = null;

    // Fetch 20-day SMA
    try {
      const sma20Url = `https://api.twelvedata.com/sma?symbol=${symbol}&interval=1day&time_period=20&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 20-day SMA for symbol: ${symbol} from Twelve Data...`);
      const sma20ResponseData = await fetchWithRetry(sma20Url);
      smaData.sma20 = sma20ResponseData.values || null;
      console.log(`Successfully fetched 20-day SMA for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching 20-day SMA for symbol ${symbol}:`, errorMessage);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch 50-day SMA
    try {
      const sma50Url = `https://api.twelvedata.com/sma?symbol=${symbol}&interval=1day&time_period=50&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 50-day SMA for symbol: ${symbol} from Twelve Data...`);
      const sma50ResponseData = await fetchWithRetry(sma50Url);
      smaData.sma50 = sma50ResponseData.values || null;
      console.log(`Successfully fetched 50-day SMA for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching 50-day SMA for symbol ${symbol}:`, errorMessage);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch RSI (14-day)
    try {
      const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching RSI for symbol: ${symbol} from Twelve Data...`);
      const rsiResponseData = await fetchWithRetry(rsiUrl);
      rsiData = rsiResponseData.values || null;
      console.log(`Successfully fetched RSI for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching RSI for symbol ${symbol}:`, errorMessage);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch MACD
    try {
      const macdUrl = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching MACD for symbol: ${symbol} from Twelve Data...`);
      const macdResponseData = await fetchWithRetry(macdUrl);
      macdData = macdResponseData.values || null;
      console.log(`Successfully fetched MACD for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching MACD for symbol ${symbol}:`, errorMessage);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch ATR (Average True Range, 14-day)
    try {
      const atrUrl = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching ATR for symbol: ${symbol} from Twelve Data...`);
      const atrResponseData = await fetchWithRetry(atrUrl);
      atrData = atrResponseData.values || null;
      console.log(`Successfully fetched ATR for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching ATR for symbol ${symbol}:`, errorMessage);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch ICHIMOKU (Ichimoku Cloud)
    try {
      const ichimokuUrl = `https://api.twelvedata.com/ichimoku?symbol=${symbol}&interval=1day&tenkan_period=9&kijun_period=26&senkou_span_b_period=52&displacement=26&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching ICHIMOKU for symbol: ${symbol} from Twelve Data...`);
      const ichimokuResponseData = await fetchWithRetry(ichimokuUrl);
      ichimokuData = ichimokuResponseData.values || null;
      console.log(`Successfully fetched ICHIMOKU for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching ICHIMOKU for symbol ${symbol}:`, errorMessage);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch AROON
    try {
      const aroonUrl = `https://api.twelvedata.com/aroon?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching AROON for symbol: ${symbol} from Twelve Data...`);
      const aroonResponseData = await fetchWithRetry(aroonUrl);
      aroonData = aroonResponseData.values || null;
      console.log(`Successfully fetched AROON for symbol: ${symbol}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching AROON for symbol ${symbol}:`, errorMessage);
    }

    // Combine all indicator data
    const indicatorsData = {
      sma: smaData,
      rsi: rsiData,
      macd: macdData,
      atr: atrData,
      ichimoku: ichimokuData,
      aroon: aroonData,
    };

    // Cache the result
    indicatorsCache.set(cacheKey, { data: indicatorsData, timestamp: now });
    console.log(`Successfully fetched and cached technical indicators for symbol: ${symbol}`);

    return NextResponse.json(indicatorsData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching technical indicators for symbol ${symbol}:`, errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch technical indicators: " + errorMessage },
      { status: 500 }
    );
  }
}