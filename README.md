# FinanceAI - AI-Powered Financial Analysis Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-46%2B%20Unit%20%7C%206%20E2E%20Suites-brightgreen)](https://github.com/RobinMillford/Ai-Finance)

> A production-ready financial analysis platform with AI-powered insights, real-time market data, portfolio management, and advanced search capabilities.

![FinanceAI Dashboard](public/Finance-Markets-Analysis.png)

![FinanceAI Architecture](public/Architecture.png)

## Overview

FinanceAI is a comprehensive financial analysis platform that combines real-time market data with AI-powered insights to help users make informed investment decisions. Built with modern web technologies and optimized for performance, accessibility, and user experience.

## Key Features

### Multi-Agent AI Advisors

- **LangGraph Architecture**: Orchestrator-Workers pattern with intelligent routing
- **3 Specialized Advisors**: Crypto, Forex, and Stock analysis
- **4-Agent Teams**: Supervisor, Technical Analyst, Sentiment Analyst, Market Researcher
- **Real-time Streaming**: Live agent status updates via SSE
- **Smart Routing**: 1-2 agents for simple queries, 2-3 for comprehensive analysis
- **Token Budget Trimming**: Dynamic message history based on token budget instead of a fixed count

### Multi-Market Analysis

- **Stocks**: Real-time stock data with technical indicators
- **Forex**: Currency pair analysis and trends
- **Crypto**: Cryptocurrency market tracking

### Portfolio Management

- Create and manage multiple portfolios
- Track holdings with real-time P&L calculations
- Portfolio analytics dashboard with interactive charts
- Export portfolio data (CSV/PDF)

### Watchlist System

- Track favorite assets across all markets
- Quick access to watched assets
- Statistics and performance tracking
- Export watchlist data

### Advanced Search

- Command palette (⌘K / Ctrl+K)
- Real-time fuzzy search across all markets
- Recent items tracking
- Keyboard-first navigation

### Data Visualizations

- Portfolio value over time (area charts)
- Asset allocation (pie charts)
- P&L breakdown (bar charts)
- Market heatmap (sector performance)
- Correlation matrix (diversification analysis)
- OHLC price charts with time ranges

### Modern UI/UX

- Responsive design with dark/light theme support
- Smooth animations with Framer Motion
- Accessible (WCAG AA compliant)

## Tech Stack

### Frontend

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Animations**: Framer Motion
- **Charts**: Recharts
- **State Management**: React Hooks, SWR

### Backend

- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: MongoDB Atlas
- **Authentication**: NextAuth.js v4
- **Multi-Agent AI**:
  - LangGraph (State Machine Orchestration)
  - LangChain (Tool Integration)
  - Groq (LLaMA 3.3 70B + LLaMA 3.1 8B)
- **Search & Intelligence**: Tavily API
- **Email**: Resend API (password reset)

### Data Sources

- **Market Data**: Twelve Data API (stocks, forex, crypto)
- **News**: NewsAPI
- **Community Sentiment**: Reddit API (15+ financial subreddits)
- **Market Intelligence**: Tavily Search API
- **Technical Indicators**: RSI, MACD, EMA, Bollinger Bands, ATR, ADX

### Development Tools

- **Testing**: Jest 30, React Testing Library, Playwright
- **E2E Testing**: Playwright (multi-browser + mobile)
- **Linting**: ESLint
- **Accessibility**: axe-core, eslint-plugin-jsx-a11y
- **Bundle Analysis**: @next/bundle-analyzer
- **CI/CD**: GitHub Actions
- **Security**: isomorphic-dompurify v3 (XSS prevention)

## Testing & Quality Assurance

### Test Coverage

- **Unit Tests**: Jest + React Testing Library
  - Rate limiter (18 tests)
  - AI utilities — `trimToTokenBudget`, `collectToolResults` (13 tests)
  - Graph factory — routing logic, supervisor cap, config contract (15 tests)
- **E2E Tests**: 6 test suites with Playwright
  - Homepage & navigation
  - Search functionality (Command Palette)
  - Portfolio management
  - Watchlist operations
  - Market data pages
  - Crypto routes
  - Multi-browser (Chrome, Firefox, Safari) + mobile (Pixel 5, iPhone 12)
- **CI/CD**: Automated testing on every push and PR
- **Coverage Threshold**: 50% enforced on branches, functions, lines, and statements
- **Code Coverage**: Codecov integration

### Security Features

- **Security Headers**: HSTS, CSP (nonce-based), X-Frame-Options, X-XSS-Protection, and more
- **Input Sanitization**: isomorphic-dompurify v3 — XSS prevention, HTML sanitization
- **Rate Limiting**: Shared in-memory rate limiter across all API routes
- **CSRF Protection**: NextAuth.js integration
- **Password Reset**: Transactional email via Resend API

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account (free tier available)
- API keys (see Environment Variables below)

