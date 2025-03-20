import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// In-memory cache for stock listings and exchange data
let cachedStocks = null;
let cacheTimestamp = null;
export const exchangeCache = new Map(); // Cache for exchange data (symbol -> exchange)
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Utility function to delay execution (for retry)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request, { retries = 2, delayMs = 15000 } = {}) {
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

  if (!ALPHA_VANTAGE_API_KEY) {
    console.error("Alpha Vantage API key is missing in environment variables");
    return NextResponse.json(
      { error: "Server configuration error: API key missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = 50; // 50 stocks per page

  console.log(`Fetching stock listings (Page ${page})...`);

  // Check if cache is valid
  const now = Date.now();
  if (cachedStocks && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    console.log("Returning cached stock listings...");
    const totalStocks = cachedStocks.length;
    const totalPages = Math.ceil(totalStocks / perPage);
    const paginatedStocks = cachedStocks.slice((page - 1) * perPage, page * perPage);

    return NextResponse.json({
      stocks: paginatedStocks,
      total_pages: totalPages,
      current_page: page,
      total_stocks: totalStocks,
    });
  }

  // Fetch stock listings from Alpha Vantage
  const alphaVantageUrl = `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${ALPHA_VANTAGE_API_KEY}`;

  try {
    console.log("Fetching stock listings from Alpha Vantage...");
    const response = await fetch(alphaVantageUrl);
    if (!response.ok) {
      const text = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { Information: text || "Unknown error from Alpha Vantage" };
      }
      console.error("Alpha Vantage API error:", errorData);

      if (errorData.Information && errorData.Information.includes("rate limit") && retries > 0) {
        console.log(`Alpha Vantage rate limit exceeded for stock listings. Retrying in ${delayMs / 1000} seconds... (${retries} retries left)`);
        await delay(delayMs);
        return GET(request, { retries: retries - 1, delayMs });
      }

      return NextResponse.json(
        { error: errorData.Information || "Failed to fetch data from Alpha Vantage" },
        { status: 500 }
      );
    }

    const data = await response.text();
    console.log("Raw Alpha Vantage response length:", data.length);

    if (!data || data.startsWith('<!DOCTYPE')) {
      console.error("Received HTML instead of CSV:", data.slice(0, 100));
      return NextResponse.json(
        { error: "Invalid response format from Alpha Vantage" },
        { status: 500 }
      );
    }

    if (data.length <= 2) {
      console.error("Empty or near-empty response from Alpha Vantage:", data);
      if (retries > 0) {
        console.log(`Empty response from Alpha Vantage. Retrying in ${delayMs / 1000} seconds... (${retries} retries left)`);
        await delay(delayMs);
        return GET(request, { retries: retries - 1, delayMs });
      }
      return NextResponse.json(
        { error: "Empty response from Alpha Vantage. Possible rate limit exceeded." },
        { status: 500 }
      );
    }

    const stocks = data
      .split('\n')
      .slice(1) // Skip header (symbol,name,exchange,assetType,status)
      .map(row => {
        const [symbol, name, exchange, assetType, status] = row.split(',');
        exchangeCache.set(symbol, exchange); // Cache the exchange
        return { 
          symbol, 
          name, 
          exchange, 
          status: assetType // Use assetType (Stock/ETF) as status
        };
      })
      .filter(stock => stock.symbol && stock.symbol.trim());

    // Update cache
    cachedStocks = stocks;
    cacheTimestamp = Date.now();
    console.log("Stock listings cached successfully");

    const totalStocks = stocks.length;
    const totalPages = Math.ceil(totalStocks / perPage);
    const paginatedStocks = stocks.slice((page - 1) * perPage, page * perPage);

    console.log(`Successfully fetched ${paginatedStocks.length} stocks (Page ${page} of ${totalPages})`);

    return NextResponse.json({
      stocks: paginatedStocks,
      total_pages: totalPages,
      current_page: page,
      total_stocks: totalStocks,
    });
  } catch (error) {
    console.error("Error fetching stocks from Alpha Vantage:", error.message);
    if (retries > 0) {
      console.log(`Error occurred with Alpha Vantage. Retrying in ${delayMs / 1000} seconds... (${retries} retries left)`);
      await delay(delayMs);
      return GET(request, { retries: retries - 1, delayMs });
    }
    return NextResponse.json(
      { error: "Failed to fetch stock listings: " + error.message },
      { status: 500 }
    );
  }
}