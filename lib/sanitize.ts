import DOMPurify from 'isomorphic-dompurify';

/**
 * Input Sanitization Utilities
 * Prevents XSS attacks by sanitizing user input
 */

/**
 * Sanitizes plain text input by removing all HTML tags
 * Use this for user input that should never contain HTML
 * @param input User input string
 * @returns Sanitized string with all HTML removed
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitizes HTML content while allowing safe tags
 * Use this for rich text content that may contain formatting
 * @param html HTML string
 * @returns Sanitized HTML with only safe tags
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'code', 'pre',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes URL to prevent javascript: and data: URIs
 * @param url URL string
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  const sanitized = DOMPurify.sanitize(url);
  
  // Block javascript: and data: URIs
  if (
    sanitized.toLowerCase().startsWith('javascript:') ||
    sanitized.toLowerCase().startsWith('data:')
  ) {
    return '';
  }
  
  return sanitized;
}

/**
 * Escapes special characters in a string for safe use in HTML
 * @param str String to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return str.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Sanitizes object properties recursively
 * Useful for sanitizing form data or API responses
 * @param obj Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T;
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeInput(value) as T[keyof T];
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value) as T[keyof T];
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map(item =>
        typeof item === 'string' ? sanitizeInput(item) : item
      ) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes email address
 * @param email Email string
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  const sanitized = sanitizeInput(email).toLowerCase().trim();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Sanitizes filename to prevent directory traversal
 * @param filename Filename string
 * @returns Safe filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  
  // Remove path separators and null bytes
  return filename
    .replace(/[/\\]/g, '')
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .trim();
}
