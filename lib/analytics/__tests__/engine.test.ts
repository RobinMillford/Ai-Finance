/**
 * Phase 1 tests: deterministic analytics engine (§30).
 *
 * Pure-function tests with known statistical fixtures. Same input must always
 * produce the same output — no randomness, no provider calls.
 */

import {
  mean,
  covariance,
  correlation,
  computeReturns,
  alignSeries,
  riskReturnMetrics,
  correlationBetweenPrices,
  portfolioWeights,
  portfolioReturns,
  cumulativeReturn,
  periodReturn,
  sanitizeSeries,
  PricePoint,
} from '@/lib/analytics/engine';

/**
 * Deterministic price series with VARYING returns (sine-modulated drift).
 *
 * Constant-drift fixtures have zero return variance: the only thing that
 * varies is 1e-6 price-rounding noise, which correlates like random noise.
 * Correlation fixtures therefore need genuine return variation.
 */
function varyingSeries(
  n: number,
  startPrice: number,
  amplitude: number,
  startDate = '2026-01-01'
): PricePoint[] {
  const out: PricePoint[] = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const ts = new Date(Date.parse(startDate) + i * 24 * 60 * 60 * 1000).toISOString();
    out.push({ timestamp: ts, price: Math.round(price * 1e6) / 1e6 });
    price *= 1 + amplitude * Math.sin(i / 3);
  }
  return out;
}

/** Deterministic price series generator (no Math.random anywhere). */
function series(
  n: number,
  startPrice: number,
  dailyDrift: number,
  startDate = '2026-01-01'
): PricePoint[] {
  const out: PricePoint[] = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const ts = new Date(Date.parse(startDate) + i * 24 * 60 * 60 * 1000).toISOString();
    out.push({ timestamp: ts, price: Math.round(price * 1e6) / 1e6 });
    price *= 1 + dailyDrift;
  }
  return out;
}

describe('sanitizeSeries', () => {
  it('sorts by timestamp and drops non-finite/non-positive prices', () => {
    const out = sanitizeSeries([
      { timestamp: '2026-01-03', price: 103 },
      { timestamp: '2026-01-01', price: 100 },
      { timestamp: '2026-01-02', price: NaN },
      { timestamp: '2026-01-02T02:00:00Z', price: -5 },
      { timestamp: 'bad-date', price: 50 },
      { timestamp: '2026-01-02T01:00:00Z', price: 101 },
    ]);
    // Original strings are preserved; only ORDER + FILTERING are guaranteed.
    expect(out.map((p) => p.timestamp)).toEqual([
      '2026-01-01',
      '2026-01-02T01:00:00Z',
      '2026-01-03',
    ]);
  });
});

describe('computeReturns', () => {
  it('computes simple periodic returns', () => {
    const r = computeReturns([
      { timestamp: '2026-01-01', price: 100 },
      { timestamp: '2026-01-02', price: 110 },
      { timestamp: '2026-01-03', price: 99 },
    ])!;
    expect(r.returns).toHaveLength(2);
    expect(r.returns[0]).toBeCloseTo(0.1, 10);
    expect(r.returns[1]).toBeCloseTo(-0.1, 10);
    expect(r.timestamps[0]).toBe('2026-01-02');
  });

  it('returns null for insufficient data', () => {
    expect(computeReturns([])).toBeNull();
    expect(computeReturns([{ timestamp: '2026-01-01', price: 100 }])).toBeNull();
  });

  it('skips a zero predecessor rather than dividing by zero', () => {
    const r = computeReturns([
      { timestamp: '2026-01-01', price: 0 },
      { timestamp: '2026-01-02', price: 100 },
      { timestamp: '2026-01-03', price: 110 },
    ])!;
    expect(r.returns).toHaveLength(1); // only the 100→110 return
  });
});

describe('alignSeries', () => {
  it('inner-joins on shared timestamps only', () => {
    const a = [
      { timestamp: '2026-01-01', price: 100 },
      { timestamp: '2026-01-02', price: 101 },
      { timestamp: '2026-01-03', price: 102 },
    ];
    const b = [
      { timestamp: '2026-01-02', price: 50 },
      { timestamp: '2026-01-03', price: 51 },
      { timestamp: '2026-01-04', price: 52 }, // missing in A
    ];
    const { a: aA, b: aB } = alignSeries(a, b);
    expect(aA.map((p) => p.timestamp)).toEqual(['2026-01-02', '2026-01-03']);
    expect(aB.map((p) => p.price)).toEqual([50, 51]);
  });

  it('returns empty arrays when calendars never overlap', () => {
    const { a } = alignSeries(
      [{ timestamp: '2026-01-01', price: 100 }],
      [{ timestamp: '2026-02-01', price: 100 }]
    );
    expect(a).toHaveLength(0);
  });
});

