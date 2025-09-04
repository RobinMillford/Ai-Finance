import { NextResponse } from 'next/server';
import Sentiment from 'sentiment';

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Interface for Reddit Post
interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  score: number;
  num_comments: number;
  permalink: string;
  url: string;
  subreddit: string;
  ups: number;
  downs: number;
  upvote_ratio: number;
}

// Interface for Reddit Comment
interface RedditComment {
  id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
  ups: number;
  downs: number;
}

// Interface for Sentiment Analysis Result
interface SentimentResult {
  label: "Bullish" | "Bearish" | "Neutral";
  score: number;
  confidence: "High" | "Medium" | "Low";
  words: {
    positive: string[];
    negative: string[];
  };
}

// Financial-specific sentiment words
const FINANCIAL_SENTIMENT_WORDS = {
  bullish: [
    'bullish', 'buy', 'long', 'moon', 'rocket', 'pump', 'surge', 'rally', 'breakout',
    'uptrend', 'bull run', 'hodl', 'diamond hands', 'to the moon', 'calls', 'green',
    'profit', 'gains', 'rising', 'growth', 'strong', 'positive', 'optimistic',
    'accumulate', 'undervalued', 'oversold', 'bounce', 'support', 'resistance broken',
    // Forex-specific bullish terms
    'strengthen', 'strengthening', 'hawkish', 'rate hike', 'dovish pivot', 'bullish outlook',
    'currency strength', 'positive fundamentals', 'favorable', 'upside potential',
    'bullish bias', 'long setup', 'buy zone', 'demand zone'
  ],
  bearish: [
    'bearish', 'sell', 'short', 'crash', 'dump', 'drop', 'fall', 'decline', 'red',
    'loss', 'losses', 'bear market', 'puts', 'negative', 'pessimistic', 'overvalued',
    'overbought', 'correction', 'pullback', 'breakdown', 'resistance', 'panic',
    'fear', 'bubble', 'trap', 'rug pull', 'scam', 'avoid', 'risky',
    // Forex-specific bearish terms
    'weaken', 'weakening', 'dovish', 'rate cut', 'hawkish pause', 'bearish outlook',
    'currency weakness', 'negative fundamentals', 'unfavorable', 'downside risk',
    'bearish bias', 'short setup', 'sell zone', 'supply zone', 'intervention'
  ]
};

// In-memory cache for Reddit data
const redditCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Add financial sentiment words to the analyzer
const bullishWords: { [key: string]: number } = {};
FINANCIAL_SENTIMENT_WORDS.bullish.forEach(word => {
  bullishWords[word] = 2;
});

const bearishWords: { [key: string]: number } = {};
FINANCIAL_SENTIMENT_WORDS.bearish.forEach(word => {
  bearishWords[word] = -2;
});

sentiment.registerLanguage('en', {
  labels: { ...bullishWords, ...bearishWords }
});

// Financial subreddits to search
const FINANCIAL_SUBREDDITS = [
  'investing',
  'stocks', 
  'SecurityAnalysis',
  'ValueInvesting',
  'StockMarket',
  'cryptocurrency',
  'CryptoCurrency', 
  'Bitcoin',
  'ethereum',
  'Forex',
  'forextrading',
  'ForexStrategy',
  'forex_trades',
  'daytrading',
  'SwingTrading',
  'FXTrading',
  'currencytrading',
  'Trading',
  'options',
  'wallstreetbets',
  'pennystocks',
  'RobinhoodPennystocks'
];

