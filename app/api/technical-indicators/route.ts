import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for technical indicators data (symbol -> indicators data)
const indicatorsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
    // Fetch STOCH (Stochastic Oscillator)
    let stochData = null;
    try {
      const stochUrl = `https://api.twelvedata.com/stoch?symbol=${symbol}&interval=1day&fast_k_period=14&slow_d_period=3&slow_k_period=1&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching STOCH for symbol: ${symbol} from Twelve Data...`);
      const stochResponse = await fetch(stochUrl);
      if (!stochResponse.ok) {
        const errorData = await stochResponse.json();
        console.error(`Twelve Data API error for STOCH (${symbol}):`, errorData);
        throw new Error("Failed to fetch STOCH data");
      }
      const stochResponseData = await stochResponse.json();
      stochData = stochResponseData.values || null;
      console.log(`Successfully fetched STOCH for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching STOCH for symbol ${symbol}:`, error.message);
      // Continue with null STOCH data
    }

    // Fetch SMA (20-day and 50-day)
    let smaData = { sma20: null, sma50: null };
    try {
      // 20-day SMA
      const sma20Url = `https://api.twelvedata.com/sma?symbol=${symbol}&interval=1day&time_period=20&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 20-day SMA for symbol: ${symbol} from Twelve Data...`);
      const sma20Response = await fetch(sma20Url);
      if (!sma20Response.ok) {
        const errorData = await sma20Response.json();
        console.error(`Twelve Data API error for 20-day SMA (${symbol}):`, errorData);
        throw new Error("Failed to fetch 20-day SMA");
      }
      const sma20ResponseData = await sma20Response.json();
      smaData.sma20 = sma20ResponseData.values || null;
      console.log(`Successfully fetched 20-day SMA for symbol: ${symbol}`);

      // 50-day SMA
      const sma50Url = `https://api.twelvedata.com/sma?symbol=${symbol}&interval=1day&time_period=50&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 50-day SMA for symbol: ${symbol} from Twelve Data...`);
      const sma50Response = await fetch(sma50Url);
      if (!sma50Response.ok) {
        const errorData = await sma50Response.json();
        console.error(`Twelve Data API error for 50-day SMA (${symbol}):`, errorData);
        throw new Error("Failed to fetch 50-day SMA");
      }
      const sma50ResponseData = await sma50Response.json();
      smaData.sma50 = sma50ResponseData.values || null;
      console.log(`Successfully fetched 50-day SMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching SMA for symbol ${symbol}:`, error.message);
      // Continue with null SMA data
    }

    // Fetch EMA (20-day and 50-day)
    let emaData = { ema20: null, ema50: null };
    try {
      // 20-day EMA
      const ema20Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 20-day EMA for symbol: ${symbol} from Twelve Data...`);
      const ema20Response = await fetch(ema20Url);
      if (!ema20Response.ok) {
        const errorData = await ema20Response.json();
        console.error(`Twelve Data API error for 20-day EMA (${symbol}):`, errorData);
        throw new Error("Failed to fetch 20-day EMA");
      }
      const ema20ResponseData = await ema20Response.json();
      emaData.ema20 = ema20ResponseData.values || null;
      console.log(`Successfully fetched 20-day EMA for symbol: ${symbol}`);

      // 50-day EMA
      const ema50Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=50&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 50-day EMA for symbol: ${symbol} from Twelve Data...`);
      const ema50Response = await fetch(ema50Url);
      if (!ema50Response.ok) {
        const errorData = await ema50Response.json();
        console.error(`Twelve Data API error for 50-day EMA (${symbol}):`, errorData);
        throw new Error("Failed to fetch 50-day EMA");
      }
      const ema50ResponseData = await ema50Response.json();
      emaData.ema50 = ema50ResponseData.values || null;
      console.log(`Successfully fetched 50-day EMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching EMA for symbol ${symbol}:`, error.message);
      // Continue with null EMA data
    }

    // Fetch RSI (14-day)
    let rsiData = null;
    try {
      const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching RSI for symbol: ${symbol} from Twelve Data...`);
      const rsiResponse = await fetch(rsiUrl);
      if (!rsiResponse.ok) {
        const errorData = await rsiResponse.json();
        console.error(`Twelve Data API error for RSI (${symbol}):`, errorData);
        throw new Error("Failed to fetch RSI data");
      }
      const rsiResponseData = await rsiResponse.json();
      rsiData = rsiResponseData.values || null;
      console.log(`Successfully fetched RSI for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching RSI for symbol ${symbol}:`, error.message);
      // Continue with null RSI data
    }

    // Fetch PERCENT_B
    let percentBData = null;
    try {
      const percentBUrl = `https://api.twelvedata.com/percent_b?symbol=${symbol}&interval=1day&time_period=20&sd=2&ma_type=SMA&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching PERCENT_B for symbol: ${symbol} from Twelve Data...`);
      const percentBResponse = await fetch(percentBUrl);
      if (!percentBResponse.ok) {
        const errorData = await percentBResponse.json();
        console.error(`Twelve Data API error for PERCENT_B (${symbol}):`, errorData);
        throw new Error("Failed to fetch PERCENT_B data");
      }
      const percentBResponseData = await percentBResponse.json();
      percentBData = percentBResponseData.values || null;
      console.log(`Successfully fetched PERCENT_B for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching PERCENT_B for symbol ${symbol}:`, error.message);
      // Continue with null PERCENT_B data
    }

    // Fetch MACD
    let macdData = null;
    try {
      const macdUrl = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching MACD for symbol: ${symbol} from Twelve Data...`);
      const macdResponse = await fetch(macdUrl);
      if (!macdResponse.ok) {
        const errorData = await macdResponse.json();
        console.error(`Twelve Data API error for MACD (${symbol}):`, errorData);
        throw new Error("Failed to fetch MACD data");
      }
      const macdResponseData = await macdResponse.json();
      macdData = macdResponseData.values || null;
      console.log(`Successfully fetched MACD for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching MACD for symbol ${symbol}:`, error.message);
      // Continue with null MACD data
    }

    // Fetch BBANDS
    let bbandsData = null;
    try {
      const bbandsUrl = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&sd=2&ma_type=SMA&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching BBANDS for symbol: ${symbol} from Twelve Data...`);
      const bbandsResponse = await fetch(bbandsUrl);
      if (!bbandsResponse.ok) {
        const errorData = await bbandsResponse.json();
        console.error(`Twelve Data API error for BBANDS (${symbol}):`, errorData);
        throw new Error("Failed to fetch BBANDS data");
      }
      const bbandsResponseData = await bbandsResponse.json();
      bbandsData = bbandsResponseData.values || null;
      console.log(`Successfully fetched BBANDS for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching BBANDS for symbol ${symbol}:`, error.message);
      // Continue with null BBANDS data
    }

    // Fetch ADX
    let adxData = null;
    try {
      const adxUrl = `https://api.twelvedata.com/adx?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching ADX for symbol: ${symbol} from Twelve Data...`);
      const adxResponse = await fetch(adxUrl);
      if (!adxResponse.ok) {
        const errorData = await adxResponse.json();
        console.error(`Twelve Data API error for ADX (${symbol}):`, errorData);
        throw new Error("Failed to fetch ADX data");
      }
      const adxResponseData = await adxResponse.json();
      adxData = adxResponseData.values || null;
      console.log(`Successfully fetched ADX for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching ADX for symbol ${symbol}:`, error.message);
      // Continue with null ADX data
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