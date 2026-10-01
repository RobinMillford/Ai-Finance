/**
 * Portfolio valuation (Phase 1, §21–§24).
 *
 * Replaces the old behavior of treating `purchasePrice` as the current price.
 * Real data only:
 *   - current price, day change  → live quotes via the provider registry
 *   - historical portfolio value → persisted candles (storage-first)
 *
 * Every holding result carries provenance + freshness. A symbol whose quote
 * cannot be fetched is reported in `symbolErrors` — the rest of the
 * portfolio is still valued (partial results are labeled, never guessed).
 */

import { getQuoteFor, ProviderError } from '@/lib/market-data/registry';
import { getCandles } from '@/lib/market-data/candles';
import type { Quote, FreshnessClass, ProviderId } from '@/lib/market-data/domain';

export interface ValuationHolding {
  symbol: string;
  assetType: 'stock' | 'crypto' | 'forex';
  quantity: number;
  /** Average purchase price (cost basis per unit). */
  purchasePrice: number;
  /** Total cost basis = quantity × purchasePrice. */
  costBasis: number;
  /** Current unit price from the quote. Null when unavailable. */
  currentPrice: number | null;
  /** Unit price change vs previous close. Null when unavailable. */
  dayChange: number | null;
  /** Day change in percent. Null when unavailable. */
  dayChangePercent: number | null;
  /** Market value = quantity × currentPrice. Null when no price. */
  marketValue: number | null;
  /** Unrealized P&L = marketValue − costBasis. Null when no price. */
  unrealizedPL: number | null;
  /** Unrealized P&L percent vs cost basis. Null when no price or zero cost. */
  unrealizedPLPercent: number | null;
  /** Previous close used for the day change (provenance). */
  previousClose: number | null;
  freshness: FreshnessClass;
  provider: ProviderId;
  asOf: string | null;
  retrievedAt: string;
}

export interface PortfolioValuation {
  holdings: ValuationHolding[];
  totals: {
    marketValue: number | null;
    costBasis: number;
    unrealizedPL: number | null;
    unrealizedPLPercent: number | null;
    dayChange: number | null;
    dayChangePercent: number | null;
  };
  /** Symbols whose quotes failed (others are still valued). */
  symbolErrors: { symbol: string; reason: string }[];
  /** True when at least one holding had no usable quote. */
  partial: boolean;
  /** ISO timestamp of the valuation run. */
  computedAt: string;
}

export function toValuationHolding(
  holding: {
    symbol: string;
    assetType: 'stock' | 'crypto' | 'forex';
    quantity: number;
    purchasePrice: number;
  },
  quote: Quote
): ValuationHolding {
  const costBasis = holding.quantity * holding.purchasePrice;
  const price = quote.price;
  const marketValue = price === null ? null : price * holding.quantity;
  const unrealizedPL = marketValue === null ? null : marketValue - costBasis;
  const dayChange = quote.change;
  const dayChangePercent = quote.changePercent;

  return {
    symbol: holding.symbol.toUpperCase(),
    assetType: holding.assetType,
    quantity: holding.quantity,
    purchasePrice: holding.purchasePrice,
    costBasis,
    currentPrice: price,
    dayChange,
    dayChangePercent,
    marketValue,
    unrealizedPL,
    unrealizedPLPercent:
      unrealizedPL === null || costBasis === 0 ? null : (unrealizedPL / costBasis) * 100,
    previousClose: quote.previousClose,
    freshness: quote.freshness,
    provider: quote.provider,
    asOf: quote.asOf,
    retrievedAt: quote.retrievedAt,
  };
}

function summarize(holdings: ValuationHolding[]): PortfolioValuation['totals'] {
  let marketValue = 0;
  let valueKnown = true;
  let costBasis = 0;
  let dayChange = 0;
  let dayKnown = true;

  for (const h of holdings) {
    costBasis += h.costBasis;
    if (h.marketValue === null) {
      valueKnown = false;
      dayKnown = false;
      continue;
    }
    marketValue += h.marketValue;
    if (h.dayChange === null) dayKnown = false;
    else dayChange += h.dayChange * h.quantity;
  }

  const unrealizedPL = valueKnown ? marketValue - costBasis : null;
  return {
    marketValue: valueKnown ? marketValue : null,
    costBasis,
    unrealizedPL,
    unrealizedPLPercent:
      unrealizedPL === null || costBasis === 0 ? null : (unrealizedPL / costBasis) * 100,
    dayChange: dayKnown ? dayChange : null,
    dayChangePercent:
      dayKnown && valueKnown && costBasis > 0 ? (dayChange / (marketValue - dayChange)) * 100 : null,
  };
}

