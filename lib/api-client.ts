/**
 * API Client Utilities
 * Centralized API request handling with error handling, retries, and caching
 */

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Enhanced fetch with retry logic and timeout
 */
export async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          const errorData = await response.json().catch(() => ({}));
          return {
            error: errorData.error || `Request failed with status ${response.status}`,
            status: response.status,
          };
        }

        // Retry on 5xx errors (server errors)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on abort (timeout)
      if (error instanceof Error && error.name === "AbortError") {
        return {
          error: "Request timeout",
          status: 408,
        };
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
      }
    }
  }

  return {
    error: lastError?.message || "Request failed after multiple retries",
    status: 500,
  };
}

/**
 * GET request helper
 */
export async function apiGet<T>(
  endpoint: string,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  return fetchWithRetry<T>(endpoint, {
    method: "GET",
    ...options,
  });
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  endpoint: string,
  data?: unknown,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  return fetchWithRetry<T>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T>(
  endpoint: string,
  data?: unknown,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  return fetchWithRetry<T>(endpoint, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(
  endpoint: string,
  options?: FetchOptions
): Promise<ApiResponse<T>> {
  return fetchWithRetry<T>(endpoint, {
    method: "DELETE",
    ...options,
  });
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}
