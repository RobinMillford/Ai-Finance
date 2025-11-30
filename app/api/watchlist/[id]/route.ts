import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Watchlist, { IWatchlistAsset } from '@/models/Watchlist';
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
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    await dbConnect();
    
    const watchlist = await Watchlist.findOne({
      _id: id,
      userId: session.user.email,
    }).lean();

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
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return errorResponse('Name is required', 400);
    }

    await dbConnect();

    const watchlist = await Watchlist.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      { name: name.trim() },
      { new: true, runValidators: true }
    );

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
async function deleteWatchlist(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    await dbConnect();

    const watchlist = await Watchlist.findOneAndDelete({
      _id: id,
      userId: session.user.email,
    });

    if (!watchlist) {
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
 * Add asset to watchlist
 */
async function addAsset(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
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

    await dbConnect();

    const newAsset: IWatchlistAsset = {
      symbol: symbol.toUpperCase(),
      assetType,
      addedAt: new Date(),
      notes: notes || '',
      alertPrice: alertPrice ? Number(alertPrice) : undefined,
    };

    const watchlist = await Watchlist.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      { $push: { assets: newAsset } },
      { new: true, runValidators: true }
    );

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
export const DELETE = withRateLimit(deleteWatchlist, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(addAsset, RATE_LIMITS.API_DEFAULT);