/**
 * Value a portfolio from live quotes.
 * One failed symbol does not fail the whole valuation — it is reported.
 */
export async function valuePortfolio(
  holdings: {
    symbol: string;
    assetType: 'stock' | 'crypto' | 'forex';
    quantity: number;
    purchasePrice: number;
  }[]
): Promise<PortfolioValuation> {
  const computedAt = new Date().toISOString();
  const valued: ValuationHolding[] = [];
  const symbolErrors: { symbol: string; reason: string }[] = [];

  await Promise.all(
    holdings.map(async (holding) => {
      try {
        const quote = await getQuoteFor(holding.symbol);
        valued.push(toValuationHolding(holding, quote));
      } catch (error) {
        const reason =
          error instanceof ProviderError
            ? `${error.kind}: ${error.message}`
            : error instanceof Error
              ? error.message
              : 'unknown error';
        symbolErrors.push({ symbol: holding.symbol.toUpperCase(), reason });
        // Include the holding at cost basis so the table stays complete.
        valued.push({
          ...toValuationHolding(holding, {
            symbol: holding.symbol.toUpperCase(),
            price: null,
            open: null,
            high: null,
            low: null,
            previousClose: null,
            change: null,
            changePercent: null,
            volume: null,
            asOf: null,
            retrievedAt: computedAt,
            provider: 'twelvedata',
            freshness: 'unknown',
          }),
        });
      }
    })
  );

  valued.sort((a, b) => b.costBasis - a.costBasis);
  const partial = symbolErrors.length > 0;

  return {
    holdings: valued,
    totals: summarize(valued),
    symbolErrors,
    partial,
    computedAt,
  };
}

// ── Historical portfolio value (from persisted candles) ─────────────────────

export interface PortfolioHistoryPoint {
  date: string; // ISO date
  /** Portfolio market value on that date, over the covered holdings only. */
  value: number;
}

export interface PortfolioHistory {
  series: PortfolioHistoryPoint[];
  /** Symbols included (had usable candle coverage). */
  coveredSymbols: string[];
  /** Symbols excluded (no candle data available). */
  missingSymbols: string[];
  /** True when missingSymbols is non-empty (the series covers only part). */
  partial: boolean;
}

/**
 * Real historical portfolio value built from persisted daily candles.
 *
 * Deterministic and honest:
 *  - only holdings with candle coverage contribute;
 *  - value dates are the INTERSECTION of all covered symbols' calendars
 *    (inner join — no interpolation, no invention);
 *  - when any holding lacks candles the result is flagged `partial`.
 */
export async function portfolioHistory(
  holdings: {
    symbol: string;
    assetType: 'stock' | 'crypto' | 'forex';
    quantity: number;
  }[],
  opts: { days?: number } = {}
): Promise<PortfolioHistory> {
  const days = opts.days ?? 180;
  const bySymbol = new Map<string, Map<string, number>>();
  const coveredSymbols: string[] = [];
  const missingSymbols: string[] = [];

  // Deduplicate symbols (same symbol held twice shares one series).
  const unique = new Map<string, 'stock' | 'crypto' | 'forex'>();
  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    if (!unique.has(sym)) unique.set(sym, h.assetType);
  }

  await Promise.all(
    [...unique.entries()].map(async ([symbol, assetType]) => {
      try {
        const { candles } = await getCandles(symbol, assetType, { days });
        if (candles.length < 2) {
          missingSymbols.push(symbol);
          return;
        }
        const closes = new Map<string, number>();
        for (const c of candles) {
          const date = c.timestamp.slice(0, 10);
          closes.set(date, c.close); // last close per date wins
        }
        bySymbol.set(symbol, closes);
        coveredSymbols.push(symbol);
      } catch {
        missingSymbols.push(symbol);
      }
    })
  );

  if (coveredSymbols.length === 0) {
    return { series: [], coveredSymbols, missingSymbols, partial: missingSymbols.length > 0 };
  }

  // Inner-join across all covered symbols' calendars.
  const [first, ...rest] = [...bySymbol.values()];
  const sharedDates = [...first.keys()]
    .filter((date) => rest.every((m) => m.has(date)))
    .sort();

  const series: PortfolioHistoryPoint[] = sharedDates.map((date) => {
    let value = 0;
    for (const h of holdings) {
      const closes = bySymbol.get(h.symbol.toUpperCase());
      if (!closes) continue;
      value += (closes.get(date) ?? 0) * h.quantity;
    }
    return { date, value };
  });

  return {
    series,
    coveredSymbols,
    missingSymbols,
    partial: missingSymbols.length > 0,
  };
}
