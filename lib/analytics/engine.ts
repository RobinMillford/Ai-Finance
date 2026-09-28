/**
 * Deterministic analytics engine (Phase 1, §17/§18).
 *
 * PURE functions over normalized data — no provider calls, no I/O, no LLM,
 * no placeholders. Same input → same output, always.
 *
 * Input: aligned price series (from stored candles via lib/market-data/candles)
 * Output: typed metrics. `null` means genuinely unavailable (insufficient
 * data, constant series) — never zero, never a guess (§18/§32).
 */

/** One aligned observation: a timestamp plus prices for each series. */
export interface PricePoint {
  timestamp: string; // ISO
  price: number;
}

export interface ReturnSeries {
  /** Timestamps of each return observation (date the return realized). */
  timestamps: string[];
  /** Periodic returns (simple), same length as timestamps. */
  returns: number[];
}

export interface RiskReturnMetrics {
  meanReturn: number | null;
  volatility: number | null;
  cagr: number | null;
  maxDrawdown: number | null;
  observations: number;
}

export interface CovarianceResult {
  covariance: number | null;
  correlation: number | null;
  observations: number;
}

// ── Series helpers ───────────────────────────────────────────────────────────

/**
 * Sort by timestamp and drop invalid points (non-finite prices).
 * Does NOT interpolate or fill missing data (§18: no invention).
 */
