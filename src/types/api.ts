/**
 * HTTP client configuration interface
 *
 * Defines the configuration options for HTTP client instances, providing
 * control over request behavior, timeouts, retries, and default headers.
 * Supports both global and per-request configuration overrides.
 *
 * @since 1.0.0
 * @see {@link ../lib/http-client.ts} for HTTP client implementation
 */
export interface HttpClientConfig {
  /** Base URL for all requests (optional, can be provided per request) */
  readonly baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  readonly timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  readonly retries?: number;
  /** User agent string for requests (default: auto-generated) */
  readonly userAgent?: string;
  /** Default headers to include with all requests */
  readonly headers?: Record<string, string>;
}

/**
 * HTTP response data structure with generic typing support
 *
 * Represents a complete HTTP response with status information, headers,
 * and typed response data. Provides success flag for quick status checking
 * and supports generic typing for response data validation.
 *
 * @template T - Type of the response data payload
 * @since 1.0.0
 * @see {@link HttpError} for error response handling
 */
export interface HttpResponse<T = unknown> {
  /** HTTP status code (200, 404, 500, etc.) */
  readonly status: number;
  /** HTTP status text ('OK', 'Not Found', 'Internal Server Error', etc.) */
  readonly statusText: string;
  /** Response headers as key-value pairs (lowercased keys) */
  readonly headers: Record<string, string>;
  /** Parsed response data with generic typing */
  readonly data: T;
  /** Whether the request was successful (status < 400) */
  readonly success: boolean;
}

/**
 * HTTP error interface extending native Error
 *
 * Provides detailed error information for HTTP requests including status codes,
 * response data, and error classification for proper error handling and retry logic.
 * Distinguishes between network errors, timeouts, and server errors.
 *
 * @since 1.0.0
 * @see {@link HttpResponse} for successful response structure
 */
export interface HttpError extends Error {
  /** HTTP status code (if the request reached the server) */
  readonly status?: number;
  /** HTTP status text (if available) */
  readonly statusText?: string;
  /** Full HTTP response object (if available) */
  readonly response?: HttpResponse;
  /** True if this is a network connectivity error */
  readonly isNetworkError: boolean;
  /** True if this is a timeout error */
  readonly isTimeoutError: boolean;
}

/**
 * WordPress API configuration interface
 *
 * Defines WordPress webhook endpoint configuration including URL and request
 * behavior settings. Used for WordPress webhook client initialization without
 * authentication since webhooks use HMAC signature validation.
 *
 * @since 1.0.0
 * @see {@link ../services/wordpress-client.ts} for WordPress client implementation
 */
export interface WordPressApiConfig {
  /** WordPress webhook endpoint URL */
  readonly baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  readonly timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  readonly retries?: number;
}

/**
 * DriveHR API configuration interface
 *
 * Defines configuration for DriveHR career site scraping including URLs,
 * company identification, and request behavior. Used for job fetching
 * operations from DriveHR career pages.
 *
 * @since 1.0.0
 * @see {@link ../services/playwright-scraper.ts} for DriveHR scraping implementation
 */
export interface DriveHrApiConfig {
  /** URL to the company's careers page for HTML scraping */
  readonly careersUrl: string;
  /** Unique company identifier (UUID format) */
  readonly companyId: string;
  /** Base URL for API endpoints specific to this company */
  readonly apiBaseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  readonly timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  readonly retries?: number;
}

/**
 * Webhook configuration interface for HMAC signature validation
 *
 * Defines webhook security configuration including secret keys, HMAC algorithms,
 * and header naming for webhook signature validation. Used to ensure webhook
 * request authenticity and prevent unauthorized webhook calls.
 *
 * @since 1.0.0
 * @see {@link ../lib/utils.ts} for HMAC signature validation utilities
 */
export interface WebhookConfig {
  /** Secret key for HMAC signature generation (minimum 16 characters) */
  readonly secret: string;
  /** HMAC algorithm for signature generation (sha256 recommended) */
  readonly algorithm: 'sha256' | 'sha1';
  /** HTTP header name for webhook signature (e.g., 'x-webhook-signature') */
  readonly headerName: string;
}

/**
 * Security headers interface for HTTP responses
 *
 * Defines required security headers for all HTTP responses to prevent
 * common web vulnerabilities including XSS, clickjacking, and MIME sniffing.
 * Implements enterprise-grade security standards for web applications.
 *
 * @since 1.0.0
 * @see {@link https://owasp.org/www-project-secure-headers/} OWASP Secure Headers
 */
export interface SecurityHeaders extends Record<string, string> {
  /** MIME type of the response content */
  readonly 'Content-Type': string;
  /** Content Security Policy to prevent XSS attacks */
  readonly 'Content-Security-Policy': string;
  /** Prevents page from being embedded in frames (clickjacking protection) */
  readonly 'X-Frame-Options': string;
  /** Prevents MIME type sniffing */
  readonly 'X-Content-Type-Options': string;
  /** Controls referrer information sent with requests */
  readonly 'Referrer-Policy': string;
  /** Controls access to browser features and APIs */
  readonly 'Permissions-Policy': string;
}

/**
 * CORS (Cross-Origin Resource Sharing) configuration interface
 *
 * Defines CORS policy settings for cross-origin HTTP requests including
 * allowed origins, methods, headers, and preflight cache duration. Used
 * to configure secure cross-origin access for web applications.
 *
 * @since 1.0.0
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS} MDN CORS documentation
 */
export interface CorsConfig {
  /** Allowed origins (specific URLs or '*' for all) */
  readonly origin: string | string[];
  /** Allowed HTTP methods for cross-origin requests */
  readonly methods: string[];
  /** Allowed headers for cross-origin requests */
  readonly headers: string[];
  /** Preflight request cache duration in seconds */
  readonly maxAge: number;
}

/**
 * HTTP request retry configuration interface
 *
 * Defines exponential backoff retry strategy for failed HTTP requests
 * including maximum attempts, delays, and jitter settings. Used to
 * implement resilient HTTP client behavior with configurable retry logic.
 *
 * @since 1.0.0
 * @see {@link ../lib/http-client.ts} for retry implementation
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (including initial request) */
  readonly maxAttempts: number;
  /** Initial delay in milliseconds before first retry */
  readonly baseDelay: number;
  /** Maximum delay in milliseconds (caps exponential growth) */
  readonly maxDelay: number;
  /** Base for exponential backoff calculation (e.g., 2 = double each time) */
  readonly exponentialBase: number;
  /** Whether to add random jitter to prevent thundering herd effect */
  readonly jitter: boolean;
}