### Installation

```bash
# Clone the repository
git clone https://github.com/RobinMillford/Ai-Finance.git
cd Ai-Finance

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server (Turbopack enabled)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Build for Production

```bash
# Create optimized production build
npm run build

# Start production server
npm start

# Analyze bundle size
npm run analyze
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values. All variables are documented in `.env.example`.

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# AI - Multi-Agent System (required)
NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key

# Market Data (required)
NEXT_PUBLIC_TWELVEDATA_API_KEY=your_twelve_data_key
NEXT_PUBLIC_TAVILY_API_KEY=your_tavily_api_key
NEXT_PUBLIC_NEWS_API_KEY=your_news_api_key

# Email — password reset (optional, logs to console if unset)
RESEND_API_KEY=your_resend_key

# Reddit — social sentiment (optional)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
```

### Getting API Keys

- **MongoDB**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Groq**: [Groq Cloud](https://console.groq.com/)
- **Twelve Data**: [Twelve Data](https://twelvedata.com/)
- **NewsAPI**: [NewsAPI](https://newsapi.org/)
- **Tavily**: [Tavily](https://tavily.com/)
- **Resend**: [Resend](https://resend.com/)
- **Reddit**: [Reddit Apps](https://www.reddit.com/prefs/apps)

## Project Structure

```
financeai/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── chat/                 # Crypto Multi-Agent API
│   │   ├── forex-chat/           # Forex Multi-Agent API
│   │   ├── stock-chat/           # Stock Multi-Agent API
│   │   ├── portfolio/            # Portfolio endpoints
│   │   ├── watchlist/            # Watchlist endpoints
│   │   ├── stocks/               # Stock data
│   │   ├── forex/                # Forex data
│   │   ├── cryptos/              # Crypto data
│   │   ├── reddit/               # Reddit sentiment
│   │   ├── news/                 # News aggregation
│   │   └── market-intelligence/  # Market intelligence
│   ├── cryptoadvisor/            # Crypto Multi-Agent UI
│   ├── forexadvisor/             # Forex Multi-Agent UI
│   ├── stockadvisor/             # Stock Multi-Agent UI
│   ├── portfolio/                # Portfolio pages
│   ├── watchlist/                # Watchlist pages
│   ├── stocks/                   # Stock analysis
│   ├── forexs/                   # Forex analysis
│   ├── cryptos/                  # Crypto analysis
│   ├── dashboard/                # Dashboard
│   └── layout.tsx                # Root layout
├── components/                   # React components
│   ├── ui/                       # UI components (shadcn)
│   └── charts/                   # Chart components
│       ├── TechnicalChart.tsx    # Shared recharts wrapper (memo)
│       ├── PortfolioAnalytics.tsx
│       ├── MarketHeatmap.tsx
│       ├── CorrelationMatrix.tsx
│       └── PriceChart.tsx
├── lib/                          # Utility functions
│   ├── ai/                       # Multi-Agent AI system
│   │   ├── config.ts             # LLM configuration (env-driven)
│   │   ├── graph-factory.ts      # Shared advisor graph factory
│   │   ├── utils.ts              # trimToTokenBudget, collectToolResults
│   │   ├── graph.ts              # Crypto advisor (thin wrapper)
│   │   ├── forex-graph.ts        # Forex advisor (thin wrapper)
│   │   ├── stock-graph.ts        # Stock advisor (thin wrapper)
│   │   ├── __tests__/            # Unit tests for AI utilities
│   │   └── tools/                # AI tools
│   │       ├── financial.ts      # Crypto price & indicators
│   │       ├── forex.ts          # Forex quotes & indicators
│   │       ├── stock.ts          # Stock quotes & indicators
│   │       ├── social.ts         # Reddit sentiment
│   │       └── search.ts         # Tavily search
│   ├── __tests__/                # Unit tests
│   ├── rate-limiter.ts           # Shared in-memory rate limiter
│   ├── email.ts                  # Resend transactional email
│   ├── market-intelligence.ts    # Market analysis (Tavily)
│   ├── mongodb.ts                # Database connection
│   ├── sanitize.ts               # DOMPurify XSS sanitization
│   └── export-utils.ts           # CSV/PDF export
├── models/                       # MongoDB models
│   ├── Portfolio.ts
│   ├── Watchlist.ts
│   └── User.ts
├── e2e/                          # Playwright E2E tests (6 suites)
├── middleware.ts                 # CSP nonces + auth middleware
├── .env.example                  # All env vars documented
└── next.config.js                # Next.js configuration
```

## Multi-Agent AI Architecture

**Orchestrator-Workers pattern** — one supervisor per domain coordinates three specialist workers:

```
User Query
    │
    ▼