export function sanitizeSeries(points: PricePoint[]): PricePoint[] {
  return points
    .filter((p) => Number.isFinite(p.price) && p.price > 0 && !Number.isNaN(Date.parse(p.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

/**
 * Simple periodic returns from a price series.
 * First return is from points[0] → points[1]. Requires ≥2 valid points.
 */
export function computeReturns(points: PricePoint[]): ReturnSeries | null {
  const clean = sanitizeSeries(points);
  if (clean.length < 2) return null;
  const timestamps: string[] = [];
  const returns: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    const prev = clean[i - 1].price;
    if (prev === 0) continue; // degenerate — skip rather than divide by zero
    timestamps.push(clean[i].timestamp);
    returns.push((clean[i].price - prev) / prev);
  }
  if (returns.length === 0) return null;
  return { timestamps, returns };
}

/**
 * Align two price series on shared timestamps (inner join).
 * Handles missing dates and differing calendars (§18): only dates present in
 * BOTH series are used. Returns sanitized series.
 */
export function alignSeries(a: PricePoint[], b: PricePoint[]): { a: PricePoint[]; b: PricePoint[] } {
  const cleanA = sanitizeSeries(a);
  const cleanB = sanitizeSeries(b);
  const mapB = new Map(cleanB.map((p) => [p.timestamp, p.price]));
  const alignedA: PricePoint[] = [];
  const alignedB: PricePoint[] = [];
  for (const p of cleanA) {
    const priceB = mapB.get(p.timestamp);
    if (priceB !== undefined) {
      alignedA.push({ timestamp: p.timestamp, price: p.price });
      alignedB.push({ timestamp: p.timestamp, price: priceB });
    }
  }
  return { a: alignedA, b: alignedB };
}

// ── Core metrics ─────────────────────────────────────────────────────────────

/** Arithmetic mean of a numeric array; null for empty input. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Sample covariance of two equal-length arrays; null if <2 pairs. */
export function covariance(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let acc = 0;
  for (let i = 0; i < xs.length; i++) acc += (xs[i] - mx) * (ys[i] - my);
  return acc / (xs.length - 1);
}

/**
 * Pearson correlation of two return series. Returns null when either series
 * is constant (zero variance) or too short — `0` would be a lie (§18).
 */
export function correlation(xs: number[], ys: number[], minObservations = 20): number | null {
  if (xs.length !== ys.length || xs.length < minObservations) return null;
  const varX = covariance(xs, xs);
  const varY = covariance(ys, ys);
  if (varX === null || varY === null || varX === 0 || varY === 0) return null;
  const cov = covariance(xs, ys);
  if (cov === null) return null;
  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return null;
  const r = cov / denom;
  // Clamp floating-point drift into [-1, 1].
  return Math.max(-1, Math.min(1, r));
}

/**
 * Risk/return metrics from a price series (daily observations by default).
 * - volatility: annualized sample stdev of daily returns (√252).
 * - cagr: annualized geometric growth over the series' time span.
 * - maxDrawdown: peak-to-trough decline as a positive fraction.
 */
export function riskReturnMetrics(
  points: PricePoint[],
  opts: { periodsPerYear?: number; minObservations?: number } = {}
): RiskReturnMetrics {
  const { periodsPerYear = 252, minObservations = 20 } = opts;
  const series = computeReturns(points);
  const observations = series?.returns.length ?? 0;

  if (!series || observations < minObservations) {
    return { meanReturn: null, volatility: null, cagr: null, maxDrawdown: null, observations };
  }

  const { returns, timestamps } = series;
  const m = mean(returns)!;
  const varP = covariance(returns, returns);
  const volatility = varP !== null && varP > 0 ? Math.sqrt(varP * periodsPerYear) : null;

  // CAGR over the actual span of the series (first price → last price).
  const clean = sanitizeSeries(points);
  const startPrice = clean[0].price;
  const endPrice = clean[clean.length - 1].price;
  const years = Math.max(
    (Date.parse(clean[clean.length - 1].timestamp) - Date.parse(clean[0].timestamp)) /
      (365.25 * 24 * 60 * 60 * 1000),
    0
  );
  const cagr =
    startPrice > 0 && endPrice > 0 && years > 0 ? Math.pow(endPrice / startPrice, 1 / years) - 1 : null;

  // Max drawdown over the price series (peak-to-trough, positive fraction).
  let peak = clean[0].price;
  let maxDrawdown = 0;
  for (const p of clean) {
    if (p.price > peak) peak = p.price;
    const dd = (peak - p.price) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return { meanReturn: m, volatility, cagr, maxDrawdown, observations };
}

/**
 * Correlation between two price series:
 * candles → aligned series → synchronized returns → Pearson r.
 * Returns null when alignment yields too few shared observations or a
 * constant series (§18: insufficient data → unavailable).
 */
export function correlationBetweenPrices(
  seriesA: PricePoint[],
  seriesB: PricePoint[],
  minObservations = 20
): CovarianceResult {
  const { a, b } = alignSeries(seriesA, seriesB);
  const retsA = computeReturns(a);
  const retsB = computeReturns(b);
  if (!retsA || !retsB) return { covariance: null, correlation: null, observations: 0 };
  const obs = Math.min(retsA.returns.length, retsB.returns.length);
  const xs = retsA.returns.slice(-obs);
  const ys = retsB.returns.slice(-obs);
  return {
    covariance: covariance(xs, ys),
    correlation: correlation(xs, ys, minObservations),
    observations: obs,
  };
}

// ── Portfolio metrics ────────────────────────────────────────────────────────

export interface WeightInput {
  symbol: string;
  quantity: number;
  price: number;
}

export interface WeightOutput {
  symbol: string;
  value: number;
  weight: number;
}

/** Portfolio weights from position values. Zero-value portfolio → null weights. */
export function portfolioWeights(positions: WeightInput[]): WeightOutput[] | null {
  const valid = positions.filter((p) => Number.isFinite(p.quantity) && Number.isFinite(p.price));
  if (valid.length === 0) return null;
  const values = valid.map((p) => ({ symbol: p.symbol, value: p.quantity * p.price }));
  const total = values.reduce((s, v) => s + v.value, 0);
  if (total <= 0) return null;
  return values.map((v) => ({ ...v, weight: v.value / total }));
}

/**
 * Portfolio return series from position weights + per-symbol return series.
 * All series must share return timestamps; positions without a series or with
 * null weight are EXCLUDED from the weighted average (and the caller should
 * surface that — this function is pure and cannot).
 */
export function portfolioReturns(
  positions: Array<{ symbol: string; weight: number }>,
  returnsBySymbol: Map<string, ReturnSeries>
): ReturnSeries | null {
  const usable = positions.filter(
    (p) => returnsBySymbol.has(p.symbol) && Number.isFinite(p.weight) && p.weight > 0
  );
  if (usable.length === 0) return null;

  const firstSeries = returnsBySymbol.get(usable[0].symbol)!;
  const timestamps = firstSeries.timestamps;
  const returns: number[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    let dayReturn = 0;
    let totalWeight = 0;
    let complete = true;
    for (const pos of usable) {
      const series = returnsBySymbol.get(pos.symbol)!;
      // All series must be aligned on the same timestamps (stored daily
      // candles are; alignment happened upstream via alignSeries if needed).
      if (series.timestamps[i] !== timestamps[i]) {
        complete = false;
        break;
      }
      dayReturn += pos.weight * series.returns[i];
      totalWeight += pos.weight;
    }
    if (!complete || totalWeight <= 0) return null;
    // Normalize to the weight actually covered (excluded positions shrink it).
    returns.push(dayReturn / totalWeight);
  }
  return { timestamps, returns };
}

/** Cumulative return over a return series: Π(1+r) − 1. */
export function cumulativeReturn(returns: number[]): number | null {
  if (returns.length === 0) return null;
  return returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

/**
 * Period return over a lookback window (in return observations).
 * e.g. periods=21 ≈ 1 month of trading days. Null if insufficient data.
 */
export function periodReturn(returns: number[], periods: number): number | null {
  if (periods <= 0 || returns.length < periods) return null;
  const window = returns.slice(-periods);
  return window.reduce((acc, r) => acc * (1 + r), 1) - 1;
}
