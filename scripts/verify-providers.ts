/**
 * FinanceAI Provider Verification (developer-only, §24).
 *
 * Live gate for Phase 1: proves the real Twelve Data + Eulerpool APIs work
 * through the REAL FinanceAI code path (registry → adapter → HTTP →
 * normalization → storage/consumer). No mocks, no fixtures — fault injection
 * happens ONLY at the network seam (globalThis.fetch) in the Fallback group,
 * with production semantics untouched.
 *
 *   npm run verify:providers        (append --json for machine-readable output)
 *
 * Rules enforced here:
 *  - reads credentials from the environment only; NEVER prints them
 *  - no secrets in logs, errors, or output (defense-in-depth redaction)
 *  - not part of application runtime; never runs on startup
 *  - exits non-zero on genuine integration failure
 *
 * Runtime notes (ts-node under CommonJS):
 *  - everything lives in main(); no top-level await (TS1378 under CJS)
 *  - `@/*` app modules are imported DYNAMICALLY inside main() so the .env
 *    parse and the tsconfig-paths register below run FIRST (a static import
 *    would be hoisted by CJS emit and require() before both)
 */

// ── env loading (dotenv is not a direct dependency) ─────────────────────────
import * as fs from 'fs';
import * as path from 'path';

function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadDotEnv(path.resolve(process.cwd(), '.env'));
loadDotEnv(path.resolve(process.cwd(), '.env.local'));

// Test-fast Twelve Data pacing (free-tier default is 7.6s between calls; this
// script makes ~12 TD calls). Set VERIFY_PRESERVE_TD_PACING=1 to keep
// production pacing — the run then takes ~2 extra minutes.
if (process.env.VERIFY_PRESERVE_TD_PACING !== '1') {
  process.env.TWELVEDATA_MIN_INTERVAL_MS = '0';
}

// ── path aliases (@/*) via tsconfig-paths, before ANY app module loads ──────
import { register } from 'tsconfig-paths';
import * as ts from 'typescript';

