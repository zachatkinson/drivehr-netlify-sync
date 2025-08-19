/**
 * HTTP Client Abstraction
 *
 * Enterprise-grade HTTP client with retry logic, timeout handling, and proper error management.
 * Implements dependency inversion principle with clean interfaces.
 */

import fetch, { type Response } from 'node-fetch';
import type { HttpClientConfig, HttpResponse, HttpError, RetryConfig } from '../types/api.js';

// Re-export types for test usage
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
 * Retry strategy implementation
 */
export class RetryStrategy {
  private readonly config: RetryConfig;

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

/**
 * Enterprise HTTP client with retry logic and comprehensive error handling
 */
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
 */
export function createHttpClient(config?: HttpClientConfig): IHttpClient {
  return new HttpClient(config);
}
