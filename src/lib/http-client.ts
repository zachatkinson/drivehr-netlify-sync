/**
 * HTTP Client Abstraction
 *
 * Enterprise-grade HTTP client with retry logic, timeout handling, and proper error management.
 * Implements dependency inversion principle with clean interfaces.
 */

import fetch, { type Response } from 'node-fetch';
import type { HttpClientConfig, HttpResponse, HttpError, RetryConfig } from '../types/api.js';

/**
 * Re-export HttpResponse type for external use
 *
 * Provides convenient access to the HttpResponse type interface
 * for consumers of this module without requiring them to import
 * from the types/api module directly.
 *
 * @example
 * ```typescript
 * import { type HttpResponse } from './http-client.js';
 *
 * function handleResponse(response: HttpResponse<UserData>) {
 *   if (response.ok) {
 *     console.log('User data:', response.data);
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link ../types/api.HttpResponse} for the complete type definition
 */
export type { HttpResponse } from '../types/api.js';

/**
 * HTTP Client interface for dependency injection
 *
 * Defines the contract for HTTP client implementations with support
 * for all major HTTP methods. Enables dependency inversion and makes
 * services easily testable by allowing mock implementations.
 * All methods return strongly typed responses with consistent error handling.
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(private httpClient: IHttpClient) {}
 *
 *   async fetchData(url: string): Promise<any> {
 *     const response = await this.httpClient.get<MyData>(url);
 *     if (response.success) {
 *       return response.data;
 *     }
 *     throw new Error('Failed to fetch data');
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link HttpClient} for the production implementation
 * @see {@link createHttpClient} for factory function
 */
export interface IHttpClient {
  /**
   * Perform HTTP GET request
   *
   * @param url - The URL to request
   * @param headers - Optional HTTP headers
   * @returns Promise resolving to typed HTTP response
   * @throws {HttpClientError} When request fails or times out
   * @since 1.0.0
   */
  get<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>>;
  /**
   * Perform HTTP POST request
   *
   * @param url - The URL to request
   * @param data - Optional request body data
   * @param headers - Optional HTTP headers
   * @returns Promise resolving to typed HTTP response
   * @throws {HttpClientError} When request fails or times out
   * @since 1.0.0
   */
  post<T = unknown>(
    url: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  /**
   * Perform HTTP PUT request
   *
   * @param url - The URL to request
   * @param data - Optional request body data
   * @param headers - Optional HTTP headers
   * @returns Promise resolving to typed HTTP response
   * @throws {HttpClientError} When request fails or times out
   * @since 1.0.0
   */
  put<T = unknown>(
    url: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  /**
   * Perform HTTP DELETE request
   *
   * @param url - The URL to request
   * @param headers - Optional HTTP headers
   * @returns Promise resolving to typed HTTP response
   * @throws {HttpClientError} When request fails or times out
   * @since 1.0.0
   */
  delete<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>>;
}

/**
 * Custom HTTP error class with enhanced error information
 *
 * Provides detailed error information for HTTP request failures,
 * including status codes, response data, and error categorization.
 * Helps with proper error handling and debugging in services.
 *
 * @example
 * ```typescript
 * try {
 *   const response = await httpClient.get('/api/data');
 * } catch (error) {
 *   if (error instanceof HttpClientError) {
 *     if (error.isTimeoutError) {
 *       console.log('Request timed out');
 *     } else if (error.status === 404) {
 *       console.log('Resource not found');
 *     }
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link HttpError} for the interface definition
 */
export class HttpClientError extends Error implements HttpError {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly response?: HttpResponse;
  public readonly isNetworkError: boolean;
  public readonly isTimeoutError: boolean;

  /**
   * Create a new HttpClientError
   *
   * @param message - Human-readable error message
   * @param status - HTTP status code (if applicable)
   * @param statusText - HTTP status text (if applicable)
   * @param response - The HTTP response object (if available)
   * @param isNetworkError - Whether this is a network connectivity error
   * @param isTimeoutError - Whether this is a timeout error
   * @since 1.0.0
   */
  constructor(
    message: string,
    status?: number,
    statusText?: string,
    response?: HttpResponse,
    isNetworkError = false,
    isTimeoutError = false
  ) {
    super(message);
    this.name = 'HttpClientError';
    this.status = status;
    this.statusText = statusText;
    this.response = response;
    this.isNetworkError = isNetworkError;
    this.isTimeoutError = isTimeoutError;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpClientError);
    }
  }
}

