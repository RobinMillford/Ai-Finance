import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import { updateUserProfile } from '@/lib/db/repositories/users';
import { findPublicUserById } from '@/lib/db/repositories/auth';

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, isPublic } = await request.json();

    const patch: { name?: string; isPublic?: boolean } = {};
    if (typeof name === 'string' && name.trim()) {
      patch.name = name.trim();
    }
    if (typeof isPublic === 'boolean') {
      patch.isPublic = isPublic;
    }

    const updated = await updateUserProfile(userId, patch);

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Re-read through the public projection (never exposes hashes).
    const user = await findPublicUserById(userId);

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
