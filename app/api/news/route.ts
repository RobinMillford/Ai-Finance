import { NextResponse } from "next/server";
import { withRateLimit, errorResponse, validateEnvVars } from "@/lib/api-middleware";
import { RATE_LIMITS } from "@/lib/rate-limiter";

/**
 * GET /api/news
 * Fetch news articles with rate limiting and improved error handling
 * 
 * Query params:
 * - q: search query (default: "finance")
 * - page: page number (default: 1)
 * - pageSize: articles per page (default: 10)
 */
async function handler(request: Request) {
  // Validate environment variables
  const { valid, missing } = validateEnvVars(["NEXT_PUBLIC_NEWS_API_KEY"]);
  if (!valid) {
    return errorResponse(`Missing environment variables: ${missing.join(", ")}`, 500);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "finance";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "10"), 100); // Cap at 100

  const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY;

  // Build the NewsAPI URL
  const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    query + " -crypto -cryptocurrency -bitcoin -ethereum"
  )}&language=en&sortBy=publishedAt&pageSize=${pageSize}&page=${page}&apiKey=${apiKey}`;

  try {
    const response = await fetch(newsApiUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
      return errorResponse(
        errorData.message || `Failed to fetch news: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    // Return raw NewsAPI response to maintain compatibility with frontend
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching news from NewsAPI:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}

// Apply rate limiting: 30 requests per minute for news endpoint
export const GET = withRateLimit(handler, RATE_LIMITS.NEWS);