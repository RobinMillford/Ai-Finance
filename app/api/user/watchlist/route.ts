import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getUserWatchlistSymbols,
  addUserWatchlistSymbol,
  removeUserWatchlistSymbol,
} from '@/lib/db/repositories/users';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watchlist = await getUserWatchlistSymbols(userId);

    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { symbol } = await request.json();

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    await addUserWatchlistSymbol(userId, symbol);

    const watchlist = await getUserWatchlistSymbols(userId);

    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    await removeUserWatchlistSymbol(userId, symbol);

    const watchlist = await getUserWatchlistSymbols(userId);

    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
