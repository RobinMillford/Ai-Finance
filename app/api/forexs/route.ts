import { NextResponse } from 'next/server';

// Interface for ForexPair to improve type safety
interface ForexPair {
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  base_currency: string;
  quote_currency: string;
}

// In-memory cache
const cache = new Map<string, { data: { pairs: ForexPair[]; totalCount: number }; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function GET(request: Request) {
  const TWELVE_DATA_API_KEY = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
  if (!TWELVE_DATA_API_KEY) {
    console.error("API key missing");
    return NextResponse.json({ pairs: [], totalCount: 0 }, { status: 200 });
  }

  // Get query parameters
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '50', 10);
  const currencyGroup = searchParams.get('currencyGroup') || 'All';
  const searchQuery = searchParams.get('searchQuery') || '';

  console.log("Request Parameters:", { page, perPage, currencyGroup, searchQuery });

  // Check cache
  const cacheKey = `forex_pairs_page_${page}_perPage_${perPage}_currencyGroup_${currencyGroup}_search_${searchQuery}`;
  const cachedData = cache.get(cacheKey);
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached data for key:", cacheKey);
    return NextResponse.json(cachedData.data);
  }

  try {
    console.log("Fetching from Twelve Data API...");
    const response = await fetch(
      `https://api.twelvedata.com/forex_pairs?apikey=${TWELVE_DATA_API_KEY}`
    );
    console.log("Twelve Data API Response Status:", response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Twelve Data API error:", errorData);
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    const apiResponse = await response.json();
    console.log("Twelve Data API Response:", apiResponse);

    // Extract the 'data' array from the response
    const forexPairsArray = apiResponse.data;

    // Validate that forexPairsArray is an array
    if (!Array.isArray(forexPairsArray)) {
      console.error("Invalid response format: Expected 'data' to be an array, received:", forexPairsArray);
      return NextResponse.json({ pairs: [], totalCount: 0 }, { status: 200 });
    }

    // Map the API response to the ForexPair interface
    let forexPairs: ForexPair[] = forexPairsArray.map((pair: any) => ({
      symbol: pair.symbol,
      name: `${pair.currency_base} to ${pair.currency_quote}`,
      exchange: "FOREX",
      status: pair.currency_group || "Forex Pair",
      base_currency: pair.currency_base,
      quote_currency: pair.currency_quote,
    }));
    console.log("Mapped Forex Pairs (before filtering):", forexPairs.length, "pairs");

    // Use Array.from instead of spread operator to avoid downlevel iteration issue
    const availableCurrencyGroups = Array.from(new Set(forexPairs.map((pair) => pair.status)));
    console.log("Available Currency Groups:", availableCurrencyGroups);

    // Apply filters server-side
    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      forexPairs = forexPairs.filter((pair) =>
        pair.symbol.toLowerCase().includes(lowerQuery) ||
        pair.name.toLowerCase().includes(lowerQuery) ||
        (pair.base_currency && pair.base_currency.toLowerCase().includes(lowerQuery)) ||
        (pair.quote_currency && pair.quote_currency.toLowerCase().includes(lowerQuery))
      );
      console.log("After searchQuery filter:", forexPairs.length, "pairs");
    }

    if (currencyGroup !== "All") {
      forexPairs = forexPairs.filter((pair) => pair.status === currencyGroup);
      console.log("After currencyGroup filter:", forexPairs.length, "pairs");
    }

    // Apply pagination server-side
    const totalCount = forexPairs.length;
    const start = (page - 1) * perPage;
    const paginatedPairs = forexPairs.slice(start, start + perPage);
    console.log("After pagination:", paginatedPairs.length, "pairs (total:", totalCount, ")");

    // Cache the result
    const responseData = {
      pairs: paginatedPairs,
      totalCount: totalCount,
    };
    cache.set(cacheKey, { data: responseData, timestamp: now });
    console.log("Cached response for key:", cacheKey);

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching forex pairs:", errorMessage);
    return NextResponse.json({ pairs: [], totalCount: 0 }, { status: 200 });
  }
}