Supervisor (LLaMA 3.3 70B)
    │   Analyzes query, picks agent(s), enforces 3-call cap
    ├──▶ TechnicalAnalyst (LLaMA 3.1 8B) — prices, indicators
    ├──▶ SentimentAnalyst (LLaMA 3.1 8B) — Reddit community mood
    └──▶ MarketResearcher  (LLaMA 3.1 8B) — news, events, macro
              │
              ▼
        finalResponse — synthesizes all collected data
```

**Three domain-specific advisors** share one `graph-factory.ts` — each provides only the prompts and tools that differ per domain:
- **Crypto Advisor** — cryptocurrency prices, social sentiment
- **Forex Advisor** — currency pair quotes, economic indicators
- **Stock Advisor** — US stock data, earnings, sector news

**Example workflows:**
- "What's AAPL price?" → TechnicalAnalyst → Response (1 agent)
- "Analyze TSLA" → TechnicalAnalyst + SentimentAnalyst → Response (2 agents)
- "BTC full outlook" → All 3 agents → Comprehensive Response

## Scripts

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm start            # Start production server
npm run analyze      # Build with bundle size report
npm test             # Run unit tests
npm run test:watch   # Unit tests in watch mode
npm run test:coverage # Unit tests with coverage report
npx playwright test  # Run E2E tests
npx playwright test --ui          # E2E in interactive UI mode
npx playwright test --project=chromium  # Single browser
npx playwright show-report        # View last E2E report
```

## Performance

- Code splitting and lazy loading
- `React.memo` and `useMemo` on all heavy chart components
- Turbopack for fast HMR in development
- Image optimization (WebP/AVIF)
- Server-side rendering where appropriate

## Accessibility

- WCAG AA compliant
- Keyboard navigation support
- Screen reader compatible
- ARIA labels and roles
- Semantic HTML
- Color contrast compliance

## Security

- Secure authentication with NextAuth.js
- Per-request CSP nonces (no `unsafe-inline`/`unsafe-eval` in production)
- Rate limiting on all API routes
- Input sanitization with isomorphic-dompurify v3
- CSRF protection via NextAuth.js
- Environment variable validation at startup

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:

- Code follows TypeScript and ESLint standards
- Tests pass (`npm test`)
- Accessibility guidelines are followed
- Documentation is updated

## Author

**Yamin Hossain**

- LinkedIn: [Yamin Hossain](https://www.linkedin.com/in/yamin-hossain-38a3b3263)
- GitHub: [@RobinMillford](https://github.com/RobinMillford)

## Acknowledgments

- [Next.js](https://nextjs.org/) — React framework
- [LangGraph](https://langchain.com/langgraph) — Multi-agent orchestration
- [LangChain](https://langchain.com/) — AI tool integration
- [Groq](https://groq.com/) — Ultra-fast LLM inference
- [shadcn/ui](https://ui.shadcn.com/) — UI components
- [Recharts](https://recharts.org/) — Chart library
- [Twelve Data](https://twelvedata.com/) — Market data
- [Tavily](https://tavily.com/) — AI-powered search
- [Resend](https://resend.com/) — Transactional email

## Roadmap

### Completed

- [x] Multi-Agent AI system (Crypto, Forex, Stock advisors)
- [x] Shared graph factory — single source for all 3 advisors
- [x] LangGraph orchestration with smart routing and 3-call cap
- [x] Real-time streaming with SSE
- [x] Token-budget message trimming (dynamic, env-configurable)
- [x] Portfolio management system
- [x] Watchlist functionality
- [x] Advanced search (Command Palette)
- [x] Data visualizations (5 chart types, all recharts)
- [x] Export functionality (CSV/PDF)
- [x] E2E testing with Playwright (6 suites, multi-browser + mobile)
- [x] Unit tests with 50% coverage threshold enforced
- [x] Security hardening (nonce-based CSP, DOMPurify v3, rate limiting)
- [x] Turbopack dev server
- [x] CI/CD pipeline with GitHub Actions (test → build → E2E → deploy)

### In Progress

- [ ] Real-time price updates via WebSocket
- [ ] Advanced technical indicators (Fibonacci, Ichimoku)
- [ ] Price alerts and notifications

### Planned

- [ ] Advanced backtesting with historical data
- [ ] Advanced portfolio analytics (Sharpe ratio, beta, alpha)
- [ ] Multi-language support
- [ ] Options & derivatives trading analysis

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.

---

**Built with Next.js and TypeScript**
