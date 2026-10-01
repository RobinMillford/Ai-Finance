import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getUserTrackedAssets,
  addUserTrackedAsset,
  removeUserTrackedAsset,
} from '@/lib/db/repositories/users';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trackedAssets = await getUserTrackedAssets(userId);

    return NextResponse.json({ trackedAssets });
  } catch (error) {
    console.error('Error fetching tracked assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, symbol } = await request.json();

    if (!type || !symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: 'Type and symbol are required' }, { status: 400 });
    }

    if (!['stock', 'crypto', 'forex'].includes(type)) {
      return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 });
    }

    await addUserTrackedAsset(userId, { type, symbol });

    const trackedAssets = await getUserTrackedAssets(userId);

    return NextResponse.json({ trackedAssets });
  } catch (error) {
    console.error('Error adding tracked asset:', error);
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

    await removeUserTrackedAsset(userId, symbol);

    const trackedAssets = await getUserTrackedAssets(userId);

    return NextResponse.json({ trackedAssets });
  } catch (error) {
    console.error('Error removing tracked asset:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
