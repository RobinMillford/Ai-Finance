import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import { withRateLimit, errorResponse } from '@/lib/api-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { valuePortfolio, portfolioHistory } from '@/lib/portfolio/valuation';

/**
 * GET /api/portfolio/[id]/valuation
 * Real portfolio valuation: live quotes, P&L vs cost basis, day change,
 * and historical value from persisted candles (all optional via query).
 */
async function getValuation(
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
    const includeHistory = searchParams.get('history') === '1';
    const historyDays = Math.min(Math.max(Number(searchParams.get('days')) || 180, 30), 400);

    await dbConnect();

    const portfolio = await Portfolio.findOne({
      _id: id,
      userId: session.user.email,
    }).lean();

    if (!portfolio) {
      return errorResponse('Portfolio not found', 404);
    }

    const holdings = portfolio.holdings.map((h) => ({
      symbol: h.symbol,
      assetType: h.assetType,
      quantity: h.quantity,
      purchasePrice: h.purchasePrice,
    }));

    const valuation = await valuePortfolio(holdings);

    if (!includeHistory) {
      return NextResponse.json(valuation);
    }

    const history = await portfolioHistory(holdings, { days: historyDays });
    return NextResponse.json({ ...valuation, history });
  } catch (error) {
    console.error('Error computing valuation:', error);
    return errorResponse('Failed to compute valuation', 500);
  }
}

export const GET = withRateLimit(getValuation, RATE_LIMITS.API_DEFAULT);
