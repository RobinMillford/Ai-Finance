/**
 * Environment Variables Configuration
 *
 * Centralized environment variable management with validation and type safety.
 *
 * SECURITY (Phase 0): all third-party provider credentials are SERVER-ONLY.
 * They must NOT use the NEXT_PUBLIC_ prefix — that prefix inlines values into
 * the client bundle, exposing secrets to anyone who views page source.
 * Legacy NEXT_PUBLIC_* names are still read server-side for migration
 * convenience, but the values never reach the browser because every consumer
 * of this module runs on the server.
 */

/**
 * Get environment variable with fallback options
 * Tries multiple possible names (handles legacy naming during migration)
 */
function getEnvVar(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

/**
 * Environment variable configuration
 */
export const env = {
  // AI / LLM (server-only)
  groq: {
    apiKey: getEnvVar(
      'GROQ_API_KEY',
      // Legacy names — server-side only; never expose to the client bundle.
      'NEXT_PUBLIC_GROQ_API_KEY',
      'NEXT_PUBLIC_GROK_API_KEY' // Legacy typo support
    ) || (process.env.NODE_ENV === 'production'
      ? ''
      : 'gsk_dummy-key-for-build-and-development-only'),
  },

  // Market Data APIs (server-only)
  twelveData: {
    apiKey: getEnvVar('TWELVE_DATA_API_KEY', 'NEXT_PUBLIC_TWELVEDATA_API_KEY') || '',
  },

  eulerpool: {
    apiKey: getEnvVar('EULERPOOL_API_KEY') || '',
  },

  tavily: {
    apiKey: getEnvVar('TAVILY_API_KEY', 'NEXT_PUBLIC_TAVILY_API_KEY') || '',
  },

  newsApi: {
    apiKey: getEnvVar('NEWS_API_KEY', 'NEXT_PUBLIC_NEWS_API_KEY', 'NEXT_PUBLIC_NEWSAPI_KEY') || '',
  },

  // Database (PostgreSQL — server-only connection string)
  database: {
    url: getEnvVar('DATABASE_URL') || '',
  },

  // Authentication
  nextAuth: {
    secret: getEnvVar('NEXTAUTH_SECRET') || '',
    url: getEnvVar('NEXTAUTH_URL') || 'http://localhost:3000',
    urlInternal: getEnvVar('NEXTAUTH_URL_INTERNAL') || getEnvVar('NEXTAUTH_URL') || 'http://localhost:3000',
  },

  // OAuth Providers
  google: {
    clientId: getEnvVar('GOOGLE_CLIENT_ID') || '',
    clientSecret: getEnvVar('GOOGLE_CLIENT_SECRET') || '',
  },

  github: {
    clientId: getEnvVar('GITHUB_ID') || '',
    clientSecret: getEnvVar('GITHUB_SECRET') || '',
  },

  reddit: {
    clientId: getEnvVar('REDDIT_CLIENT_ID') || '',
    clientSecret: getEnvVar('REDDIT_CLIENT_SECRET') || '',
    userAgent: getEnvVar('REDDIT_USER_AGENT') || '',
  },

  // Email
  resend: {
    apiKey: getEnvVar('RESEND_API_KEY') || '',
    from: getEnvVar('EMAIL_FROM') || '',
  },

  // Public (safe for the browser — non-secret configuration only)
  public: {
    /**
     * Server-side base URL used by server code to call its own routes.
     * NOT a secret; only used from server contexts.
     */
    baseUrl: getEnvVar('NEXT_PUBLIC_BASE_URL') || 'http://localhost:3000',
    contactFormUrl: getEnvVar('NEXT_PUBLIC_CONTACT_FORM_URL') || '',
  },

  nodeEnv: getEnvVar('NODE_ENV') || 'development',
  port: parseInt(getEnvVar('PORT') || '3000', 10),
} as const;

/**
 * Validate required environment variables
 */
export function validateEnv() {
  const required = {
    'GROQ_API_KEY': env.groq.apiKey,
    'DATABASE_URL': env.database.url,
    'NEXTAUTH_SECRET': env.nextAuth.secret,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value || value.includes('dummy'))
    .map(([key]) => key);

  if (missing.length > 0) {
    const message = `⚠️  Missing required environment variables:\n   ${missing.join(', ')}`;

    if (env.nodeEnv === 'production') {
      console.error(message);
      console.error('   Application may not work correctly!');
    } else {
      console.warn(message);
      console.warn('   Using fallback values for development.');
    }
  }

  return missing.length === 0;
}

/**
 * Check if we have a valid Groq API key
 */
export function hasValidGroqKey(): boolean {
  return !!(
    env.groq.apiKey &&
    !env.groq.apiKey.includes('dummy') &&
    env.groq.apiKey.length > 20 &&
    env.groq.apiKey.startsWith('gsk_')
  );
}

// Run validation on import (but don't throw in production builds)
if (typeof window === 'undefined') {
  // Server-side only
  validateEnv();
}
