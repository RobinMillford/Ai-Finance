import { NextResponse } from 'next/server';
import { exchangeCache } from '../stocks/route';

// Force dynamic rendering
export const dynamic = "force-dynamic";

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
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    console.error("Stock symbol is missing in the request");
    return NextResponse.json(
      { error: "Stock symbol is required" },
      { status: 400 }
    );
  }

  // Fetch company overview from Alpha Vantage
  const alphaVantageUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

  try {
    console.log(`Fetching company overview for symbol ${symbol} from Alpha Vantage...`);
    const response = await fetch(alphaVantageUrl);
    if (!response.ok) {
      const text = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { Information: "Unknown error from Alpha Vantage" };
      }
      console.error(`Alpha Vantage API error for symbol ${symbol}:`, errorData);

      if (errorData.Information && errorData.Information.includes("rate limit") && retries > 0) {
        console.log(`Alpha Vantage rate limit exceeded for overview (${symbol}). Retrying in ${delayMs / 1000} seconds... (${retries} retries left)`);
        await delay(delayMs);
        return GET(request, { retries: retries - 1, delayMs });
      }

      throw new Error(errorData.Information || "Failed to fetch company overview from Alpha Vantage");
    }

    const data = await response.json();
    if (!data.Symbol) {
      console.error(`No company overview found for symbol ${symbol} on Alpha Vantage`);
      return NextResponse.json(
        { error: "No company overview found for this symbol" },
        { status: 404 }
      );
    }

    // Update exchange if available in cache
    if (exchangeCache.has(symbol)) {
      data.Exchange = exchangeCache.get(symbol);
    }

    console.log(`Successfully fetched company overview for symbol ${symbol} from Alpha Vantage`);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching company overview for symbol ${symbol} from Alpha Vantage:`, error.message);
    if (retries > 0) {
      console.log(`Error occurred with Alpha Vantage for overview. Retrying in ${delayMs / 1000} seconds... (${retries} retries left)`);
      await delay(delayMs);
      return GET(request, { retries: retries - 1, delayMs });
    }
    return NextResponse.json(
      { error: "Failed to fetch company overview: " + error.message },
      { status: 500 }
    );
  }
}