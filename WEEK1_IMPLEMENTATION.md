# Week 1 Foundation - Implementation Guide

## ✅ Completed

### 1. TypeScript Strict Mode

- Already enabled in `tsconfig.json`
- `"strict": true` ensures type safety

### 2. Error Boundary Component

**File**: `components/ErrorBoundary.tsx`

- Catches React errors gracefully
- Shows user-friendly error UI
- Displays error details in development mode
- Includes retry and go home buttons
- Ready for Sentry integration

**Usage**:

```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>;
```

### 3. Loading Skeletons

**File**: `components/ui/loading-skeleton.tsx`

- `MarketCardSkeleton` - For stock/crypto/forex cards
- `ChartSkeleton` - For chart components
- `NewsCardSkeleton` - For news articles
- `TableRowSkeleton` - For table rows
- `StatCardSkeleton` - For dashboard stats
- `PageLoadingSkeleton` - Generic page loader

**Usage**:

```tsx
import { MarketCardSkeleton } from "@/components/ui/loading-skeleton";

{
  loading ? <MarketCardSkeleton /> : <MarketCard data={data} />;
}
```

### 4. API Client Utilities

**File**: `lib/api-client.ts`

- `fetchWithRetry()` - Fetch with automatic retries and timeout
- `apiGet()`, `apiPost()`, `apiPut()`, `apiDelete()` - HTTP method helpers
- `handleApiError()` - Consistent error handling
- `buildQueryString()` - Build URL query strings

**Features**:

- Automatic retry with exponential backoff
- Configurable timeout (default 30s)
- Proper error handling for 4xx and 5xx errors
- TypeScript generic support

**Usage**:

```tsx
import { apiGet } from "@/lib/api-client";

const { data, error } = await apiGet<StockData>("/api/stock?symbol=AAPL");
if (error) {
  console.error(error);
} else {
  console.log(data);
}
```

### 5. Rate Limiting

**File**: `lib/rate-limiter.ts`

- In-memory rate limiter (perfect for 100-500 users)
- Configurable limits per endpoint type
- Automatic cleanup of expired entries
- IP-based identification

**Configurations**:

- `API_DEFAULT`: 100 requests per 15 minutes
- `MARKET_DATA`: 60 requests per minute
- `AI_ENDPOINTS`: 20 requests per minute
- `NEWS`: 30 requests per minute
- `AUTH`: 5 requests per 15 minutes
- `REDDIT`: 10 requests per minute

### 6. API Middleware

**File**: `lib/api-middleware.ts`

- `withRateLimit()` - Apply rate limiting to API routes
- `errorResponse()` - Standardized error responses
- `successResponse()` - Standardized success responses
- `validateEnvVars()` - Validate environment variables
- `parseRequestBody()` - Parse and validate request body

**Usage in API Route**:

```tsx
import { withRateLimit, RATE_LIMITS } from "@/lib/api-middleware";

async function handler(request: Request) {
  // Your API logic
  return NextResponse.json({ data: "success" });
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
```

### 7. Global Error Boundary

**File**: `app/layout.tsx`

- Wrapped entire app with ErrorBoundary
- All errors will be caught and displayed gracefully

---

## 🔄 Next Steps

### Remaining Week 1 Tasks:

1. **Add Sentry Error Tracking** (Optional - requires free Sentry account)
2. **Apply Rate Limiting to Existing API Routes**
3. **Replace fetch calls with API client utilities**
4. **Add loading skeletons to existing pages**

### Quick Wins to Implement:

1. Update one API route to use rate limiting
2. Add loading skeleton to stocks page
3. Replace a fetch call with apiGet()

---

## 📖 How to Use These Improvements

### Example: Update an API Route with Rate Limiting

**Before** (`app/api/stocks/route.ts`):

```tsx
export async function GET(request: Request) {
  // API logic
}
```

**After**:

```tsx
import {
  withRateLimit,
  RATE_LIMITS,
  successResponse,
  errorResponse,
} from "@/lib/api-middleware";

async function handler(request: Request) {
  try {
    // Your API logic
    const data = await fetchStocks();
    return successResponse(data);
  } catch (error) {
    return errorResponse("Failed to fetch stocks", 500);
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.MARKET_DATA);
```

### Example: Add Loading State to Component

**Before**:

```tsx
export default function StocksPage() {
  const [stocks, setStocks] = useState([]);

  return (
    <div>
      {stocks.map((stock) => (
        <StockCard key={stock.id} stock={stock} />
      ))}
    </div>
  );
}
```

**After**:

```tsx
import { MarketCardSkeleton } from "@/components/ui/loading-skeleton";

export default function StocksPage() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  return (
    <div>
      {loading ? (
        <>
          <MarketCardSkeleton />
          <MarketCardSkeleton />
          <MarketCardSkeleton />
        </>
      ) : (
        stocks.map((stock) => <StockCard key={stock.id} stock={stock} />)
      )}
    </div>
  );
}
```

### Example: Use API Client

**Before**:

```tsx
const response = await fetch("/api/stock?symbol=AAPL");
const data = await response.json();
```

**After**:

```tsx
import { apiGet } from "@/lib/api-client";

const { data, error, status } = await apiGet<StockData>(
  "/api/stock?symbol=AAPL"
);
if (error) {
  toast({ title: "Error", description: error, variant: "destructive" });
  return;
}
// Use data
```

---

## 🎯 Benefits

✅ **Better Error Handling**: Graceful error recovery with user-friendly messages  
✅ **Improved Performance**: Loading skeletons improve perceived performance  
✅ **Rate Limiting**: Protects your API from abuse  
✅ **Code Reusability**: Centralized utilities reduce code duplication  
✅ **Type Safety**: Full TypeScript support  
✅ **Production Ready**: Professional error handling and monitoring

---

## 🚀 Ready for Week 2: Testing!

With these foundations in place, you're ready to add comprehensive testing in Week 2.
