import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Watchlist from '@/models/Watchlist';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * GET /api/watchlist
 * Get all watchlists for the authenticated user
 */
async function getWatchlists(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    await dbConnect();
    
    const watchlists = await Watchlist.find({ userId: session.user.email })
      .sort({ createdAt: -1 })
      .lean();

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
async function createWatchlist(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return errorResponse('Watchlist name is required', 400);
    }

    await dbConnect();

    const watchlist = await Watchlist.create({
      userId: session.user.email,
      name: name.trim(),
      assets: [],
    });

    return NextResponse.json(watchlist, { status: 201 });
  } catch (error) {
    console.error('Error creating watchlist:', error);
    return errorResponse('Failed to create watchlist', 500);
  }
}

export const GET = withRateLimit(getWatchlists, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(createWatchlist, RATE_LIMITS.API_DEFAULT);
