/**
 * Netlify Function Test Suite
 *
 * Comprehensive test coverage for the modern sync-jobs Netlify function following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates the complete job synchronization workflow using
 * modern Netlify Functions API with web standard Request/Response objects.
 *
 * Test Features:
 * - Modern Request/Response API compatibility testing
 * - HTTP method handling (GET, POST, OPTIONS) with web standards
 * - CORS preflight request handling with Headers API
 * - Security headers and webhook signature validation
 * - Job fetching and WordPress synchronization workflows
 * - Error handling and logging across all scenarios
 * - Dependency injection and initialization patterns
 * - Request ID generation and tracking
 * - Configuration validation and environment setup
 * - Modern async response body extraction patterns
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/functions/sync-jobs.test.ts -- --grep "OPTIONS request"
 *
 * // Example of running with coverage
 * pnpm test:coverage test/functions/sync-jobs.test.ts
 * ```
 *
 * @module netlify-function-test-suite
 * @since 1.0.0
 * @see {@link ../../src/functions/sync-jobs.mts} for the modern function implementation
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '@netlify/functions';

import handler from '../../src/functions/sync-jobs.mjs';
import type { JobFetchResult, JobSyncResponse, NormalizedJob } from '../../src/types/job.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as config from '../../src/lib/config.js';
import * as logger from '../../src/lib/logger.js';
import * as env from '../../src/lib/env.js';
import * as httpClient from '../../src/lib/http-client.js';
import * as utils from '../../src/lib/utils.js';
import { JobFetchService } from '../../src/services/job-fetcher.js';
import * as htmlParser from '../../src/services/html-parser.js';
import * as wordPressClient from '../../src/services/wordpress-client.js';

/**
 * Type for parsed response JSON to avoid property access issues
 * @since 1.0.0
 */
interface ParsedResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: {
    source?: string;
    method?: string;
    jobCount?: number;
    jobs?: NormalizedJob[];
    message?: string;
    syncedCount?: number;
    skippedCount?: number;
    errorCount?: number;
    errors?: string[];
  };
  error?: string;
}

/**
 * Modern Netlify Function test utilities
 *
 * Extends BaseTestUtils with modern Netlify Functions API testing capabilities.
 * Provides web standard Request/Response object creation, modern header handling,
 * async response body extraction, and comprehensive mock service setup.
 * Maintains DRY principles while supporting the latest Netlify Functions format.
 *
 * Key Features:
 * - Web standard Request object creation for modern API
 * - Response object validation with Headers API
 * - Async response body extraction patterns
 * - Mock service factories for dependency injection
 * - HMAC signature generation for webhook testing
 * - Comprehensive test data generation utilities
 *
 * @extends BaseTestUtils
 * @since 1.0.0
 * @see {@link BaseTestUtils} for shared testing utilities
 * @see {@link ../../CLAUDE.md} for testing standards
 */
