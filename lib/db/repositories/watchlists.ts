/**
 * Watchlist repository — named watchlists + their items.
 *
 * Ownership is enforced in every lookup (userId-scoped), mirroring the
 * portfolio repositories: foreign ids are indistinguishable from missing ones.
 */

import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '../client';
import {
  watchlists,
  watchlistItems,
  type Watchlist,
  type WatchlistItem,
  type AssetType,
} from '../schema';

export interface WatchlistItemView {
  id: string;
  symbol: string;
  assetType: AssetType;
  addedAt: string;
  notes: string;
  alertPrice: number | null;
}

export interface WatchlistView {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assets: WatchlistItemView[];
}

function toItemView(row: WatchlistItem): WatchlistItemView {
  return {
    id: row.id,
    symbol: row.symbol,
    assetType: row.assetType,
    addedAt: row.addedAt.toISOString(),
    notes: row.notes,
    alertPrice: row.alertPrice === null ? null : Number(row.alertPrice),
  };
}

function toWatchlistView(row: Watchlist, items: WatchlistItem[]): WatchlistView {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assets: items.map(toItemView),
  };
}

async function loadItems(watchlistId: string): Promise<WatchlistItem[]> {
  return getDb()
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.watchlistId, watchlistId))
    .orderBy(watchlistItems.addedAt);
}

export async function getUserWatchlists(userId: string): Promise<WatchlistView[]> {
  const rows = await getDb()
    .select()
    .from(watchlists)
    .where(eq(watchlists.userId, userId))
    .orderBy(desc(watchlists.createdAt));
  if (rows.length === 0) return [];

  const allItems = await getDb()
    .select()
    .from(watchlistItems)
    .orderBy(watchlistItems.addedAt);
  const byList = new Map<string, WatchlistItem[]>();
  for (const item of allItems) {
    const bucket = byList.get(item.watchlistId) ?? [];
    bucket.push(item);
    byList.set(item.watchlistId, bucket);
  }
  return rows.map((row) => toWatchlistView(row, byList.get(row.id) ?? []));
}

export async function getWatchlistById(
  userId: string,
  watchlistId: string
): Promise<WatchlistView | null> {
  const rows = await getDb()
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return toWatchlistView(row, await loadItems(watchlistId));
}

export async function createWatchlist(
  userId: string,
  name: string
): Promise<WatchlistView> {
  const rows = await getDb()
    .insert(watchlists)
    .values({ userId, name })
    .returning();
  return toWatchlistView(rows[0], []);
}

export async function renameWatchlist(
  userId: string,
  watchlistId: string,
  name: string
): Promise<WatchlistView | null> {
  const updated = await getDb()
    .update(watchlists)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .returning();
  if (updated.length === 0) return null;
  return toWatchlistView(updated[0], await loadItems(watchlistId));
}

export async function deleteWatchlist(userId: string, watchlistId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .returning({ id: watchlists.id });
  return deleted.length > 0;
}

export async function addWatchlistItem(
  userId: string,
  watchlistId: string,
  input: { symbol: string; assetType: AssetType; notes?: string; alertPrice?: number }
): Promise<WatchlistView | null> {
  const db = getDb();
  const owned = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1);
  if (owned.length === 0) return null;

  await db
    .insert(watchlistItems)
    .values({
      watchlistId,
      symbol: input.symbol.toUpperCase(),
      assetType: input.assetType,
      notes: input.notes ?? '',
      alertPrice: input.alertPrice === undefined ? null : input.alertPrice.toFixed(6),
    })
    .onConflictDoUpdate({
      // Same symbol re-added → refresh type/notes/alert instead of erroring.
      target: [watchlistItems.watchlistId, watchlistItems.symbol],
      set: {
        assetType: input.assetType,
        notes: input.notes ?? '',
        alertPrice: input.alertPrice === undefined ? null : input.alertPrice.toFixed(6),
      },
    });

  return getWatchlistById(userId, watchlistId);
}

export async function removeWatchlistItem(
  userId: string,
  watchlistId: string,
  symbol: string
): Promise<WatchlistView | null> {
  const db = getDb();
  const owned = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1);
  if (owned.length === 0) return null;

  await db
    .delete(watchlistItems)
    .where(
      and(
        eq(watchlistItems.watchlistId, watchlistId),
        eq(watchlistItems.symbol, symbol.toUpperCase())
      )
    );

  return getWatchlistById(userId, watchlistId);
}