/**
 * Exponential backoff retry strategy implementation
 *
 * Implements enterprise-grade retry logic with exponential backoff, jitter,
 * and intelligent retry conditions. Follows the SOLID principles by providing
 * a single responsibility for retry orchestration with configurable behavior.
 *
 * Key Features:
 * - Exponential backoff with configurable base and multiplier
 * - Optional jitter to prevent thundering herd problem
 * - Intelligent retry conditions based on error types
 * - Configurable maximum attempts and delays
 * - Built-in support for HTTP client error categorization
 *
 * The strategy automatically retries on:
 * - Network connectivity errors
 * - Timeout errors
 * - Server errors (5xx status codes)
 *
 * It will NOT retry on:
 * - Client errors (4xx status codes)
 * - Authentication/authorization failures
 * - Validation errors
 *
 * @example
 * ```typescript
 * const retryStrategy = new RetryStrategy({
 *   maxAttempts: 5,
 *   baseDelay: 1000,
 *   exponentialBase: 2,
 *   jitter: true
 * });
 *
 * const result = await retryStrategy.execute(
 *   () => httpClient.get('/api/data'),
 *   (error) => error instanceof NetworkError
 * );
 * ```
 * @since 1.0.0
 * @see {@link RetryConfig} for configuration options
 * @see {@link HttpClientError} for error categorization
 */
export class RetryStrategy {
  private readonly config: RetryConfig;

