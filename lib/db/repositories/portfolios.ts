/**
 * Portfolio + position + transaction repositories.
 *
 * Authorization is enforced in EVERY query: portfolio-scoped lookups always
 * filter by userId, so a valid id belonging to another user is indistinguishable
 * from a missing one (404, never 403 — no existence leak).
 *
 * Financial precision: NUMERIC columns come back as strings from pg; the
 * repositories parse them into numbers for the application layer (providers,
 * valuation, analytics all consume numbers), while PERSISTENCE stays exact
 * decimal — no binary float is ever stored.
 */

import { and, eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../client';
import {
  portfolios,
  positions,
  transactions,
  type Portfolio,
  type Position,
  type Transaction,
  type AssetType,
} from '../schema';

/** Holding shape the UI/valuation layer already consumes (numeric → number). */
export interface HoldingView {
  id: string;
  symbol: string;
  assetType: AssetType;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes: string;
}

export interface PortfolioView {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  holdings: HoldingView[];
}

function toHoldingView(row: Position): HoldingView {
  return {
    id: row.id,
    symbol: row.symbol,
    assetType: row.assetType,
    quantity: Number(row.quantity),
    purchasePrice: Number(row.averageCost),
    purchaseDate: row.purchaseDate.toISOString(),
    notes: row.notes,
  };
}

function toPortfolioView(row: Portfolio, holdings: Position[]): PortfolioView {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    holdings: holdings.map(toHoldingView),
  };
}

// ── portfolios ───────────────────────────────────────────────────────────────

export async function getUserPortfolios(userId: string): Promise<PortfolioView[]> {
  const rows = await getDb()
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .orderBy(desc(portfolios.createdAt));
  if (rows.length === 0) return [];

  const allPositions = await getDb()
    .select()
    .from(positions)
    .where(
      sql`${positions.portfolioId} IN (${sql.join(
        rows.map((r) => sql`${r.id}::uuid`),
        sql`, `
      )})`
    )
    .orderBy(positions.createdAt);

  return rows.map((row) =>
    toPortfolioView(
      row,
      allPositions.filter((p) => p.portfolioId === row.id)
    )
  );
}

export async function getPortfolioById(
  userId: string,
  portfolioId: string
): Promise<PortfolioView | null> {
  const rows = await getDb()
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const holdings = await getDb()
    .select()
    .from(positions)
    .where(eq(positions.portfolioId, portfolioId))
    .orderBy(positions.createdAt);

  return toPortfolioView(row, holdings);
}

export async function createPortfolio(
  userId: string,
  input: { name: string; description?: string }
): Promise<PortfolioView> {
  const rows = await getDb()
    .insert(portfolios)
    .values({ userId, name: input.name, description: input.description ?? '' })
    .returning();
  return toPortfolioView(rows[0], []);
}

export async function updatePortfolio(
  userId: string,
  portfolioId: string,
  patch: { name?: string; description?: string }
): Promise<PortfolioView | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;

  // Scoped update: 0 rows updated ⇒ not found (or not yours).
  const updated = await getDb()
    .update(portfolios)
    .set(set)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning();
  if (updated.length === 0) return null;

  return getPortfolioById(userId, portfolioId);
}

/** Cascades to positions + transactions inside one implicit transaction. */
export async function deletePortfolio(userId: string, portfolioId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning({ id: portfolios.id });
  return deleted.length > 0;
}

// ── positions (the old inline `holdings` array) ──────────────────────────────

