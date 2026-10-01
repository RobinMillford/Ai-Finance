/**
 * Reddit sentiment service (Phase 0 extraction).
 *
 * Extracted from the ~450-line /api/reddit monolith so the domain logic
 * (OAuth, retrieval, lexicon sentiment, relevance scoring) can be consumed
 * directly by AI tools in the future — without the self-HTTP hop — while the
 * HTTP route keeps its exact behavior and response shape.
 *
 * Phase 0 does NOT redesign the sentiment system; boundaries only:
 *   authenticate → fetchPosts → analyze (lexicon) → rank → aggregate
 */

import Sentiment from 'sentiment';

// ── Configuration ─────────────────────────────────────────────────────────────

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || '';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '';
const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT || 'FinanceAI-Bot/1.0 (by /u/National_Evidence548)';

const FINANCIAL_SUBREDDITS = [
  'investing', 'stocks', 'SecurityAnalysis', 'ValueInvesting', 'StockMarket',
  'cryptocurrency', 'CryptoCurrency', 'Bitcoin', 'ethereum', 'Forex',
  'forextrading', 'ForexStrategy', 'forex_trades', 'daytrading', 'SwingTrading',
  'FXTrading', 'currencytrading', 'Trading', 'options', 'wallstreetbets',
  'pennystocks', 'RobinhoodPennystocks',
];

const FOREX_SUBREDDITS = [
  'Forex', 'forextrading', 'ForexStrategy', 'forex_trades', 'FXTrading',
  'currencytrading', 'daytrading', 'SwingTrading', 'Trading', 'investing',
  'SecurityAnalysis',
];

const FINANCIAL_SENTIMENT_WORDS = {
  bullish: [
    'bullish', 'buy', 'long', 'moon', 'rocket', 'pump', 'surge', 'rally', 'breakout',
    'uptrend', 'bull run', 'hodl', 'diamond hands', 'to the moon', 'calls', 'green',
    'profit', 'gains', 'rising', 'growth', 'strong', 'positive', 'optimistic',
    'accumulate', 'undervalued', 'oversold', 'bounce', 'support', 'resistance broken',
    'strengthen', 'strengthening', 'hawkish', 'rate hike', 'dovish pivot', 'bullish outlook',
    'currency strength', 'positive fundamentals', 'favorable', 'upside potential',
    'bullish bias', 'long setup', 'buy zone', 'demand zone',
  ],
  bearish: [
    'bearish', 'sell', 'short', 'crash', 'dump', 'drop', 'fall', 'decline', 'red',
    'loss', 'losses', 'bear market', 'puts', 'negative', 'pessimistic', 'overvalued',
    'overbought', 'correction', 'pullback', 'breakdown', 'resistance', 'panic',
    'fear', 'bubble', 'trap', 'rug pull', 'scam', 'avoid', 'risky',
    'weaken', 'weakening', 'dovish', 'rate cut', 'hawkish pause', 'bearish outlook',
    'currency weakness', 'negative fundamentals', 'unfavorable', 'downside risk',
    'bearish bias', 'short setup', 'sell zone', 'supply zone', 'intervention',
  ],
};

// ── Sentiment analyzer setup (module singleton) ───────────────────────────────

