import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for technical indicators data (symbol -> indicators data)
const indicatorsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Rate limit: 8 requests per minute (60 seconds / 8 = 7.5 seconds per request)
// We'll use 15 seconds to be safe
const REQUEST_DELAY_MS = 18000; // 15 seconds delay between requests

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
    let emaData = { ema20: null, ema50: null };
    let rsiData = null;
    let macdData = null;
    let bbandsData = null;
    let atrData = null;
    let obvData = null;
    let vwapData = null;
    let mfiData = null;
    let ichimokuData = null;
    let adData = null;
    let adoscData = null;
    let supertrendData = null;
    let kamaData = null;

    // Fetch 20-day EMA
    try {
      const ema20Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=20&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 20-day EMA for symbol: ${symbol} from Twelve Data...`);
      const ema20ResponseData = await fetchWithRetry(ema20Url);
      emaData.ema20 = ema20ResponseData.values || null;
      console.log(`Successfully fetched 20-day EMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching 20-day EMA for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch 50-day EMA
    try {
      const ema50Url = `https://api.twelvedata.com/ema?symbol=${symbol}&interval=1day&time_period=50&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching 50-day EMA for symbol: ${symbol} from Twelve Data...`);
      const ema50ResponseData = await fetchWithRetry(ema50Url);
      emaData.ema50 = ema50ResponseData.values || null;
      console.log(`Successfully fetched 50-day EMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching 50-day EMA for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch RSI (14-day)
    try {
      const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching RSI for symbol: ${symbol} from Twelve Data...`);
      const rsiResponseData = await fetchWithRetry(rsiUrl);
      rsiData = rsiResponseData.values || null;
      console.log(`Successfully fetched RSI for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching RSI for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch MACD
    try {
      const macdUrl = `https://api.twelvedata.com/macd?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&signal_period=9&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching MACD for symbol: ${symbol} from Twelve Data...`);
      const macdResponseData = await fetchWithRetry(macdUrl);
      macdData = macdResponseData.values || null;
      console.log(`Successfully fetched MACD for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching MACD for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch BBANDS
    try {
      const bbandsUrl = `https://api.twelvedata.com/bbands?symbol=${symbol}&interval=1day&time_period=20&sd=2&ma_type=SMA&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching BBANDS for symbol: ${symbol} from Twelve Data...`);
      const bbandsResponseData = await fetchWithRetry(bbandsUrl);
      bbandsData = bbandsResponseData.values || null;
      console.log(`Successfully fetched BBANDS for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching BBANDS for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch ATR (14-day)
    try {
      const atrUrl = `https://api.twelvedata.com/atr?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching ATR for symbol: ${symbol} from Twelve Data...`);
      const atrResponseData = await fetchWithRetry(atrUrl);
      atrData = atrResponseData.values || null;
      console.log(`Successfully fetched ATR for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching ATR for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch OBV
    try {
      const obvUrl = `https://api.twelvedata.com/obv?symbol=${symbol}&interval=1day&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching OBV for symbol: ${symbol} from Twelve Data...`);
      const obvResponseData = await fetchWithRetry(obvUrl);
      obvData = obvResponseData.values || null;
      console.log(`Successfully fetched OBV for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching OBV for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch VWAP
    try {
      const vwapUrl = `https://api.twelvedata.com/vwap?symbol=${symbol}&interval=1day&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching VWAP for symbol: ${symbol} from Twelve Data...`);
      const vwapResponseData = await fetchWithRetry(vwapUrl);
      vwapData = vwapResponseData.values || null;
      console.log(`Successfully fetched VWAP for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching VWAP for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch MFI (14-day)
    try {
      const mfiUrl = `https://api.twelvedata.com/mfi?symbol=${symbol}&interval=1day&time_period=14&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching MFI for symbol: ${symbol} from Twelve Data...`);
      const mfiResponseData = await fetchWithRetry(mfiUrl);
      mfiData = mfiResponseData.values || null;
      console.log(`Successfully fetched MFI for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching MFI for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch Ichimoku Cloud
    try {
      const ichimokuUrl = `https://api.twelvedata.com/ichimoku?symbol=${symbol}&interval=1day&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching Ichimoku Cloud for symbol: ${symbol} from Twelve Data...`);
      const ichimokuResponseData = await fetchWithRetry(ichimokuUrl);
      ichimokuData = ichimokuResponseData.values || null;
      console.log(`Successfully fetched Ichimoku Cloud for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching Ichimoku Cloud for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch AD (Accumulation/Distribution)
    try {
      const adUrl = `https://api.twelvedata.com/ad?symbol=${symbol}&interval=1day&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching AD for symbol: ${symbol} from Twelve Data...`);
      const adResponseData = await fetchWithRetry(adUrl);
      adData = adResponseData.values || null;
      console.log(`Successfully fetched AD for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching AD for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch ADOSC (Chaikin Oscillator)
    try {
      const adoscUrl = `https://api.twelvedata.com/adosc?symbol=${symbol}&interval=1day&fast_period=12&slow_period=26&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching ADOSC for symbol: ${symbol} from Twelve Data...`);
      const adoscResponseData = await fetchWithRetry(adoscUrl);
      adoscData = adoscResponseData.values || null;
      console.log(`Successfully fetched ADOSC for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching ADOSC for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch Supertrend
    try {
      const supertrendUrl = `https://api.twelvedata.com/supertrend?symbol=${symbol}&interval=1day&multiplier=3&period=10&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching Supertrend for symbol: ${symbol} from Twelve Data...`);
      const supertrendResponseData = await fetchWithRetry(supertrendUrl);
      supertrendData = supertrendResponseData.values || null;
      console.log(`Successfully fetched Supertrend for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching Supertrend for symbol ${symbol}:`, error.message);
    }
    await delay(REQUEST_DELAY_MS);

    // Fetch KAMA (9-day) instead of RVOL
    try {
      const kamaUrl = `https://api.twelvedata.com/kama?symbol=${symbol}&interval=1day&time_period=9&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching KAMA for symbol: ${symbol} from Twelve Data...`);
      const kamaResponseData = await fetchWithRetry(kamaUrl);
      kamaData = kamaResponseData.values || null;
      console.log(`Successfully fetched KAMA for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching KAMA for symbol ${symbol}:`, error.message);
    }

    // Combine all indicator data
    const indicatorsData = {
      ema: emaData,
      rsi: rsiData,
      macd: macdData,
      bbands: bbandsData,
      atr: atrData,
      obv: obvData,
      vwap: vwapData,
      mfi: mfiData,
      ichimoku: ichimokuData,
      ad: adData,
      adosc: adoscData,
      supertrend: supertrendData,
      kama: kamaData,
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