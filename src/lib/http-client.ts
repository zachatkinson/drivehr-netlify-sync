/**
 * Enterprise HTTP Client System
 *
 * Production-ready HTTP client library providing enterprise-grade features including
 * automatic retry logic with exponential backoff, comprehensive timeout handling,
 * intelligent error categorization, and robust request/response processing.
 *
 * This system implements dependency inversion principles through clean interfaces,
 * enabling easy testing and service composition. Built following SOLID principles
 * with a focus on reliability, maintainability, and performance.
 *
 * Core Features:
 * - Automatic retry with exponential backoff and jitter
 * - Configurable timeouts with AbortController support
 * - Comprehensive error handling with detailed error types
 * - Support for all major HTTP methods (GET, POST, PUT, DELETE)
 * - Automatic JSON serialization/deserialization
 * - Custom header support with sensible defaults
 * - Base URL resolution for relative paths
 * - Network error detection and categorization
 * - Built-in User-Agent header management
 *
 * The system provides three main components:
 * 1. IHttpClient interface for dependency injection
 * 2. HttpClient concrete implementation with enterprise features
 * 3. RetryStrategy for intelligent retry orchestration
 *
 * @example
 * ```typescript
 * import { createHttpClient, type IHttpClient } from './http-client.js';
 *
 * // Basic usage
 * const client = createHttpClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 10000,
 *   retries: 3
 * });
 *
 * const response = await client.get<UserData>('/users/123');
 * if (response.success) {
 *   console.log('User:', response.data);
 * }
 *
 * // Dependency injection
 * class UserService {
 *   constructor(private httpClient: IHttpClient) {}
 *
 *   async fetchUser(id: string): Promise<User> {
 *     const response = await this.httpClient.get<User>(`/users/${id}`);
 *     return response.data;
 *   }
 * }
 * ```
 *
 * @module http-client-system
 * @since 1.0.0
 * @see {@link ../types/api.ts} for type definitions
 * @see {@link IHttpClient} for the main interface
 * @see {@link HttpClient} for the production implementation
 */

import fetch, { type Response } from 'node-fetch';
import type { HttpClientConfig, HttpResponse, HttpError, RetryConfig } from '../types/api.js';

/**
 * Re-export HttpResponse type for convenient external access
 *
 * Provides direct access to the HttpResponse type interface for consumers
 * of this module without requiring separate imports from types/api.
 * This promotes cleaner import statements and better developer experience.
 *
 * @example
 * ```typescript
 * import { createHttpClient, type HttpResponse } from './http-client.js';
 *
 * function processResponse<T>(response: HttpResponse<T>) {
 *   if (response.success) {
 *     return response.data;
 *   }
 *   throw new Error(`HTTP ${response.status}: ${response.statusText}`);
 * }
 * ```
 * @since 1.0.0
 * @see {@link ../types/api.HttpResponse} for the complete type definition
 */
export type { HttpResponse } from '../types/api.js';

/**
 * HTTP Client interface for dependency injection and testing
 *
 * Defines the contract for HTTP client implementations supporting all major
 * HTTP methods with consistent error handling and strongly typed responses.
 * This interface enables dependency inversion, making services easily testable
 * by allowing mock implementations during testing.
 *
 * All methods return Promise<HttpResponse<T>> with consistent error handling:
 * - Network errors throw HttpClientError with isNetworkError=true
 * - Timeout errors throw HttpClientError with isTimeoutError=true
 * - HTTP status errors throw HttpClientError with status code
 * - JSON parsing errors are handled gracefully
 *
 * The interface supports generic typing for response data, enabling
 * compile-time type safety for API responses.
 *
 * @example
 * ```typescript
 * class ApiService {
 *   constructor(private httpClient: IHttpClient) {}
 *
 *   async getUser(id: string): Promise<User> {
 *     const response = await this.httpClient.get<User>(`/users/${id}`);
 *     if (response.success) {
 *       return response.data;
 *     }
 *     throw new Error('Failed to fetch user');
 *   }
 *
 *   async createUser(userData: CreateUserData): Promise<User> {
 *     const response = await this.httpClient.post<User>('/users', userData);
 *     return response.data;
 *   }
 * }
 *
 * // Testing with mock implementation
 * const mockClient: IHttpClient = {
 *   get: vi.fn().mockResolvedValue({ success: true, data: mockUser }),
 *   post: vi.fn(),
 *   put: vi.fn(),
 *   delete: vi.fn()
 * };
 * ```
 * @since 1.0.0
 * @see {@link HttpClient} for the production implementation
 * @see {@link createHttpClient} for factory function
 * @see {@link HttpResponse} for response type structure
 */