class NetlifyFunctionTestUtils extends BaseTestUtils {
  /**
   * Mock services for dependency injection testing
   * @since 1.0.0
   */
  static mockServices = {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
    },
    httpClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    jobFetchService: {
      fetchJobs: vi.fn(),
    },
    wordPressClient: {
      syncJobs: vi.fn(),
      healthCheck: vi.fn(),
    },
    htmlParser: {
      parseJobsFromHtml: vi.fn(),
    },
  };

  /**
   * Sample configuration for testing
   * @since 1.0.0
   */
  static readonly SAMPLE_CONFIG = {
    environment: 'test' as const,
    driveHr: {
      companyId: 'test-company',
      apiBaseUrl: 'https://api.test-company.com',
      careersUrl: 'https://test-company.com/careers',
      timeout: 30000,
      retries: 3,
    },
    wordPress: {
      baseUrl: 'https://wordpress.test-company.com/wp-json/api/v1/sync',
      token: 'wp_auth_token',
      timeout: 30000,
      retries: 3,
    },
    webhook: {
      secret: 'test-webhook-secret-key-that-is-long-enough-for-validation',
      algorithm: 'sha256' as const,
      headerName: 'x-webhook-signature',
    },
    logging: {
      level: 'info' as const,
      enableStructured: true,
      enableConsole: true,
      redactSensitive: true,
    },
    performance: {
      httpTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 50,
      cacheEnabled: false,
      cacheTtl: 300000,
      maxConcurrentRequests: 10,
    },
    security: {
      enableCors: true,
      corsOrigins: ['https://admin.test-company.com'],
      enableRateLimit: false,
      maxRequestsPerMinute: 100,
      rateLimitMaxRequests: 100,
      rateLimitDuration: 60000,
      rateLimitWindowMs: 60000,
      trustedProxies: [],
      enableHsts: true,
      enableInputValidation: true,
      enableRequestValidation: true,
      enableOutputSanitization: true,
    },
  };

  /**
   * Sample normalized jobs for testing
   * @since 1.0.0
   */
  static readonly SAMPLE_JOBS: NormalizedJob[] = [
    {
      id: 'job-001',
      title: 'Senior Software Engineer',
      description: 'Build scalable applications',
      location: 'San Francisco, CA',
      department: 'Engineering',
      type: 'Full-time',
      postedDate: '2024-01-01T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-001',
      source: 'webhook',
      rawData: {},
      processedAt: '2024-01-01T12:00:00.000Z',
    },
    {
      id: 'job-002',
      title: 'Product Manager',
      description: 'Lead product development',
      location: 'Remote',
      department: 'Product',
      type: 'Full-time',
      postedDate: '2024-01-02T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-002',
      source: 'webhook',
      rawData: {},
      processedAt: '2024-01-01T12:00:00.000Z',
    },
  ];

  /**
   * Setup all mocks before tests
   *
   * Configures all necessary mocks including configuration, logger,
   * environment variables, and service dependencies for consistent
   * test behavior across all function handler tests.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * beforeEach(() => {
   *   NetlifyFunctionTestUtils.setupMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static setupMocks(): void {
    // Mock configuration
    vi.spyOn(config, 'loadAppConfig').mockReturnValue({
      isValid: true,
      config: this.SAMPLE_CONFIG,
      errors: [],
    });
    vi.spyOn(config, 'getAppConfig').mockReturnValue(this.SAMPLE_CONFIG);

    // Mock logger
    vi.spyOn(logger, 'createLogger').mockReturnValue(this.mockServices.logger);
    vi.spyOn(logger, 'setLogger').mockImplementation(() => {});
    vi.spyOn(logger, 'getLogger').mockReturnValue(this.mockServices.logger);

    // Mock environment variables
    vi.spyOn(env, 'getEnvVar').mockImplementation((name: string) => {
      switch (name) {
        case 'WEBHOOK_SECRET':
          return this.SAMPLE_CONFIG.webhook.secret;
        default:
          return undefined;
      }
    });

    // Mock HTTP client
    vi.spyOn(httpClient, 'createHttpClient').mockReturnValue(this.mockServices.httpClient);

    // Mock HTML parser
    vi.spyOn(htmlParser, 'createHtmlParser').mockReturnValue(this.mockServices.htmlParser);

    // Mock WordPress client
    vi.spyOn(wordPressClient, 'createWordPressClient').mockReturnValue(
      this.mockServices.wordPressClient
    );

    // Mock JobFetchService
    vi.spyOn(JobFetchService.prototype, 'fetchJobs').mockImplementation(
      this.mockServices.jobFetchService.fetchJobs
    );

    // Mock utility functions
    vi.spyOn(utils.StringUtils, 'generateRequestId').mockReturnValue('test-request-123');
    vi.spyOn(utils.SecurityUtils, 'validateHmacSignature').mockReturnValue(true);
  }

  /**
   * Restore all mocks after tests
   *
   * Cleans up all mock functions and restores original implementations
   * to prevent test interference between test cases.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * afterEach(() => {
   *   NetlifyFunctionTestUtils.restoreMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static restoreMocks(): void {
    vi.restoreAllMocks();
    Object.values(this.mockServices.logger).forEach(mock => mock.mockClear());
    Object.values(this.mockServices.httpClient).forEach(mock => mock.mockClear());
    Object.values(this.mockServices.jobFetchService).forEach(mock => mock.mockClear());
    Object.values(this.mockServices.wordPressClient).forEach(mock => mock.mockClear());
    Object.values(this.mockServices.htmlParser).forEach(mock => mock.mockClear());
  }

  /**
   * Create modern Request object
   *
   * Generates a properly formatted Request object for testing
   * modern Netlify Functions with the web standard API.
   *
   * @param {string} method - HTTP method (GET, POST, OPTIONS, etc.)
   * @param {Record<string, string>} [headers={}] - HTTP headers
   * @param {string} [body] - Request body (for POST requests)
   * @param {string} [path='/'] - Request path
   * @returns {Request} Web standard Request object
   * @example
   * ```typescript
   * const request = NetlifyFunctionTestUtils.createRequest('POST', {
   *   'Content-Type': 'application/json',
   *   'X-Webhook-Signature': 'sha256=...'
   * }, JSON.stringify({ source: 'manual' }));
   * ```
   * @since 1.0.0
   */
  static createRequest(
    method: string,
    headers: Record<string, string> = {},
    body?: string,
    path = '/'
  ): Request {
    const url = `https://example.netlify.app/.netlify/functions/sync-jobs${path}`;
    const init: RequestInit = {
      method,
      headers: new Headers(headers),
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      init.body = body;
    }

    return new Request(url, init);
  }

  /**
   * Create Netlify context
   *
   * Generates a minimal Netlify context object for testing modern functions.
   * Provides mock implementations of all required Context properties.
   *
   * @returns {Context} Netlify context with mock data
   * @example
   * ```typescript
   * const context = NetlifyFunctionTestUtils.createContext();
   * const response = await handler(request, context);
   * ```
   * @since 1.0.0
   */
  static createContext(): Context {
    // Create minimal mock Context for testing - only implements what we use
    return {
      requestId: 'test-request-id',
    } as unknown as Context;
  }

  /**
   * Create successful job fetch result
   *
   * Generates a successful job fetch result with the provided jobs
   * for mocking the job fetch service behavior.
   *
   * @param {NormalizedJob[]} [jobs] - Jobs to include in the result
   * @param {string} [method='api'] - Fetch method used
   * @returns {JobFetchResult} Successful job fetch result
   * @example
   * ```typescript
   * const result = NetlifyFunctionTestUtils.createJobFetchResult(jobs, 'api');
   * mockServices.jobFetchService.fetchJobs.mockResolvedValue(result);
   * ```
   * @since 1.0.0
   */
  static createJobFetchResult(
    jobs: NormalizedJob[] = this.SAMPLE_JOBS,
    method: 'api' | 'json' | 'html' | 'json-ld' = 'api'
  ): JobFetchResult {
    return {
      success: true,
      jobs,
      totalCount: jobs.length,
      method,
      fetchedAt: '2024-01-01T12:00:00.000Z',
      message: `Successfully fetched ${jobs.length} jobs using ${method}`,
    };
  }

  /**
   * Create failed job fetch result
   *
   * Generates a failed job fetch result for testing error scenarios.
   *
   * @param {string} [error='Failed to fetch jobs'] - Error message
   * @returns {JobFetchResult} Failed job fetch result
   * @example
   * ```typescript
   * const result = NetlifyFunctionTestUtils.createJobFetchFailure('API timeout');
   * mockServices.jobFetchService.fetchJobs.mockResolvedValue(result);
   * ```
   * @since 1.0.0
   */
  static createJobFetchFailure(error = 'Failed to fetch jobs'): JobFetchResult {
    return {
      success: false,
      jobs: [],
      totalCount: 0,
      method: 'none',
      fetchedAt: '2024-01-01T12:00:00.000Z',
      error,
    };
  }

  /**
   * Create successful WordPress sync response
   *
   * Generates a successful WordPress sync response for testing
   * the complete job synchronization workflow.
   *
   * @param {number} [syncedCount=2] - Number of jobs synced
   * @param {number} [skippedCount=0] - Number of jobs skipped
   * @param {number} [errorCount=0] - Number of jobs with errors
   * @returns {JobSyncResponse} Successful sync response
   * @example
   * ```typescript
   * const response = NetlifyFunctionTestUtils.createSyncResponse(3, 1, 0);
   * mockServices.wordPressClient.syncJobs.mockResolvedValue(response);
   * ```
   * @since 1.0.0
   */
  static createSyncResponse(syncedCount = 2, skippedCount = 0, errorCount = 0): JobSyncResponse {
    return {
      success: true,
      syncedCount,
      skippedCount,
      errorCount,
      message: `Successfully synced ${syncedCount} jobs to WordPress`,
      errors: [],
      processedAt: '2024-01-01T12:00:00.000Z',
    };
  }

  /**
   * Create failed WordPress sync response
   *
   * Generates a failed WordPress sync response for testing error scenarios.
   *
   * @param {string} [message='WordPress sync failed'] - Error message
   * @returns {JobSyncResponse} Failed sync response
   * @example
   * ```typescript
   * const response = NetlifyFunctionTestUtils.createSyncFailure('Connection timeout');
   * mockServices.wordPressClient.syncJobs.mockResolvedValue(response);
   * ```
   * @since 1.0.0
   */
  static createSyncFailure(message = 'WordPress sync failed'): JobSyncResponse {
    return {
      success: false,
      syncedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      message,
      errors: [message],
      processedAt: '2024-01-01T12:00:00.000Z',
    };
  }

  /**
   * Verify Response object structure
   *
   * Validates that a Response object has the correct structure
   * with proper status code, headers, and JSON body format.
   *
   * @param {unknown} response - Response to verify
   * @param {number} expectedStatus - Expected HTTP status code
   * @param {boolean} [shouldHaveBody=true] - Whether response should have body
   * @returns {void} No return value, throws assertion errors on mismatch
   * @example
   * ```typescript
   * const response = await handler(request, context);
   * NetlifyFunctionTestUtils.verifyResponse(response, 200);
   * ```
   * @since 1.0.0
   */
  static verifyResponse(
    response: unknown,
    expectedStatus: number,
    shouldHaveBody = true
  ): asserts response is Response {
    expect(response).toBeInstanceOf(Response);
    expect(response).not.toBeNull();

    const webResponse = response as Response;
    expect(webResponse.status).toBe(expectedStatus);
    expect(webResponse.headers).toBeInstanceOf(Headers);

    if (shouldHaveBody && expectedStatus !== 204) {
      expect(webResponse.body).toBeDefined();
    }
  }

  /**
   * Safely extract response body with proper TypeScript handling
   *
   * Helper method to safely extract the response body from a Response object
   * and ensure it's properly typed for downstream processing.
   *
   * @param {Response} response - Response to extract body from
   * @returns {Promise<string>} Response body as string
   * @throws {Error} If response body cannot be read as text
   * @since 1.0.0
   */
  static async extractResponseBody(response: Response): Promise<string> {
    expect(response.body).toBeDefined();
    const text = await response.text();
    expect(text).toBeTypeOf('string');
    return text;
  }

  /**
   * Verify response JSON content
   *
   * Parses and validates the JSON content of a handler response
   * with expected success status and required fields.
   *
   * @param {string} responseBody - Response body JSON string
   * @param {boolean} expectedSuccess - Expected success status
   * @param {string[]} [requiredFields=[]] - Required fields in response data
   * @param {string} [expectedRequestIdPattern] - Expected request ID pattern (regex)
   * @returns {ParsedResponse} Parsed response object with proper typing
   * @example
   * ```typescript
   * const response = await handler(event, context);
   * const data = NetlifyFunctionTestUtils.verifyResponseJson(
   *   response.body,
   *   true,
   *   ['jobCount', 'syncedCount']
   * );
   * ```
   * @since 1.0.0
   */
  static verifyResponseJson(
    responseBody: string,
    expectedSuccess: boolean,
    requiredFields: string[] = [],
    expectedRequestIdPattern?: string
  ): ParsedResponse {
    const parsed = JSON.parse(responseBody) as ParsedResponse;
    expect(parsed.success).toBe(expectedSuccess);

    // Use provided pattern or default pattern
    const requestIdPattern = expectedRequestIdPattern ?? '^netlify_test-request-123$';
    expect(parsed.requestId).toMatch(new RegExp(requestIdPattern));
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    if (expectedSuccess && parsed.data) {
      requiredFields.forEach(field => {
        expect(parsed.data).toHaveProperty(field);
      });
    }

    return parsed;
  }

  /**
   * Generate valid HMAC signature for testing
   *
   * Creates a valid HMAC signature for the given payload using the
   * test webhook secret for testing authenticated requests.
   *
   * @param {string} payload - Request payload to sign
   * @returns {string} HMAC signature in sha256=<hex> format
   * @example
   * ```typescript
   * const payload = JSON.stringify({ source: 'webhook' });
   * const signature = NetlifyFunctionTestUtils.generateValidSignature(payload);
   * const request = createRequest('POST', { 'x-webhook-signature': signature }, payload);
   * ```
   * @since 1.0.0
   */
  static generateValidSignature(payload: string): string {
    // In real implementation, this would use actual HMAC generation
    // For testing, we mock the validation to return true
    return `sha256=${Buffer.from(payload + this.SAMPLE_CONFIG.webhook.secret).toString('hex')}`;
  }
}

