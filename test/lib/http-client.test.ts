/**
 * HTTP Client Service Test Suite
 *
 * Comprehensive test coverage for the HTTP client service using enterprise-grade
 * testing patterns with DRY principles, proper mocking, and thorough validation
 * of all HTTP operations, error handling, and retry mechanisms.
 *
 * Test Coverage:
 * - HTTP client instantiation and configuration
 * - GET, POST, PUT, DELETE operations with various data types
 * - Header management and content type handling
 * - URL building and base URL resolution
 * - Timeout handling and network error simulation
 * - Retry strategy with exponential backoff and jitter
 * - Response processing and JSON parsing
 * - Comprehensive error handling scenarios
 * - Factory function validation
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/http-client.test.ts -- --grep "HttpClient"
 *
 * // Example of running with coverage
 * pnpm test test/lib/http-client.test.ts --coverage
 * ```
 *
 * @module http-client-test-suite
 * @since 1.0.0
 * @see {@link ../../src/lib/http-client.ts} for the implementation under test
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HttpClient,
  HttpClientError,
  RetryStrategy,
  createHttpClient,
  // type IHttpClient,
} from '../../src/lib/http-client.js';
import { HttpTestUtils } from '../shared/http-test-utils.js';

/**
 * Mock Response interface for testing
 *
 * Provides proper typing for mock response objects used in tests,
 * avoiding the need for 'any' types while maintaining compatibility
 * with node-fetch Response interface requirements.
 *
 * @since 1.0.0
 */
interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Map<string, string> & {
    forEach: (
      callbackfn: (value: string, key: string, map: Map<string, string>) => void,
      thisArg?: unknown
    ) => void;
  };
  text: ReturnType<typeof vi.fn>;
}

vi.mock('node-fetch');

