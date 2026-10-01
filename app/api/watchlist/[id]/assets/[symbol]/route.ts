import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import { removeWatchlistItem } from '@/lib/db/repositories/watchlists';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * DELETE /api/watchlist/[id]/assets/[symbol]
 * Remove a specific asset from a watchlist
 */
async function deleteAsset(
  request: Request,
  { params }: { params: Promise<{ id: string; symbol: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id, symbol } = await params;

    const watchlist = await removeWatchlistItem(userId, id, symbol);

    if (!watchlist) {
      return errorResponse('Watchlist not found', 404);
    }

    return NextResponse.json(watchlist);
  } catch (error) {
    console.error('Error removing asset:', error);
    return errorResponse('Failed to remove asset', 500);
  }
}

export const DELETE = withRateLimit(deleteAsset, RATE_LIMITS.API_DEFAULT);
