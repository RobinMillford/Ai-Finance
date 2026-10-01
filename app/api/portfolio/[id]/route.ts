import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getPortfolioById,
  updatePortfolio,
  deletePortfolio,
} from '@/lib/db/repositories/portfolios';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * GET /api/portfolio/[id]
 * Get a specific portfolio with its positions (holdings)
 */
async function getPortfolio(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const portfolio = await getPortfolioById(userId, id);

    if (!portfolio) {
      return errorResponse('Portfolio not found', 404);
    }

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return errorResponse('Failed to fetch portfolio', 500);
  }
}

/**
 * PUT /api/portfolio/[id]
 * Update portfolio details (name, description)
 */
async function updatePortfolioRoute(
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
    const { name, description } = body;

    const patch: { name?: string; description?: string } = {};
    if (typeof name === 'string' && name.trim()) patch.name = name.trim();
    if (typeof description === 'string') patch.description = description.trim();

    const portfolio = await updatePortfolio(userId, id, patch);

    if (!portfolio) {
      return errorResponse('Portfolio not found', 404);
    }

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error updating portfolio:', error);
    return errorResponse('Failed to update portfolio', 500);
  }
}

/**
 * DELETE /api/portfolio/[id]
 * Delete a portfolio (cascades to positions + transactions)
 */
async function deletePortfolioRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    const deleted = await deletePortfolio(userId, id);

    if (!deleted) {
      return errorResponse('Portfolio not found', 404);
    }

    return NextResponse.json({ message: 'Portfolio deleted successfully' });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    return errorResponse('Failed to delete portfolio', 500);
  }
}

export const GET = withRateLimit(getPortfolio, RATE_LIMITS.API_DEFAULT);
export const PUT = withRateLimit(updatePortfolioRoute, RATE_LIMITS.API_DEFAULT);
export const DELETE = withRateLimit(deletePortfolioRoute, RATE_LIMITS.API_DEFAULT);