const tsconfig = ts.readConfigFile(path.resolve(process.cwd(), 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, process.cwd());
register({
  baseUrl: parsed.options.baseUrl ? path.resolve(process.cwd(), parsed.options.baseUrl) : process.cwd(),
  paths: (parsed.options.paths as Record<string, string[]>) ?? {},
});

// ── reporting scaffolding (no app imports needed at module scope) ───────────

const JSON_MODE = process.argv.includes('--json');
const results: {
  group: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail: string;
  meta?: Record<string, unknown>;
}[] = [];

function redact(text: string): string {
  const ep = process.env.EULERPOOL_API_KEY ?? '';
  const td = process.env.TWELVE_DATA_API_KEY ?? '';
  let out = text;
  if (ep && ep.length >= 8) out = out.split(ep).join('<redacted>');
  if (td && td.length >= 8) out = out.split(td).join('<redacted>');
  out = out.replace(/(token|apikey|api_key|access_token)=([^&\s"']+)/gi, '$1=<redacted>');
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer <redacted>');
  return out;
}

function record(
  group: string,
  name: string,
  status: 'PASS' | 'FAIL' | 'SKIP',
  detail: string,
  meta?: Record<string, unknown>
): void {
  results.push({ group, name, status, detail, meta });
  if (!JSON_MODE) {
    const mark = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '–';
    console.log(`  ${mark} ${name.padEnd(48)} ${status}${detail ? ` — ${detail}` : ''}`);
  }
}

async function step(
  group: string,
  name: string,
  fn: () => Promise<{ detail?: string; meta?: Record<string, unknown> } | void>
): Promise<boolean> {
  const started = Date.now();
  try {
    const out = (await fn()) ?? {};
    const latency = Date.now() - started;
    record(group, name, 'PASS', out.detail ? `${out.detail} (${latency}ms)` : `${latency}ms`, {
      latencyMs: latency,
      ...out.meta,
    });
    return true;
  } catch (error) {
    if (error instanceof SkipError) {
      record(group, name, 'SKIP', redact(error.message));
      return false;
    }
    const raw = error instanceof Error ? error.message : String(error);
    record(group, name, 'FAIL', redact(raw), { latencyMs: Date.now() - started });
    return false;
  }
}

const nowIso = () => new Date().toISOString();

/** Thrown by a step to mark itself SKIPPED (environment blocker, not a failure). */
class SkipError extends Error {}

// ═════════════════════════════════ MAIN ═════════════════════════════════════

async function main(): Promise<number> {
  // App modules load HERE (after .env + path registration above).
  const { env } = await import('@/lib/env');
  const {
    getQuoteFor,
    getCandlesFromProviders,
    getCompanyFor,
    providerHealth,
    ProviderError,
    clearQuoteCache,
  } = await import('@/lib/market-data/registry');
  const { getCandles } = await import('@/lib/market-data/candles');
  const { eulerpoolFetch, eulerpoolRateLimitState } = await import('@/lib/market-data/eulerpool');
  const { getQuote, getDailyHistory, getStockCatalog } = await import('@/lib/market-data/service');
  const { getIndicators } = await import('@/lib/market-data/indicators');
  const { valuePortfolio } = await import('@/lib/portfolio/valuation');
  const { correlationBetweenPrices } = await import('@/lib/analytics/engine');
  const Candle = (await import('@/models/Candle')).default;
  const mongooseMod = await import('mongoose');
  const mongoose = ((mongooseMod as any).default ?? mongooseMod) as typeof mongooseMod;

  const isFail = (e: unknown, kind: string) =>
    e instanceof ProviderError && e.kind === kind;

  console.log('\nFinanceAI Provider Verification');
  console.log('='.repeat(72));

  if (!env.eulerpool.apiKey) console.log('WARNING: EULERPOOL_API_KEY is not set — Eulerpool checks will fail.');
  if (!env.twelveData.apiKey) console.log('WARNING: TWELVE_DATA_API_KEY is not set — Twelve Data checks will fail.');

  // Cold-start every run: a previous run's cached quotes must not mask live
  // provider behavior in this one (deterministic, honest gate).
  clearQuoteCache();

  // ── Fault injection seam (Fallback group only) ────────────────────────────
  const realFetch = globalThis.fetch;
  const makeJson = (body: unknown, status = 200, headers: Record<string, string> = {}): any => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    json: async () => body,
  });
  const inject = (impl: (url: string) => Promise<any>) => {
    (globalThis as { fetch: unknown }).fetch = async (url: unknown) => impl(String(url));
  };
  const restore = () => {
    (globalThis as { fetch: unknown }).fetch = realFetch;
  };

  // ═════════════════════════════ EULERPOOL ══════════════════════════════════
  console.log('\nEulerpool');

  // 1) Raw endpoint + rate-limit headers — proves we reached the real service
  //    and captures the §13 metadata (headers are recorded, never secrets).
  await step('Eulerpool', 'Raw overview endpoint + rate-limit headers', async () => {
    const started = Date.now();
    const res = await eulerpoolFetch<any>('/equity/overview/AAPL', {}, { maxRetries: 0 });
    const latencyMs = Date.now() - started;
    const name = res?.name ?? res?.companyName;
    if (!res || typeof res !== 'object' || !name) {
      throw new Error(`overview payload has no name; keys=${Object.keys(res ?? {}).slice(0, 12).join(',')}`);
    }
    return {
      detail: `HTTP 200, name="${name}", latency=${latencyMs}ms`,
      meta: {
        rateLimitLimit: eulerpoolRateLimitState.limit,
        rateLimitRemaining: eulerpoolRateLimitState.remaining,
        rateLimitReset: eulerpoolRateLimitState.reset,
      },
    };
  });

  // 2) FinanceAI → registry → Eulerpool adapter → normalized Company.
  await step('Eulerpool', 'Company profile via registry (normalized)', async () => {
    const company = await getCompanyFor('AAPL');
    if (company.provider !== 'eulerpool') throw new Error(`expected provider=eulerpool, got ${company.provider}`);
    if (!company.name) throw new Error('normalized company has no name');
    if (company.asOf !== null && Number.isNaN(Date.parse(company.asOf))) {
      throw new Error(`normalized asOf invalid: ${String(company.asOf)}`);
    }
    return {
      detail: `provider=${company.provider}, name="${company.name}", asOf=${company.asOf}`,
      meta: { provider: company.provider, asOf: company.asOf, currency: company.currency ?? null },
    };
  });

  // 3) Quote — whichever provider the policy selects; identity + freshness must
  //    survive normalization (§11/§14). Also warms the quote cache for Case C.
  await step('Eulerpool', 'Quote normalization (policy-selected provider)', async () => {
    const quote = await getQuoteFor('AAPL');
    if (quote.provider !== 'twelvedata' && quote.provider !== 'eulerpool') {
      throw new Error(`unexpected provider ${quote.provider}`);
    }
    if (quote.price === null || !Number.isFinite(quote.price) || quote.price <= 0) {
      throw new Error(`quote price invalid: ${String(quote.price)}`);
    }
    if (Number.isNaN(Date.parse(quote.retrievedAt))) throw new Error('retrievedAt unparsable');
    if (!['live', 'delayed', 'eod', 'stale', 'unknown'].includes(quote.freshness)) {
      throw new Error(`invalid freshness class: ${quote.freshness}`);
    }
    return {
      detail: `provider=${quote.provider}, price=${quote.price}, asOf=${quote.asOf}, freshness=${quote.freshness}`,
      meta: {
        provider: quote.provider,
        price: quote.price,
        asOf: quote.asOf,
        freshness: quote.freshness,
        currency: quote.currency ?? null,
      },
    };
  });

  // 4) Historical candles via the registry (Eulerpool canonical for equity).
  await step('Eulerpool', 'Candles via registry (canonical policy)', async () => {
    const candles = await getCandlesFromProviders('AAPL', { outputsize: 30 });
    if (!Array.isArray(candles) || !candles.length) throw new Error('no candles returned');
    const provider = candles[0].provider;
    if (provider !== 'eulerpool') throw new Error(`expected provider=eulerpool, got ${provider}`);
    for (const c of candles) {
      if (!Number.isFinite(c.open) || !Number.isFinite(c.close) || c.close <= 0) {
        throw new Error(`candle ${c.timestamp} has non-finite close ${String(c.close)}`);
      }
      if (Number.isNaN(Date.parse(c.timestamp))) throw new Error(`bad timestamp ${c.timestamp}`);
    }
    return {
      detail: `${candles.length} OHLC candles, provider=${provider}, latest close=${candles[candles.length - 1].close}`,
      meta: { provider, count: candles.length },
    };
  });

  // 5) Fundamentals via the Eulerpool adapter (§7).
  await step('Eulerpool', 'Income statement via adapter', async () => {
    const { eulerpoolGetIncomeStatement } = await import('@/lib/market-data/eulerpool');
    const metrics = await eulerpoolGetIncomeStatement('AAPL', nowIso());
    if (!metrics.length) throw new Error('no fundamental metrics normalized from income statement');
    const bad = metrics.filter((m) => m.value !== null && !Number.isFinite(m.value));
    if (bad.length) throw new Error(`${bad.length} non-finite metric values`);
    return {
      detail: `${metrics.length} metrics, e.g. ${metrics[0].metric}=${metrics[0].value} ${metrics[0].unit} (${metrics[0].periodType}), provider=${metrics[0].provider}`,
      meta: { provider: metrics[0].provider, count: metrics.length },
    };
  });

  // ═══════════════════════════ FALLBACK (§10/§12) ═══════════════════════════
  // Deliberately runs EARLY: the live fallback proof needs Eulerpool quota
  // headroom (the free tier's per-minute window is exhausted by long runs).
  console.log('\nFallback');
  await new Promise((r) => setTimeout(r, 15_000)); // let the EP per-minute window breathe

  await step('Fallback', 'Case A/B: TD primary fails → Eulerpool serves quote', async () => {
    const fbBefore = providerHealth.twelvedata.fallbacksUsed;
    inject(async (url) =>
      url.includes('twelvedata.com')
        ? makeJson({ code: 500, message: 'internal error', status: 'error' }, 500)
        : realFetch(url as any)
    );
    try {
      const quote = await getQuoteFor('AAPL');
      if (quote.provider !== 'eulerpool') throw new Error(`fallback served provider=${quote.provider}`);
      if (quote.price === null || quote.price <= 0) throw new Error('fallback price invalid');
      const fbDelta = providerHealth.twelvedata.fallbacksUsed - fbBefore;
      return {
        detail: `provider=${quote.provider}, price=${quote.price} (registry fallbacksUsed Δ=${fbDelta})`,
        meta: { provider: quote.provider, fallbacksUsedDelta: fbDelta },
      };
    } finally {
      restore();
    }
  });

  await step('Fallback', 'Case D: invalid symbol → honest not-found (never price 0)', async () => {
    try {
      await getQuoteFor('ZZINVALIDZZ');
      throw new Error('expected ProviderError for invalid symbol');
    } catch (e) {
      if (isFail(e, 'bad_symbol') || isFail(e, 'not_found')) {
        return { detail: `kind=${e instanceof ProviderError ? e.kind : 'unknown'}` };
      }
      throw e;
    }
  });

  await step('Fallback', 'Case C: both fail → stale cache (labeled) or honest error', async () => {
    inject(async (url) =>
      url.includes('twelvedata.com') || url.includes('eulerpool.com')
        ? makeJson({ code: 500, message: 'internal error', status: 'error' }, 500)
        : realFetch(url as any)
    );
    try {
      try {
        const quote = await getQuoteFor('AAPL'); // cached by an earlier step
        if (quote.freshness !== 'stale') {
          throw new Error(`expected freshness=stale, got ${quote.freshness}`);
        }
        return { detail: 'stale cache served, explicitly labeled stale' };
      } catch (e) {
        if (e instanceof ProviderError) return { detail: `honest failure: ${e.kind}` };
        throw e;
      }
    } finally {
      restore();
    }
  });

  await step('Fallback', '429 → rate_limited mapping, bounded retry (§12)', async () => {
    let tdCalls = 0;
    inject(async (url) => {
      if (url.includes('twelvedata.com')) {
        tdCalls += 1;
        return makeJson({ code: 429, message: 'rate limit', status: 'error' }, 429, {
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        });
      }
      return realFetch(url as any);
    });
    const started = Date.now();
    try {
      const quote = await getQuoteFor('AMD'); // not cached yet → primary exercised
      if (quote.provider === 'twelvedata') throw new Error('TD answered despite injected 429');
      return { detail: `TD 429 → fell back to ${quote.provider} (tdCalls=${tdCalls})` };
    } catch (e) {
      if (isFail(e, 'rate_limited')) {
        const elapsed = Date.now() - started;
        // Budget guard, not a semantics test: TD's own policy is ≤2 retries at
        // 10s/20s backoff, so an honest bounded path can take up to ~30s.
        if (elapsed > 40_000) throw new Error(`429 handling took ${elapsed}ms — possible retry loop`);
        return { detail: `mapped to rate_limited in ${elapsed}ms (no infinite retry)` };
      }
      throw e;
    } finally {
      restore();
    }
  });

  // ═══════════════════════════ TWELVE DATA ══════════════════════════════════
  console.log('\nTwelve Data');

  await step('Twelve Data', 'Equity quote', async () => {
    const quote = await getQuote('AAPL');
    if (!quote.price || quote.price <= 0) throw new Error(`invalid price ${String(quote.price)}`);
    return { detail: `price=${quote.price}`, meta: { symbol: 'AAPL', price: quote.price } };
  });

  await step('Twelve Data', 'Historical time series', async () => {
    const rows = await getDailyHistory('AAPL', 30);
    if (!rows.length) throw new Error('empty history');
    return { detail: `${rows.length} rows` };
  });

  await step('Twelve Data', 'Technical indicators (RSI + EMA20)', async () => {
    const agg = await getIndicators('AAPL', ['rsi', 'ema20']);
    if (!agg.indicators.rsi && !agg.indicators.ema20) {
      throw new Error(`all indicators failed: ${JSON.stringify(agg.errors).slice(0, 120)}`);
    }
    return {
      detail: `rsi=${agg.indicators.rsi ? 'present' : 'failed'} ema20=${agg.indicators.ema20 ? 'present' : 'failed'} complete=${agg.complete}`,
      meta: { errors: Object.keys(agg.errors) },
    };
  });

  await step('Twelve Data', 'Crypto path (BTC/USD)', async () => {
    const quote = await getQuote('BTC/USD');
    if (!quote.price || quote.price <= 0) throw new Error(`invalid BTC/USD price ${String(quote.price)}`);
    return { detail: `price=${quote.price}` };
  });

  await step('Twelve Data', 'Catalog', async () => {
    const catalog = await getStockCatalog();
    if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('empty catalog');
    return { detail: `${catalog.length} symbols` };
  });

  // ═══════════════════════ REGISTRY / ROUTING ═══════════════════════════════
  console.log('\nFinanceAI Registry');

  await step('Registry', 'Routing policy (quote=TD, candles/company=EP)', async () => {
    const quote = await getQuoteFor('MSFT');
    const candleRows = await getCandlesFromProviders('MSFT', { outputsize: 5 });
    const company = await getCompanyFor('MSFT');
    if (quote.provider !== 'twelvedata') throw new Error(`quote routed to ${quote.provider}, expected twelvedata`);
    if (candleRows[0].provider !== 'eulerpool') throw new Error(`candles routed to ${candleRows[0].provider}, expected eulerpool`);
    if (company.provider !== 'eulerpool') throw new Error(`company routed to ${company.provider}, expected eulerpool`);
    return {
      detail: `quote→${quote.provider}, candles→${candleRows[0].provider}, company→${company.provider}`,
      meta: { quoteProvider: quote.provider, candleProvider: candleRows[0].provider, companyProvider: company.provider },
    };
  });

  await step('Registry', 'Crypto quote routed to Twelve Data', async () => {
    const quote = await getQuoteFor('BTC/USD');
    if (quote.provider !== 'twelvedata') throw new Error(`crypto quote routed to ${quote.provider}, expected twelvedata`);
    return { detail: `BTC/USD price=${quote.price} provider=${quote.provider}` };
  });

  await step('Registry', 'Normalization preserves provenance', async () => {
    const company = await getCompanyFor('NVDA');
    if (company.provider !== 'eulerpool') throw new Error(`company provider=${company.provider}`);
    if (company.asOf !== null && Number.isNaN(Date.parse(company.asOf))) {
      throw new Error('asOf neither ISO string nor null');
    }
    if (!company.retrievedAt || Number.isNaN(Date.parse(company.retrievedAt))) throw new Error('retrievedAt missing');
    return { detail: `provider=${company.provider}, retrievedAt=${company.retrievedAt}` };
  });

  await step('Registry', 'Freshness derived from provider timestamp (§14)', async () => {
    const quote = await getQuoteFor('NVDA');
    if (!['live', 'delayed', 'eod', 'stale', 'unknown'].includes(quote.freshness)) {
      throw new Error(`invalid freshness class ${quote.freshness}`);
    }
    // asOf must be the PROVIDER timestamp (or null), never fabricated from Date.now().
    if (quote.asOf && Date.parse(quote.asOf) > Date.now() + 60_000) {
      throw new Error(`asOf is in the future — not a provider timestamp: ${quote.asOf}`);
    }
    return { detail: `freshness=${quote.freshness} (asOf=${quote.asOf})` };
  });

  // ═════════════════ CANDLE PERSISTENCE (Mongo + real data, §15) ════════════
  console.log('\nCandle Persistence');

  let mongoReady = false;
  await step('Persistence', 'Mongo connect', async () => {
    if (!env.mongodb.uri) throw new Error('MONGODB_URI not set');
    try {
      // `as any` on options: mongoose ConnectOptions type drift under ts-node.
      await mongoose.connect(env.mongodb.uri, { serverSelectionTimeoutMS: 10_000 } as any);
      mongoReady = true;
      return { detail: 'connected' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `MongoDB unreachable: ${redact(reason)} — infrastructure/environment blocker, NOT a code-path failure. ` +
        'Re-run this gate once MONGODB_URI points to a reachable cluster.'
      );
    }
  });

  await step('Persistence', 'Candles stored from live provider', async () => {
    if (!mongoReady) throw new SkipError('MongoDB unreachable — persistence gate cannot run');
    await Candle.deleteMany({ symbol: 'AAPL' }).catch(() => null); // clean slate
    const { candles, provider, source } = await getCandles('AAPL', 'stock', { days: 45 });
    if (!candles.length) throw new Error('no candles after live fetch');
    const stored = await Candle.countDocuments({ symbol: 'AAPL', interval: '1day' });
    if (stored === 0) throw new Error('provider data did not persist');
    const sample = (await Candle.findOne({ symbol: 'AAPL' }).lean()) as any;
    // Provenance is persisted in `sourceProvider` (models/Candle.ts, §13).
    if (sample.sourceProvider !== 'eulerpool' && sample.sourceProvider !== 'twelvedata') {
      throw new Error(`stored provenance invalid: ${String(sample.sourceProvider)}`);
    }
    return {
      detail: `source=${source}, provider=${provider}, ${stored} docs, sample close=${sample.close} prov=${sample.sourceProvider}`,
      meta: { provider, stored, source },
    };
  });

  await step('Persistence', 'Second read served from storage (coverage policy)', async () => {
    if (!mongoReady) throw new SkipError('MongoDB unreachable — persistence gate cannot run');
    const before = providerHealth.eulerpool.success;
    const { source } = await getCandles('AAPL', 'stock', { days: 45 });
    const after = providerHealth.eulerpool.success;
    if (source !== 'storage') throw new Error(`second read source=${source}, expected storage`);
    if (before !== after) throw new Error(`provider was hit on a storage read (${before}→${after})`);
    return { detail: `source=storage, EP success calls unchanged (${before}→${after})` };
  });

  // ═══════════════════ PORTFOLIO VALUATION (real quotes, §16) ═══════════════
  console.log('\nPortfolio');

  await step('Portfolio', 'Real valuation (currentPrice ≠ purchasePrice)', async () => {
    const valuation = await valuePortfolio([
      { symbol: 'AAPL', assetType: 'stock', quantity: 10, purchasePrice: 100 },
    ]);
    const h = valuation.holdings[0];
    if (h.currentPrice === null) throw new Error('no current price from provider');
    if (h.currentPrice === 100) {
      throw new Error('suspicious: currentPrice equals the controlled test basis exactly');
    }
    const expectedMv = 10 * h.currentPrice;
    if (Math.abs(h.marketValue! - expectedMv) > 0.01) throw new Error(`marketValue ${h.marketValue} ≠ 10×${h.currentPrice}`);
    const expectedPl = expectedMv - 1000;
    if (Math.abs(h.unrealizedPL! - expectedPl) > 0.01) throw new Error(`P&L ${h.unrealizedPL} ≠ ${expectedPl}`);
    return {
      detail: `currentPrice=${h.currentPrice} (${h.provider}, ${h.freshness}), marketValue=${h.marketValue?.toFixed(2)}, costBasis=1000, P&L=${h.unrealizedPL?.toFixed(2)}`,
      meta: { provider: h.provider, currentPrice: h.currentPrice, unrealizedPL: h.unrealizedPL },
    };
  });

  // ═══════════════════════ ANALYTICS (real stored candles, §17) ═════════════
  console.log('\nAnalytics');

  await step('Analytics', 'Deterministic real correlation AAPL/MSFT', async () => {
    // Real data through the storage path when available; otherwise live
    // provider candles (the ENGINE under test is pure — same input, same
    // output — and the storage read is gated separately above).
    const a = mongoReady
      ? await getCandles('AAPL', 'stock', { days: 180 })
      : { candles: await getCandlesFromProviders('AAPL', { range: '6m' }) };
    const b = mongoReady
      ? await getCandles('MSFT', 'stock', { days: 180 })
      : { candles: await getCandlesFromProviders('MSFT', { range: '6m' }) };
    const sourceLabel = mongoReady ? 'stored candles' : 'live provider candles (Mongo blocked)';
    if (a.candles.length < 25 || b.candles.length < 25) {
      throw new Error(`insufficient candles: AAPL=${a.candles.length} MSFT=${b.candles.length}`);
    }
    const toPoints = (cs: { timestamp: string; close: number }[]) =>
      cs.map((c) => ({ timestamp: c.timestamp, price: c.close }));
    const r1 = correlationBetweenPrices(toPoints(a.candles), toPoints(b.candles));
    const r2 = correlationBetweenPrices(toPoints(a.candles), toPoints(b.candles));
    if (r1.correlation === null) throw new Error('correlation unavailable despite sufficient real data');
    if (r1.correlation !== r2.correlation) throw new Error('non-deterministic output for identical input');
    if (Math.abs(r1.correlation) > 1) throw new Error('correlation out of range');
    return {
      detail: `r=${r1.correlation.toFixed(4)} over ${r1.observations} shared observations (${sourceLabel}; returns-based, deterministic)`,
      meta: { correlation: r1.correlation, observations: r1.observations, dataSource: sourceLabel },
    };
  });

  // ══════════════════════════════ SUMMARY (§25) ═════════════════════════════
  console.log('='.repeat(72));
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  console.log(`Result: ${pass} PASS, ${fail} FAIL${skipped ? `, ${skipped} SKIP (environment blocker)` : ''}`);

  // §5 — the report must state WHO served the data, not just "request succeeded".
  try {
    const finalQuote = await getQuoteFor('AAPL');
    console.log(
      `Provider used (latest quote): ${finalQuote.provider} (freshness=${finalQuote.freshness}, asOf=${finalQuote.asOf})`
    );
    console.log(
      `Provider health: TD {success=${providerHealth.twelvedata.success}, fallbacks=${providerHealth.twelvedata.fallbacksUsed}} EP {success=${providerHealth.eulerpool.success}, fallbacks=${providerHealth.eulerpool.fallbacksUsed}}`
    );
  } catch {
    console.log('Provider used (latest quote): unavailable');
  }

  // §13 metadata: the headers the real API actually sent (no secrets).
  console.log(
    `Eulerpool rate-limit headers (last captured): limit=${eulerpoolRateLimitState.limit}, remaining=${eulerpoolRateLimitState.remaining}, reset=${eulerpoolRateLimitState.reset}`
  );

  if (mongoose.connection.readyState === 1) await mongoose.disconnect();

  if (JSON_MODE) {
    console.log(`__VERIFY_RESULTS__${JSON.stringify(results)}`);
  }
  return fail;
}

main()
  .then((fail) => process.exit(fail > 0 ? 1 : 0))
  .catch((error) => {
    console.error(redact(error instanceof Error ? error.stack ?? error.message : String(error)));
    process.exit(2);
  });