describe('mean / covariance', () => {
  it('computes the arithmetic mean', () => {
    expect(mean([1, 2, 3, 4])).toBeCloseTo(2.5, 10);
    expect(mean([])).toBeNull();
  });

  it('computes sample covariance', () => {
    // Perfect linear relation: y = 2x. Sample covariance of (1,2,3) vs (2,4,6)
    // = 4. Variance of x = 1 → cov = 2*var(x) = 2? No: cov(x,2x)=2*var(x)=2.
    expect(covariance([1, 2, 3], [2, 4, 6])).toBeCloseTo(2, 10);
    expect(covariance([1], [1])).toBeNull();
    expect(covariance([1, 2], [1, 2, 3])).toBeNull();
  });
});

describe('correlation', () => {
  it('returns 1 for perfectly correlated series', () => {
    const r = correlation([0.01, 0.02, -0.01, 0.03, 0.0, 0.01], [0.02, 0.04, -0.02, 0.06, 0.0, 0.02], 5);
    expect(r).toBeCloseTo(1, 10);
  });

  it('returns -1 for perfectly anti-correlated series', () => {
    const r = correlation([0.01, 0.02, -0.01, 0.03], [-0.01, -0.02, 0.01, -0.03], 4);
    expect(r).toBeCloseTo(-1, 10);
  });

  it('returns null for a constant series (zero variance is not correlation zero)', () => {
    expect(correlation([0, 0, 0, 0, 0], [0.01, 0.02, 0.03, 0.04, 0.05], 5)).toBeNull();
  });

  it('returns null below the minimum observation threshold', () => {
    expect(correlation([0.01, 0.02], [0.01, 0.02], 20)).toBeNull();
  });
});

describe('riskReturnMetrics', () => {
  it('computes annualized volatility, CAGR, and max drawdown for a known series', () => {
    // 252 days of +0.1% daily drift.
    const points = series(253, 100, 0.001);
    const m = riskReturnMetrics(points);

    expect(m.observations).toBe(252);
    // Daily return stdev is ~0 for a constant drift → volatility ≈ 0 (but not null).
    expect(m.volatility).not.toBeNull();
    expect(m.volatility!).toBeLessThan(0.001);
    // CAGR annualizes by the SERIES' CALENDAR span (252 consecutive days =
    // 0.69y): (1.001^252)^(365.25/252) − 1 = 1.001^365.25 − 1 ≈ 44.1%.
    expect(m.cagr!).toBeCloseTo(Math.pow(1.001, 365.25) - 1, 3);
    // Monotonic rise → max drawdown ≈ 0.
    expect(m.maxDrawdown).toBeCloseTo(0, 8);
    expect(m.meanReturn!).toBeCloseTo(0.001, 8);
  });

  it('computes max drawdown for a known crash path', () => {
    // Rise to 100, crash to 80, recover to 90: max drawdown = 20%.
    const points = series(101, 90, 0.001); // gentle rise baseline
    points[20] = { timestamp: points[20].timestamp, price: 100 };
    points[40] = { timestamp: points[40].timestamp, price: 80 };
    points[60] = { timestamp: points[60].timestamp, price: 90 };
    const m = riskReturnMetrics(points, { minObservations: 10 });
    expect(m.maxDrawdown).toBeCloseTo(0.2, 6);
  });

  it('returns nulls below the minimum observation threshold', () => {
    const m = riskReturnMetrics(series(10, 100, 0.001));
    expect(m.observations).toBe(9);
    expect(m.volatility).toBeNull();
    expect(m.cagr).toBeNull();
    expect(m.maxDrawdown).toBeNull();
  });

  it('reports null volatility for a perfectly flat price series', () => {
    const flat = series(30, 100, 0);
    const m = riskReturnMetrics(flat, { minObservations: 10 });
    expect(m.volatility).toBeNull(); // zero variance → null, not zero
    expect(m.maxDrawdown).toBeCloseTo(0, 10);
    expect(m.cagr).toBeCloseTo(0, 6);
  });
});

