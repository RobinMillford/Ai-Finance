import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getUserPortfolios,
  createPortfolio,
} from '@/lib/db/repositories/portfolios';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * GET /api/portfolio
 * Get all portfolios for the authenticated user
 */
async function getPortfolios(request: Request) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const portfolios = await getUserPortfolios(userId);

    return NextResponse.json(portfolios);
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    return errorResponse('Failed to fetch portfolios', 500);
  }
}

/**
 * POST /api/portfolio
 * Create a new portfolio
 */
async function createNewPortfolio(request: Request) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return errorResponse('Portfolio name is required', 400);
    }

    const portfolio = await createPortfolio(userId, {
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
    });

    return NextResponse.json(portfolio, { status: 201 });
  } catch (error) {
    console.error('Error creating portfolio:', error);
    return errorResponse('Failed to create portfolio', 500);
  }
}

export const GET = withRateLimit(getPortfolios, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(createNewPortfolio, RATE_LIMITS.API_DEFAULT);