const sentiment = new Sentiment();
const bullishWords: { [key: string]: number } = {};
FINANCIAL_SENTIMENT_WORDS.bullish.forEach((word) => (bullishWords[word] = 2));
const bearishWords: { [key: string]: number } = {};
FINANCIAL_SENTIMENT_WORDS.bearish.forEach((word) => (bearishWords[word] = -2));
sentiment.registerLanguage('en', { labels: { ...bullishWords, ...bearishWords } });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RedditPost {
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

export interface SentimentResult {
  label: 'Bullish' | 'Bearish' | 'Neutral';
  score: number;
  confidence: 'High' | 'Medium' | 'Low';
  words: { positive: string[]; negative: string[] };
}

// ── Sentiment analysis ────────────────────────────────────────────────────────

export function analyzeFinancialSentiment(text: string, symbol?: string): SentimentResult {
  const cleanText = text.toLowerCase();

  let contextualText = cleanText;
  if (symbol) {
    const symbolLower = symbol.toLowerCase();
    if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol)) {
      const baseCurrency = symbol.slice(0, 3).toLowerCase();
      const quoteCurrency = symbol.slice(3, 6).toLowerCase();
      const forexMatches = [
        symbolLower,
        `${baseCurrency}/${quoteCurrency}`,
        `${baseCurrency} ${quoteCurrency}`,
        baseCurrency,
        quoteCurrency,
      ];
      for (const pattern of forexMatches) {
        if (cleanText.includes(pattern)) {
          contextualText += ` ${pattern} ${pattern}`;
          break;
        }
      }
    } else if (cleanText.includes(symbolLower) || cleanText.includes(`$${symbolLower}`)) {
      contextualText += ` ${symbolLower} ${symbolLower}`;
    }
  }

  const result = sentiment.analyze(contextualText);
  let score = result.score;

  const bullishMatches = FINANCIAL_SENTIMENT_WORDS.bullish.filter((word) => cleanText.includes(word));
  const bearishMatches = FINANCIAL_SENTIMENT_WORDS.bearish.filter((word) => cleanText.includes(word));

  score += bullishMatches.length * 2;
  score -= bearishMatches.length * 2;

  let label: 'Bullish' | 'Bearish' | 'Neutral';
  if (score > 1) label = 'Bullish';
  else if (score < -1) label = 'Bearish';
  else label = 'Neutral';

  const totalMatches = bullishMatches.length + bearishMatches.length;
  const absScore = Math.abs(score);
  let confidence: 'High' | 'Medium' | 'Low';
  if (absScore >= 5 || totalMatches >= 3) confidence = 'High';
  else if (absScore >= 2 || totalMatches >= 1) confidence = 'Medium';
  else confidence = 'Low';

  return {
    label,
    score,
    confidence,
    words: { positive: bullishMatches, negative: bearishMatches },
  };
}

// ── Relevance scoring ─────────────────────────────────────────────────────────