  /**
   * Create a new retry strategy instance
   *
   * Initializes the retry strategy with the provided configuration,
   * applying sensible defaults for enterprise applications. The default
   * configuration provides 3 attempts with exponential backoff starting
   * at 1 second, capped at 10 seconds maximum delay.
   *
   * @param config - Partial retry configuration (defaults applied for missing values)
   * @example
   * ```typescript
   * // Use defaults (3 attempts, 1s base delay, 2x multiplier)
   * const strategy = new RetryStrategy();
   *
   * // Custom configuration
   * const customStrategy = new RetryStrategy({
   *   maxAttempts: 5,
   *   baseDelay: 500,
   *   maxDelay: 30000,
   *   exponentialBase: 1.5,
   *   jitter: false
   * });
   * ```
   * @since 1.0.0
   */
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: config.maxAttempts ?? 3,
      baseDelay: config.baseDelay ?? 1000,
      maxDelay: config.maxDelay ?? 10000,
      exponentialBase: config.exponentialBase ?? 2,
      jitter: config.jitter ?? true,
    };
  }

  /**
   * Execute an operation with retry logic
   *
   * Attempts to execute the provided operation with automatic retry on retryable
   * errors. Uses exponential backoff with optional jitter between attempts.
   * The retry behavior can be customized via the isRetryable predicate function.
   *
   * The operation will be retried based on the configured maximum attempts.
   * Between retries, the strategy will wait for a calculated delay that increases
   * exponentially with each attempt, optionally including jitter to prevent
   * synchronized retries across multiple clients.
   *
   * @template T - The return type of the operation
   * @param operation - Async function to execute with retry logic
   * @param isRetryable - Predicate function to determine if error should trigger retry (defaults to built-in logic)
   * @returns Promise resolving to the operation result
   * @throws {Error} The last error if all retry attempts are exhausted
   * @example
   * ```typescript
   * // Using default retry conditions
   * const data = await retryStrategy.execute(
   *   () => fetch('/api/data').then(r => r.json())
   * );
   *
   * // Custom retry condition
   * const result = await retryStrategy.execute(
   *   () => riskOperation(),
   *   (error) => error.code === 'RATE_LIMITED'
   * );
   * ```
   * @since 1.0.0
   */
  public async execute<T>(
    operation: () => Promise<T>,
    isRetryable: (error: unknown) => boolean = this.defaultRetryCondition
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === this.config.maxAttempts || !isRetryable(error)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Calculate exponential backoff delay with optional jitter
   *
   * Computes the delay duration for the next retry attempt using exponential
   * backoff algorithm. The delay starts at baseDelay and multiplies by
   * exponentialBase for each attempt, capped at maxDelay. Optional jitter
   * adds randomness to prevent thundering herd scenarios.
   *
   * @param attempt - Current attempt number (1-based)
   * @returns Delay in milliseconds before next retry
   * @example
   * ```typescript
   * // For attempt 3 with baseDelay=1000, exponentialBase=2:
   * // delay = min(1000 * 2^(3-1), maxDelay) = min(4000, maxDelay)
   * // With jitter: delay ± (delay * 0.1)
   * ```
   * @since 1.0.0
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.config.baseDelay * Math.pow(this.config.exponentialBase, attempt - 1),
      this.config.maxDelay
    );

    if (!this.config.jitter) {
      return exponentialDelay;
    }

    // Add jitter to prevent thundering herd
    const jitterRange = exponentialDelay * 0.1;
    const jitter = Math.random() * jitterRange * 2 - jitterRange;
    return Math.max(0, exponentialDelay + jitter);
  }

  /**
   * Asynchronous sleep utility
   *
   * Creates a promise that resolves after the specified number of milliseconds.
   * Used to implement delays between retry attempts without blocking the
   * event loop.
   *
   * @param ms - Number of milliseconds to sleep
   * @returns Promise that resolves after the delay
   * @example
   * ```typescript
   * await this.sleep(1000); // Wait 1 second
   * ```
   * @since 1.0.0
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Default retry condition logic
   *
   * Determines whether an error should trigger a retry attempt based on
   * enterprise-grade error categorization. This implements intelligent
   * retry logic that avoids wasting attempts on non-recoverable errors.
   *
   * Retryable conditions:
   * - Network connectivity errors (DNS, connection refused, etc.)
   * - Timeout errors (request exceeded configured timeout)
   * - Server errors (5xx HTTP status codes)
   *
   * Non-retryable conditions:
   * - Client errors (4xx HTTP status codes)
   * - Authentication/authorization failures
   * - Validation errors
   * - Unknown error types
   *
   * @param error - The error to evaluate for retry eligibility
   * @returns True if the error should trigger a retry, false otherwise
   * @example
   * ```typescript
   * const shouldRetry = this.defaultRetryCondition(new HttpClientError(
   *   'Server Error', 500
   * )); // returns true
   *
   * const shouldNotRetry = this.defaultRetryCondition(new HttpClientError(
   *   'Bad Request', 400
   * )); // returns false
   * ```
   * @since 1.0.0
   */
  private defaultRetryCondition(error: unknown): boolean {
    if (error instanceof HttpClientError) {
      // Retry on network errors, timeouts, and 5xx server errors
      return (
        error.isNetworkError ||
        error.isTimeoutError ||
        (error.status !== undefined && error.status >= 500)
      );
    }
    return false;
  }
}