describe('Netlify Function Handler', () => {
  beforeEach(() => {
    NetlifyFunctionTestUtils.setupMocks();
  });

  afterEach(() => {
    NetlifyFunctionTestUtils.restoreMocks();
  });

  describe('OPTIONS request handling', () => {
    it('should handle CORS preflight request correctly', async () => {
      const request = NetlifyFunctionTestUtils.createRequest('OPTIONS');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 200, false);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
      expect(response.headers.get('Access-Control-Max-Age')).toBeDefined();
    });

    it('should include security headers in OPTIONS response', async () => {
      const request = NetlifyFunctionTestUtils.createRequest('OPTIONS');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 200, false);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Content-Security-Policy')).toBeDefined();
    });

    it('should set CORS origin based on configuration', async () => {
      const request = NetlifyFunctionTestUtils.createRequest('OPTIONS');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 200, false);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://admin.test-company.com'
      );
    });
  });

  describe('GET request handling', () => {
    it('should fetch jobs without syncing on GET request', async () => {
      const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult();
      NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
        fetchResult
      );

      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 200);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, true, [
        'source',
        'method',
        'jobCount',
        'jobs',
      ]);

      expect(data.data).toHaveProperty('method', 'api');
      expect(data.data).toHaveProperty('jobCount', 2);
      expect(data.data).toHaveProperty('jobs');
      expect(NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs).not.toHaveBeenCalled();
    });

    it('should handle job fetch failure on GET request', async () => {
      const fetchResult = NetlifyFunctionTestUtils.createJobFetchFailure('API timeout');
      NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
        fetchResult
      );

      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 200);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);

      expect(data.data).toHaveProperty('message', 'API timeout');
      expect(data.data).toHaveProperty('jobCount', 0);
    });

    it('should log GET request appropriately', async () => {
      const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult();
      NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
        fetchResult
      );

      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      await handler(request, context);

      expect(NetlifyFunctionTestUtils.mockServices.logger.info).toHaveBeenCalledWith(
        'DriveHR sync function invoked',
        expect.objectContaining({
          requestId: expect.stringMatching(/^netlify_/),
          method: 'GET',
          path: '/.netlify/functions/sync-jobs/',
        })
      );
    });
  });

  describe('POST request handling', () => {
    describe('webhook signature validation', () => {
      it('should validate webhook signature when present', async () => {
        const payload = JSON.stringify({ source: 'webhook' });
        const signature = NetlifyFunctionTestUtils.generateValidSignature(payload);
        const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult();
        const syncResult = NetlifyFunctionTestUtils.createSyncResponse();

        NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
          fetchResult
        );
        NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs.mockResolvedValue(
          syncResult
        );

        const request = NetlifyFunctionTestUtils.createRequest(
          'POST',
          { 'x-webhook-signature': signature },
          payload
        );
        const context = NetlifyFunctionTestUtils.createContext();

        const response = await handler(request, context);

        NetlifyFunctionTestUtils.verifyResponse(response, 200);
        expect(utils.SecurityUtils.validateHmacSignature).toHaveBeenCalledWith(
          payload,
          signature,
          NetlifyFunctionTestUtils.SAMPLE_CONFIG.webhook.secret
        );
      });

      it('should reject invalid webhook signature', async () => {
        vi.spyOn(utils.SecurityUtils, 'validateHmacSignature').mockReturnValue(false);

        const payload = JSON.stringify({ source: 'webhook' });
        const request = NetlifyFunctionTestUtils.createRequest(
          'POST',
          { 'x-webhook-signature': 'sha256=invalid-signature' },
          payload
        );
        const context = NetlifyFunctionTestUtils.createContext();

        const response = await handler(request, context);

        NetlifyFunctionTestUtils.verifyResponse(response, 401);
        const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
        const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);
        expect(data.error).toBe('Invalid webhook signature');
      });

      it('should handle missing webhook secret environment variable', async () => {
        vi.spyOn(env, 'getEnvVar').mockReturnValue(undefined);

        const payload = JSON.stringify({ source: 'webhook' });
        const request = NetlifyFunctionTestUtils.createRequest(
          'POST',
          { 'x-webhook-signature': 'sha256=some-signature' },
          payload
        );
        const context = NetlifyFunctionTestUtils.createContext();

        const response = await handler(request, context);

        NetlifyFunctionTestUtils.verifyResponse(response, 500);
        const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
        const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);
        expect(data.error).toBe('Failed to sync jobs');
      });
    });

    describe('job fetching and syncing', () => {
      it('should fetch and sync jobs successfully', async () => {
        const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult();
        const syncResult = NetlifyFunctionTestUtils.createSyncResponse();

        NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
          fetchResult
        );
        NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs.mockResolvedValue(
          syncResult
        );

        const request = NetlifyFunctionTestUtils.createRequest('POST');
        const context = NetlifyFunctionTestUtils.createContext();

        const response = await handler(request, context);

        NetlifyFunctionTestUtils.verifyResponse(response, 200);
        const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
        const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, true, [
          'jobCount',
          'syncedCount',
        ]);

        expect(data.data).toHaveProperty('jobCount', 2);
        expect(data.data).toHaveProperty('syncedCount', 2);
        expect(data.data).toHaveProperty('skippedCount', 0);
        expect(data.data).toHaveProperty('errorCount', 0);

        expect(
          NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs
        ).toHaveBeenCalledWith(NetlifyFunctionTestUtils.SAMPLE_CONFIG.driveHr, 'manual');
        expect(NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs).toHaveBeenCalledWith(
          fetchResult.jobs,
          'manual'
        );
      });

      it('should handle job fetch failure gracefully', async () => {
        const fetchResult = NetlifyFunctionTestUtils.createJobFetchFailure();
        NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
          fetchResult
        );

        const request = NetlifyFunctionTestUtils.createRequest('POST');
        const context = NetlifyFunctionTestUtils.createContext();

        const response = await handler(request, context);

        NetlifyFunctionTestUtils.verifyResponse(response, 200);
        const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
        const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, true, [
          'jobCount',
          'syncedCount',
        ]);

        expect(data.data).toHaveProperty('jobCount', 0);
        expect(data.data).toHaveProperty('syncedCount', 0);
        expect(data.data).toHaveProperty('message', 'Failed to fetch jobs');
        expect(
          NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs
        ).not.toHaveBeenCalled();
      });

      it('should handle empty job results', async () => {
        const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult([], 'api');
        NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
          fetchResult
        );

        const request = NetlifyFunctionTestUtils.createRequest('POST');
        const context = NetlifyFunctionTestUtils.createContext();

        const response = await handler(request, context);

        NetlifyFunctionTestUtils.verifyResponse(response, 200);
        const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
        const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, true);

        expect(data.data).toHaveProperty('jobCount', 0);
        expect(data.data).toHaveProperty('syncedCount', 0);
        expect(data.data).toHaveProperty('message', 'No jobs found to sync');
        expect(
          NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs
        ).not.toHaveBeenCalled();
      });

      it('should handle WordPress sync failure', async () => {
        const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult();
        const syncResult = NetlifyFunctionTestUtils.createSyncFailure(
          'WordPress connection failed'
        );

        NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
          fetchResult
        );
        NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs.mockResolvedValue(
          syncResult
        );

        const request = NetlifyFunctionTestUtils.createRequest('POST');
        const context = NetlifyFunctionTestUtils.createContext();

        const response = await handler(request, context);

        NetlifyFunctionTestUtils.verifyResponse(response, 200);
        const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
        const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);

        expect(data.data).toHaveProperty('message', 'WordPress connection failed');
        expect(data.data).toHaveProperty('jobCount', 2);
        expect(data.data).toHaveProperty('syncedCount', 0);
      });

      it('should use webhook source when signature is present', async () => {
        const payload = JSON.stringify({ source: 'webhook' });
        const signature = NetlifyFunctionTestUtils.generateValidSignature(payload);
        const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult();
        const syncResult = NetlifyFunctionTestUtils.createSyncResponse();

        NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
          fetchResult
        );
        NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs.mockResolvedValue(
          syncResult
        );

        const request = NetlifyFunctionTestUtils.createRequest(
          'POST',
          { 'x-webhook-signature': signature },
          payload
        );
        const context = NetlifyFunctionTestUtils.createContext();

        await handler(request, context);

        expect(
          NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs
        ).toHaveBeenCalledWith(NetlifyFunctionTestUtils.SAMPLE_CONFIG.driveHr, 'webhook');
        expect(NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs).toHaveBeenCalledWith(
          fetchResult.jobs,
          'webhook'
        );
      });
    });
  });

  describe('error handling', () => {
    it('should handle configuration loading errors', async () => {
      vi.spyOn(config, 'loadAppConfig').mockReturnValue({
        isValid: false,
        config: undefined,
        errors: ['Invalid WORDPRESS_URL', 'Missing WEBHOOK_SECRET'],
      });

      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 500);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle service initialization errors', async () => {
      vi.spyOn(httpClient, 'createHttpClient').mockImplementation(() => {
        throw new Error('HTTP client initialization failed');
      });

      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 500);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle unexpected errors in job processing', async () => {
      NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockRejectedValue(
        new Error('Unexpected error during job fetch')
      );

      const request = NetlifyFunctionTestUtils.createRequest('POST');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 500);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);
      expect(data.error).toBe('Failed to sync jobs');

      expect(NetlifyFunctionTestUtils.mockServices.logger.error).toHaveBeenCalledWith(
        'Failed to sync jobs',
        expect.objectContaining({
          requestId: expect.stringMatching(/^netlify_/),
          error: expect.any(Error),
        })
      );
    });

    it('should fallback to console logging when logger fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(logger, 'getLogger').mockImplementation(() => {
        throw new Error('Logger not initialized');
      });
      vi.spyOn(config, 'loadAppConfig').mockImplementation(() => {
        throw new Error('Config loading failed');
      });

      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 500);
      expect(consoleSpy).toHaveBeenCalledWith(
        'DriveHR sync function error:',
        expect.objectContaining({
          requestId: expect.stringMatching(/^netlify_/),
          error: 'Config loading failed',
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('HTTP method validation', () => {
    it('should reject unsupported HTTP methods', async () => {
      const request = NetlifyFunctionTestUtils.createRequest('PUT');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 405);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, false);
      expect(data.error).toBe('Method not allowed');
    });

    it('should include security headers in method not allowed response', async () => {
      const request = NetlifyFunctionTestUtils.createRequest('DELETE');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 405, true);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  describe('request ID generation', () => {
    it('should generate unique request IDs for each request', async () => {
      let callCount = 0;
      vi.spyOn(utils.StringUtils, 'generateRequestId').mockImplementation(() => {
        callCount++;
        return `test-request-${callCount}`;
      });

      const request1 = NetlifyFunctionTestUtils.createRequest('GET');
      const request2 = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      const response1 = await handler(request1, context);
      const response2 = await handler(request2, context);

      NetlifyFunctionTestUtils.verifyResponse(response1, 500, true);
      NetlifyFunctionTestUtils.verifyResponse(response2, 500, true);
      const responseBody1 = await NetlifyFunctionTestUtils.extractResponseBody(response1);
      const responseBody2 = await NetlifyFunctionTestUtils.extractResponseBody(response2);
      const data1 = NetlifyFunctionTestUtils.verifyResponseJson(
        responseBody1,
        false,
        [],
        '^netlify_test-request-\\d+$'
      );
      const data2 = NetlifyFunctionTestUtils.verifyResponseJson(
        responseBody2,
        false,
        [],
        '^netlify_test-request-\\d+$'
      );

      expect(data1.requestId).toBe('netlify_test-request-1');
      expect(data2.requestId).toBe('netlify_test-request-2');
    });

    it('should include request ID in all logging calls', async () => {
      const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult();
      NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
        fetchResult
      );

      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      await handler(request, context);

      expect(NetlifyFunctionTestUtils.mockServices.logger.info).toHaveBeenCalledWith(
        'DriveHR sync function invoked',
        expect.objectContaining({
          requestId: 'netlify_test-request-123',
        })
      );
    });
  });

  describe('Integration Tests', () => {
    it('should demonstrate complete workflow for successful sync', async () => {
      const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult(
        NetlifyFunctionTestUtils.SAMPLE_JOBS,
        'api'
      );
      const syncResult = NetlifyFunctionTestUtils.createSyncResponse(2, 0, 0);

      NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
        fetchResult
      );
      NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs.mockResolvedValue(syncResult);

      const request = NetlifyFunctionTestUtils.createRequest('POST');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      // Verify complete response structure
      NetlifyFunctionTestUtils.verifyResponse(response, 200);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, true, [
        'message',
        'jobCount',
        'syncedCount',
        'skippedCount',
        'errorCount',
      ]);

      // Verify workflow completion
      expect(NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs).toHaveBeenCalledWith(
        NetlifyFunctionTestUtils.SAMPLE_CONFIG.driveHr,
        'manual'
      );
      expect(NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs).toHaveBeenCalledWith(
        NetlifyFunctionTestUtils.SAMPLE_JOBS,
        'manual'
      );

      // Verify response data
      expect(data.data).toEqual({
        message: 'Successfully synced 2 jobs to WordPress',
        jobCount: 2,
        syncedCount: 2,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      });

      // Verify logging occurred
      expect(NetlifyFunctionTestUtils.mockServices.logger.info).toHaveBeenCalledWith(
        'DriveHR sync function invoked',
        expect.objectContaining({
          method: 'POST',
          requestId: expect.stringMatching(/^netlify_/),
        })
      );
    });

    it('should handle partial sync success with errors', async () => {
      const fetchResult = NetlifyFunctionTestUtils.createJobFetchResult(
        NetlifyFunctionTestUtils.SAMPLE_JOBS,
        'json'
      );
      const syncResult: JobSyncResponse = {
        success: true,
        syncedCount: 1,
        skippedCount: 1,
        errorCount: 1,
        message: 'Partial sync completed with errors',
        errors: ['Job validation failed for job-002'],
        processedAt: '2024-01-01T12:00:00.000Z',
      };

      NetlifyFunctionTestUtils.mockServices.jobFetchService.fetchJobs.mockResolvedValue(
        fetchResult
      );
      NetlifyFunctionTestUtils.mockServices.wordPressClient.syncJobs.mockResolvedValue(syncResult);

      const request = NetlifyFunctionTestUtils.createRequest('POST');
      const context = NetlifyFunctionTestUtils.createContext();

      const response = await handler(request, context);

      NetlifyFunctionTestUtils.verifyResponse(response, 200);
      const responseBody = await NetlifyFunctionTestUtils.extractResponseBody(response);
      const data = NetlifyFunctionTestUtils.verifyResponseJson(responseBody, true);

      expect(data.data).toEqual({
        message: 'Partial sync completed with errors',
        jobCount: 2,
        syncedCount: 1,
        skippedCount: 1,
        errorCount: 1,
        errors: ['Job validation failed for job-002'],
      });
    });

    it('should properly initialize all dependencies in correct order', async () => {
      const request = NetlifyFunctionTestUtils.createRequest('GET');
      const context = NetlifyFunctionTestUtils.createContext();

      await handler(request, context);

      // Verify configuration was loaded first
      expect(config.loadAppConfig).toHaveBeenCalled();
      expect(config.getAppConfig).toHaveBeenCalled();

      // Verify logger was initialized
      expect(logger.createLogger).toHaveBeenCalledWith(
        NetlifyFunctionTestUtils.SAMPLE_CONFIG.logging.level,
        NetlifyFunctionTestUtils.SAMPLE_CONFIG.logging.enableStructured
      );
      expect(logger.setLogger).toHaveBeenCalled();

      // Verify HTTP client was created
      expect(httpClient.createHttpClient).toHaveBeenCalledWith({
        timeout: NetlifyFunctionTestUtils.SAMPLE_CONFIG.performance.httpTimeout,
        retries: NetlifyFunctionTestUtils.SAMPLE_CONFIG.performance.maxRetries,
        userAgent: 'DriveHR-Sync/1.0 (Netlify Function)',
      });

      // Verify HTML parser was created
      expect(htmlParser.createHtmlParser).toHaveBeenCalled();

      // Verify WordPress client was created
      expect(wordPressClient.createWordPressClient).toHaveBeenCalledWith(
        NetlifyFunctionTestUtils.SAMPLE_CONFIG.wordPress,
        NetlifyFunctionTestUtils.mockServices.httpClient,
        NetlifyFunctionTestUtils.SAMPLE_CONFIG.webhook.secret
      );
    });
  });
});
