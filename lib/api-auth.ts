import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Canonical session identity for API routes.
 *
 * With the JWT session strategy there is no database adapter: `session.user.id`
 * is populated from the JWT `id`/`sub` claim (see lib/auth.ts) and IS the
 * users.id UUID — the ownership key every repository query is scoped by.
 * Returns null when the caller is not an authenticated user.
 */
export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