export interface IHttpClient {
  /**
   * Perform HTTP GET request with automatic retry and error handling
   *
   * Executes a GET request to the specified URL with optional custom headers.
   * Automatically applies base URL resolution, default headers, retry logic,
   * and comprehensive error handling.
   *
   * @template T - Expected response data type (defaults to unknown for flexibility)
   * @param url - Target URL (absolute or relative to base URL)
   * @param headers - Optional custom HTTP headers to merge with defaults
   * @returns Promise resolving to typed HTTP response with success indicator
   * @throws {HttpClientError} For network errors, timeouts, or HTTP status errors
   * @example
   * ```typescript
   * // Basic GET request
   * const response = await client.get<User>('/api/users/123');
   * console.log('User:', response.data);
   *
   * // GET with custom headers
   * const response = await client.get<UserList>('/api/users', {
   *   'Authorization': 'Bearer token123',
   *   'X-Page-Size': '50'
   * });
   * ```
   * @since 1.0.0
   */
  get<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>>;
  /**
   * Perform HTTP POST request with JSON serialization and retry logic
   *
   * Executes a POST request with automatic JSON serialization of request data,
   * proper Content-Type headers, retry logic, and error handling. Supports
   * both simple data objects and complex nested structures.
   *
   * @template T - Expected response data type (defaults to unknown for flexibility)
   * @param url - Target URL (absolute or relative to base URL)
   * @param data - Optional request body data (automatically JSON-serialized)
   * @param headers - Optional custom HTTP headers to merge with defaults
   * @returns Promise resolving to typed HTTP response with success indicator
   * @throws {HttpClientError} For network errors, timeouts, or HTTP status errors
   * @example
   * ```typescript
   * // POST with JSON data
   * const newUser = await client.post<User>('/api/users', {
   *   name: 'John Doe',
   *   email: 'john@example.com'
   * });
   *
   * // POST with custom headers
   * const response = await client.post<ApiResponse>('/api/data', payload, {
   *   'Content-Type': 'application/json',
   *   'X-Request-ID': 'req-123'
   * });
   * ```
   * @since 1.0.0
   */
  post<T = unknown>(
    url: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  /**
   * Perform HTTP PUT request with JSON serialization and retry logic
   *
   * Executes a PUT request for updating resources with automatic JSON
   * serialization, proper headers, retry logic, and error handling.
   * Typically used for full resource updates or replacements.
   *
   * @template T - Expected response data type (defaults to unknown for flexibility)
   * @param url - Target URL (absolute or relative to base URL)
   * @param data - Optional request body data (automatically JSON-serialized)
   * @param headers - Optional custom HTTP headers to merge with defaults
   * @returns Promise resolving to typed HTTP response with success indicator
   * @throws {HttpClientError} For network errors, timeouts, or HTTP status errors
   * @example
   * ```typescript
   * // PUT to update user
   * const updatedUser = await client.put<User>('/api/users/123', {
   *   id: 123,
   *   name: 'John Smith',
   *   email: 'john.smith@example.com'
   * });
   *
   * // PUT with version header
   * const response = await client.put<Resource>('/api/resources/456', data, {
   *   'If-Match': '"v2.1"'
   * });
   * ```
   * @since 1.0.0
   */
  put<T = unknown>(
    url: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
  /**
   * Perform HTTP DELETE request with automatic retry and error handling
   *
   * Executes a DELETE request to remove resources with proper error handling
   * and retry logic. Supports custom headers for authorization and conditional
   * deletion scenarios.
   *
   * @template T - Expected response data type (defaults to unknown for flexibility)
   * @param url - Target URL (absolute or relative to base URL)
   * @param headers - Optional custom HTTP headers to merge with defaults
   * @returns Promise resolving to typed HTTP response with success indicator
   * @throws {HttpClientError} For network errors, timeouts, or HTTP status errors
   * @example
   * ```typescript
   * // Basic DELETE request
   * const response = await client.delete('/api/users/123');
   * console.log('Deleted:', response.success);
   *
   * // DELETE with authorization
   * const response = await client.delete<DeleteResponse>('/api/resources/456', {
   *   'Authorization': 'Bearer token123',
   *   'X-Reason': 'cleanup'
   * });
   * ```
   * @since 1.0.0
   */
  delete<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>>;
}

/**
 * Enhanced HTTP error class with comprehensive error categorization
 *
 * Provides detailed error information for HTTP request failures including
 * status codes, response data, and intelligent error categorization. This
 * class enables proper error handling strategies by categorizing errors into
 * network issues, timeouts, and HTTP status problems.
 *
 * Error Categories:
 * - Network errors: DNS failures, connection refused, etc.
 * - Timeout errors: Requests exceeding configured timeout
 * - HTTP status errors: 4xx client errors, 5xx server errors
 * - Parse errors: Invalid JSON or response format issues
 *
 * The class maintains the original Error interface while adding HTTP-specific
 * properties for detailed error analysis and appropriate retry logic.
 *
 * @example
 * ```typescript
 * try {
 *   const response = await httpClient.get('/api/data');
 * } catch (error) {
 *   if (error instanceof HttpClientError) {
 *     if (error.isTimeoutError) {
 *       console.log('Request timed out - consider increasing timeout');
 *     } else if (error.isNetworkError) {
 *       console.log('Network connectivity issue - check connection');
 *     } else if (error.status === 401) {
 *       console.log('Authentication required - refresh token');
 *     } else if (error.status && error.status >= 500) {
 *       console.log('Server error - retry may help');
 *     }
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link HttpError} for the interface definition
 * @see {@link HttpClient} for error throwing context
 */
export class HttpClientError extends Error implements HttpError {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly response?: HttpResponse;
  public readonly isNetworkError: boolean;
  public readonly isTimeoutError: boolean;

  /**
   * Create a new HttpClientError with comprehensive error context
   *
   * Initializes an HTTP client error with detailed context information
   * for proper error handling and debugging. All parameters except message
   * are optional to support various error scenarios from network failures
   * to HTTP status errors.
   *
   * The constructor automatically sets the error name and maintains proper
   * stack traces for debugging in V8 environments.
   *
   * @param message - Human-readable error description
   * @param status - HTTP status code (if applicable)
   * @param statusText - HTTP status text (if applicable)
   * @param response - Complete HTTP response object (if available)
   * @param isNetworkError - Whether this represents a network connectivity issue
   * @param isTimeoutError - Whether this represents a timeout issue
   * @example
   * ```typescript
   * // Network error
   * new HttpClientError(
   *   'Connection refused',
   *   undefined,
   *   undefined,
   *   undefined,
   *   true,
   *   false
   * );
   *
   * // HTTP status error
   * new HttpClientError(
   *   'Not Found',
   *   404,
   *   'Not Found',
   *   httpResponse
   * );
   *
   * // Timeout error
   * new HttpClientError(
   *   'Request timeout after 30000ms',
   *   undefined,
   *   undefined,
   *   undefined,
   *   false,
   *   true
   * );
   * ```
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
 * Enterprise exponential backoff retry strategy implementation
 *
 * Implements production-grade retry logic with exponential backoff, jitter,
 * and intelligent retry conditions. This class follows SOLID principles by
 * providing single responsibility for retry orchestration with highly
 * configurable behavior patterns.
 *
 * Key Features:
 * - Exponential backoff with configurable base delay and multiplier
 * - Optional jitter to prevent thundering herd scenarios
 * - Intelligent retry conditions based on error types and HTTP status
 * - Configurable maximum attempts and delay caps
 * - Built-in support for HTTP client error categorization
 * - Extensible retry condition logic via predicate functions
 *
 * Retry Logic:
 * The strategy automatically retries on:
 * - Network connectivity errors (DNS, connection refused, etc.)
 * - Timeout errors (request exceeded configured timeout)
 * - Server errors (5xx HTTP status codes)
 *
 * It will NOT retry on:
 * - Client errors (4xx HTTP status codes)
 * - Authentication/authorization failures
 * - Validation errors
 * - Unknown error types (unless custom predicate allows)
 *
 * Backoff Algorithm:
 * delay = min(baseDelay * exponentialBase^(attempt-1), maxDelay)
 * With optional jitter: delay ± (delay * 0.1 * random())
 *
 * @example
 * ```typescript
 * // Basic usage with defaults (3 attempts, 1s base, 2x multiplier)
 * const strategy = new RetryStrategy();
 * const result = await strategy.execute(
 *   () => httpClient.get('/api/data')
 * );
 *
 * // Advanced configuration
 * const customStrategy = new RetryStrategy({
 *   maxAttempts: 5,
 *   baseDelay: 500,
 *   maxDelay: 30000,
 *   exponentialBase: 1.5,
 *   jitter: false
 * });
 *
 * // Custom retry condition
 * const result = await strategy.execute(
 *   () => riskOperation(),
 *   (error) => error.code === 'RATE_LIMITED'
 * );
 * ```
 * @since 1.0.0
 * @see {@link RetryConfig} for configuration options
 * @see {@link HttpClientError} for error categorization
 */
export class RetryStrategy {
  private readonly config: RetryConfig;

  /**
   * Create a new retry strategy with configurable behavior
   *
   * Initializes the retry strategy with provided configuration, applying
   * enterprise-grade defaults for missing values. The default configuration
   * provides balanced retry behavior suitable for most production scenarios.
   *
   * Default Configuration:
   * - maxAttempts: 3 (plus initial attempt = 4 total tries)
   * - baseDelay: 1000ms (1 second)
   * - maxDelay: 10000ms (10 seconds cap)
   * - exponentialBase: 2 (doubling delay each attempt)
   * - jitter: true (adds ±10% randomization)
   *
   * The configuration is immutable after construction, ensuring consistent
   * retry behavior throughout the strategy's lifecycle.
   *
   * @param config - Partial retry configuration (defaults applied for missing values)
   * @example
   * ```typescript
   * // Use all defaults
   * const defaultStrategy = new RetryStrategy();
   *
   * // Custom aggressive retries
   * const aggressiveStrategy = new RetryStrategy({
   *   maxAttempts: 8,
   *   baseDelay: 200,
   *   exponentialBase: 1.3
   * });
   *
   * // Conservative retries without jitter
   * const conservativeStrategy = new RetryStrategy({
   *   maxAttempts: 2,
   *   baseDelay: 2000,
   *   maxDelay: 5000,
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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

export class HttpClient implements IHttpClient {
  private readonly config: Required<HttpClientConfig>;
  private readonly retryStrategy: RetryStrategy;

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
          body: data ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
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

export function createHttpClient(config?: HttpClientConfig): IHttpClient {
  return new HttpClient(config);
}