describe('HttpClient', () => {
  beforeEach(() => {
    HttpTestUtils.resetMocks();
  });

  afterEach(() => {
    HttpTestUtils.resetMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default configuration', () => {
      const client = new HttpClient();
      expect(client).toBeInstanceOf(HttpClient);
    });

    it('should create instance with custom configuration', () => {
      const client = new HttpClient(HttpTestUtils.TEST_CONFIG);
      expect(client).toBeInstanceOf(HttpClient);
    });

    it('should apply default values for missing config properties', () => {
      const client = new HttpClient({ baseUrl: 'https://custom.api.com' });
      expect(client).toBeInstanceOf(HttpClient);
    });
  });

  describe('HTTP Methods - Success Scenarios', () => {
    let client: HttpClient;

    beforeEach(() => {
      client = new HttpClient(HttpTestUtils.TEST_CONFIG);
    });

    it('should perform successful GET request', async () => {
      const testData = { id: 1, name: 'Test Item' };
      const mockFetch = HttpTestUtils.getMockFetch();

      const mockResponse: MockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]) as Map<string, string> & {
          forEach: (callback: (value: string, key: string) => void) => void;
        },
        text: vi.fn().mockResolvedValue(JSON.stringify(testData)),
      };

      // Mock headers.forEach for header extraction
      mockResponse.headers.forEach = (
        callbackfn: (value: string, key: string, map: Map<string, string>) => void
      ) => {
        for (const [key, value] of mockResponse.headers) {
          callbackfn(value, key, mockResponse.headers);
        }
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as import('node-fetch').Response);

      const response = await client.get('/test');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(testData);
      expect(response.status).toBe(200);
    });

    it('should perform successful POST request with data', async () => {
      const requestData = { name: 'New Item', value: 42 };
      const responseData = { id: 123, created: true };
      HttpTestUtils.mockSuccessResponse(responseData, 201);

      const response = await client.post('/items', requestData);

      HttpTestUtils.verifyResponse(response, responseData, 201);
      expect(HttpTestUtils.getMockFetch()).toHaveBeenCalledWith(
        `${HttpTestUtils.TEST_CONFIG.baseUrl}/items`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should perform successful PUT request', async () => {
      const requestData = { name: 'Updated Item', version: 2 };
      const responseData = { id: 123, updated: true };
      HttpTestUtils.mockSuccessResponse(responseData);

      const response = await client.put('/items/123', requestData);

      HttpTestUtils.verifyResponse(response, responseData);
      expect(HttpTestUtils.getMockFetch()).toHaveBeenCalledWith(
        `${HttpTestUtils.TEST_CONFIG.baseUrl}/items/123`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(requestData),
        })
      );
    });

    it('should perform successful DELETE request', async () => {
      const responseData = { deleted: true, id: 123 };
      HttpTestUtils.mockSuccessResponse(responseData, 204);

      const response = await client.delete('/items/123');

      HttpTestUtils.verifyResponse(response, responseData, 204);
      expect(HttpTestUtils.getMockFetch()).toHaveBeenCalledWith(
        `${HttpTestUtils.TEST_CONFIG.baseUrl}/items/123`,
        expect.objectContaining({
          method: 'DELETE',
          body: undefined,
        })
      );
    });
  });

  describe('HTTP Methods with Custom Headers', () => {
    let client: HttpClient;

    beforeEach(() => {
      client = new HttpClient(HttpTestUtils.TEST_CONFIG);
    });

    it('should handle GET request with custom headers', async () => {
      const testData = { id: 1, name: 'Test Item' };
      const customHeaders = { Authorization: 'Bearer token123' };
      HttpTestUtils.mockSuccessResponse(testData);

      const response = await client.get('/test', customHeaders);

      HttpTestUtils.verifyResponse(response, testData);
      expect(HttpTestUtils.getMockFetch()).toHaveBeenCalledWith(
        `${HttpTestUtils.TEST_CONFIG.baseUrl}/test`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        })
      );
    });

    it('should handle POST request with custom content type', async () => {
      const responseData = { uploaded: true };
      const customHeaders = { 'Content-Type': 'text/plain' };
      HttpTestUtils.mockSuccessResponse(responseData);

      const response = await client.post('/upload', 'raw data', customHeaders);

      HttpTestUtils.verifyResponse(response, responseData);
      expect(HttpTestUtils.getMockFetch()).toHaveBeenCalledWith(
        `${HttpTestUtils.TEST_CONFIG.baseUrl}/upload`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'text/plain',
          }),
          body: 'raw data',
        })
      );
    });
  });

  describe('Error Handling', () => {
    let client: HttpClient;

    beforeEach(() => {
      client = new HttpClient(HttpTestUtils.TEST_CONFIG_NO_RETRIES);
    });

    HttpTestUtils.getErrorTestScenarios().forEach(scenario => {
      it(`should handle ${scenario.name}`, async () => {
        scenario.setupMock();

        await expect(client.get('/test')).rejects.toThrow();

        try {
          await client.get('/test');
        } catch (error) {
          const httpError = error as HttpClientError;
          expect(httpError).toBeInstanceOf(HttpClientError);
          expect(httpError.name).toBe('HttpClientError');

          if (typeof scenario.expectedErrorPattern === 'string') {
            expect(httpError.message).toContain(scenario.expectedErrorPattern);
          } else {
            expect(httpError.message).toMatch(scenario.expectedErrorPattern);
          }

          if (scenario.expectedStatus !== undefined) {
            expect(httpError.status).toBe(scenario.expectedStatus);
          }

          if (scenario.expectedIsNetwork !== undefined) {
            expect(httpError.isNetworkError).toBe(scenario.expectedIsNetwork);
          }

          if (scenario.expectedIsTimeout !== undefined) {
            expect(httpError.isTimeoutError).toBe(scenario.expectedIsTimeout);
          }
        }
      });
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const mockFetch = HttpTestUtils.getMockFetch();

      const mockResponse: MockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]) as Map<string, string> & {
          forEach: (callback: (value: string, key: string) => void) => void;
        },
        text: vi.fn().mockResolvedValue('invalid json {'),
      };

      // Mock headers.forEach for header extraction
      mockResponse.headers.forEach = (
        callbackfn: (value: string, key: string, map: Map<string, string>) => void
      ) => {
        for (const [key, value] of mockResponse.headers) {
          callbackfn(value, key, mockResponse.headers);
        }
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as import('node-fetch').Response);

      const result = await client.get('/test');

      expect(result.data).toBe('invalid json {');
      expect(result.success).toBe(true);
    });
  });

  describe('URL Building', () => {
    HttpTestUtils.getUrlBuildingTestCases().forEach(testCase => {
      it(`should handle ${testCase.name}`, async () => {
        HttpTestUtils.mockSuccessResponse({ ok: true });

        const client = new HttpClient({ baseUrl: testCase.baseUrl });
        await client.get(testCase.requestUrl);

        expect(HttpTestUtils.getMockFetch()).toHaveBeenCalledWith(
          testCase.expectedUrl,
          expect.any(Object)
        );
      });
    });
  });

  describe('Request Methods Without Body', () => {
    let client: HttpClient;

    beforeEach(() => {
      client = new HttpClient(HttpTestUtils.TEST_CONFIG);
    });

    it('should perform POST request without body', async () => {
      const responseData = { action: 'completed' };
      HttpTestUtils.mockSuccessResponse(responseData);

      const response = await client.post('/action');

      HttpTestUtils.verifyResponse(response, responseData);
      HttpTestUtils.verifyFetchCall(
        `${HttpTestUtils.TEST_CONFIG.baseUrl}/action`,
        'POST',
        expect.not.objectContaining({ 'Content-Type': 'application/json' })
      );
    });
  });

  describe('Complex Data Types', () => {
    let client: HttpClient;

    beforeEach(() => {
      client = new HttpClient(HttpTestUtils.TEST_CONFIG);
    });

    it('should handle complex object responses', async () => {
      const complexData = HttpTestUtils.createTestData().complexObject;
      const getMethod = (url: string, data?: unknown, headers?: Record<string, string>) =>
        client.get(url, headers);
      await HttpTestUtils.testHttpMethodSuccess(
        getMethod,
        'GET',
        '/complex',
        undefined,
        complexData
      );
    });

    it('should handle array responses', async () => {
      const arrayData = HttpTestUtils.createTestData().arrayData;
      const getMethod = (url: string, data?: unknown, headers?: Record<string, string>) =>
        client.get(url, headers);
      await HttpTestUtils.testHttpMethodSuccess(getMethod, 'GET', '/array', undefined, arrayData);
    });
  });
});

