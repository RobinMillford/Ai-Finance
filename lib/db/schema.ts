/**
 * Drizzle schema — the complete FinanceAI relational data model.
 *
 * Derived from the application's ACTUAL behavior (audit of all routes and
 * the previous Mongo models), not a mechanical SQL translation:
 *  - UUID primary keys (canonical identity everywhere, incl. NextAuth JWT sub)
 *  - portfolio/watchlist/conversation ownership is user_id (the previous
 *    email-keyed Mongo identity is gone — Phase 6 of the migration spec)
 *  - arrays-of-documents become normalized child tables with intentional FKs
 *  - monetary/quantity columns are NUMERIC(18,6) — exact decimal semantics
 *    for financial persistence (binary float is never persisted)
 *  - provider candles keep their Phase 1 identity + canonical-source policy
 *
 * Financial precision: NUMERIC(18,6) covers quantity and unit price for
 * retail-scale portfolios (18 digits total, 6 after the decimal point) while
 * remaining exact. The analytics engine still computes in JS on parsed
 * values — persistence is exact, calculation rules are application logic.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** Per-channel notification switches (stored as one jsonb document). */
export interface NotificationPreferences {
  email: boolean;
  marketAlerts: boolean;
  priceChanges: boolean;
  portfolioUpdates: boolean;
  aiRecommendations: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  marketAlerts: true,
  priceChanges: true,
  portfolioUpdates: true,
  aiRecommendations: true,
};

// ── users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    /** bcrypt hash — never logged, never selected into client payloads. */
    passwordHash: text('password_hash'),
    image: text('image'),
    /** Email verification gate: a pending token blocks credentials login. */
    emailVerificationToken: text('email_verification_token'),
    emailVerificationTokenExpiry: timestamp('email_verification_token_expiry', { withTimezone: true }),
    isPublic: boolean('is_public').notNull().default(false),
    /** Whole-document preference updates (the API replaces the object). */
    notificationPreferences: jsonb('notification_preferences')
      .$type<NotificationPreferences>()
      .notNull()
      .default(DEFAULT_NOTIFICATION_PREFERENCES),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)]
);

// ── portfolios ───────────────────────────────────────────────────────────────

export const portfolios = pgTable(
  'portfolios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('portfolios_user_created_idx').on(t.userId, t.createdAt.desc()),
    check('portfolios_name_len_check', sql`char_length(${t.name}) > 0`),
  ]
);

// ── positions (normalized portfolio holdings) ────────────────────────────────

export type AssetType = 'stock' | 'crypto' | 'forex';

export const positions = pgTable(
  'positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 32 }).notNull(),
    assetType: varchar('asset_type', { length: 16 })
      .$type<AssetType>()
      .notNull(),
    /** NUMERIC(18,6): exact shares/units, fractional crypto included. */
    quantity: numeric('quantity', { precision: 18, scale: 6 }).notNull(),
    /** NUMERIC(18,6): exact per-unit cost basis (purchase price). */
    averageCost: numeric('average_cost', { precision: 18, scale: 6 }).notNull(),
    purchaseDate: timestamp('purchase_date', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The previous UI keyed holdings by array index; relational identity is
    // (portfolio, symbol, asset_type). Re-adding an asset updates the lot.
    uniqueIndex('positions_identity_unique').on(t.portfolioId, t.symbol, t.assetType),
    index('positions_portfolio_idx').on(t.portfolioId),
    check('positions_quantity_positive_check', sql`${t.quantity} > 0`),
    check('positions_cost_nonnegative_check', sql`${t.averageCost} >= 0`),
    check('positions_asset_type_check', sql`${t.assetType} IN ('stock', 'crypto', 'forex')`),
  ]
);

// ── transactions (trade history; positions may be derived from these) ────────

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 32 }).notNull(),
    assetType: varchar('asset_type', { length: 16 })
      .$type<AssetType>()
      .notNull(),
    side: varchar('side', { length: 4 })
      .$type<'buy' | 'sell'>()
      .notNull(),
    quantity: numeric('quantity', { precision: 18, scale: 6 }).notNull(),
    /** Exact execution price per unit. */
    price: numeric('price', { precision: 18, scale: 6 }).notNull(),
    /** Exact fee amount (transaction currency). */
    fees: numeric('fees', { precision: 18, scale: 6 }).notNull().default('0'),
    transactionAt: timestamp('transaction_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transactions_portfolio_idx').on(t.portfolioId),
    index('transactions_symbol_idx').on(t.portfolioId, t.symbol),
    check('transactions_quantity_positive_check', sql`${t.quantity} > 0`),
    check('transactions_price_nonnegative_check', sql`${t.price} >= 0`),
    check('transactions_fees_nonnegative_check', sql`${t.fees} >= 0`),
    check('transactions_side_check', sql`${t.side} IN ('buy', 'sell')`),
    check('transactions_asset_type_check', sql`${t.assetType} IN ('stock', 'crypto', 'forex')`),
  ]
);

// ── watchlists ───────────────────────────────────────────────────────────────

