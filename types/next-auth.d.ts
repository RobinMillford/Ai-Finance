import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user?: {
      /** Canonical PostgreSQL user id (UUID) — populated from the JWT `sub` claim (see lib/auth.ts). */
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