export function calculateRelevanceScore(post: RedditPost, symbol: string): number {
  const symbolLower = symbol.toLowerCase();
  const title = post.title.toLowerCase();
  const text = post.selftext.toLowerCase();
  const fullText = `${title} ${text}`;

  let score = 0;

  if (symbol.length === 6 && /^[A-Z]{6}$/.test(symbol)) {
    const baseCurrency = symbol.slice(0, 3).toLowerCase();
    const quoteCurrency = symbol.slice(3, 6).toLowerCase();

    const forexPatterns = [
      { pattern: symbolLower, weight: 8 },
      { pattern: `${baseCurrency}/${quoteCurrency}`, weight: 7 },
      { pattern: `${baseCurrency} ${quoteCurrency}`, weight: 6 },
      { pattern: `${baseCurrency}-${quoteCurrency}`, weight: 6 },
      { pattern: `${baseCurrency}${quoteCurrency}`, weight: 5 },
      { pattern: baseCurrency, weight: 3 },
      { pattern: quoteCurrency, weight: 2 },
    ];

    for (const { pattern, weight } of forexPatterns) {
      if (title.includes(pattern)) {
        score += weight;
        break;
      }
    }
    for (const { pattern, weight } of forexPatterns) {
      if (text.includes(pattern)) {
        score += Math.ceil(weight / 2);
        break;
      }
    }

    const forexKeywords = [
      { keyword: 'forex', weight: 3 }, { keyword: 'currency', weight: 2 },
      { keyword: 'pair', weight: 2 }, { keyword: 'fx', weight: 2 },
      { keyword: 'exchange rate', weight: 2 }, { keyword: 'central bank', weight: 1 },
      { keyword: 'fed', weight: 1 }, { keyword: 'ecb', weight: 1 },
      { keyword: 'boe', weight: 1 }, { keyword: 'hawkish', weight: 1 },
      { keyword: 'dovish', weight: 1 }, { keyword: 'interest rate', weight: 1 },
      { keyword: 'monetary policy', weight: 1 },
    ];
    for (const { keyword, weight } of forexKeywords) {
      if (fullText.includes(keyword)) score += weight;
    }

    const irrelevantKeywords = ['stock', 'equity', 'crypto', 'bitcoin', 'ethereum', 'nft'];
    for (const keyword of irrelevantKeywords) {
      if (fullText.includes(keyword) && !fullText.includes('forex') && !fullText.includes('currency')) {
        score -= 2;
      }
    }
  } else {
    const stockPatterns = [
      { pattern: `$${symbolLower}`, weight: 5 },
      { pattern: symbolLower, weight: 4 },
      { pattern: symbol.toUpperCase(), weight: 4 },
    ];
    for (const { pattern, weight } of stockPatterns) {
      if (title.includes(pattern)) {
        score += weight;
        break;
      }
    }
    for (const { pattern, weight } of stockPatterns) {
      if (text.includes(pattern)) {
        score += Math.ceil(weight / 2);
        break;
      }
    }
  }

  const engagementScore = Math.min(post.score / 50, 3);
  const commentScore = Math.min(post.num_comments / 25, 2);
  const ratioScore = post.upvote_ratio > 0.8 ? 1 : 0;
  score += engagementScore + commentScore + ratioScore;

  const postAge = Date.now() / 1000 - post.created_utc;
  const daysSincePost = postAge / (24 * 60 * 60);
  const timeBonus = Math.max(0, 1 - daysSincePost / 7);
  score += timeBonus;

  return Math.round(score * 100) / 100;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

async function getRedditAccessToken(): Promise<string> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error('Reddit API credentials not configured');
  }
  const authString = `${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`;
  const authBuffer = Buffer.from(authString, 'utf-8');
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authBuffer.toString('base64')}`,
      'User-Agent': REDDIT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    throw new Error(`Failed to get Reddit access token: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.access_token;
}

function isForexSymbol(symbol: string): boolean {
  return symbol.length === 6 && /^[A-Z]{6}$/.test(symbol);
}

function buildSearchQueries(symbol: string): string[] {
  if (isForexSymbol(symbol)) {
    const baseCurrency = symbol.slice(0, 3);
    const quoteCurrency = symbol.slice(3, 6);
    return [
      symbol,
      `${baseCurrency}/${quoteCurrency}`,
      `${baseCurrency} ${quoteCurrency}`,
      `${baseCurrency}-${quoteCurrency}`,
      baseCurrency,
      quoteCurrency,
      `${baseCurrency.toLowerCase()}/${quoteCurrency.toLowerCase()}`,
      `forex ${baseCurrency}`,
      `currency ${baseCurrency}`,
      `${baseCurrency} pair`,
      `trading ${baseCurrency}`,
      `${baseCurrency} analysis`,
      `${quoteCurrency} strength`,
      `${baseCurrency} outlook`,
    ];
  }
  return [symbol, `$${symbol}`, symbol.toLowerCase(), `${symbol} stock`, `${symbol} analysis`];
}

