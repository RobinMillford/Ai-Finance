/**
 * Normalized financial domain objects (Phase 1).
 *
 * The single schema-free contract shared by every market-data provider
 * adapter. Domain services, analytics, AI tools, and UI consume ONLY these
 * types — never raw provider payloads.
 *
 * Every object carries provenance (provider, asOf, retrievedAt) so the future
 * evidence/citation layer (Phase 2) can cite exact data origins.
 */

export type ProviderId = 'twelvedata' | 'eulerpool';

/** Freshness classes — shared with the Phase 0 cache layer. */
export type FreshnessClass = 'live' | 'delayed' | 'eod' | 'stale' | 'unknown';

/** Candle interval (normalized; only daily in Phase 1). */
export type CandleInterval = '1day';

/** Whether prices are split/dividend adjusted. */
export type AdjustmentMode = 'adjusted' | 'unadjusted' | 'unknown';

/** Normalized quote — current price snapshot for one symbol. */
export interface Quote {
  symbol: string;
  name?: string;
  exchange?: string;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  currency?: string;
  /** Provider data timestamp (ISO 8601, best effort). */
  asOf: string | null;
  /** When we fetched it (ISO 8601). */
  retrievedAt: string;
  provider: ProviderId;
  freshness: FreshnessClass;
}

/** Normalized OHLCV candle. */
export interface Candle {
  symbol: string;
  /** Candle timestamp (ISO 8601 date — daily bars). */
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  interval: CandleInterval;
  adjustmentMode: AdjustmentMode;
  currency?: string;
  provider: ProviderId;
}

/** Normalized company profile. */
export interface Company {
  symbol: string;
  name: string;
  exchange?: string;
  country?: string;
  sector?: string;
  industry?: string;
  currency?: string;
  /** External identifiers where the provider supplies them. */
  identifiers?: { isin?: string; cusip?: string };
  description?: string;
  website?: string;
  employees?: number | null;
  marketCap?: number | null;
  asOf: string | null;
  retrievedAt: string;
  provider: ProviderId;
}

/** A single normalized fundamental metric value. */
export interface FundamentalMetric {
  symbol: string;
  /** Machine name, e.g. `revenue`, `netIncome`, `ebit`. */
  metric: string;
  value: number | null;
  /** Display unit, e.g. `USD`, `ratio`, `percent`. */
  unit: string;
  currency?: string;
  /** Period end date covered by the value (ISO). */
  period: string | null;
  periodType: 'annual' | 'quarterly' | 'ttm' | 'unknown';
  /** Filing/report date where the provider supplies one. */
  reportDate?: string | null;
  asOf: string | null;
  retrievedAt: string;
  provider: ProviderId;
}

/** Which provider is canonical (primary) for a data class + asset class. */
export type DataClass =
  | 'quote'
  | 'candles'
  | 'company'
  | 'fundamentals'
  | 'valuation';