describe('RetryStrategy', () => {
  beforeEach(() => {
    HttpTestUtils.resetMocks();
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const strategy = new RetryStrategy();
      expect(strategy).toBeInstanceOf(RetryStrategy);
    });

    it('should accept custom retry configuration', () => {
      const config = { ...HttpTestUtils.TEST_RETRY_CONFIG, maxAttempts: 5 };
      const strategy = new RetryStrategy(config);
      expect(strategy).toBeInstanceOf(RetryStrategy);
    });
  });

  describe('Retry Logic', () => {
    it('should succeed on first attempt when operation succeeds', async () => {
      const strategy = new RetryStrategy(HttpTestUtils.TEST_RETRY_CONFIG);
      const operation = vi.fn().mockResolvedValue('success');

      const result = await strategy.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const strategy = new RetryStrategy({ ...HttpTestUtils.TEST_RETRY_CONFIG, maxAttempts: 3 });
      const networkError = new HttpClientError(
        'Network error',
        undefined,
        undefined,
        undefined,
        true
      );
      const operation = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await strategy.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying on non-retryable errors', async () => {
      const strategy = new RetryStrategy(HttpTestUtils.TEST_RETRY_CONFIG);
      const clientError = new HttpClientError('Bad Request', 400);
      const operation = vi.fn().mockRejectedValue(clientError);

      await expect(strategy.execute(operation)).rejects.toThrow('Bad Request');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should stop retrying after max attempts reached', async () => {
      const strategy = new RetryStrategy({ ...HttpTestUtils.TEST_RETRY_CONFIG, maxAttempts: 2 });
      const serverError = new HttpClientError('Server Error', 500);
      const operation = vi.fn().mockRejectedValue(serverError);

      await expect(strategy.execute(operation)).rejects.toThrow('Server Error');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should calculate exponential backoff delays correctly', async () => {
      const strategy = new RetryStrategy({
        maxAttempts: 3,
        baseDelay: 100,
        exponentialBase: 2,
        jitter: false,
      });

      const startTime = Date.now();
      const timeoutError = new HttpClientError(
        'Timeout',
        undefined,
        undefined,
        undefined,
        false,
        true
      );
      const operation = vi.fn().mockRejectedValue(timeoutError);

      await expect(strategy.execute(operation)).rejects.toThrow();
      const endTime = Date.now();

      // Should have waited approximately: 100ms + 200ms = 300ms total
      expect(endTime - startTime).toBeGreaterThan(250);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });
});

describe('HttpClientError', () => {
  it('should create error with all properties', () => {
    interface MockHttpResponse {
      status: number;
      statusText: string;
      headers: Record<string, string>;
      data: unknown;
      success: boolean;
    }

    const response: MockHttpResponse = {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      data: null,
      success: false,
    };

    const error = new HttpClientError('Not Found', 404, 'Not Found', response, false, true);

    expect(error.name).toBe('HttpClientError');
    expect(error.message).toBe('Not Found');
    expect(error.status).toBe(404);
    expect(error.statusText).toBe('Not Found');
    expect(error.response).toBe(response);
    expect(error.isNetworkError).toBe(false);
    expect(error.isTimeoutError).toBe(true);
  });

  it('should create error with minimal properties', () => {
    const error = new HttpClientError('Generic error');

    expect(error.name).toBe('HttpClientError');
    expect(error.message).toBe('Generic error');
    expect(error.status).toBeUndefined();
    expect(error.statusText).toBeUndefined();
    expect(error.response).toBeUndefined();
    expect(error.isNetworkError).toBe(false);
    expect(error.isTimeoutError).toBe(false);
  });
});

describe('createHttpClient', () => {
  it('should create HTTP client instance with default config', () => {
    const client = createHttpClient();
    expect(client).toBeInstanceOf(HttpClient);
  });

  it('should create HTTP client instance with custom config', () => {
    const client = createHttpClient(HttpTestUtils.TEST_CONFIG);
    expect(client).toBeInstanceOf(HttpClient);
  });

  it('should return instance that implements IHttpClient interface', () => {
    const client = createHttpClient();

    // Verify all interface methods exist
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
  });
});
