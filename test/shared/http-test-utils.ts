/**
 * Shared HTTP Testing Utilities
 *
 * Centralized DRY utilities for HTTP client testing across all test suites.
 * Eliminates code duplication in HTTP-related tests by providing reusable
 * mock factories, assertion helpers, and common testing patterns.
 *
 * Test Features:
 * - Mock response builders for all HTTP scenarios
 * - Error simulation utilities for network/timeout conditions
 * - Standardized assertion helpers
 * - Request/response verification patterns
 * - Common test fixture generators
 *
 * @example
 * ```typescript
 * // Run tests using the utilities
 * HttpTestUtils.mockSuccessResponse({ data: 'test' });
 * const response = await httpClient.get('/test');
 * HttpTestUtils.verifyResponse(response, { data: 'test' });
 * ```
 *
 * @module http-test-utils
 * @since 1.0.0
 * @see {@link ../../src/lib/http-client.ts} for the HTTP client being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { vi, expect, type MockedFunction } from 'vitest';
import fetch, { Response } from 'node-fetch';
import type { HttpResponse } from '../../src/lib/http-client.js';
import type { HttpClientConfig, RetryConfig } from '../../src/types/api.js';

/**
 * HTTP Testing Utilities Class
 *
 * Provides comprehensive utilities for HTTP-related testing with proper
 * mock management, response building, and error simulation capabilities.
 * Follows DRY principles to eliminate duplication across test suites.
 *
 * @since 1.0.0
 */
export class HttpTestUtils {
  /**
   * Mock fetch instance for controlled testing
   * @since 1.0.0
   */
  private static mockFetch = fetch as MockedFunction<typeof fetch>;

  /**
   * Standard test configuration for HTTP client testing
   *
   * @since 1.0.0
   */
  static readonly TEST_CONFIG: HttpClientConfig = {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 2,
    userAgent: 'Test-Client/1.0',
    headers: { 'X-Test-Header': 'test-value' },
  };

