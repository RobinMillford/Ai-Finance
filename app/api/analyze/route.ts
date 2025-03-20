import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  
  const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    // Fetch stock price
    const priceUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const priceResponse = await fetch(priceUrl);
    const priceData = await priceResponse.json();

    // Fetch news
    const newsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const newsResponse = await fetch(newsUrl);
    const newsData = await newsResponse.json();

    const news = newsData.feed?.slice(0, 3).map((item: any) => ({
      headline: item.title,
      summary: item.summary
    })) || [];

    // Get sentiment analysis from Gemini
    const headlines = news.map((n: any) => n.headline).join(' ');
    const sentimentUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    const sentimentResponse = await fetch(sentimentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GEMINI_API_KEY}`
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze the sentiment of these financial headlines: '${headlines}' (Positive, Negative, or Neutral).`
          }]
        }]
      })
    });
    const sentimentData = await sentimentResponse.json();
    const sentiment = sentimentData.candidates[0].content.parts[0].text;

    return NextResponse.json({
      symbol,
      price: priceData['Global Quote']?.['05. price'],
      news,
      sentiment,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to analyze stock' }, { status: 500 });
  }
}