/**
 * Enterprise-grade HTTP client implementation
 *
 * Production-ready HTTP client that implements the IHttpClient interface with
 * enterprise-grade features including automatic retry logic, timeout handling,
 * comprehensive error management, and proper request/response processing.
 *
 * Built following SOLID principles with dependency inversion support through
 * the IHttpClient interface. Designed for high-reliability scenarios with
 * intelligent retry strategies and proper error categorization.
 *
 * Key Features:
 * - Automatic retry with exponential backoff and jitter
 * - Configurable timeouts with AbortController support
 * - Comprehensive error handling with detailed error types
 * - Support for all major HTTP methods (GET, POST, PUT, DELETE)
 * - Automatic JSON serialization/deserialization
 * - Custom header support with sensible defaults
 * - Base URL resolution for relative paths
 * - Built-in User-Agent header management
 * - Network error detection and categorization
 * - Timeout error detection and proper cleanup
 *
 * Error Handling:
 * - Network connectivity errors (DNS, connection refused, etc.)
 * - Timeout errors with proper request abortion
 * - HTTP status errors (4xx client errors, 5xx server errors)
 * - JSON parsing errors with graceful fallback
 * - Request serialization errors
 *
 * Retry Strategy:
 * - Automatic retry on network errors, timeouts, and 5xx errors
 * - No retry on 4xx client errors (bad requests, auth failures)
 * - Exponential backoff with configurable parameters
 * - Jitter to prevent thundering herd scenarios
 * - Maximum retry attempts and delay caps
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const client = new HttpClient();
 * const response = await client.get<UserData>('/api/users/123');
 *
 * // Advanced configuration
 * const client = new HttpClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 10000,
 *   retries: 5,
 *   userAgent: 'MyApp/1.0',
 *   headers: { 'X-API-Key': 'secret' }
 * });
 *
 * // POST with data
 * const newUser = await client.post<User>('/api/users', {
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 *
 * // Error handling
 * try {
 *   const data = await client.get('/api/protected');
 * } catch (error) {
 *   if (error instanceof HttpClientError) {
 *     if (error.status === 401) {
 *       console.log('Authentication required');
 *     } else if (error.isNetworkError) {
 *       console.log('Network connectivity issue');
 *     }
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link IHttpClient} for the interface this class implements
 * @see {@link HttpClientConfig} for configuration options
 * @see {@link RetryStrategy} for retry logic details
 * @see {@link HttpClientError} for error handling details
 */
export class HttpClient implements IHttpClient {
  private readonly config: Required<HttpClientConfig>;
  private readonly retryStrategy: RetryStrategy;

  /**
   * Create a new HTTP client instance
   *
   * Initializes the HTTP client with the provided configuration, applying
   * sensible defaults for enterprise applications. The client is immediately
   * ready for use and all configuration is immutable after construction.
   *
   * Default Configuration:
   * - No base URL (empty string)
   * - 30 second timeout
   * - 3 retry attempts (plus initial attempt = 4 total)
   * - User-Agent: 'DriveHR-Sync/1.0'
   * - No default headers
   *
   * The retry strategy is automatically configured with:
   * - Maximum attempts: retries + 1
   * - Base delay: 1 second
   * - Maximum delay: 10 seconds
   * - Exponential base: 2 (doubling)
   * - Jitter: enabled
   *
   * @param config - HTTP client configuration (defaults applied for missing values)
   * @example
   * ```typescript
   * // Minimal configuration
   * const client = new HttpClient();
   *
   * // Production configuration
   * const client = new HttpClient({
   *   baseUrl: 'https://api.production.com',
   *   timeout: 15000,
   *   retries: 5,
   *   userAgent: 'DriveHR-Production/2.1',
   *   headers: {
   *     'X-API-Version': '2.0',
   *     'X-Client-ID': 'drivehr-sync'
   *   }
   * });
   * ```
   * @since 1.0.0
   */
  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? '',
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      userAgent: config.userAgent ?? 'DriveHR-Sync/1.0',
      headers: config.headers ?? {},
    };

    this.retryStrategy = new RetryStrategy({
      maxAttempts: this.config.retries + 1,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
      jitter: true,
    });
  }

  public async get<T = unknown>(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, headers);
  }

  public async post<T = unknown>(
    url: string,
    data?: unknown,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, data, headers);
  }

  public async put<T = unknown>(
    url: string,
    data?: unknown,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, data, headers);
  }

  public async delete<T = unknown>(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, headers);
  }

  private async request<T>(
    method: string,
    url: string,
    data?: unknown,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse<T>> {
    const fullUrl = this.buildUrl(url);
    const requestHeaders = this.buildHeaders(headers, data !== undefined);

    return this.retryStrategy.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(fullUrl, {
          method,
          headers: requestHeaders,
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return await this.processResponse<T>(response);
      } catch (error) {
        clearTimeout(timeoutId);

        // If it's already an HttpClientError from processResponse, re-throw it as-is
        if (error instanceof HttpClientError) {
          throw error;
        }

        // Otherwise, handle it as a network/fetch error
        throw this.handleRequestError(error, fullUrl, method);
      }
    });
  }

  private async processResponse<T>(response: Response): Promise<HttpResponse<T>> {
    const headers = this.extractHeaders(response);
    const success = response.ok;

    let data: T;

    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : ({} as T);
    } catch {
      // If JSON parsing fails, treat as text
      data = (await response.text()) as unknown as T;
    }

    const httpResponse: HttpResponse<T> = {
      status: response.status,
      statusText: response.statusText,
      headers,
      data,
      success,
    };

    if (!success) {
      throw new HttpClientError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText,
        httpResponse
      );
    }

    return httpResponse;
  }

  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const baseUrl = this.config.baseUrl.endsWith('/')
      ? this.config.baseUrl.slice(0, -1)
      : this.config.baseUrl;
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${baseUrl}${path}`;
  }

  private buildHeaders(
    customHeaders: Record<string, string>,
    hasBody: boolean
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.config.userAgent,
      Accept: 'application/json',
      ...this.config.headers,
      ...customHeaders,
    };

    if (hasBody && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return headers;
  }

  private handleRequestError(error: unknown, url: string, method: string): HttpClientError {
    if (error instanceof Error) {
      // Handle abort signal (timeout)
      if (error.name === 'AbortError') {
        return new HttpClientError(
          `Request timeout after ${this.config.timeout}ms: ${method} ${url}`,
          undefined,
          undefined,
          undefined,
          false,
          true
        );
      }

      // Handle network errors
      if (error.name === 'FetchError' || error.message.includes('ENOTFOUND')) {
        return new HttpClientError(
          `Network error: ${error.message}`,
          undefined,
          undefined,
          undefined,
          true,
          false
        );
      }
    }

    // Handle unknown errors
    return new HttpClientError(
      `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      undefined,
      true,
      false
    );
  }
}

