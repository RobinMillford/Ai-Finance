# FinanceAI - AI-Powered Financial Analysis Platform

[![Next.js](https://img.shields.io/badge/Next.js-15.5.7-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-53%2B%20Passing-brightgreen)](https://github.com/yourusername/financeai)
[![Performance](https://img.shields.io/badge/Lighthouse-90+-brightgreen)](https://developers.google.com/web/tools/lighthouse)

> A production-ready financial analysis platform with AI-powered insights, real-time market data, portfolio management, and advanced search capabilities.

![FinanceAI Dashboard](https://via.placeholder.com/1200x600/1a1a2e/16a34a?text=FinanceAI+Dashboard)

## 🎯 Overview

FinanceAI is a comprehensive financial analysis platform that combines real-time market data with AI-powered insights to help users make informed investment decisions. Built with modern web technologies and optimized for performance, accessibility, and user experience.

## ✨ Key Features

### 📊 **Multi-Market Analysis**

- **Stocks**: Real-time stock data with technical indicators
- **Forex**: Currency pair analysis and trends
- **Crypto**: Cryptocurrency market tracking

### 💼 **Portfolio Management**

- Create and manage multiple portfolios
- Track holdings with real-time P&L calculations
- Portfolio analytics dashboard with interactive charts
- Export portfolio data (CSV/PDF)

### 👁️ **Watchlist System**

- Track favorite assets across all markets
- Quick access to watched assets
- Statistics and performance tracking
- Export watchlist data

### 🔍 **Advanced Search**

- Command palette (⌘K / Ctrl+K)
- Real-time fuzzy search across all markets
- Recent items tracking
- Keyboard-first navigation

### 📈 **Data Visualizations**

- Portfolio value over time (area charts)
- Asset allocation (pie charts)
- P&L breakdown (bar charts)
- Market heatmap (sector performance)
- Correlation matrix (diversification analysis)
- OHLC price charts with time ranges

### 🤖 **AI-Powered Insights**

- LLaMA 3 integration via Groq
- Market intelligence analysis
- Reddit sentiment analysis (15+ subreddits)
- News aggregation and analysis

### 🎨 **Modern UI/UX**

- Beautiful, responsive design
- Dark/Light theme support
- Smooth animations with Framer Motion
- Accessible (WCAG AA compliant)
- Progressive Web App (PWA)

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Animations**: Framer Motion
- **Charts**: Recharts, D3.js
- **State Management**: React Hooks, SWR

### Backend

- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: MongoDB Atlas
- **Authentication**: NextAuth.js
- **AI**: Groq (LLaMA 3), LangChain
- **Search**: Tavily API

### Data Sources

- **Market Data**: Twelve Data API
- **News**: NewsAPI
- **Community**: Reddit API
- **Search**: Tavily Search API

### Development Tools

- **Testing**: Jest, React Testing Library, Playwright
- **E2E Testing**: Playwright (multi-browser + mobile)
- **Linting**: ESLint, Prettier
- **Accessibility**: axe-core, eslint-plugin-jsx-a11y
- **Bundle Analysis**: @next/bundle-analyzer
- **CI/CD**: GitHub Actions
- **Security**: DOMPurify (XSS prevention)

## 🧪 Testing & Quality Assurance

### Comprehensive Test Coverage

- **Unit Tests**: 28 tests with Jest & React Testing Library
  - Rate limiter tests
  - API client tests
  - Utility function tests
- **E2E Tests**: 25+ tests with Playwright
  - Homepage & navigation
  - Search functionality (Command Palette)
  - Portfolio management
  - Watchlist operations
  - Market data pages
  - Multi-browser testing (Chrome, Firefox, Safari)
  - Mobile testing (Pixel 5, iPhone 12)
- **CI/CD**: Automated testing on every push/PR
- **Code Coverage**: Codecov integration

### Security Features

- **Security Headers**: 8 comprehensive headers
  - HSTS (Strict Transport Security)
  - CSP (Content Security Policy)
  - X-Frame-Options (Clickjacking prevention)
  - X-XSS-Protection
  - And more...
- **Input Sanitization**: DOMPurify integration
  - XSS prevention
  - HTML sanitization
  - URL validation
  - Email validation
  - Filename sanitization
- **Environment Validation**: Required variable checking
- **Rate Limiting**: API route protection
- **CSRF Protection**: NextAuth.js integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account (free tier)
- API keys (see Environment Variables)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/financeai.git
cd financeai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
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
ANALYZE=true npm run build
```

## 🔐 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Market Data
TWELVE_DATA_API_KEY=your_twelve_data_key

# News
NEWS_API_KEY=your_news_api_key

# AI
GROQ_API_KEY=your_groq_api_key

# Search
TAVILY_API_KEY=your_tavily_api_key

# Reddit (Optional)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
```

### Getting API Keys

- **MongoDB**: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Twelve Data**: [Twelve Data](https://twelvedata.com/)
- **NewsAPI**: [NewsAPI](https://newsapi.org/)
- **Groq**: [Groq Cloud](https://console.groq.com/)
- **Tavily**: [Tavily](https://tavily.com/)
- **Reddit**: [Reddit Apps](https://www.reddit.com/prefs/apps)

## 📁 Project Structure

```
financeai/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── portfolio/        # Portfolio endpoints
│   │   ├── watchlist/        # Watchlist endpoints
│   │   ├── stocks/           # Stock data
│   │   ├── forex/            # Forex data
│   │   └── cryptos/          # Crypto data
│   ├── portfolio/            # Portfolio pages
│   ├── watchlist/            # Watchlist pages
│   ├── stocks/               # Stock analysis
│   ├── forexs/               # Forex analysis
│   ├── cryptos/              # Crypto analysis
│   └── layout.tsx            # Root layout
├── components/               # React components
│   ├── ui/                   # UI components (shadcn)
│   ├── charts/               # Chart components
│   ├── CommandPalette.tsx    # Search command palette
│   ├── ExportButton.tsx      # Export functionality
│   └── ...
├── lib/                      # Utility functions
│   ├── export-utils.ts       # CSV/PDF export
│   ├── mongodb.ts            # Database connection
│   └── ...
├── models/                   # MongoDB models
│   ├── Portfolio.ts
│   ├── Watchlist.ts
│   └── User.ts
├── contexts/                 # React contexts
│   └── AuthContext.tsx
├── public/                   # Static assets
└── next.config.js            # Next.js configuration
```

## 🎨 Features in Detail

### Portfolio Management

Create and manage investment portfolios with:

- Add/remove holdings
- Real-time P&L tracking
- Performance analytics
- Asset allocation visualization
- Export to CSV/PDF

### Watchlist System

Track your favorite assets:

- Multi-market support (stocks, forex, crypto)
- Quick access from any page
- Performance statistics
- Export capabilities

### Advanced Search

Powerful search with:

- Keyboard shortcuts (⌘K / Ctrl+K)
- Fuzzy matching
- Recent searches
- Cross-market search

### Data Visualizations

Professional charts:

- Portfolio analytics dashboard
- Market heatmap
- Correlation matrix
- OHLC price charts
- Interactive tooltips

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run E2E tests
npx playwright test

# Run E2E tests in UI mode
npx playwright test --ui

# Run E2E tests on specific browser
npx playwright test --project=chromium

# View E2E test report
npx playwright show-report
```

### Test Coverage

- **Unit Tests**: 28 tests (Jest + React Testing Library)
- **E2E Tests**: 25+ tests (Playwright)
- **Total**: 53+ automated tests
- **Coverage**: 85%+ on tested modules

## 📊 Performance

- **Lighthouse Score**: 90+ (Production)
- **First Contentful Paint**: <0.5s
- **Largest Contentful Paint**: <2.5s
- **Time to Interactive**: <3s
- **Cumulative Layout Shift**: <0.1

### Optimizations Implemented

- Code splitting and lazy loading
- React.memo and useMemo for expensive operations
- Image optimization (WebP/AVIF)
- Bundle size optimization
- Server-side rendering where appropriate
- Edge caching for static assets

## ♿ Accessibility

- WCAG AA compliant
- Keyboard navigation support
- Screen reader compatible
- ARIA labels and roles
- Semantic HTML
- Color contrast compliance

## 🔒 Security

- Secure authentication with NextAuth.js
- Environment variable validation
- Rate limiting on API routes
- Input sanitization
- CSRF protection
- Security headers (HSTS, XFO, CSP)

## 📱 Progressive Web App

- Installable on desktop and mobile
- Offline support (coming soon)
- App-like experience
- Fast loading times

## 🤝 Contributing

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Yamin Hossain**

- LinkedIn: [Yamin Hossain](https://www.linkedin.com/in/yamin-hossain-38a3b3263)
- GitHub: [@RobinMillford](https://github.com/RobinMillford)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Recharts](https://recharts.org/) - Chart library
- [Twelve Data](https://twelvedata.com/) - Market data
- [Groq](https://groq.com/) - AI inference

## 📞 Support

For support, email yamin@example.com or open an issue on GitHub.

## 🗺️ Roadmap

### ✅ Completed

- [x] Portfolio management system
- [x] Watchlist functionality
- [x] Advanced search (Command Palette)
- [x] Data visualizations (5 chart types)
- [x] Export functionality (CSV/PDF)
- [x] E2E testing with Playwright
- [x] Security hardening
- [x] Performance optimization
- [x] CI/CD pipeline

### 🚧 In Progress

- [ ] Real-time price updates via WebSocket
- [ ] Advanced technical indicators
- [ ] Price alerts and notifications

### 📋 Planned

- [ ] Social trading features
- [ ] Mobile app (React Native)
- [ ] Advanced portfolio analytics
- [ ] Backtesting capabilities
- [ ] Multi-language support

---

**Built with ❤️ using Next.js and TypeScript**
