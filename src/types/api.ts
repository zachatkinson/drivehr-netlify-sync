/**
 * API and HTTP Client Types
 *
 * Comprehensive type definitions for HTTP communication, API responses, and client interfaces.
 * Ensures type safety across all external communication including DriveHR API integration,
 * WordPress webhook communication, and general HTTP client operations.
 *
 * These types provide strong typing for:
 * - HTTP client configuration and responses
 * - API credentials and authentication
 * - Webhook security and CORS configuration
 * - Rate limiting and retry mechanisms
 *
 * @module api-types
 * @since 1.0.0
 */

/**
 * HTTP client configuration interface
 *
 * Defines configuration options for HTTP client instances with support
 * for timeouts, retries, custom headers, and user agent strings.
 *
 * @example
 * ```typescript
 * const config: HttpClientConfig = {
 *   baseUrl: 'https://api.example.com',
 *   timeout: 30000,
 *   retries: 3,
 *   userAgent: 'MyApp/1.0',
 *   headers: {
 *     'Authorization': 'Bearer token123',
 *     'Content-Type': 'application/json'
 *   }
 * };
 * ```
 * @since 1.0.0
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
 * HTTP response interface with generic data typing
 *
 * Standardized HTTP response structure that wraps all HTTP responses
 * with consistent metadata and strongly-typed data payloads.
 *
 * @template T - Type of the response data payload
 * @example
 * ```typescript
 * // Typed API response
 * const response: HttpResponse<JobData[]> = await httpClient.get('/jobs');
 * if (response.success && response.status === 200) {
 *   const jobs = response.data; // Type: JobData[]
 *   console.log(`Received ${jobs.length} jobs`);
 * }
 *
 * // Error handling
 * if (!response.success) {
 *   console.error(`HTTP ${response.status}: ${response.statusText}`);
 * }
 * ```
 * @since 1.0.0
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
 * HTTP error interface for enhanced error handling
 *
 * Extended error interface that provides detailed information about
 * HTTP request failures, including status codes, response data,
 * and error categorization for proper error handling.
 *
 * @example
 * ```typescript
 * try {
 *   await httpClient.post('/api/data', payload);
 * } catch (error) {
 *   if (error instanceof Error && 'status' in error) {
 *     const httpError = error as HttpError;
 *     if (httpError.isTimeoutError) {
 *       console.log('Request timed out, retrying...');
 *     } else if (httpError.status === 429) {
 *       console.log('Rate limited, backing off...');
 *     } else if (httpError.isNetworkError) {
 *       console.log('Network connectivity issue');
 *     }
 *   }
 * }
 * ```
 * @since 1.0.0
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
 * Generic API credentials interface
 *
 * Flexible credential structure that supports various authentication
 * methods including tokens, basic auth, and API keys. Used as a base
 * for more specific API configuration interfaces.
 *
 * @example
 * ```typescript
 * // Token-based authentication
 * const tokenAuth: ApiCredentials = {
 *   token: 'jwt-token-here'
 * };
 *
 * // Basic authentication
 * const basicAuth: ApiCredentials = {
 *   username: 'user@example.com',
 *   password: 'secure-password'
 * };
 *
 * // API key authentication
 * const apiKeyAuth: ApiCredentials = {
 *   apiKey: 'api-key-12345'
 * };
 * ```
 * @since 1.0.0
 */
export interface ApiCredentials {
  /** Bearer token for JWT or OAuth authentication */
  readonly token?: string;
  /** Username for basic authentication */
  readonly username?: string;
  /** Password for basic authentication */
  readonly password?: string;
  /** API key for key-based authentication */
  readonly apiKey?: string;
}

/**
 * WordPress API configuration interface
 *
 * Configuration for WordPress REST API communication including
 * authentication credentials, endpoint URLs, and request settings.
 * Extends ApiCredentials to support multiple authentication methods.
 *
 * @example
 * ```typescript
 * const wpConfig: WordPressApiConfig = {
 *   baseUrl: 'https://mysite.com/wp-json/drivehr/v1/sync',
 *   timeout: 30000,
 *   retries: 3
 * };
 * ```
 * @since 1.0.0
 * @see {@link ApiCredentials} for authentication options
 */
export interface WordPressApiConfig extends ApiCredentials {
  /** WordPress REST API base URL (typically ends with /wp-json/...) */
  readonly baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  readonly timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  readonly retries?: number;
}