// Analyze sentiment with financial context
function analyzeFinancialSentiment(text: string, symbol?: string): SentimentResult {
  const cleanText = text.toLowerCase();
  
  // Enhanced analysis with symbol-specific mentions
  let contextualText = cleanText;
  if (symbol) {
    const symbolLower = symbol.toLowerCase();
    
    // Check if it's a forex pair
    if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol)) {
      const baseCurrency = symbol.slice(0, 3).toLowerCase();
      const quoteCurrency = symbol.slice(3, 6).toLowerCase();
      
      // Check for various forex representations
      const forexMatches = [
        symbolLower, // eurusd
        `${baseCurrency}/${quoteCurrency}`, // eur/usd
        `${baseCurrency} ${quoteCurrency}`, // eur usd
        baseCurrency, // eur
        quoteCurrency // usd
      ];
      
      // Boost relevance if any forex pattern is found
      for (const pattern of forexMatches) {
        if (cleanText.includes(pattern)) {
          contextualText += ` ${pattern} ${pattern}`; // Boost forex relevance
          break;
        }
      }
    } else {
      // Stock or crypto symbol
      if (cleanText.includes(symbolLower) || cleanText.includes(`$${symbolLower}`)) {
        contextualText += ` ${symbolLower} ${symbolLower}`; // Boost symbol relevance
      }
    }
  }
  
  const result = sentiment.analyze(contextualText);
  let score = result.score;
  
  // Financial-specific adjustments
  const bullishMatches = FINANCIAL_SENTIMENT_WORDS.bullish.filter(word => 
    cleanText.includes(word)
  );
  const bearishMatches = FINANCIAL_SENTIMENT_WORDS.bearish.filter(word => 
    cleanText.includes(word)
  );
  
  // Adjust score based on financial terms
  score += bullishMatches.length * 2;
  score -= bearishMatches.length * 2;
  
  // Determine sentiment label
  let label: "Bullish" | "Bearish" | "Neutral";
  if (score > 1) {
    label = "Bullish";
  } else if (score < -1) {
    label = "Bearish";
  } else {
    label = "Neutral";
  }
  
  // Calculate confidence based on absolute score and word matches
  const totalMatches = bullishMatches.length + bearishMatches.length;
  const absScore = Math.abs(score);
  let confidence: "High" | "Medium" | "Low";
  
  if (absScore >= 5 || totalMatches >= 3) {
    confidence = "High";
  } else if (absScore >= 2 || totalMatches >= 1) {
    confidence = "Medium";
  } else {
    confidence = "Low";
  }
  
  return {
    label,
    score,
    confidence,
    words: {
      positive: bullishMatches,
      negative: bearishMatches
    }
  };
}

