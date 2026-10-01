import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import {
  findCredentialsUser,
  findPublicUserById,
  registerUser,
} from '@/lib/db/repositories/auth';
import {
  getUserByEmail,
  updateUserImage,
} from '@/lib/db/repositories/users';
import { verifyPassword, isValidEmailDomain } from './auth-utils';
import { env } from './env';

/**
 * NextAuth configuration (JWT sessions — unchanged strategy).
 *
 * Identity (PostgreSQL migration): every user has a canonical UUID
 * `users.id`. OAuth sign-in upserts by email and injects the database id
 * into the JWT (`token.id`/`token.sub`); all data ownership references that
 * id — email is a unique attribute, never a foreign key.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
    }),
    GitHubProvider({
      clientId: env.github.clientId,
      clientSecret: env.github.clientSecret,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Validate email domain
        if (!isValidEmailDomain(credentials.email)) {
          throw new Error('Please use a valid email from a recognized provider');
        }

        // Find user (PostgreSQL)
        const user = await findCredentialsUser(credentials.email);

        if (!user || !user.passwordHash) {
          return null;
        }

        // Verify password
        const isValid = await verifyPassword(credentials.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        // Check if user has verified their email (if applicable)
        if (user.emailVerificationToken) {
          throw new Error('Please verify your email before signing in');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        };
      }
    })
  ],

  // Configure session
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Configure JWT
  jwt: {
    secret: env.nextAuth.secret,
  },

  // Configure callbacks
  callbacks: {
    async session({ session, token }) {
      // Send properties to the client — canonical database user id.
      if (session.user) {
        (session.user as any).id = token.id ?? token.sub;
      }
      return session;
    },

    async jwt({ token, user, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account && user) {
        token.accessToken = account.access_token;
        token.id = user.id;
      }
      return token;
    },

    async signIn({ user, account }) {
      // Log only non-identifying fields — `account` carries OAuth access/
      // refresh tokens and `profile` carries raw provider data, neither of
      // which may end up in logs (Phase 0 logging hygiene).
      console.log('SignIn callback triggered', {
        provider: account?.provider,
        hasEmail: Boolean(user?.email),
      });

      // For OAuth providers, upsert the user in PostgreSQL
      if (account?.provider) {
        try {
          if (!user.email) {
            console.log('OAuth sign-in without email rejected');
            return false;
          }

          // Validate email domain for OAuth users too
          if (!isValidEmailDomain(user.email)) {
            console.log('OAuth user with invalid email domain rejected');
            return false;
          }

          const found = await getUserByEmail(user.email);

          // registerUser returns the public projection; id/image are all the
          // callback needs. The row is created with a null password hash.
          const dbUser = found ?? (await registerUser({
            name: user.name ?? user.email.split('@')[0],
            email: user.email,
            // OAuth users have no local password.
            passwordHash: null,
          }));

          // Update user image if it has changed
          if (user.image && dbUser.image !== user.image) {
            console.log('Updating user image');
            await updateUserImage(dbUser.id, user.image);
          }

          // Add the canonical database id to the user object (flows into JWT).
          user.id = dbUser.id;
          console.log('SignIn successful', { userId: user.id });
          return true;
        } catch (error) {
          console.error('Error in signIn callback:', error);
          return false;
        }
      }

      console.log('Credentials signIn successful');
      return true;
    }
  },

  // Add error handling
  events: {
    async signOut() {
      // Deliberately no payload logging: the signOut message contains the
      // session JWT for the jwt strategy.
      console.log('User signed out');
    }
  },

  // Configure pages
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error', // Error code passed in query string as ?error=
  },

  // Enable debug messages in development
  debug: env.nodeEnv === 'development',
};

export default NextAuth(authOptions);
