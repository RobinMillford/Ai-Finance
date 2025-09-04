import { NextResponse } from 'next/server';
import { getMarketIntelligence, getComprehensiveMarketOverview, getLatestNews, getGeopoliticalAnalysis, getMarketSentiment, getFundamentalAnalysis, getTechnicalAnalysis, getMacroeconomicAnalysis, getRegulatoryAnalysis, getMarketAlerts } from '@/lib/market-intelligence';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const type = searchParams.get('type') || 'general';

  // Check if API key is available
  const apiKey = process.env.NEXT_PUBLIC_TAVILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      error: "NEXT_PUBLIC_TAVILY_API_KEY not found in environment variables. Market intelligence features are disabled." 
    }, { status: 500 });
  }

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    let result;
    switch (type) {
      case 'comprehensive':
        result = await getComprehensiveMarketOverview(symbol);
        break;
      case 'news':
        result = await getLatestNews(symbol);
        break;
      case 'geopolitical':
        result = await getGeopoliticalAnalysis(symbol);
        break;
      case 'sentiment':
        result = await getMarketSentiment(symbol);
        break;
      case 'fundamental':
        result = await getFundamentalAnalysis(symbol);
        break;
      case 'technical':
        result = await getTechnicalAnalysis(symbol);
        break;
      case 'macroeconomic':
        result = await getMacroeconomicAnalysis(symbol);
        break;
      case 'regulatory':
        result = await getRegulatoryAnalysis(symbol);
        break;
      case 'alerts':
        result = await getMarketAlerts(symbol);
        break;
      default:
        result = await getMarketIntelligence(symbol, type);
        break;
    }
    
    // Check if the result contains a rate limit error
    if (result && typeof result === 'object' && 'error' in result && 
        typeof result.error === 'string' && result.error.includes("Rate limit exceeded")) {
      return NextResponse.json(result, { status: 429 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching market intelligence:', error);
    return NextResponse.json({ error: 'Failed to fetch market intelligence' }, { status: 500 });
  }
}