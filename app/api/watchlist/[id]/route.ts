import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getWatchlistById,
  renameWatchlist,
  deleteWatchlist,
  addWatchlistItem,
} from '@/lib/db/repositories/watchlists';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * GET /api/watchlist/[id]
 * Get a specific watchlist
 */
async function getWatchlist(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const watchlist = await getWatchlistById(userId, id);

    if (!watchlist) {
      return errorResponse('Watchlist not found', 404);
    }

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return errorResponse('Failed to fetch watchlist', 500);
  }
}

/**
 * PUT /api/watchlist/[id]
 * Update watchlist name
 */
async function updateWatchlist(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return errorResponse('Name is required', 400);
    }

    const watchlist = await renameWatchlist(userId, id, name.trim());

    if (!watchlist) {
      return errorResponse('Watchlist not found', 404);
    }

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error('Error updating watchlist:', error);
    return errorResponse('Failed to update watchlist', 500);
  }
}

/**
 * DELETE /api/watchlist/[id]
 * Delete a watchlist
 */
async function deleteWatchlistRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const deleted = await deleteWatchlist(userId, id);

    if (!deleted) {
      return errorResponse('Watchlist not found', 404);
    }

    return NextResponse.json({ message: 'Watchlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    return errorResponse('Failed to delete watchlist', 500);
  }
}

/**
 * POST /api/watchlist/[id]
 * Add asset to watchlist (same symbol re-add refreshes notes/alert).
 */
async function addAsset(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const body = await request.json();
    const { symbol, assetType, notes, alertPrice } = body;

    if (!symbol || !assetType) {
      return errorResponse('Symbol and asset type are required', 400);
    }

    if (!['stock', 'crypto', 'forex'].includes(assetType)) {
      return errorResponse('Invalid asset type', 400);
    }

    const watchlist = await addWatchlistItem(userId, id, {
      symbol: String(symbol),
      assetType,
      notes: typeof notes === 'string' ? notes : '',
      alertPrice:
        alertPrice !== undefined && alertPrice !== null && Number.isFinite(Number(alertPrice))
          ? Number(alertPrice)
          : undefined,
    });

    if (!watchlist) {
      return errorResponse('Watchlist not found', 404);
    }

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error('Error adding asset:', error);
    return errorResponse('Failed to add asset', 500);
  }
}

export const GET = withRateLimit(getWatchlist, RATE_LIMITS.API_DEFAULT);
export const PUT = withRateLimit(updateWatchlist, RATE_LIMITS.API_DEFAULT);
export const DELETE = withRateLimit(deleteWatchlistRoute, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(addAsset, RATE_LIMITS.API_DEFAULT);
