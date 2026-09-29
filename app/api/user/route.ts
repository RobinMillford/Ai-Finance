import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import { findPublicUserById } from '@/lib/db/repositories/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await findPublicUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
