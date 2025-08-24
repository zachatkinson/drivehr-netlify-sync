/**
 * Shared HTTP Testing Utilities
 *
 * Centralized DRY utilities for HTTP client testing across all test suites.
 * Eliminates code duplication in HTTP-related tests by providing reusable
 * mock factories, assertion helpers, and common testing patterns.
 *
 * Key Features:
 * - Mock response builders for all HTTP scenarios
 * - Error simulation utilities for network/timeout conditions
 * - Standardized assertion helpers
 * - Request/response verification patterns
 * - Common test fixture generators
 *
 * @module http-test-utils
 * @since 1.0.0
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
   */
  private static mockFetch = fetch as MockedFunction<typeof fetch>;

  /**
   * Standard test configurations
   */
  static readonly TEST_CONFIG: HttpClientConfig = {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 2,
    userAgent: 'Test-Client/1.0',
    headers: { 'X-Test-Header': 'test-value' },
  };

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
   * issues during error simulation tests. Network and timeout errors
   * are retryable by default, which causes test timeouts when mocks
   * consistently return the same error.
   *
   * @example
   * ```typescript
   * const client = new HttpClient(HttpTestUtils.TEST_CONFIG_NO_RETRIES);
   * // Error tests will fail immediately without retries
   * await expect(client.get('/test')).rejects.toThrow();
   * ```
   * @since 1.0.0
   * @see {@link TEST_CONFIG} for standard configuration with retries
   */
  static readonly TEST_CONFIG_NO_RETRIES: HttpClientConfig = {
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 0,
    userAgent: 'Test-Client/1.0',
    headers: { 'X-Test-Header': 'test-value' },
  };

  /**
   * Mock Response Builders
   */

  /**
   * Create successful JSON response mock
   *
   * Creates a properly formatted mock response for successful HTTP operations.
   * Includes proper JSON serialization, headers, and response structure
   * that matches the fetch API Response interface.
   *
   * @param data - Response data to serialize as JSON
   * @param status - HTTP status code (default: 200)
   * @param statusText - HTTP status text (default: 'OK')
   * @param additionalHeaders - Additional headers to include in response
   * @returns Mock Response object with proper JSON content
   * @example
   * ```typescript
   * const response = HttpTestUtils.createSuccessResponse({ id: 1, name: 'Test' });
   * // Response will have status 200 and JSON body: {"id":1,"name":"Test"}
   * ```
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
   * Creates a properly formatted mock response for HTTP error scenarios.
   * Includes appropriate status codes, error messages, and structured
   * error data that matches real API error responses.
   *
   * @param status - HTTP error status code (4xx or 5xx)
   * @param statusText - HTTP status text for the error
   * @param errorData - Error data to include in response body
   * @returns Mock Response object configured for error scenario
   * @example
   * ```typescript
   * const errorResponse = HttpTestUtils.createErrorResponse(
   *   404,
   *   'Not Found',
   *   { error: 'Resource not found', code: 'NOT_FOUND' }
   * );
   * ```
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
   * Internal utility that creates a fully configurable mock response
   * with complete control over all response properties. Used by other
   * response creation methods to maintain consistency.
   *
   * @param data - Response data to include in the body
   * @param status - HTTP status code
   * @param statusText - HTTP status text
   * @param additionalHeaders - Additional headers to include
   * @returns Fully configured mock Response object
   * @example
   * ```typescript
   * const response = HttpTestUtils.createResponseMock(
   *   { data: 'test' },
   *   201,
   *   'Created',
   *   { 'Location': '/api/items/123' }
   * );
   * ```
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

    // Mock headers.forEach for header extraction - using any for architectural necessity:
    // node-fetch Headers type conflicts with Map interface used in our mocks

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
   * Error Simulation Utilities
   */

  /**
   * Simulate network connectivity error
   *
   * Creates a network-level error that simulates connectivity issues
   * such as DNS resolution failures, connection timeouts, or network
   * unavailability scenarios commonly encountered in production.
   *
   * @param message - Error message describing the network issue
   * @returns Promise that rejects with a network error
   * @example
   * ```typescript
   * HttpTestUtils.getMockFetch().mockImplementation(
   *   () => HttpTestUtils.simulateNetworkError('DNS resolution failed')
   * );
   * ```
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
   * Creates a timeout error that simulates request cancellation due to
   * timeout limits. Mimics AbortController behavior when requests exceed
   * their configured timeout duration.
   *
   * @returns Promise that rejects with a timeout/abort error
   * @example
   * ```typescript
   * HttpTestUtils.getMockFetch().mockImplementation(
   *   () => HttpTestUtils.simulateTimeoutError()
   * );
   * // Test will receive an AbortError
   * ```
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
   * Configures the mock fetch to return server-side error responses.
   * Useful for testing error handling, retry logic, and user feedback
   * when backend services encounter internal issues.
   *
   * @param status - Server error status code (default: 500)
   * @param message - Error message for the response
   * @example
   * ```typescript
   * HttpTestUtils.simulateServerError(503, 'Service Unavailable');
   * // Next HTTP request will return a 503 error
   * ```
   * @since 1.0.0
   */
  static simulateServerError(status = 500, message = 'Internal Server Error'): void {
    this.mockFetch.mockResolvedValue(this.createErrorResponse(status, message));
  }

  /**
   * Simulate client error (4xx)
   *
   * Configures the mock fetch to return client-side error responses.
   * Useful for testing validation error handling, authentication failures,
   * and other client-side error scenarios.
   *
   * @param status - Client error status code (default: 404)
   * @param message - Error message for the response
   * @example
   * ```typescript
   * HttpTestUtils.simulateClientError(401, 'Unauthorized');
   * // Next HTTP request will return a 401 error
   * ```
   * @since 1.0.0
   */
  static simulateClientError(status = 404, message = 'Not Found'): void {
    this.mockFetch.mockResolvedValue(this.createErrorResponse(status, message));
  }

  /**
   * Mock Management
   */

  /**
   * Get mock fetch instance
   *
   * Returns the mocked fetch function for direct manipulation and
   * verification. Allows access to all Vitest mock capabilities
   * for complex testing scenarios.
   *
   * @returns Mocked fetch function with Vitest mock methods
   * @example
   * ```typescript
   * const mockFetch = HttpTestUtils.getMockFetch();
   * expect(mockFetch).toHaveBeenCalledTimes(2);
   * expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users');
   * ```
   * @since 1.0.0
   */
  static getMockFetch(): MockedFunction<typeof fetch> {
    return this.mockFetch;
  }

  /**
   * Reset all mocks
   *
   * Comprehensive cleanup that resets all mock state and call history.
   * Should be used between tests to ensure proper isolation and
   * prevent test interference.
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   HttpTestUtils.resetMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static resetMocks(): void {
    vi.clearAllMocks();
    this.mockFetch.mockReset();
  }

  /**
   * Setup successful response mock
   *
   * Configures the mock fetch to return a successful response with
   * the provided data. Convenience method for setting up positive
   * test scenarios.
   *
   * @param data - Response data to return
   * @param status - Success status code (default: 200)
   * @example
   * ```typescript
   * HttpTestUtils.mockSuccessResponse({ users: [] }, 201);
   * // Next HTTP request will return status 201 with {users: []} data
   * ```
   * @since 1.0.0
   */
  static mockSuccessResponse<T>(data: T, status = 200): void {
    this.mockFetch.mockResolvedValue(this.createSuccessResponse(data, status));
  }

  /**
   * Setup network error mock
   *
   * Configures the mock fetch to simulate network connectivity failures.
   * Useful for testing offline scenarios, network timeout handling,
   * and connectivity error recovery.
   *
   * @example
   * ```typescript
   * HttpTestUtils.mockNetworkError();
   * // Next HTTP request will throw a network error
   * await expect(httpClient.get('/users')).rejects.toThrow('Network error');
   * ```
   * @since 1.0.0
   */
  static mockNetworkError(): void {
    this.mockFetch.mockImplementation(() => this.simulateNetworkError());
  }

  /**
   * Setup timeout error mock
   *
   * Configures the mock fetch to simulate request timeout scenarios.
   * Useful for testing timeout handling, retry logic, and user
   * experience during slow network conditions.
   *
   * @example
   * ```typescript
   * HttpTestUtils.mockTimeoutError();
   * // Next HTTP request will throw a timeout error
   * await expect(httpClient.get('/users')).rejects.toThrow('timeout');
   * ```
   * @since 1.0.0
   */
  static mockTimeoutError(): void {
    this.mockFetch.mockImplementation(() => this.simulateTimeoutError());
  }

  /**
   * Assertion Helpers
   */

  /**
   * Verify HTTP response structure and content
   *
   * Comprehensive assertion helper that validates HTTP response objects
   * match expected structure and content. Checks status, data, headers,
   * and success flags for complete response validation.
   *
   * @param response - HTTP response object to validate
   * @param expectedData - Expected response data
   * @param expectedStatus - Expected HTTP status code (default: 200)
   * @param expectedSuccess - Expected success flag (auto-computed if not provided)
   * @example
   * ```typescript
   * HttpTestUtils.verifyResponse(
   *   response,
   *   { id: 1, name: 'Test' },
   *   201,
   *   true
   * );
   * ```
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
   * Assertion helper that validates the mock fetch was called with
   * the correct URL, method, headers, and body. Essential for testing
   * that HTTP requests are constructed properly.
   *
   * @param expectedUrl - Expected request URL
   * @param expectedMethod - Expected HTTP method
   * @param expectedHeaders - Expected request headers (optional)
   * @param expectedBody - Expected request body (optional)
   * @example
   * ```typescript
   * HttpTestUtils.verifyFetchCall(
   *   'https://api.example.com/users',
   *   'POST',
   *   { 'Content-Type': 'application/json' },
   *   JSON.stringify({ name: 'John' })
   * );
   * ```
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
   * Creates an expectation object that validates standard HTTP headers
   * are included in requests. Ensures consistent header patterns
   * across all HTTP operations.
   *
   * @param customHeaders - Additional custom headers to verify
   * @returns Expectation object for header validation
   * @example
   * ```typescript
   * expect(requestHeaders).toEqual(
   *   HttpTestUtils.verifyStandardHeaders({ 'X-API-Key': 'test-key' })
   * );
   * ```
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
   * Creates an expectation object that validates the Content-Type header
   * is properly set for requests that include a body. Essential for
   * ensuring proper content serialization.
   *
   * @param contentType - Expected content type (default: 'application/json')
   * @returns Expectation object for Content-Type header validation
   * @example
   * ```typescript
   * expect(requestHeaders).toEqual(
   *   HttpTestUtils.verifyContentTypeHeader('application/xml')
   * );
   * ```
   * @since 1.0.0
   */
  static verifyContentTypeHeader(contentType = 'application/json'): Record<string, string> {
    return expect.objectContaining({
      'Content-Type': contentType,
    });
  }

  /**
   * Test Pattern Helpers
   */

  /**
   * Test HTTP method with standard success scenario
   *
   * Comprehensive test helper that validates HTTP methods work correctly
   * in success scenarios. Handles request setup, response verification,
   * and parameter validation in a single reusable function.
   *
   * @param methodFn - HTTP method function to test
   * @param method - HTTP method name (GET, POST, etc.)
   * @param url - Request URL path
   * @param requestData - Request body data (optional)
   * @param responseData - Expected response data (optional)
   * @param customHeaders - Custom headers to include (optional)
   * @example
   * ```typescript
   * await HttpTestUtils.testHttpMethodSuccess(
   *   client.post.bind(client),
   *   'POST',
   *   '/users',
   *   { name: 'John' },
   *   { id: 1, name: 'John' }
   * );
   * ```
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

    // Build expected headers manually
    const expectedHeaders: Record<string, string> = {
      'User-Agent': expect.any(String),
      Accept: 'application/json',
      ...this.TEST_CONFIG.headers,
      ...customHeaders,
    };

    // Add Content-Type for requests with body
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
   * Test helper that validates HTTP methods properly handle error
   * responses. Configures error conditions and verifies that the
   * method throws appropriate errors.
   *
   * @param methodFn - HTTP method function to test
   * @param url - Request URL path
   * @param errorStatus - HTTP error status code
   * @param errorMessage - Error message for the response
   * @param requestData - Request body data (optional)
   * @example
   * ```typescript
   * await HttpTestUtils.testHttpMethodError(
   *   client.get.bind(client),
   *   '/users/999',
   *   404,
   *   'User not found'
   * );
   * ```
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
   * URL Building Test Helpers
   */

  /**
   * Get URL building test cases
   *
   * Provides a comprehensive set of URL building scenarios for testing
   * URL construction logic. Covers edge cases like trailing slashes,
   * absolute URLs, and various path combinations.
   *
   * @returns Array of test cases with input and expected output URLs
   * @example
   * ```typescript
   * const testCases = HttpTestUtils.getUrlBuildingTestCases();
   * testCases.forEach(({ name, baseUrl, requestUrl, expectedUrl }) => {
   *   test(name, () => {
   *     expect(buildUrl(baseUrl, requestUrl)).toBe(expectedUrl);
   *   });
   * });
   * ```
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
   * Provides a comprehensive set of error scenarios for testing error
   * handling logic. Includes network errors, timeouts, and various HTTP
   * error codes with their expected behaviors.
   *
   * @returns Array of error test scenarios with setup and expectations
   * @example
   * ```typescript
   * const errorScenarios = HttpTestUtils.getErrorTestScenarios();
   * errorScenarios.forEach(({ name, setupMock, expectedErrorPattern }) => {
   *   test(`handles ${name}`, async () => {
   *     setupMock();
   *     await expect(httpClient.get('/test')).rejects.toThrow(expectedErrorPattern);
   *   });
   * });
   * ```
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
   * Generates standardized test data objects for consistent testing
   * across different scenarios. Provides simple, complex, and array
   * data structures commonly used in API responses.
   *
   * @returns Object containing various test data structures
   * @example
   * ```typescript
   * const testData = HttpTestUtils.createTestData();
   * HttpTestUtils.mockSuccessResponse(testData.complexObject);
   * const response = await httpClient.get('/complex-data');
   * expect(response.data).toEqual(testData.complexObject);
   * ```
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
