import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import { withRateLimit, errorResponse, successResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';

/**
 * GET /api/portfolio
 * Get all portfolios for the authenticated user
 */
async function getPortfolios(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    await dbConnect();
    
    const portfolios = await Portfolio.find({ userId: session.user.email })
      .sort({ createdAt: -1 })
      .lean();

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
async function createPortfolio(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return errorResponse('Portfolio name is required', 400);
    }

    await dbConnect();

    const portfolio = await Portfolio.create({
      userId: session.user.email,
      name: name.trim(),
      description: description?.trim() || '',
      holdings: [],
    });

    return NextResponse.json(portfolio, { status: 201 });
  } catch (error) {
    console.error('Error creating portfolio:', error);
    return errorResponse('Failed to create portfolio', 500);
  }
}

export const GET = withRateLimit(getPortfolios, RATE_LIMITS.API_DEFAULT);
export const POST = withRateLimit(createPortfolio, RATE_LIMITS.API_DEFAULT);
