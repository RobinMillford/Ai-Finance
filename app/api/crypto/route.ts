import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
  if (!TWELVE_DATA_API_KEY) {
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

  try {
    // Fetch time series data
    const timeSeriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
    const timeSeriesResponse = await fetch(timeSeriesUrl);
    if (!timeSeriesResponse.ok) {
      const errorData = await timeSeriesResponse.json();
      return NextResponse.json(
        { error: `Failed to fetch time series data: ${errorData.message || "Unknown error"}` },
        { status: timeSeriesResponse.status }
      );
    }
    const timeSeriesData = await timeSeriesResponse.json();

    // Fetch quote data
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`;
    const quoteResponse = await fetch(quoteUrl);
    if (!quoteResponse.ok) {
      const errorData = await quoteResponse.json();
      return NextResponse.json(
        { error: `Failed to fetch quote data: ${errorData.message || "Unknown error"}` },
        { status: quoteResponse.status }
      );
    }
    const quoteData = await quoteResponse.json();

    // Combine data
    return NextResponse.json({
      timeSeries: timeSeriesData,
      quote: quoteData,
      // Add other data like price, eod, etc., as needed
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch crypto data: ${error.message}` },
      { status: 500 }
    );
  }
}