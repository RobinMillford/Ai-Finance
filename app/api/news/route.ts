import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "finance"; // Default to "finance" if no query
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");

  const apiKey = process.env.NEXT_PUBLIC_NEWSAPI_KEY; // Use server-side env variable (not NEXT_PUBLIC_)
  if (!apiKey) {
    return NextResponse.json({ error: "NewsAPI key is missing" }, { status: 500 });
  }

  // Build the NewsAPI URL
  const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    query + " -crypto -cryptocurrency -bitcoin -ethereum" // Exclude crypto terms
  )}&language=en&sortBy=publishedAt&pageSize=${pageSize}&page=${page}&apiKey=${apiKey}`;

  try {
    const response = await fetch(newsApiUrl);
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.message || "Failed to fetch news" }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching news from NewsAPI:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}