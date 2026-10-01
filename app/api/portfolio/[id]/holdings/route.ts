import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  addPosition,
  updatePosition,
  deletePosition,
} from '@/lib/db/repositories/portfolios';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * POST /api/portfolio/[id]/holdings
 * Add a new holding (position) to the portfolio.
 * Re-adding the same (symbol, assetType) merges lots via weighted-average cost.
 */
async function addHolding(
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
    const { symbol, assetType, quantity, purchasePrice, purchaseDate, notes } = body;

    // Validation
    if (!symbol || !assetType || !quantity || !purchasePrice) {
      return errorResponse('Missing required fields', 400);
    }

    if (!['stock', 'crypto', 'forex'].includes(assetType)) {
      return errorResponse('Invalid asset type', 400);
    }

    const qty = Number(quantity);
    const price = Number(purchasePrice);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      return errorResponse('Quantity and price must be positive', 400);
    }

    const portfolio = await addPosition(userId, id, {
      symbol: String(symbol),
      assetType,
      quantity: qty,
      purchasePrice: price,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      notes: typeof notes === 'string' ? notes : '',
    });

    if (!portfolio) {
      return errorResponse('Portfolio not found', 404);
    }

    return NextResponse.json(portfolio, { status: 201 });
  } catch (error) {
    console.error('Error adding holding:', error);
    return errorResponse('Failed to add holding', 500);
  }
}

/**
 * PUT /api/portfolio/[id]/holdings
 * Update one position by its stable id (replaces the old array-index API).
 * Body: { positionId, quantity?, purchasePrice?, notes? }
 */
async function updateHolding(
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
    const { positionId, quantity, purchasePrice, notes } = body;

    if (!positionId || typeof positionId !== 'string') {
      return errorResponse('Position id is required', 400);
    }

    const patch: { quantity?: number; purchasePrice?: number; notes?: string } = {};
    if (quantity !== undefined) {
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return errorResponse('Quantity must be positive', 400);
      }
      patch.quantity = qty;
    }
    if (purchasePrice !== undefined) {
      const price = Number(purchasePrice);
      if (!Number.isFinite(price) || price <= 0) {
        return errorResponse('Purchase price must be positive', 400);
      }
      patch.purchasePrice = price;
    }
    if (notes !== undefined) patch.notes = String(notes);

    const portfolio = await updatePosition(userId, id, positionId, patch);

    if (!portfolio) {
      return errorResponse('Position not found', 404);
    }

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error updating holding:', error);
    return errorResponse('Failed to update holding', 500);
  }
}

/**
 * DELETE /api/portfolio/[id]/holdings?positionId=<uuid>
 * Remove one position by id (replaces the old array-index API).
 */
async function deleteHolding(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get('positionId');

    if (!positionId) {
      return errorResponse('Position id is required', 400);
    }

    const portfolio = await deletePosition(userId, id, positionId);

    if (!portfolio) {
      return errorResponse('Position not found', 404);
    }

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error deleting holding:', error);
    return errorResponse('Failed to delete holding', 500);
  }
}

export const POST = withRateLimit(addHolding, RATE_LIMITS.API_DEFAULT);
export const PUT = withRateLimit(updateHolding, RATE_LIMITS.API_DEFAULT);
export const DELETE = withRateLimit(deleteHolding, RATE_LIMITS.API_DEFAULT);