// Fetch Reddit data using Reddit's JSON API (no auth required)
async function fetchRedditData(symbol: string, subreddits: string[] = FINANCIAL_SUBREDDITS) {
  const allPosts: any[] = [];
  
  // Generate search queries based on symbol type
  let searchQueries: string[] = [];
  let targetSubreddits = [...subreddits];
  
  // Check if it's a forex pair (6 characters like EURUSD)
  if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol)) {
    const baseCurrency = symbol.slice(0, 3);
    const quoteCurrency = symbol.slice(3, 6);
    searchQueries = [
      symbol, // EURUSD
      `${baseCurrency}/${quoteCurrency}`, // EUR/USD
      `${baseCurrency} ${quoteCurrency}`, // EUR USD
      `${baseCurrency}-${quoteCurrency}`, // EUR-USD
      baseCurrency, // EUR
      quoteCurrency, // USD
      `${baseCurrency.toLowerCase()}/${quoteCurrency.toLowerCase()}`, // eur/usd
      `forex ${baseCurrency}`,
      `currency ${baseCurrency}`,
      `${baseCurrency} pair`,
      `trading ${baseCurrency}`,
      `${baseCurrency} analysis`,
      `${quoteCurrency} strength`,
      `${baseCurrency} outlook`
    ];
    
    // For forex, prioritize forex-specific subreddits
    targetSubreddits = [
      'Forex',
      'forextrading', 
      'ForexStrategy',
      'forex_trades',
      'FXTrading',
      'currencytrading',
      'daytrading',
      'SwingTrading',
      'Trading',
      'investing',
      'SecurityAnalysis'
    ];
    
    console.log(`Forex pair detected: ${symbol} -> ${baseCurrency}/${quoteCurrency}`);
  } else {
    // Stock or crypto symbol
    searchQueries = [
      symbol,
      `$${symbol}`,
      symbol.toLowerCase(),
      `${symbol} stock`,
      `${symbol} analysis`
    ];
    console.log(`Stock/Crypto symbol detected: ${symbol}`);
  }
  
  console.log(`Search queries: [${searchQueries.slice(0, 5).join(', ')}...]`);
  console.log(`Target subreddits: [${targetSubreddits.slice(0, 5).join(', ')}...]`);
  
  try {
    for (const subreddit of targetSubreddits.slice(0, 10)) { // Increase subreddit limit for forex
      for (const query of searchQueries.slice(0, 4)) { // Use top 4 search queries
        try {
          // Search in subreddit using Reddit's JSON API
          const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=hot&limit=15&t=week`;
          
          console.log(`Searching r/${subreddit} for: "${query}"`);
          
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'FinanceAI-Bot/1.0 (Financial Analysis Tool)'
            }
          });
          
          if (!response.ok) {
            console.warn(`Failed to fetch from r/${subreddit}: ${response.status}`);
            continue;
          }
          
          const data = await response.json();
          
          if (data.data && data.data.children && data.data.children.length > 0) {
            const posts = data.data.children.map((child: any) => ({
              id: child.data.id,
              title: child.data.title,
              selftext: child.data.selftext || '',
              author: child.data.author,
              created_utc: child.data.created_utc,
              score: child.data.score,
              num_comments: child.data.num_comments,
              permalink: `https://reddit.com${child.data.permalink}`,
              url: child.data.url,
              subreddit: child.data.subreddit,
              ups: child.data.ups,
              downs: child.data.downs || 0,
              upvote_ratio: child.data.upvote_ratio
            }));
            
            console.log(`Found ${posts.length} posts in r/${subreddit} for "${query}"`);
            allPosts.push(...posts);
          } else {
            console.log(`No posts found in r/${subreddit} for "${query}"`);
          }
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 800));
          
        } catch (error) {
          console.error(`Error fetching from r/${subreddit}:`, error);
          continue;
        }
      }
    }
    
    console.log(`Total posts collected: ${allPosts.length}`);
    
    // Remove duplicates and sort by relevance score
    const uniquePosts = Array.from(
      new Map(allPosts.map(post => [post.id, post])).values()
    );
    
    // Calculate relevance for each post and sort
    const scoredPosts = uniquePosts.map(post => ({
      ...post,
      relevance: calculateRelevanceScore(post, symbol)
    })).sort((a, b) => {
      // Sort by relevance first, then by score
      if (Math.abs(a.relevance - b.relevance) > 0.5) {
        return b.relevance - a.relevance;
      }
      return b.score - a.score;
    });
    
    console.log(`Returning top ${Math.min(25, scoredPosts.length)} most relevant posts`);
    return scoredPosts.slice(0, 25); // Return top 25 posts
    
  } catch (error) {
    console.error('Error fetching Reddit data:', error);
    throw error;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required' },
      { status: 400 }
    );
  }
  
  // Check cache
  const cacheKey = `reddit_${symbol.toUpperCase()}`;
  const cachedData = redditCache.get(cacheKey);
  const now = Date.now();
  
  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Returning cached Reddit data for symbol: ${symbol}`);
    return NextResponse.json(cachedData.data);
  }
  
  try {
    console.log(`Fetching Reddit data for symbol: ${symbol}`);
    
    // Fetch Reddit posts
    const posts = await fetchRedditData(symbol);
    
    // Analyze sentiment for each post
    const analyzedPosts = posts.map(post => {
      const fullText = `${post.title} ${post.selftext}`;
      const sentimentResult = analyzeFinancialSentiment(fullText, symbol);
      
      return {
        ...post,
        sentiment: sentimentResult,
        relevance_score: calculateRelevanceScore(post, symbol)
      };
    });
    
    // Calculate overall sentiment statistics
    const totalPosts = analyzedPosts.length;
    const bullishCount = analyzedPosts.filter(p => p.sentiment.label === 'Bullish').length;
    const bearishCount = analyzedPosts.filter(p => p.sentiment.label === 'Bearish').length;
    const neutralCount = analyzedPosts.filter(p => p.sentiment.label === 'Neutral').length;
    
    const averageScore = analyzedPosts.length > 0 
      ? analyzedPosts.reduce((sum, p) => sum + p.sentiment.score, 0) / analyzedPosts.length 
      : 0;
    
    const overallSentiment = averageScore > 1 ? 'Bullish' : averageScore < -1 ? 'Bearish' : 'Neutral';
    
    const result = {
      symbol: symbol.toUpperCase(),
      posts: analyzedPosts,
      total_posts: totalPosts,
      bullish_count: bullishCount,
      bearish_count: bearishCount,
      neutral_count: neutralCount,
      bullish_percentage: totalPosts > 0 ? Math.round((bullishCount / totalPosts) * 100) : 0,
      bearish_percentage: totalPosts > 0 ? Math.round((bearishCount / totalPosts) * 100) : 0,
      neutral_percentage: totalPosts > 0 ? Math.round((neutralCount / totalPosts) * 100) : 0,
      average_sentiment_score: Math.round(averageScore * 100) / 100,
      overall_sentiment: overallSentiment,
      confidence: totalPosts >= 10 ? 'High' : totalPosts >= 5 ? 'Medium' : 'Low'
    };
    
    // Cache the result
    redditCache.set(cacheKey, { data: result, timestamp: now });
    console.log(`Successfully fetched and cached Reddit data for symbol: ${symbol}`);
    
    return NextResponse.json(result);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching Reddit data for symbol ${symbol}:`, errorMessage);
    
    return NextResponse.json(
      { error: `Failed to fetch Reddit data: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Helper function to calculate relevance score
function calculateRelevanceScore(post: any, symbol: string): number {
  const symbolLower = symbol.toLowerCase();
  const title = post.title.toLowerCase();
  const text = post.selftext.toLowerCase();
  const fullText = `${title} ${text}`;
  
  let score = 0;
  
  // Check if it's a forex pair
  if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol)) {
    const baseCurrency = symbol.slice(0, 3).toLowerCase();
    const quoteCurrency = symbol.slice(3, 6).toLowerCase();
    
    // Forex-specific matching patterns with different weights
    const forexPatterns = [
      { pattern: symbolLower, weight: 8 }, // eurusd - highest weight
      { pattern: `${baseCurrency}/${quoteCurrency}`, weight: 7 }, // eur/usd
      { pattern: `${baseCurrency} ${quoteCurrency}`, weight: 6 }, // eur usd
      { pattern: `${baseCurrency}-${quoteCurrency}`, weight: 6 }, // eur-usd
      { pattern: `${baseCurrency}${quoteCurrency}`, weight: 5 }, // eurusd (lowercase)
      { pattern: baseCurrency, weight: 3 }, // eur
      { pattern: quoteCurrency, weight: 2 } // usd
    ];
    
    // Check title for forex patterns
    for (const { pattern, weight } of forexPatterns) {
      if (title.includes(pattern)) {
        score += weight;
        console.log(`Title match for "${pattern}" in: "${title.substring(0, 50)}..." (+${weight})`);
        break; // Only count the highest weight match
      }
    }
    
    // Check text for forex patterns (lower weight)
    for (const { pattern, weight } of forexPatterns) {
      if (text.includes(pattern)) {
        score += Math.ceil(weight / 2);
        console.log(`Text match for "${pattern}" in post text (+${Math.ceil(weight / 2)})`);
        break;
      }
    }
    
    // Forex-specific keywords boost
    const forexKeywords = [
      { keyword: 'forex', weight: 3 },
      { keyword: 'currency', weight: 2 },
      { keyword: 'pair', weight: 2 },
      { keyword: 'fx', weight: 2 },
      { keyword: 'exchange rate', weight: 2 },
      { keyword: 'central bank', weight: 1 },
      { keyword: 'fed', weight: 1 },
      { keyword: 'ecb', weight: 1 },
      { keyword: 'boe', weight: 1 },
      { keyword: 'hawkish', weight: 1 },
      { keyword: 'dovish', weight: 1 },
      { keyword: 'interest rate', weight: 1 },
      { keyword: 'monetary policy', weight: 1 }
    ];
    
    for (const { keyword, weight } of forexKeywords) {
      if (fullText.includes(keyword)) {
        score += weight;
        console.log(`Forex keyword "${keyword}" found (+${weight})`);
      }
    }
    
    // Penalize posts that are clearly about other topics
    const irrelevantKeywords = ['stock', 'equity', 'crypto', 'bitcoin', 'ethereum', 'nft'];
    for (const keyword of irrelevantKeywords) {
      if (fullText.includes(keyword) && !fullText.includes('forex') && !fullText.includes('currency')) {
        score -= 2;
        console.log(`Irrelevant keyword "${keyword}" found (-2)`);
      }
    }
    
  } else {
    // Stock/crypto symbol matching
    const stockPatterns = [
      { pattern: `$${symbolLower}`, weight: 5 },
      { pattern: symbolLower, weight: 4 },
      { pattern: symbol.toUpperCase(), weight: 4 }
    ];
    
    // Title mentions
    for (const { pattern, weight } of stockPatterns) {
      if (title.includes(pattern)) {
        score += weight;
        break;
      }
    }
    
    // Text mentions
    for (const { pattern, weight } of stockPatterns) {
      if (text.includes(pattern)) {
        score += Math.ceil(weight / 2);
        break;
      }
    }
  }
  
  // Post engagement scoring (same for all symbol types)
  const engagementScore = Math.min(post.score / 50, 3); // Max 3 points for score
  const commentScore = Math.min(post.num_comments / 25, 2); // Max 2 points for comments
  const ratioScore = post.upvote_ratio > 0.8 ? 1 : 0; // Bonus for highly upvoted posts
  
  score += engagementScore + commentScore + ratioScore;
  
  // Time decay (newer posts get slight bonus)
  const postAge = Date.now() / 1000 - post.created_utc;
  const daysSincePost = postAge / (24 * 60 * 60);
  const timeBonus = Math.max(0, 1 - daysSincePost / 7); // Bonus decreases over 7 days
  score += timeBonus;
  
  const finalScore = Math.round(score * 100) / 100;
  console.log(`Final relevance score for post "${title.substring(0, 30)}...": ${finalScore}`);
  
  return finalScore;
}