export async function addPosition(
  userId: string,
  portfolioId: string,
  input: {
    symbol: string;
    assetType: AssetType;
    quantity: number;
    purchasePrice: number;
    purchaseDate?: Date;
    notes?: string;
  }
): Promise<PortfolioView | null> {
  const db = getDb();
  // Ownership gate first: an insert must never target someone else's portfolio.
  const owned = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (owned.length === 0) return null;

  // Same (symbol, asset_type) lot → weighted-average cost update; new symbol → insert.
  // NOTE: interpolated numbers MUST carry an explicit ::numeric cast — with two
  // untyped params PG cannot resolve the overloaded `*` operator.
  const conflictSet: Record<string, unknown> = {
    quantity: sql`${positions.quantity} + ${input.quantity.toFixed(6)}::numeric`,
    averageCost: sql`(${positions.averageCost} * ${positions.quantity} + ${input.purchasePrice.toFixed(6)}::numeric * ${input.quantity.toFixed(6)}::numeric) / (${positions.quantity} + ${input.quantity.toFixed(6)}::numeric)`,
    updatedAt: new Date(),
  };
  // Empty/absent notes keep the existing value (old CASE semantics) — an empty
  // string cannot be passed through the sql template (it renders no param).
  if (input.notes !== undefined && input.notes !== '') {
    conflictSet.notes = input.notes;
  }

  await db
    .insert(positions)
    .values({
      portfolioId,
      symbol: input.symbol.toUpperCase(),
      assetType: input.assetType,
      quantity: input.quantity.toFixed(6),
      averageCost: input.purchasePrice.toFixed(6),
      purchaseDate: input.purchaseDate ?? new Date(),
      notes: input.notes ?? '',
    })
    .onConflictDoUpdate({
      target: [positions.portfolioId, positions.symbol, positions.assetType],
      set: conflictSet,
    });

  return getPortfolioById(userId, portfolioId);
}

/** Partial position update by position id (replaces the old holdingIndex API). */
export async function updatePosition(
  userId: string,
  portfolioId: string,
  positionId: string,
  patch: { quantity?: number; purchasePrice?: number; notes?: string }
): Promise<PortfolioView | null> {
  const db = getDb();
  const owned = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (owned.length === 0) return null;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.quantity !== undefined) set.quantity = patch.quantity.toFixed(6);
  if (patch.purchasePrice !== undefined) set.averageCost = patch.purchasePrice.toFixed(6);
  if (patch.notes !== undefined) set.notes = patch.notes;

  const updated = await db
    .update(positions)
    .set(set)
    .where(and(eq(positions.id, positionId), eq(positions.portfolioId, portfolioId)))
    .returning({ id: positions.id });
  if (updated.length === 0) return null;

  return getPortfolioById(userId, portfolioId);
}

export async function deletePosition(
  userId: string,
  portfolioId: string,
  positionId: string
): Promise<PortfolioView | null> {
  const db = getDb();
  const owned = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (owned.length === 0) return null;

  const deleted = await db
    .delete(positions)
    .where(and(eq(positions.id, positionId), eq(positions.portfolioId, portfolioId)))
    .returning({ id: positions.id });
  if (deleted.length === 0) return null;

  return getPortfolioById(userId, portfolioId);
}

// ── transactions ─────────────────────────────────────────────────────────────

export interface TransactionView {
  id: string;
  symbol: string;
  assetType: AssetType;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  transactionAt: string;
}

export async function createTransaction(
  userId: string,
  portfolioId: string,
  input: {
    symbol: string;
    assetType: AssetType;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    fees?: number;
    transactionAt?: Date;
  }
): Promise<TransactionView | null> {
  const db = getDb();
  const owned = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (owned.length === 0) return null;

  const rows = await db
    .insert(transactions)
    .values({
      portfolioId,
      symbol: input.symbol.toUpperCase(),
      assetType: input.assetType,
      side: input.side,
      quantity: input.quantity.toFixed(6),
      price: input.price.toFixed(6),
      fees: (input.fees ?? 0).toFixed(6),
      transactionAt: input.transactionAt ?? new Date(),
    })
    .returning();

  const row: Transaction = rows[0];
  return {
    id: row.id,
    symbol: row.symbol,
    assetType: row.assetType,
    side: row.side,
    quantity: Number(row.quantity),
    price: Number(row.price),
    fees: Number(row.fees),
    transactionAt: row.transactionAt.toISOString(),
  };
}

export async function getTransactions(
  userId: string,
  portfolioId: string
): Promise<TransactionView[] | null> {
  const db = getDb();
  const owned = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (owned.length === 0) return null;

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.portfolioId, portfolioId))
    .orderBy(desc(transactions.transactionAt));

  return rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    assetType: row.assetType,
    side: row.side,
    quantity: Number(row.quantity),
    price: Number(row.price),
    fees: Number(row.fees),
    transactionAt: row.transactionAt.toISOString(),
  }));
}
