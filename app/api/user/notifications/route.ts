import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/api-auth';
import {
  getUserById,
  updateUserNotificationPreferences,
} from '@/lib/db/repositories/users';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/db/schema';

function coercePreferences(raw: unknown): NotificationPreferences {
  const prefs: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  };
  if (raw && typeof raw === 'object') {
    const input = raw as Record<string, unknown>;
    for (const key of Object.keys(prefs) as (keyof NotificationPreferences)[]) {
      if (typeof input[key] === 'boolean') {
        prefs[key] = input[key] as boolean;
      }
    }
  }
  return prefs;
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const preferences = coercePreferences(body);

    const user = await updateUserNotificationPreferences(userId, preferences);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ notificationPreferences: user.notificationPreferences });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ notificationPreferences: user.notificationPreferences });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
