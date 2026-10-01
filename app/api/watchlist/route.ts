import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getUserWatchlists,
  createWatchlist,
} from '@/lib/db/repositories/watchlists';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * GET /api/watchlist
 * Get all watchlists for the authenticated user
 */
async function getWatchlists(request: Request) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const watchlists = await getUserWatchlists(userId);

    return NextResponse.json(watchlists);
  } catch (error) {
    console.error('Error fetching watchlists:', error);
    return errorResponse('Failed to fetch watchlists', 500);
  }
}

/**
 * POST /api/watchlist
 * Create a new watchlist
 */
async function createNewWatchlist(request: Request) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return errorResponse('Watchlist name is required', 400);
    }

    const watchlist = await createWatchlist(userId, name.trim());

    return NextResponse.json(watchlist, { status: 201 });
  } catch (error) {
    console.error('Error creating watchlist:', error);
    return errorResponse('Failed to create watchlist', 500);
  }
}

export const GET = withRateLimit(getWatchlists, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(createNewWatchlist, RATE_LIMITS.API_DEFAULT);
