import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Watchlist from '@/models/Watchlist';
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
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id, symbol } = await params;

    await dbConnect();

    // Remove the asset from the watchlist
    const watchlist = await Watchlist.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      { $pull: { assets: { symbol: symbol.toUpperCase() } } },
      { new: true, runValidators: true }
    );

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