  /**
   * Standard retry configuration for testing retry logic
   *
   * @since 1.0.0
   */
  static readonly TEST_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 10,
    maxDelay: 100,
    exponentialBase: 2,
    jitter: false,
  };

  /**
   * HTTP client configuration for error testing scenarios
   *
   * Specialized configuration that disables retries to prevent timeout
   * issues during error simulation tests.
   *
   * @since 1.0.0
   */
  static readonly TEST_CONFIG_NO_RETRIES: HttpClientConfig = {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 0,
    userAgent: 'Test-Client/1.0',
    headers: { 'X-Test-Header': 'test-value' },
  };

  /**
   * Create successful JSON response mock
   *
   * @param data - Response data to serialize as JSON
   * @param status - HTTP status code (default: 200)
   * @param statusText - HTTP status text (default: 'OK')
   * @param additionalHeaders - Additional headers to include in response
   * @returns Mock Response object with proper JSON content
   * @since 1.0.0
   */
  static createSuccessResponse<T>(
    data: T,
    status = 200,
    statusText = 'OK',
    additionalHeaders: Record<string, string> = {}
  ): Response {
    return this.createResponseMock(data, status, statusText, additionalHeaders);
  }

  /**
   * Create error response mock
   *
   * @param status - HTTP error status code (4xx or 5xx)
   * @param statusText - HTTP status text for the error
   * @param errorData - Error data to include in response body
   * @returns Mock Response object configured for error scenario
   * @since 1.0.0
   */
  static createErrorResponse(
    status: number,
    statusText: string,
    errorData: unknown = { error: 'Request failed' }
  ): Response {
    return this.createResponseMock(errorData, status, statusText);
  }

  /**
   * Create generic response mock with full control
   *
   * @param data - Response data to include in the body
   * @param status - HTTP status code
   * @param statusText - HTTP status text
   * @param additionalHeaders - Additional headers to include
   * @returns Fully configured mock Response object
   * @since 1.0.0
   */
  private static createResponseMock<T>(
    data: T,
    status: number,
    statusText: string,
    additionalHeaders: Record<string, string> = {}
  ): Response {
    const response = {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers: new Map([
        ['content-type', 'application/json'],
        ...Object.entries(additionalHeaders),
      ]),
      text: vi.fn().mockResolvedValue(JSON.stringify(data)),
      json: vi.fn().mockResolvedValue(data),
    } as unknown as Response;

    // ARCHITECTURAL JUSTIFICATION: Test mocking requires dynamic assignment of forEach method
    // to Map-based headers mock. node-fetch Headers interface expects specific method signature
    // that conflicts with Map interface. Type casting to any is necessary for mock compatibility.
    //
    // ALTERNATIVES CONSIDERED:
    // 1. Creating complete Headers implementation: Would require complex polyfill and lose
    //    test simplicity benefits of Map-based mocking approach
    // 2. Using real Headers object: Would introduce external dependencies and complicate
    //    test setup without providing testing benefits over controlled mock objects
    // 3. Separate interface definition: Would duplicate Headers contract and create
    //    maintenance burden for test-only type definitions
    //
    // CONCLUSION: eslint-disable is architecturally necessary for test mock compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response.headers as any).forEach = (callback: (value: string, key: string) => void) => {
      for (const [key, value] of response.headers as unknown as Map<string, string>) {
        callback(value, key);
      }
    };

    return response;
  }

  /**
   * Simulate network connectivity error
   *
   * @param message - Error message describing the network issue
   * @returns Promise that rejects with a network error
   * @since 1.0.0
   */
  static simulateNetworkError(message = 'Network error: ENOTFOUND'): Promise<never> {
    const error = new Error(message);
    error.name = 'FetchError';
    return Promise.reject(error);
  }

  /**
   * Simulate request timeout error
   *
   * @returns Promise that rejects with a timeout/abort error
   * @since 1.0.0
   */
  static simulateTimeoutError(): Promise<never> {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    return Promise.reject(error);
  }

  /**
   * Simulate server error (5xx)
   *
   * @param status - Server error status code (default: 500)
   * @param message - Error message for the response
   * @since 1.0.0
   */
  static simulateServerError(status = 500, message = 'Internal Server Error'): void {
    this.mockFetch.mockResolvedValue(this.createErrorResponse(status, message));
  }

  /**
   * Simulate client error (4xx)
   *
   * @param status - Client error status code (default: 404)
   * @param message - Error message for the response
   * @since 1.0.0
   */
  static simulateClientError(status = 404, message = 'Not Found'): void {
    this.mockFetch.mockResolvedValue(this.createErrorResponse(status, message));
  }

  /**
   * Get mock fetch instance
   *
   * @returns Mocked fetch function with Vitest mock methods
   * @since 1.0.0
   */
  static getMockFetch(): MockedFunction<typeof fetch> {
    return this.mockFetch;
  }

  /**
   * Reset all mocks
   *
   * @since 1.0.0
   */
  static resetMocks(): void {
    vi.clearAllMocks();
    this.mockFetch.mockReset();
  }

  /**
   * Setup successful response mock
   *
   * @param data - Response data to return
   * @param status - Success status code (default: 200)
   * @since 1.0.0
   */
  static mockSuccessResponse<T>(data: T, status = 200): void {
    this.mockFetch.mockResolvedValue(this.createSuccessResponse(data, status));
  }

  /**
   * Setup network error mock
   *
   * @since 1.0.0
   */
  static mockNetworkError(): void {
    this.mockFetch.mockImplementation(() => this.simulateNetworkError());
  }

  /**
   * Setup timeout error mock
   *
   * @since 1.0.0
   */
  static mockTimeoutError(): void {
    this.mockFetch.mockImplementation(() => this.simulateTimeoutError());
  }

  /**
   * Verify HTTP response structure and content
   *
   * @param response - HTTP response object to validate
   * @param expectedData - Expected response data
   * @param expectedStatus - Expected HTTP status code (default: 200)
   * @param expectedSuccess - Expected success flag (auto-computed if not provided)
   * @since 1.0.0
   */
  static verifyResponse<T>(
    response: HttpResponse<T>,
    expectedData: T,
    expectedStatus = 200,
    expectedSuccess?: boolean
  ): void {
    const success = expectedSuccess ?? (expectedStatus >= 200 && expectedStatus < 300);

    expect(response).toMatchObject({
      status: expectedStatus,
      statusText: expect.any(String),
      headers: expect.any(Object),
      data: expectedData,
      success,
    });
  }

  /**
   * Verify fetch was called with expected parameters
   *
   * @param expectedUrl - Expected request URL
   * @param expectedMethod - Expected HTTP method
   * @param expectedHeaders - Expected request headers (optional)
   * @param expectedBody - Expected request body (optional)
   * @since 1.0.0
   */
  static verifyFetchCall(
    expectedUrl: string,
    expectedMethod: string,
    expectedHeaders?: Record<string, string> | ReturnType<typeof expect.not.objectContaining>,
    expectedBody?: string
  ): void {
    expect(this.mockFetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        method: expectedMethod,
        headers: expectedHeaders ?? expect.any(Object),
        signal: expect.any(Object), // AbortController signal is always present
        ...(expectedBody !== undefined && { body: expectedBody }),
      })
    );
  }

  /**
   * Verify standard headers are present
   *
   * @param customHeaders - Additional custom headers to verify
   * @returns Expectation object for header validation
   * @since 1.0.0
   */
  static verifyStandardHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    return expect.objectContaining({
      'User-Agent': expect.any(String),
      Accept: 'application/json',
      ...customHeaders,
    });
  }

  /**
   * Verify content-type header for requests with body
   *
   * @param contentType - Expected content type (default: 'application/json')
   * @returns Expectation object for Content-Type header validation
   * @since 1.0.0
   */
  static verifyContentTypeHeader(contentType = 'application/json'): Record<string, string> {
    return expect.objectContaining({
      'Content-Type': contentType,
    });
  }

  /**
   * Test HTTP method with standard success scenario
   *
   * @param methodFn - HTTP method function to test
   * @param method - HTTP method name (GET, POST, etc.)
   * @param url - Request URL path
   * @param requestData - Request body data (optional)
   * @param responseData - Expected response data (optional)
   * @param customHeaders - Custom headers to include (optional)
   * @since 1.0.0
   */
  static async testHttpMethodSuccess<T>(
    methodFn: (
      url: string,
      data?: unknown,
      headers?: Record<string, string>
    ) => Promise<HttpResponse<T>>,
    method: string,
    url: string,
    requestData?: unknown,
    responseData?: T,
    customHeaders?: Record<string, string>
  ): Promise<void> {
    const testResponseData = responseData ?? ({ success: true } as T);
    this.mockSuccessResponse(testResponseData);

    const response = requestData
      ? await methodFn(url, requestData, customHeaders)
      : await methodFn(url, customHeaders);

    this.verifyResponse(response, testResponseData);

    const expectedHeaders: Record<string, string> = {
      'User-Agent': expect.any(String),
      Accept: 'application/json',
      ...this.TEST_CONFIG.headers,
      ...customHeaders,
    };

    if (requestData && !customHeaders?.['Content-Type']) {
      expectedHeaders['Content-Type'] = 'application/json';
    }

    const expectedBody = requestData ? JSON.stringify(requestData) : undefined;

    this.verifyFetchCall(
      `${this.TEST_CONFIG.baseUrl}${url}`,
      method,
      expect.objectContaining(expectedHeaders),
      expectedBody
    );
  }

  /**
   * Test HTTP method with error scenario
   *
   * @param methodFn - HTTP method function to test
   * @param url - Request URL path
   * @param errorStatus - HTTP error status code
   * @param errorMessage - Error message for the response
   * @param requestData - Request body data (optional)
   * @since 1.0.0
   */
  static async testHttpMethodError<T>(
    methodFn: (
      url: string,
      data?: unknown,
      headers?: Record<string, string>
    ) => Promise<HttpResponse<T>>,
    url: string,
    errorStatus: number,
    errorMessage: string,
    requestData?: unknown
  ): Promise<void> {
    this.simulateClientError(errorStatus, errorMessage);

    await expect(requestData ? methodFn(url, requestData) : methodFn(url)).rejects.toThrow();
  }

  /**
   * Get URL building test cases
   *
   * @returns Array of test cases with input and expected output URLs
   * @since 1.0.0
   */
  static getUrlBuildingTestCases(): Array<{
    name: string;
    baseUrl: string;
    requestUrl: string;
    expectedUrl: string;
  }> {
    return [
      {
        name: 'relative path with leading slash',
        baseUrl: 'https://api.example.com',
        requestUrl: '/users',
        expectedUrl: 'https://api.example.com/users',
      },
      {
        name: 'relative path without leading slash',
        baseUrl: 'https://api.example.com',
        requestUrl: 'users',
        expectedUrl: 'https://api.example.com/users',
      },
      {
        name: 'base URL with trailing slash',
        baseUrl: 'https://api.example.com/',
        requestUrl: '/users',
        expectedUrl: 'https://api.example.com/users',
      },
      {
        name: 'absolute URL (should not modify)',
        baseUrl: 'https://api.example.com',
        requestUrl: 'https://other.api.com/data',
        expectedUrl: 'https://other.api.com/data',
      },
      {
        name: 'HTTP absolute URL',
        baseUrl: 'https://api.example.com',
        requestUrl: 'http://insecure.api.com/data',
        expectedUrl: 'http://insecure.api.com/data',
      },
    ];
  }

  /**
   * Get common error test scenarios
   *
   * @returns Array of error test scenarios with setup and expectations
   * @since 1.0.0
   */
  static getErrorTestScenarios(): Array<{
    name: string;
    setupMock: () => void;
    expectedErrorPattern: string | RegExp;
    expectedStatus?: number;
    expectedIsNetwork?: boolean;
    expectedIsTimeout?: boolean;
  }> {
    return [
      {
        name: '404 Not Found',
        setupMock: () => this.simulateClientError(404, 'Not Found'),
        expectedErrorPattern: 'HTTP 404: Not Found',
        expectedStatus: 404,
      },
      {
        name: '500 Internal Server Error',
        setupMock: () => this.simulateServerError(500, 'Internal Server Error'),
        expectedErrorPattern: 'HTTP 500: Internal Server Error',
        expectedStatus: 500,
      },
      {
        name: 'Network Error',
        setupMock: () => this.mockNetworkError(),
        expectedErrorPattern: 'Network error:',
        expectedIsNetwork: true,
      },
      {
        name: 'Timeout Error',
        setupMock: () => this.mockTimeoutError(),
        expectedErrorPattern: /Request timeout after \d+ms:/,
        expectedIsTimeout: true,
      },
    ];
  }

  /**
   * Create test data generators
   *
   * @returns Object containing various test data structures
   * @since 1.0.0
   */
  static createTestData(): {
    simpleObject: { id: number; name: string };
    complexObject: {
      user: { id: number; profile: { name: string; email: string } };
      items: string[];
    };
    arrayData: Array<{ id: number; value: string }>;
  } {
    return {
      simpleObject: { id: 1, name: 'Test Item' },
      complexObject: {
        user: {
          id: 42,
          profile: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
        items: ['item1', 'item2', 'item3'],
      },
      arrayData: [
        { id: 1, value: 'first' },
        { id: 2, value: 'second' },
        { id: 3, value: 'third' },
      ],
    };
  }
}
