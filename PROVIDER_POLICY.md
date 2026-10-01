# Provider & Data-Class Policy (Phase 1)

This document is the **contract** for how FinanceAI talks to market-data
providers. Every claim about data provenance in the UI or the AI layer is
backed by the rules here. Code that violates this document is a bug.

## 1. Providers

| Provider | Base URL | Auth | Used for |
|---|---|---|---|
| **Twelve Data** | `https://api.twelvedata.com` | `apikey` query param | quotes (canonical), indicators, crypto/forex candles, catalog |
| **Eulerpool** | `https://api.eulerpool.com/api/1` | `token` query param (or Bearer) | equity candles, company profiles, income statements (canonical) |

Both keys are **server-only** (`TWELVE_DATA_API_KEY`, `EULERPOOL_API_KEY`).
They must never carry the `NEXT_PUBLIC_` prefix.

Eulerpool error contract (from official docs): JSON body
`{ error, message, status }`; HTTP 429 carries `X-RateLimit-Reset`;
timestamps are epoch-ms; `volume` may be absent/null.

## 2. Canonical-source policy per data class (§33)

One canonical provider per data class. The other provider is fallback only.
Providers are **never merged** for the same datum — the returned object
always names the provider that produced it (`provider` field).

| Data class | Canonical | Fallback | Last resort |
|---|---|---|---|
| quote (equity) | Twelve Data | Eulerpool | cached stale (labeled `freshness: 'stale'`) |
| quote (crypto/forex) | Twelve Data | — | cached stale |
| candles (equity) | Eulerpool | Twelve Data | persisted Mongo storage |
| candles (crypto/forex) | Twelve Data | — | persisted Mongo storage |
| company profile | Eulerpool | Twelve Data | — |
| fundamentals | Eulerpool | Twelve Data | — |

Rules:

1. **No silent mixing.** A normalized object is produced by exactly one
   provider; provenance fields (`provider`, `asOf`, `retrievedAt`) always
   say who and when.
2. **Deterministic fallback.** Order is fixed per data class (above), never
   random, never A/B.
3. **`bad_symbol` does not fall back.** A symbol that is bad on the primary
   is genuinely bad; falling back would double quota spend for the same 404.
4. **Transient failures fall back** (`unavailable`, `rate_limited`,
   `network`, 5xx). A fallback that itself hits a rate limit surfaces a
   `rate_limited` ProviderError.
5. **Stale cache is labeled, not hidden.** When both providers fail and a
   cached quote exists, it is served with `freshness: 'stale'`.

## 3. Candle storage policy (§12/§13)

Stored in the `candles` Mongo collection
(`models/Candle.ts`). Identity:
`symbol + interval + timestamp + adjustmentMode` (unique index).

- **Canonical provider owns the truth for its asset class** (stocks:
  Eulerpool; crypto/forex: Twelve Data).
- Canonical-provider candles **upsert** (they refresh stored values).
- Non-canonical candles **fill gaps only** — a non-canonical candle never
  overwrites a row stored from the canonical provider
  (counted as `skippedNonCanonical`).
- Every row persists provenance: `sourceProvider`, `retrievedAt`.
- `adjustmentMode: 'unknown'` is stored explicitly — never silently assumed.

## 4. Read path (§39/§40/§41)

`getCandles()` is **storage-first**:

1. Read stored candles for the requested window.
2. If coverage ≥ `minCoverage` (default 0.95 of expected ~5/7 trading
   days) → serve from storage; no provider call.
3. Otherwise fetch missing data from providers (registry fallback policy),
   persist, and merge. Stored rows keep their identity; the fetch fills
   gaps, and canonical-provider data supersedes non-canonical fillers.
4. No coverage anywhere → error. **Missing data is never invented.**

## 5. Freshness classes (Phase 0, unchanged)

| Class | Meaning |
|---|---|
| `live` | data timestamp ≤ 15 min old |
| `delayed` | ≤ 1 h old |
| `eod` | ≤ 24 h old |
| `stale` | > 24 h (or served from stale cache after provider failure) |
| `unknown` | provider gave no usable timestamp |

## 6. Analytics semantics (§17/§18/§30)

`lib/analytics/engine.ts` is pure and deterministic. Contract:

- Functions return `null` when a metric is **genuinely unavailable**
  (insufficient observations, zero variance) — never `0`, never a guess.
- Correlation requires ≥ 20 aligned return observations and non-constant
  series.
- CAGR annualizes by the series' **calendar** span (365.25 days/year).
- Series alignment is an **inner join** on shared timestamps — differing
  calendars shrink the sample rather than invent points.

## 7. Portfolio valuation (§21–§24)

- Current price, day change: live quotes via the registry; every holding
  result carries `provider` + `freshness`.
- P&L = market value − cost basis, computed **only** when a quote exists;
  otherwise `null` (rendered as "—").
- Historical portfolio value: built from persisted candles over the
  **intersection** of covered symbols' calendars; holdings without candle
  coverage are reported as missing (result flagged `partial`).
- A failed quote degrades to `symbolErrors` for that symbol only — the rest
  of the portfolio is still valued (labeled `partial`).

## 8. Provider health (§26)

`providerHealth` (lib/market-data/registry.ts) counters per provider:
`success`, `failure`, `rateLimited`, `fallbacksUsed`, `totalLatencyMs`.
Lightweight by design — no external observability dependency.

## 9. Things that are forbidden

- `Math.random()` (or any nondeterminism) in data, analytics, or UI paths.
  (Retry-backoff jitter in `lib/ai/utils.ts` is the sole, documented
  exception — it is transport, not data.)
- Inventing, interpolating, or extrapolating market data.
- Mixing two providers' values into one datum.
- Shipping provider API keys to the browser.
- Treating `null` metrics as `0`.
