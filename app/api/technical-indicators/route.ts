import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for technical indicators data (symbol -> indicators data)
const indicatorsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Rate limit: 8 requests per minute (60 seconds / 8 = 7.5 seconds per request)
// We'll use 10 seconds to be safe
const REQUEST_DELAY_MS = 15000; // 10 seconds delay between requests

// Utility function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Utility function to fetch with retry on rate limit
async function fetchWithRetry(url: string, maxRetries: number = 3, retryDelayMs: number = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          // Rate limit hit, retry after delay
          console.warn(`Rate limit hit for URL: ${url}. Retrying (${attempt}/${maxRetries}) after ${retryDelayMs}ms...`);
          if (attempt === maxRetries) {
            throw new Error("Rate limit exceeded after maximum retries");
          }
          await delay(retryDelayMs);
          continue;
        }
        throw new Error(`API error: ${JSON.stringify(errorData)}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.warn(`Fetch attempt ${attempt} failed for URL: ${url}. Retrying after ${retryDelayMs}ms...`, error.message);
      await delay(retryDelayMs);
    }
  }
  throw new Error("Unexpected error in fetchWithRetry");
}

export async function GET(request: Request) {
  const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
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
    let stochData = null;
    let smaData = { sma20: null, sma50: null };
    let emaData = { ema20: null, ema50: null };
    let rsiData = null;
    let percentBData = null;
    let macdData = null;
    let bbandsData = null;
    let adxData = null;
    let maxData = null;

    // Fetch STOCH (Stochastic Oscillator)
    try {
      const stochUrl = `https://api.twelvedata.com/stoch?symbol=${symbol}&interval=1day&fast_k_period=14&slow_d_period=3&slow_k_period=1&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching STOCH for symbol: ${symbol} from Twelve Data...`);
      const stochResponseData = await fetchWithRetry(stochUrl);
      stochData = stochResponseData.values || null;
      console.log(`Successfully fetched STOCH for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching STOCH for symbol ${symbol}:`, error.message);
      // Continue with null STOCH data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch 20-day SMA
    try {
      const sma20Url = `https://api.twelvedata.com/sma?symbol=${symbol}&interval=1day&time_period=20&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 20-day SMA for symbol: ${symbol} from Twelve Data...`);
      const sma20ResponseData = await fetchWithRetry(sma20Url);
      smaData.sma20 = sma20ResponseData.values || null;
      console.log(`Successfully fetched 20-day SMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching 20-day SMA for symbol ${symbol}:`, error.message);
      // Continue with null SMA 20 data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch 50-day SMA
    try {
      const sma50Url = `https://api.twelvedata.com/sma?symbol=${symbol}&interval=1day&time_period=50&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 50-day SMA for symbol: ${symbol} from Twelve Data...`);
      const sma50ResponseData = await fetchWithRetry(sma50Url);
      smaData.sma50 = sma50ResponseData.values || null;
      console.log(`Successfully fetched 50-day SMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching 50-day SMA for symbol ${symbol}:`, error.message);
      // Continue with null SMA 50 data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch 20-day EMA
    try {
      const ema20Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 20-day EMA for symbol: ${symbol} from Twelve Data...`);
      const ema20ResponseData = await fetchWithRetry(ema20Url);
      emaData.ema20 = ema20ResponseData.values || null;
      console.log(`Successfully fetched 20-day EMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching 20-day EMA for symbol ${symbol}:`, error.message);
      // Continue with null EMA 20 data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch 50-day EMA
    try {
      const ema50Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=50&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 50-day EMA for symbol: ${symbol} from Twelve Data...`);
      const ema50ResponseData = await fetchWithRetry(ema50Url);
      emaData.ema50 = ema50ResponseData.values || null;
      console.log(`Successfully fetched 50-day EMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching 50-day EMA for symbol ${symbol}:`, error.message);
      // Continue with null EMA 50 data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch RSI (14-day)
    try {
      const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching RSI for symbol: ${symbol} from Twelve Data...`);
      const rsiResponseData = await fetchWithRetry(rsiUrl);
      rsiData = rsiResponseData.values || null;
      console.log(`Successfully fetched RSI for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching RSI for symbol ${symbol}:`, error.message);
      // Continue with null RSI data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch PERCENT_B
    try {
      const percentBUrl = `https://api.twelvedata.com/percent_b?symbol=${symbol}&interval=1day&time_period=20&sd=2&ma_type=SMA&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching PERCENT_B for symbol: ${symbol} from Twelve Data...`);
      const percentBResponseData = await fetchWithRetry(percentBUrl);
      percentBData = percentBResponseData.values || null;
      console.log(`Successfully fetched PERCENT_B for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching PERCENT_B for symbol ${symbol}:`, error.message);
      // Continue with null PERCENT_B data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch MACD
    try {
      const macdUrl = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching MACD for symbol: ${symbol} from Twelve Data...`);
      const macdResponseData = await fetchWithRetry(macdUrl);
      macdData = macdResponseData.values || null;
      console.log(`Successfully fetched MACD for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching MACD for symbol ${symbol}:`, error.message);
      // Continue with null MACD data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch BBANDS
    try {
      const bbandsUrl = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&sd=2&ma_type=SMA&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching BBANDS for symbol: ${symbol} from Twelve Data...`);
      const bbandsResponseData = await fetchWithRetry(bbandsUrl);
      bbandsData = bbandsResponseData.values || null;
      console.log(`Successfully fetched BBANDS for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching BBANDS for symbol ${symbol}:`, error.message);
      // Continue with null BBANDS data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch ADX
    try {
      const adxUrl = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching ADX for symbol: ${symbol} from Twelve Data...`);
      const adxResponseData = await fetchWithRetry(adxUrl);
      adxData = adxResponseData.values || null;
      console.log(`Successfully fetched ADX for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching ADX for symbol ${symbol}:`, error.message);
      // Continue with null ADX data
    }
    await delay(REQUEST_DELAY_MS); // Delay before next request

    // Fetch MAX (Highest Value Over Period, 9-day)
    try {
      const maxUrl = `https://api.twelvedata.com/max?symbol=${symbol}&interval=1day&time_period=9&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching MAX (9-day) for symbol: ${symbol} from Twelve Data...`);
      const maxResponseData = await fetchWithRetry(maxUrl);
      maxData = maxResponseData.values || null;
      console.log(`Successfully fetched MAX (9-day) for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching MAX for symbol ${symbol}:`, error.message);
      // Continue with null MAX data
    }

    // Combine all indicator data
    const indicatorsData = {
      stoch: stochData,
      sma: smaData,
      ema: emaData,
      rsi: rsiData,
      percentB: percentBData,
      macd: macdData,
      bbands: bbandsData,
      adx: adxData,
      max: maxData, // Add MAX data
    };

    // Cache the result
    indicatorsCache.set(cacheKey, { data: indicatorsData, timestamp: now });
    console.log(`Successfully fetched and cached technical indicators for symbol: ${symbol}`);

    return NextResponse.json(indicatorsData);
  } catch (error) {
    console.error(`Error fetching technical indicators for symbol ${symbol}:`, error.message);
    return NextResponse.json(
      { error: "Failed to fetch technical indicators: " + error.message },
      { status: 500 }
    );
  }
}