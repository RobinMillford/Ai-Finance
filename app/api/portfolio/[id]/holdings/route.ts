import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Portfolio, { IHolding } from '@/models/Portfolio';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * POST /api/portfolio/[id]/holdings
 * Add a new holding to the portfolio
 */
async function addHolding(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params; // Await params before using

    const body = await request.json();
    const { symbol, assetType, quantity, purchasePrice, purchaseDate, notes } = body;

    // Validation
    if (!symbol || !assetType || !quantity || !purchasePrice) {
      return errorResponse('Missing required fields', 400);
    }

    if (!['stock', 'crypto', 'forex'].includes(assetType)) {
      return errorResponse('Invalid asset type', 400);
    }

    if (quantity <= 0 || purchasePrice <= 0) {
      return errorResponse('Quantity and price must be positive', 400);
    }

    await dbConnect();

    const newHolding: IHolding = {
      symbol: symbol.toUpperCase(),
      assetType,
      quantity: Number(quantity),
      purchasePrice: Number(purchasePrice),
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      notes: notes || '',
    };

    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      { $push: { holdings: newHolding } },
      { new: true, runValidators: true }
    );

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
 * Update a holding in the portfolio
 */
async function updateHolding(
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
    const { holdingIndex, quantity, purchasePrice, notes } = body;

    if (holdingIndex === undefined) {
      return errorResponse('Holding index is required', 400);
    }

    await dbConnect();

    const updateFields: any = {};
    if (quantity !== undefined) updateFields[`holdings.${holdingIndex}.quantity`] = Number(quantity);
    if (purchasePrice !== undefined) updateFields[`holdings.${holdingIndex}.purchasePrice`] = Number(purchasePrice);
    if (notes !== undefined) updateFields[`holdings.${holdingIndex}.notes`] = notes;

    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId: session.user.email },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!portfolio) {
      return errorResponse('Portfolio not found', 404);
    }

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error updating holding:', error);
    return errorResponse('Failed to update holding', 500);
  }
}

/**
 * DELETE /api/portfolio/[id]/holdings
 * Remove a holding from the portfolio
 */
async function deleteHolding(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const holdingIndex = searchParams.get('index');

    if (holdingIndex === null) {
      return errorResponse('Holding index is required', 400);
    }

    await dbConnect();

    const portfolio = await Portfolio.findOne({
      _id: id,
      userId: session.user.email,
    });

    if (!portfolio) {
      return errorResponse('Portfolio not found', 404);
    }

    portfolio.holdings.splice(Number(holdingIndex), 1);
    await portfolio.save();

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error deleting holding:', error);
    return errorResponse('Failed to delete holding', 500);
  }
}

export const POST = withRateLimit(addHolding, RATE_LIMITS.API_DEFAULT);
export const PUT = withRateLimit(updateHolding, RATE_LIMITS.API_DEFAULT);
export const DELETE = withRateLimit(deleteHolding, RATE_LIMITS.API_DEFAULT);