export const watchlists = pgTable(
  'watchlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('watchlists_user_created_idx').on(t.userId, t.createdAt.desc())]
);

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    watchlistId: uuid('watchlist_id')
      .notNull()
      .references(() => watchlists.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 32 }).notNull(),
    assetType: varchar('asset_type', { length: 16 })
      .$type<AssetType>()
      .notNull(),
    notes: text('notes').notNull().default(''),
    /** Optional price alert target — exact numeric. */
    alertPrice: numeric('alert_price', { precision: 18, scale: 6 }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('watchlist_items_identity_unique').on(t.watchlistId, t.symbol),
    index('watchlist_items_watchlist_idx').on(t.watchlistId),
    check('watchlist_items_asset_type_check', sql`${t.assetType} IN ('stock', 'crypto', 'forex')`),
  ]
);

// ── user tracked assets + flat watchlist symbols (/api/user/*) ───────────────
// The previous User document carried BOTH a flat `watchlist: string[]` and a
// richer `trackedAssets: {type, symbol, addedAt}[]` — two distinct lists with
// different contracts, so they normalize to two tables (not one derived).

export const userTrackedAssets = pgTable(
  'user_tracked_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 32 }).notNull(),
    assetType: varchar('asset_type', { length: 16 })
      .$type<AssetType>()
      .notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_tracked_assets_identity_unique').on(t.userId, t.symbol),
    check('user_tracked_assets_asset_type_check', sql`${t.assetType} IN ('stock', 'crypto', 'forex')`),
  ]
);

export const userWatchlistSymbols = pgTable(
  'user_watchlist_symbols',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbol: varchar('symbol', { length: 32 }).notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_watchlist_symbols_identity_unique').on(t.userId, t.symbol)]
);

// ── conversations + messages (normalized thread storage) ─────────────────────

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    /** Which advisor graph the conversation belongs to. */
    chatType: varchar('chat_type', { length: 16 })
      .$type<'main' | 'stock' | 'forex'>()
      .notNull()
      .default('main'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('conversations_user_created_idx').on(t.userId, t.createdAt.desc()),
    check('conversations_chat_type_check', sql`${t.chatType} IN ('main', 'stock', 'forex')`),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 })
      .$type<'user' | 'assistant' | 'system'>()
      .notNull(),
    content: text('content').notNull(),
    /** Which provider answered (assistant messages only, when known). */
    provider: varchar('provider', { length: 100 }),
    /** Which agent/graph produced the message (e.g. 'stock', 'forex'). */
    agent: varchar('agent', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
    check('messages_role_check', sql`${t.role} IN ('user', 'assistant', 'system')`),
    check('messages_content_len_check', sql`char_length(${t.content}) > 0`),
  ]
);

// ── password reset tokens (hashed at rest, one-time use) ─────────────────────

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 hash of the reset token — the raw token is never stored. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set when consumed; consumed tokens can never be replayed. */
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('password_reset_tokens_hash_unique').on(t.tokenHash),
    index('password_reset_tokens_expiry_idx').on(t.expiresAt),
  ]
);

// ── candles (provider persistence — Phase 1 provider architecture) ───────────

export type CandleInterval = '1day';
export type AdjustmentMode = 'adjusted' | 'unadjusted' | 'unknown';
export type ProviderId = 'twelvedata' | 'eulerpool';

/**
 * Persistent candle storage. Identity stays identical to the Phase 1 Mongo
 * model: symbol + interval + timestamp + adjustmentMode. The supplying
 * provider is provenance only (`source_provider`), never part of identity —
 * the canonical-source policy lives in lib/market-data/candles.ts.
 */
export const candles = pgTable(
  'candles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    symbol: varchar('symbol', { length: 32 }).notNull(),
    /** Candle open time (UTC midnight for 1day bars). */
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    interval: varchar('interval', { length: 16 })
      .$type<CandleInterval>()
      .notNull()
      .default('1day'),
    open: numeric('open', { precision: 18, scale: 6 }).notNull(),
    high: numeric('high', { precision: 18, scale: 6 }).notNull(),
    low: numeric('low', { precision: 18, scale: 6 }).notNull(),
    close: numeric('close', { precision: 18, scale: 6 }).notNull(),
    volume: numeric('volume', { precision: 24, scale: 2 }),
    adjustmentMode: varchar('adjustment_mode', { length: 16 })
      .$type<AdjustmentMode>()
      .notNull()
      .default('unknown'),
    /** Provider that supplied this candle (provenance, not identity). */
    sourceProvider: varchar('source_provider', { length: 16 })
      .$type<ProviderId>()
      .notNull(),
    /** When we fetched and stored it. */
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('candles_identity_unique').on(t.symbol, t.interval, t.timestamp, t.adjustmentMode),
    index('candles_symbol_time_idx').on(t.symbol, t.interval, t.timestamp.desc()),
    check('candles_ohlc_positive_check', sql`${t.open} >= 0 AND ${t.high} >= 0 AND ${t.low} >= 0 AND ${t.close} >= 0`),
    check('candles_volume_nonnegative_check', sql`${t.volume} IS NULL OR ${t.volume} >= 0`),
    check('candles_source_provider_check', sql`${t.sourceProvider} IN ('twelvedata', 'eulerpool')`),
    check('candles_adjustment_mode_check', sql`${t.adjustmentMode} IN ('adjusted', 'unadjusted', 'unknown')`),
  ]
);

// ── inferred types (repositories consume these) ──────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Watchlist = typeof watchlists.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type CandleRow = typeof candles.$inferSelect;
export type TrackedAssetRow = typeof userTrackedAssets.$inferSelect;
export type UserWatchlistSymbolRow = typeof userWatchlistSymbols.$inferSelect;

/** Keep the FK-typing honest: columns referencing other tables stay typed. */
export type UserRef = AnyPgColumn;