describe('correlationBetweenPrices (§18)', () => {
  it('finds ~1 for series moving together, ~-1 for opposite series', () => {
    const n = 100;
    const up = varyingSeries(n, 100, 0.002);
    const down = varyingSeries(n, 100, -0.002); // negated returns
    const same = correlationBetweenPrices(up, varyingSeries(n, 50, 0.002));
    // Identical return patterns at different price levels → r ≈ 1
    // (residual deviation comes only from 1e-6 rounding noise).
    expect(same.correlation).toBeCloseTo(1, 6);
    expect(same.observations).toBe(n - 1);

    const opposite = correlationBetweenPrices(up, down, 10);
    expect(opposite.correlation).toBeCloseTo(-1, 6);
  });

  it('handles differing calendars via shared dates only', () => {
    const a = varyingSeries(60, 100, 0.002);
    // Remove every 5th point from B (different "calendar").
    const b = varyingSeries(60, 100, 0.002).filter((_, i) => i % 5 !== 0);
    const result = correlationBetweenPrices(a, b, 10);
    expect(result.correlation).toBeCloseTo(1, 6);
    expect(result.observations).toBeGreaterThan(10);
  });

  it('returns unavailable when there are too few shared observations', () => {
    const result = correlationBetweenPrices(series(10, 100, 0.001), series(10, 100, 0.001));
    // Correlation requires ≥20 aligned returns → unavailable…
    expect(result.correlation).toBeNull();
    // …but covariance is well-defined at 9 observations and stays available.
    expect(result.covariance).not.toBeNull();
    expect(result.covariance!).toBeGreaterThan(0);
  });

  it('returns unavailable when calendars never overlap', () => {
    const result = correlationBetweenPrices(
      series(30, 100, 0.001, '2026-01-01'),
      series(30, 100, 0.001, '2026-06-01')
    );
    expect(result.correlation).toBeNull();
    expect(result.observations).toBe(0);
  });
});

describe('portfolioWeights', () => {
  it('computes value-weighted portfolio weights', () => {
    const w = portfolioWeights([
      { symbol: 'AAPL', quantity: 10, price: 150 }, // 1500
      { symbol: 'MSFT', quantity: 5, price: 300 }, // 1500
      { symbol: 'NVDA', quantity: 10, price: 100 }, // 1000
    ])!;
    expect(w.find((x) => x.symbol === 'AAPL')!.weight).toBeCloseTo(0.375, 10);
    expect(w.find((x) => x.symbol === 'MSFT')!.weight).toBeCloseTo(0.375, 10);
    expect(w.find((x) => x.symbol === 'NVDA')!.weight).toBeCloseTo(0.25, 10);
    expect(w.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1, 10);
  });

  it('returns null for a zero-value portfolio', () => {
    expect(portfolioWeights([{ symbol: 'X', quantity: 0, price: 100 }])).toBeNull();
    expect(portfolioWeights([])).toBeNull();
  });
});

describe('portfolioReturns', () => {
  const timestamps = ['d1', 'd2', 'd3'];
  const seriesFor = (returns: number[]): Map<string, { timestamps: string[]; returns: number[] }> =>
    new Map([['X', { timestamps, returns }]]);

  it('computes the weighted average of aligned series', () => {
    const out = portfolioReturns(
      [
        { symbol: 'X', weight: 0.5 },
        { symbol: 'Y', weight: 0.5 },
      ],
      new Map([
        ['X', { timestamps, returns: [0.02, 0.04, -0.02] }],
        ['Y', { timestamps, returns: [0.0, 0.02, 0.0] }],
      ])
    )!;
    expect(out.returns).toEqual([0.01, 0.03, -0.01]);
  });

  it('normalizes when some positions lack series (explicit, not hidden)', () => {
    const out = portfolioReturns(
      [
        { symbol: 'X', weight: 0.5 },
        { symbol: 'MISSING', weight: 0.5 },
      ],
      seriesFor([0.02, 0.04, -0.02])
    )!;
    // Only X is usable → weight renormalizes to 1.0 for X alone.
    expect(out.returns).toEqual([0.02, 0.04, -0.02]);
  });

  it('returns null when no positions have series', () => {
    expect(portfolioReturns([{ symbol: 'Z', weight: 1 }], seriesFor([0.01]))).toBeNull();
  });
});

describe('cumulativeReturn / periodReturn', () => {
  it('compounds returns multiplicatively', () => {
    expect(cumulativeReturn([0.1, 0.1])!).toBeCloseTo(0.21, 10);
    expect(cumulativeReturn([-0.5, 0.5])!).toBeCloseTo(-0.25, 10);
    expect(cumulativeReturn([])).toBeNull();
  });

  it('computes period returns over a trailing window', () => {
    const returns = [0.01, 0.02, 0.03, 0.04, -0.05];
    // Trailing 2: 0.04 then -0.05 → (1.04)(0.95) - 1.
    expect(periodReturn(returns, 2)!).toBeCloseTo(1.04 * 0.95 - 1, 10);
    expect(periodReturn(returns, 99)).toBeNull();
    expect(periodReturn(returns, 0)).toBeNull();
  });
});