/** Fetch recent Reddit posts mentioning a symbol. Never throws — returns []. */
export async function fetchRedditPosts(symbol: string): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];
  const searchQueries = buildSearchQueries(symbol);
  const targetSubreddits = isForexSymbol(symbol) ? FOREX_SUBREDDITS : [...FINANCIAL_SUBREDDITS];

  try {
    let accessToken = '';
    if (REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET) {
      try {
        accessToken = await getRedditAccessToken();
      } catch (authError) {
        console.error('[reddit] Auth failed, falling back to unauthenticated requests:', authError);
        accessToken = '';
      }
    }

    const subredditLimit = REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET ? 10 : 8;
    const queryLimit = REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET ? 4 : 3;
    const postLimit = REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET ? 15 : 10;
    const requestDelay = REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET ? 800 : 1000;
    const host = accessToken ? 'https://oauth.reddit.com' : 'https://www.reddit.com';

    for (const subreddit of targetSubreddits.slice(0, subredditLimit)) {
      for (const query of searchQueries.slice(0, queryLimit)) {
        try {
          const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=hot&limit=${postLimit}&t=week`
            .replace('https://www.reddit.com', host);

          const headers: Record<string, string> = { 'User-Agent': REDDIT_USER_AGENT };
          if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

          const response = await fetch(searchUrl, { headers });
          if (!response.ok) {
            console.warn(`[reddit] Failed to fetch from r/${subreddit}: ${response.status}`);
            continue;
          }

          const data = await response.json();
          if (data?.data?.children?.length > 0) {
            for (const child of data.data.children) {
              allPosts.push({
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
                upvote_ratio: child.data.upvote_ratio,
              });
            }
          }

          await new Promise((resolve) => setTimeout(resolve, requestDelay));
        } catch (error) {
          console.error(`[reddit] Error fetching from r/${subreddit}:`, error);
          continue;
        }
      }
    }

    // Dedupe + rank.
    const uniquePosts = Array.from(new Map(allPosts.map((p) => [p.id, p])).values());
    return uniquePosts
      .map((post) => ({ ...post, relevance: calculateRelevanceScore(post, symbol) }))
      .sort((a: any, b: any) => {
        if (Math.abs(a.relevance - b.relevance) > 0.5) return b.relevance - a.relevance;
        return b.score - a.score;
      })
      .slice(0, 25);
  } catch (error) {
    console.error('[reddit] Error fetching Reddit data:', error);
    return [];
  }
}

// ── Aggregate result (the shape /api/reddit returns today) ───────────────────

export interface RedditSentimentResult {
  symbol: string;
  posts: Array<RedditPost & { sentiment: SentimentResult; relevance_score: number }>;
  total_posts: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  bullish_percentage: number;
  bearish_percentage: number;
  neutral_percentage: number;
  average_sentiment_score: number;
  overall_sentiment: string;
  confidence: string;
}

/** Full pipeline: fetch + analyze + aggregate. Never throws. */
export async function getRedditSentiment(symbol: string): Promise<RedditSentimentResult> {
  const posts = await fetchRedditPosts(symbol);

  const analyzedPosts = posts.map((post) => ({
    ...post,
    sentiment: analyzeFinancialSentiment(`${post.title} ${post.selftext}`, symbol),
    relevance_score: calculateRelevanceScore(post, symbol),
  }));

  const totalPosts = analyzedPosts.length;
  const bullishCount = analyzedPosts.filter((p) => p.sentiment.label === 'Bullish').length;
  const bearishCount = analyzedPosts.filter((p) => p.sentiment.label === 'Bearish').length;
  const neutralCount = analyzedPosts.filter((p) => p.sentiment.label === 'Neutral').length;
  const averageScore =
    analyzedPosts.length > 0
      ? analyzedPosts.reduce((sum, p) => sum + p.sentiment.score, 0) / analyzedPosts.length
      : 0;
  const overallSentiment = averageScore > 1 ? 'Bullish' : averageScore < -1 ? 'Bearish' : 'Neutral';

  return {
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
    confidence: totalPosts >= 10 ? 'High' : totalPosts >= 5 ? 'Medium' : totalPosts > 0 ? 'Low' : 'None',
  };
}

/** Empty fallback result (preserves today's error behavior). */
export function emptySentimentResult(symbol: string): RedditSentimentResult {
  return {
    symbol: symbol.toUpperCase(),
    posts: [],
    total_posts: 0,
    bullish_count: 0,
    bearish_count: 0,
    neutral_count: 0,
    bullish_percentage: 0,
    bearish_percentage: 0,
    neutral_percentage: 0,
    average_sentiment_score: 0,
    overall_sentiment: 'Neutral',
    confidence: 'None',
  };
}
