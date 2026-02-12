/**
 * Environment Variable Validation
 * Ensures all required environment variables are set before the application starts
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const;

const optionalEnvVars = [
  'NEXT_PUBLIC_TWELVEDATA_API_KEY',
  'NEXT_PUBLIC_NEWS_API_KEY',
  'NEXT_PUBLIC_GROQ_API_KEY',
  'NEXT_PUBLIC_TAVILY_API_KEY',
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
] as const;

interface ValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validates that all required environment variables are set
 * @returns Validation result with missing and warning variables
 */
export function validateEnv(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional variables (warnings only)
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Validates environment variables and throws error if required ones are missing
 * Logs warnings for missing optional variables
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();

  if (!result.isValid) {
    throw new Error(
      `Missing required environment variables:\n${result.missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      `Please check your .env.local file and ensure all required variables are set.`
    );
  }

  if (result.warnings.length > 0) {
    console.warn(
      `⚠️  Missing optional environment variables:\n${result.warnings.map(v => `  - ${v}`).join('\n')}\n` +
      `Some features may not work without these variables.`
    );
  }
}

/**
 * Gets an environment variable with type safety
 * @param key Environment variable key
 * @param defaultValue Optional default value
 * @returns Environment variable value or default
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is not set and no default provided`);
  }
  
  return value || defaultValue || '';
}

/**
 * Checks if we're in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Checks if we're in development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Checks if we're in test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}