/**
 * DriveHR API configuration interface
 *
 * Configuration for DriveHR API integration including company-specific
 * URLs, identifiers, and request settings. Used for job data fetching
 * from various DriveHR endpoints and formats.
 *
 * @example
 * ```typescript
 * const driveHrConfig: DriveHrApiConfig = {
 *   careersUrl: 'https://drivehris.app/careers/acme-corp/list',
 *   companyId: 'acme-corp-uuid-here',
 *   apiBaseUrl: 'https://drivehris.app/careers/acme-corp',
 *   timeout: 30000,
 *   retries: 3
 * };
 * ```
 * @since 1.0.0
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
 * Webhook security configuration interface
 *
 * Configuration for webhook signature verification including HMAC
 * algorithm, secret key, and header naming conventions for secure
 * webhook communication.
 *
 * @example
 * ```typescript
 * const webhookConfig: WebhookConfig = {
 *   secret: 'super-secret-webhook-key-min-32-chars',
 *   algorithm: 'sha256',
 *   headerName: 'x-webhook-signature'
 * };
 * ```
 * @since 1.0.0
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
 * Defines required security headers for HTTP responses to protect
 * against common web vulnerabilities including XSS, clickjacking,
 * and content sniffing attacks.
 *
 * @example
 * ```typescript
 * const securityHeaders: SecurityHeaders = {
 *   'Content-Type': 'application/json',
 *   'Content-Security-Policy': "default-src 'self'",
 *   'X-Frame-Options': 'DENY',
 *   'X-Content-Type-Options': 'nosniff',
 *   'Referrer-Policy': 'strict-origin-when-cross-origin',
 *   'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
 * };
 * ```
 * @since 1.0.0
 * @see {@link https://owasp.org/www-project-secure-headers/} for security header best practices
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
 * Configuration for handling cross-origin requests including allowed
 * origins, HTTP methods, headers, and preflight cache duration.
 *
 * @example
 * ```typescript
 * // Allow specific origins
 * const strictCors: CorsConfig = {
 *   origin: ['https://myapp.com', 'https://admin.myapp.com'],
 *   methods: ['GET', 'POST'],
 *   headers: ['Content-Type', 'Authorization'],
 *   maxAge: 86400 // 24 hours
 * };
 *
 * // Allow all origins (development only)
 * const permissiveCors: CorsConfig = {
 *   origin: '*',
 *   methods: ['GET', 'POST', 'PUT', 'DELETE'],
 *   headers: ['*'],
 *   maxAge: 3600 // 1 hour
 * };
 * ```
 * @since 1.0.0
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS} for CORS documentation
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
 * Rate limiting configuration interface
 *
 * Configuration for API rate limiting to prevent abuse and ensure
 * fair usage across clients. Defines time windows, request limits,
 * and behavior options.
 *
 * @example
 * ```typescript
 * // Standard rate limiting
 * const rateLimitConfig: RateLimitConfig = {
 *   windowMs: 60000, // 1 minute
 *   maxRequests: 100, // 100 requests per minute
 *   skipSuccessfulRequests: false
 * };
 *
 * // Strict rate limiting for sensitive endpoints
 * const strictLimits: RateLimitConfig = {
 *   windowMs: 900000, // 15 minutes
 *   maxRequests: 5, // 5 requests per 15 minutes
 *   skipSuccessfulRequests: true // only count failed requests
 * };
 * ```
 * @since 1.0.0
 */
export interface RateLimitConfig {
  /** Time window in milliseconds for rate limit calculation */
  readonly windowMs: number;
  /** Maximum number of requests allowed within the time window */
  readonly maxRequests: number;
  /** Whether to exclude successful requests from rate limit counting */
  readonly skipSuccessfulRequests?: boolean;
}

/**
 * HTTP request retry configuration interface
 *
 * Configuration for automatic retry logic including exponential backoff,
 * jitter, and delay limits to handle transient failures gracefully.
 *
 * @example
 * ```typescript
 * // Standard retry configuration
 * const retryConfig: RetryConfig = {
 *   maxAttempts: 3,
 *   baseDelay: 1000, // Start with 1 second
 *   maxDelay: 10000, // Cap at 10 seconds
 *   exponentialBase: 2, // Double delay each time
 *   jitter: true // Add randomness to prevent thundering herd
 * };
 *
 * // Aggressive retry for critical operations
 * const aggressiveRetry: RetryConfig = {
 *   maxAttempts: 5,
 *   baseDelay: 500,
 *   maxDelay: 30000,
 *   exponentialBase: 1.5,
 *   jitter: true
 * };
 * ```
 * @since 1.0.0
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
