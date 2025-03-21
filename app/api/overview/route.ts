import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for overview data (symbol -> overview)
const overviewCache = new Map();
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
  const cachedData = overviewCache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached overview data for symbol: ${symbol}`);
    return NextResponse.json(cachedData.data);
  }

  try {
    // Initialize response data
    let logoData = { url: null, logo_base: null, logo_quote: null };

    // Fetch logo data from Twelve Data
    try {
      const logoUrl = `https://api.twelvedata.com/logo?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
      console.log(`Fetching logo data for symbol: ${symbol} from Twelve Data...`);
      const logoResponse = await fetch(logoUrl);
      if (!logoResponse.ok) {
        const errorData = await logoResponse.json();
        console.error(`Twelve Data API error for logo (${symbol}):`, errorData);
        throw new Error(errorData.message || "Failed to fetch logo data");
      }
      const logoResponseData = await logoResponse.json();
      console.log(`Successfully fetched logo data for symbol: ${symbol}`);

      // Handle both equity and crypto/forex logo responses
      if (logoResponseData.url) {
        // Equity symbol
        logoData.url = logoResponseData.url;
      } else if (logoResponseData.logo_base && logoResponseData.logo_quote) {
        // Crypto/forex symbol
        logoData.logo_base = logoResponseData.logo_base;
        logoData.logo_quote = logoResponseData.logo_quote;
      } else {
        console.warn(`Unexpected logo response format for symbol ${symbol}:`, logoResponseData);
      }
    } catch (error) {
      console.error(`Error fetching logo data for symbol ${symbol} from Twelve Data:`, error.message);
      // Continue with default logo data (null values)
    }

    // Prepare the response data (only logo-related fields)
    const overviewData = {
      logo: logoData.url, // For equities
      logo_base: logoData.logo_base, // For crypto/forex
      logo_quote: logoData.logo_quote, // For crypto/forex
    };

    // Cache the result
    overviewCache.set(cacheKey, { data: overviewData, timestamp: now });
    console.log(`Successfully fetched and cached overview data for symbol: ${symbol}`);

    return NextResponse.json(overviewData);
  } catch (error) {
    console.error(`Error fetching overview data for symbol ${symbol}:`, error.message);
    return NextResponse.json(
      { error: "Failed to fetch overview data: " + error.message },
      { status: 500 }
    );
  }
}