/**
 * Factory function for creating HTTP client instances
 *
 * Provides a convenient factory function for creating HTTP client instances
 * that implement the IHttpClient interface. This function promotes dependency
 * inversion by returning the interface type rather than the concrete class,
 * making it easier to substitute implementations in tests or different
 * environments.
 *
 * The factory pattern allows for:
 * - Consistent client instantiation across the application
 * - Future extensibility (different implementations based on config)
 * - Easier testing with mock implementations
 * - Clear separation between interface and implementation
 * - Simplified dependency injection setup
 *
 * This is the recommended way to create HTTP client instances in application
 * code, as it abstracts away the concrete implementation details and ensures
 * consumers depend only on the interface contract.
 *
 * @param config - Optional HTTP client configuration (uses defaults if not provided)
 * @returns HTTP client instance implementing the IHttpClient interface
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const httpClient = createHttpClient();
 * const users = await httpClient.get<User[]>('/api/users');
 *
 * // With configuration
 * const apiClient = createHttpClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 15000,
 *   retries: 5,
 *   headers: {
 *     'Authorization': 'Bearer token',
 *     'X-API-Version': '2.0'
 *   }
 * });
 *
 * // Dependency injection usage
 * class UserService {
 *   constructor(private httpClient: IHttpClient = createHttpClient()) {}
 *
 *   async getUser(id: string): Promise<User> {
 *     const response = await this.httpClient.get<User>(`/users/${id}`);
 *     return response.data;
 *   }
 * }
 *
 * // Testing with mock implementation
 * const mockClient = createMockHttpClient();
 * const userService = new UserService(mockClient);
 * ```
 * @since 1.0.0
 * @see {@link IHttpClient} for the interface specification
 * @see {@link HttpClient} for the concrete implementation
 * @see {@link HttpClientConfig} for configuration options
 */
export function createHttpClient(config?: HttpClientConfig): IHttpClient {
  return new HttpClient(config);
}
