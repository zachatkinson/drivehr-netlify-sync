/**
 * @fileoverview Comprehensive test suite for WordPress webhook client
 *
 * Tests the WordPress client service that handles secure job synchronization
 * with WordPress via webhooks using HMAC signature verification. Uses DRY
 * principles with specialized utilities for consistent test patterns.
 *
 * Key test areas:
 * - WordPressWebhookClient: Main client class with sync and health operations
 * - createWordPressClient: Factory function with configuration validation
 * - syncJobs: Core synchronization logic with various scenarios
 * - healthCheck: WordPress endpoint accessibility verification
 * - Error handling: Custom errors and HTTP failure scenarios
 * - Security: HMAC signature generation and validation
 * - Integration patterns: End-to-end workflow testing
 *
 * @since 1.0.0
 * @see {@link ../../src/services/wordpress-client.ts} for implementation details
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WordPressWebhookClient,
  createWordPressClient,
  validateWebhookSignature,
  WordPressClientError,
  type IWordPressClient,
} from '../../src/services/wordpress-client.js';
import type { WordPressApiConfig } from '../../src/types/api.js';
import type { NormalizedJob, JobSyncResponse, JobSource } from '../../src/types/job.js';
import type { IHttpClient } from '../../src/lib/http-client.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as logger from '../../src/lib/logger.js';
import * as utils from '../../src/lib/utils.js';
import { SpanKind } from '@opentelemetry/api';

/**
 * Specialized test utilities for WordPress client testing
 *
 * Extends BaseTestUtils with WordPress-client-specific testing capabilities including
 * mock configuration generation, job data creation, HTTP response simulation,
 * and comprehensive test data management. Implements DRY principles for
 * consistent test patterns across all WordPress client test scenarios.
 *
 * @extends BaseTestUtils
 * @since 1.0.0
 */
class WordPressClientTestUtils extends BaseTestUtils {
  /**
   * Mock logger for testing logging behavior
   * @since 1.0.0
   */
  static mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  };

  /**
   * Mock HTTP client for testing network operations
   * @since 1.0.0
   */
  static mockHttpClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as IHttpClient;

  /**
   * Valid WordPress API configurations for testing
   * @since 1.0.0
   */
  static readonly VALID_CONFIGS = {
    basic: {
      baseUrl: 'https://example.com/webhook/drivehr-sync',
      token: 'wp_token_123',
      timeout: 30000,
      retries: 3,
    } as WordPressApiConfig,

    custom: {
      baseUrl: 'https://mysite.wordpress.com/webhook/drivehr-sync',
      token: 'wp_custom_token_456',
      timeout: 45000,
      retries: 5,
    } as WordPressApiConfig,

    minimal: {
      baseUrl: 'https://minimal.com/webhook/drivehr-sync',
    } as WordPressApiConfig,
  } as const;

  /**
   * Invalid configurations for testing validation
   * @since 1.0.0
   */
  static readonly INVALID_CONFIGS = {
    noUrl: {} as WordPressApiConfig,
    emptyUrl: { baseUrl: '' } as WordPressApiConfig,
    invalidUrl: { baseUrl: 'not-a-url' } as WordPressApiConfig,
  } as const;

  /**
   * Valid webhook secrets for testing
   * @since 1.0.0
   */
  static readonly VALID_SECRETS = {
    standard: 'this-is-a-valid-webhook-secret-key-that-is-long-enough',
    custom: 'custom-webhook-secret-key-for-advanced-testing-scenarios',
    minimal: '12345678901234567890123456789012', // exactly 32 chars
  } as const;

  /**
   * Invalid webhook secrets for validation testing
   * @since 1.0.0
   */
  static readonly INVALID_SECRETS = {
    empty: '',
    short: 'too-short',
    almostLong: '1234567890123456789012345678901', // 31 chars
  } as const;

  /**
   * Sample normalized job data for testing
   * @since 1.0.0
   */
  static readonly SAMPLE_JOBS = {
    single: [
      {
        id: 'job-001',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        type: 'Full-time',
        description: 'Build scalable applications using modern technologies.',
        postedDate: '2024-01-01T00:00:00.000Z',
        applyUrl: 'https://example.com/apply/job-001',
        source: 'webhook' as JobSource,
      },
    ] as NormalizedJob[],

    multiple: [
      {
        id: 'job-001',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        type: 'Full-time',
        description: 'Build scalable applications.',
        postedDate: '2024-01-01T00:00:00.000Z',
        applyUrl: 'https://example.com/apply/job-001',
        source: 'webhook' as JobSource,
      },
      {
        id: 'job-002',
        title: 'Product Manager',
        department: 'Product',
        location: 'Remote',
        type: 'Full-time',
        description: 'Lead product strategy.',
        postedDate: '2024-01-02T00:00:00.000Z',
        applyUrl: 'https://example.com/apply/job-002',
        source: 'webhook' as JobSource,
      },
      {
        id: 'job-003',
        title: 'UX Designer',
        department: 'Design',
        location: 'New York, NY',
        type: 'Contract',
        description: 'Create beautiful user experiences.',
        postedDate: '2024-01-03T00:00:00.000Z',
        applyUrl: 'https://example.com/apply/job-003',
        source: 'webhook' as JobSource,
      },
    ] as NormalizedJob[],

    empty: [] as NormalizedJob[],
  } as const;

  /**
   * Sample HTTP responses for testing
   * @since 1.0.0
   */
  static readonly SAMPLE_RESPONSES = {
    syncSuccess: {
      success: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        success: true,
        syncedCount: 3,
        skippedCount: 0,
        errorCount: 0,
        message: 'Jobs synced successfully',
        errors: [],
        processedAt: '2024-01-01T12:00:00.000Z',
      } as JobSyncResponse,
    },

    syncPartialSuccess: {
      success: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        success: true,
        syncedCount: 2,
        skippedCount: 1,
        errorCount: 0,
        message: '2 jobs synced, 1 skipped (duplicate)',
        errors: [],
        processedAt: '2024-01-01T12:00:00.000Z',
      } as JobSyncResponse,
    },

    syncWithErrors: {
      success: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        success: true,
        syncedCount: 1,
        skippedCount: 0,
        errorCount: 2,
        message: '1 job synced, 2 had errors',
        errors: ['Invalid job data for job-002', 'Missing required field for job-003'],
        processedAt: '2024-01-01T12:00:00.000Z',
      } as JobSyncResponse,
    },

    healthSuccess: {
      success: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { status: 'healthy', version: '1.0.0' },
    },

    serverError: {
      success: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      data: { error: 'Internal server error' },
    },

    unauthorizedError: {
      success: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      data: { error: 'Invalid authentication token' },
    },

    timeoutError: {
      success: false,
      status: 0,
      statusText: 'Timeout',
      headers: {},
      data: null,
    },
  } as const;

  /**
   * Setup mocks for testing
   * @since 1.0.0
   */
  static setupMocks(): void {
    vi.spyOn(logger, 'getLogger').mockReturnValue(this.mockLogger);
    vi.spyOn(utils.StringUtils, 'generateRequestId').mockReturnValue('test-req-id-123');
    vi.spyOn(utils.SecurityUtils, 'generateHmacSignature').mockReturnValue('sha256=test-signature');
    vi.spyOn(utils.SecurityUtils, 'validateHmacSignature').mockReturnValue(true);

    // Reset mock HTTP client
    Object.values(this.mockHttpClient).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockReset();
      }
    });
  }

  /**
   * Restore mocks after testing
   * @since 1.0.0
   */
  static restoreMocks(): void {
    vi.restoreAllMocks();
    Object.values(this.mockLogger).forEach(mock => mock.mockClear());
    Object.values(this.mockHttpClient).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockClear();
      }
    });
  }

  /**
   * Create a configured WordPress client for testing
   * @since 1.0.0
   */
  static createTestClient(
    config: WordPressApiConfig = this.VALID_CONFIGS.basic,
    secret: string = this.VALID_SECRETS.standard
  ): IWordPressClient {
    return createWordPressClient(config, this.mockHttpClient, secret);
  }

  /**
   * Verify job sync response structure and content
   * @since 1.0.0
   */
  static verifyJobSyncResponse(actual: JobSyncResponse, expected: Partial<JobSyncResponse>): void {
    expect(actual.success).toBe(expected.success ?? true);
    expect(actual.syncedCount).toBe(expected.syncedCount ?? 0);
    expect(actual.skippedCount).toBe(expected.skippedCount ?? 0);
    expect(actual.errorCount).toBe(expected.errorCount ?? 0);
    expect(actual.message).toBe(expected.message ?? 'Sync completed successfully');
    expect(Array.isArray(actual.errors)).toBe(true);
    expect(typeof actual.processedAt).toBe('string');

    if (expected.errors) {
      expect(actual.errors).toEqual(expected.errors);
    }
    if (expected.processedAt) {
      expect(actual.processedAt).toBe(expected.processedAt);
    }
  }

  /**
   * Setup HTTP client mock for successful sync operation
   *
   * Configures the mock HTTP client to return a successful sync response
   * for testing positive sync scenarios.
   *
   * @param {object} [response] - Mock response object to return
   * @returns {void} No return value
   * @example
   * ```typescript
   * WordPressClientTestUtils.setupSyncSuccessMock();
   * const result = await client.syncJobs(jobs, 'webhook');
   * expect(result.success).toBe(true);
   * ```
   * @since 1.0.0
   */
  static setupSyncSuccessMock(response = this.SAMPLE_RESPONSES.syncSuccess): void {
    vi.mocked(this.mockHttpClient.post).mockResolvedValue(response);
  }

  /**
   * Setup HTTP client mock for failed sync operation
   *
   * Configures the mock HTTP client to return a failed sync response
   * for testing error handling scenarios.
   *
   * @param {object} [response] - Mock error response object to return
   * @returns {void} No return value
   * @example
   * ```typescript
   * WordPressClientTestUtils.setupSyncFailureMock();
   * await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow();
   * ```
   * @since 1.0.0
   */
  static setupSyncFailureMock(response = this.SAMPLE_RESPONSES.serverError): void {
    vi.mocked(this.mockHttpClient.post).mockResolvedValue(response);
  }

  /**
   * Setup HTTP client mock for health check success
   *
   * Configures the mock HTTP client to return a successful health check
   * response for testing positive health check scenarios.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * WordPressClientTestUtils.setupHealthSuccessMock();
   * const isHealthy = await client.healthCheck();
   * expect(isHealthy).toBe(true);
   * ```
   * @since 1.0.0
   */
  static setupHealthSuccessMock(): void {
    vi.mocked(this.mockHttpClient.post).mockResolvedValue(this.SAMPLE_RESPONSES.healthSuccess);
  }

  /**
   * Setup HTTP client mock for health check failure
   *
   * Configures the mock HTTP client to return a failed health check
   * response for testing error handling scenarios.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * WordPressClientTestUtils.setupHealthFailureMock();
   * const isHealthy = await client.healthCheck();
   * expect(isHealthy).toBe(false);
   * ```
   * @since 1.0.0
   */
  static setupHealthFailureMock(): void {
    vi.mocked(this.mockHttpClient.post).mockResolvedValue(this.SAMPLE_RESPONSES.serverError);
  }

  /**
   * Setup HTTP client mock to throw network error
   *
   * Configures the mock HTTP client to reject with a network error
   * for testing network failure and timeout scenarios.
   *
   * @param {string} [errorMessage] - Custom error message
   * @returns {void} No return value
   * @example
   * ```typescript
   * WordPressClientTestUtils.setupNetworkErrorMock('Connection timeout');
   * await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow();
   * ```
   * @since 1.0.0
   */
  static setupNetworkErrorMock(errorMessage = 'Network timeout'): void {
    vi.mocked(this.mockHttpClient.post).mockRejectedValue(new Error(errorMessage));
  }

  /**
   * Verify HTTP client was called with correct parameters
   *
   * Validates that the mock HTTP client was invoked with the expected
   * URL, payload, and headers for comprehensive test verification.
   *
   * @param {string} url - Expected request URL
   * @param {unknown} payload - Expected request payload
   * @param {Record<string, string>} expectedHeaders - Expected HTTP headers
   * @returns {void} No return value, throws assertion errors on mismatch
   * @example
   * ```typescript
   * await client.syncJobs(jobs, 'webhook');
   * WordPressClientTestUtils.verifyHttpCall(
   *   'https://example.com/webhook/drivehr-sync',
   *   expect.objectContaining({ source: 'webhook' }),
   *   expect.objectContaining({ 'Content-Type': 'application/json' })
   * );
   * ```
   * @since 1.0.0
   */
  static verifyHttpCall(
    url: string,
    payload: unknown,
    expectedHeaders: Record<string, string>
  ): void {
    expect(this.mockHttpClient.post).toHaveBeenCalledWith(url, payload, expectedHeaders);
  }

  /**
   * Verify HMAC signature was generated with correct payload
   *
   * Validates that the HMAC signature utility was called with the
   * expected payload and secret for security verification.
   *
   * @param {string} expectedPayload - Expected payload string
   * @param {string} expectedSecret - Expected webhook secret
   * @returns {void} No return value, throws assertion errors on mismatch
   * @example
   * ```typescript
   * await client.syncJobs(jobs, 'webhook');
   * WordPressClientTestUtils.verifySignatureGeneration(
   *   JSON.stringify({ source: 'webhook', jobs }),
   *   'my-webhook-secret'
   * );
   * ```
   * @since 1.0.0
   */
  static verifySignatureGeneration(expectedPayload: string, expectedSecret: string): void {
    expect(utils.SecurityUtils.generateHmacSignature).toHaveBeenCalledWith(
      expectedPayload,
      expectedSecret
    );
  }
}

describe('WordPress Client Service', () => {
  beforeEach(() => {
    WordPressClientTestUtils.setupMocks();
  });

  afterEach(() => {
    WordPressClientTestUtils.restoreMocks();
  });

  describe('createWordPressClient', () => {
    it('should create client with valid configuration', () => {
      const config = WordPressClientTestUtils.VALID_CONFIGS.basic;
      const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

      const client = createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret);

      expect(client).toBeInstanceOf(WordPressWebhookClient);
      expect(typeof client.syncJobs).toBe('function');
      expect(typeof client.healthCheck).toBe('function');
    });

    it('should throw error for missing URL configuration', () => {
      const config = WordPressClientTestUtils.INVALID_CONFIGS.noUrl;
      const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow(WordPressClientError);
      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow('WordPress API URL is required');
    });

    it('should throw error for empty URL configuration', () => {
      const config = WordPressClientTestUtils.INVALID_CONFIGS.emptyUrl;
      const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow(WordPressClientError);
      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow('WordPress API URL is required');
    });

    it('should throw error for invalid URL format', () => {
      const config = WordPressClientTestUtils.INVALID_CONFIGS.invalidUrl;
      const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow(WordPressClientError);
      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow('Invalid WordPress API URL format');
    });

    it('should throw error for missing webhook secret', () => {
      const config = WordPressClientTestUtils.VALID_CONFIGS.basic;
      const secret = WordPressClientTestUtils.INVALID_SECRETS.empty;

      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow(WordPressClientError);
      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow('Webhook secret is required');
    });

    it('should throw error for short webhook secret', () => {
      const config = WordPressClientTestUtils.VALID_CONFIGS.basic;
      const secret = WordPressClientTestUtils.INVALID_SECRETS.short;

      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow(WordPressClientError);
      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).toThrow('Webhook secret must be at least 32 characters');
    });

    it('should accept minimal 32-character webhook secret', () => {
      const config = WordPressClientTestUtils.VALID_CONFIGS.basic;
      const secret = WordPressClientTestUtils.VALID_SECRETS.minimal;

      expect(() =>
        createWordPressClient(config, WordPressClientTestUtils.mockHttpClient, secret)
      ).not.toThrow();
    });
  });

  describe('WordPressWebhookClient', () => {
    let client: IWordPressClient;

    beforeEach(() => {
      client = WordPressClientTestUtils.createTestClient();
    });

    describe('syncJobs', () => {
      it('should sync single job successfully', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;
        const expectedResponse = WordPressClientTestUtils.SAMPLE_RESPONSES.syncSuccess;

        WordPressClientTestUtils.setupSyncSuccessMock(expectedResponse);

        const result = await client.syncJobs(jobs, 'webhook');

        WordPressClientTestUtils.verifyJobSyncResponse(result, expectedResponse.data);
        WordPressClientTestUtils.verifyHttpCall(
          WordPressClientTestUtils.VALID_CONFIGS.basic.baseUrl,
          expect.objectContaining({
            source: 'webhook',
            jobs: jobs,
            requestId: 'req_test-req-id-123',
            timestamp: expect.any(String),
          }),
          expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Signature': 'sha256=test-signature',
            'X-Request-ID': 'req_test-req-id-123',
            'User-Agent': 'DriveHR-Sync-Netlify/1.0',
          })
        );
      });

      it('should sync multiple jobs successfully', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.multiple;
        const expectedResponse = WordPressClientTestUtils.SAMPLE_RESPONSES.syncSuccess;

        WordPressClientTestUtils.setupSyncSuccessMock(expectedResponse);

        const result = await client.syncJobs(jobs, 'manual');

        expect(result.success).toBe(true);
        expect(result.syncedCount).toBe(3);
        expect(WordPressClientTestUtils.mockHttpClient.post).toHaveBeenCalledWith(
          WordPressClientTestUtils.VALID_CONFIGS.basic.baseUrl,
          expect.objectContaining({
            source: 'manual',
            jobs: jobs,
          }),
          expect.any(Object)
        );
      });

      it('should handle partial sync success with skipped jobs', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.multiple;
        const expectedResponse = WordPressClientTestUtils.SAMPLE_RESPONSES.syncPartialSuccess;

        WordPressClientTestUtils.setupSyncSuccessMock(expectedResponse);

        const result = await client.syncJobs(jobs, 'webhook');

        WordPressClientTestUtils.verifyJobSyncResponse(result, {
          success: true,
          syncedCount: 2,
          skippedCount: 1,
          errorCount: 0,
          message: '2 jobs synced, 1 skipped (duplicate)',
        });
      });

      it('should handle sync success with individual job errors', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.multiple;
        const expectedResponse = WordPressClientTestUtils.SAMPLE_RESPONSES.syncWithErrors;

        WordPressClientTestUtils.setupSyncSuccessMock(expectedResponse);

        const result = await client.syncJobs(jobs, 'webhook');

        WordPressClientTestUtils.verifyJobSyncResponse(result, {
          success: true,
          syncedCount: 1,
          skippedCount: 0,
          errorCount: 2,
          message: '1 job synced, 2 had errors',
          errors: ['Invalid job data for job-002', 'Missing required field for job-003'],
        });
      });

      it('should handle empty job array', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.empty;
        const expectedResponse = {
          success: true as const,
          status: 200 as const,
          statusText: 'OK' as const,
          headers: {},
          data: {
            ...WordPressClientTestUtils.SAMPLE_RESPONSES.syncSuccess.data,
            syncedCount: 0,
            message: 'No jobs to sync',
          },
        };

        WordPressClientTestUtils.setupSyncSuccessMock(expectedResponse);

        const result = await client.syncJobs(jobs, 'webhook');

        expect(result.syncedCount).toBe(0);
        expect(result.message).toBe('No jobs to sync');
      });

      it('should throw WordPressClientError for HTTP 500 response', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;

        WordPressClientTestUtils.setupSyncFailureMock(
          WordPressClientTestUtils.SAMPLE_RESPONSES.serverError
        );

        await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow(WordPressClientError);
        await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow(
          'WordPress sync failed with status 500'
        );
      });

      it('should throw WordPressClientError for HTTP 401 response', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;

        vi.mocked(WordPressClientTestUtils.mockHttpClient.post).mockResolvedValue(
          WordPressClientTestUtils.SAMPLE_RESPONSES.unauthorizedError
        );

        await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow(WordPressClientError);
        await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow(
          'WordPress sync failed with status 401'
        );
      });

      it('should handle network timeout errors', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;

        WordPressClientTestUtils.setupNetworkErrorMock('Request timeout');

        await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow(WordPressClientError);
        await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow(
          'WordPress sync failed: Request timeout'
        );
      });

      it('should generate correct HMAC signature for payload', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;
        const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

        WordPressClientTestUtils.setupSyncSuccessMock();

        await client.syncJobs(jobs, 'webhook');

        // Verify signature generation was called with correct secret
        expect(utils.SecurityUtils.generateHmacSignature).toHaveBeenCalledWith(
          expect.stringContaining('"source":"webhook"'),
          secret
        );
        expect(utils.SecurityUtils.generateHmacSignature).toHaveBeenCalledWith(
          expect.stringContaining('"requestId":"req_test-req-id-123"'),
          secret
        );
      });

      it('should log sync operation details', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.multiple;

        WordPressClientTestUtils.setupSyncSuccessMock();

        await client.syncJobs(jobs, 'webhook');

        expect(WordPressClientTestUtils.mockLogger.info).toHaveBeenCalledWith(
          'Syncing 3 jobs to WordPress',
          expect.objectContaining({
            requestId: 'req_test-req-id-123',
            source: 'webhook',
          })
        );

        expect(WordPressClientTestUtils.mockLogger.info).toHaveBeenCalledWith(
          'WordPress sync completed successfully',
          expect.objectContaining({
            requestId: 'req_test-req-id-123',
            processed: 3,
            skipped: 0,
            errors: 0,
          })
        );
      });

      it('should throw appropriate errors for sync failures', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;

        WordPressClientTestUtils.setupNetworkErrorMock('Connection failed');

        await expect(client.syncJobs(jobs, 'webhook')).rejects.toThrow(
          expect.objectContaining({
            name: 'WordPressClientError',
            message: expect.stringMatching(/WordPress sync failed/),
          })
        );
      });

      it('should execute telemetry code paths when telemetry is initialized', async () => {
        const jobs = WordPressClientTestUtils.SAMPLE_JOBS.multiple;

        // Mock telemetry functions to trigger telemetry code paths
        const mockWithSpan = vi
          .fn()
          .mockImplementation(async (name, fn, _attributes, _spanKind) => {
            // Simulate span object with setAttributes method
            const mockSpan = {
              setAttributes: vi.fn(),
            };
            return await fn(mockSpan);
          });

        // Import and mock telemetry module
        const telemetryModule = await import('../../src/lib/telemetry.js');
        const originalIsTelemetryInitialized = telemetryModule.isTelemetryInitialized;
        const originalWithSpan = telemetryModule.withSpan;
        const originalRecordWebhookMetrics = telemetryModule.recordWebhookMetrics;

        // Mock telemetry as initialized
        vi.spyOn(telemetryModule, 'isTelemetryInitialized').mockReturnValue(true);
        vi.spyOn(telemetryModule, 'withSpan').mockImplementation(mockWithSpan);
        vi.spyOn(telemetryModule, 'recordWebhookMetrics').mockImplementation(vi.fn());

        WordPressClientTestUtils.setupSyncSuccessMock();

        const result = await client.syncJobs(jobs, 'webhook');

        expect(result.success).toBe(true);
        expect(result.syncedCount).toBe(3);

        // Verify telemetry code paths were executed
        expect(telemetryModule.isTelemetryInitialized).toHaveBeenCalled();
        expect(telemetryModule.withSpan).toHaveBeenCalledWith(
          'wordpress-client.sync-jobs',
          expect.any(Function),
          { 'service.name': 'wordpress-client' },
          SpanKind.CLIENT
        );

        // Restore original functions
        vi.spyOn(telemetryModule, 'isTelemetryInitialized').mockImplementation(
          originalIsTelemetryInitialized
        );
        vi.spyOn(telemetryModule, 'withSpan').mockImplementation(originalWithSpan);
        vi.spyOn(telemetryModule, 'recordWebhookMetrics').mockImplementation(
          originalRecordWebhookMetrics
        );
      });
    });

    describe('healthCheck', () => {
      it('should return true for successful health check', async () => {
        WordPressClientTestUtils.setupHealthSuccessMock();

        const result = await client.healthCheck();

        expect(result).toBe(true);
        expect(WordPressClientTestUtils.mockHttpClient.post).toHaveBeenCalledWith(
          WordPressClientTestUtils.VALID_CONFIGS.basic.baseUrl,
          { action: 'health_check' },
          expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Signature': 'sha256=test-signature',
            'User-Agent': 'DriveHR-Sync-Netlify/1.0',
          })
        );
      });

      it('should return false for HTTP error response', async () => {
        WordPressClientTestUtils.setupHealthFailureMock();

        const result = await client.healthCheck();

        expect(result).toBe(false);
      });

      it('should return false for network errors', async () => {
        WordPressClientTestUtils.setupNetworkErrorMock('Health check timeout');

        const result = await client.healthCheck();

        expect(result).toBe(false);
        expect(WordPressClientTestUtils.mockLogger.warn).toHaveBeenCalledWith(
          'WordPress health check failed',
          expect.objectContaining({
            error: expect.any(Error),
          })
        );
      });

      it('should generate HMAC signature for health check payload', async () => {
        const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

        WordPressClientTestUtils.setupHealthSuccessMock();

        await client.healthCheck();

        // Verify signature generation was called with correct secret and payload structure
        expect(utils.SecurityUtils.generateHmacSignature).toHaveBeenCalledWith(
          expect.stringContaining('"action":"health_check"'),
          secret
        );
        expect(utils.SecurityUtils.generateHmacSignature).toHaveBeenCalledWith(
          expect.stringContaining('"timestamp"'),
          secret
        );
      });
    });
  });

  describe('WordPressClientError', () => {
    it('should create error with message only', () => {
      const error = new WordPressClientError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WordPressClientError);
      expect(error.name).toBe('WordPressClientError');
      expect(error.message).toBe('Test error message');
      expect(error.status).toBeUndefined();
      expect(error.response).toBeUndefined();
      expect(error.originalError).toBeUndefined();
    });

    it('should create error with HTTP status and response data', () => {
      const responseData = { error: 'Server error', code: 'INTERNAL_ERROR' };
      const error = new WordPressClientError('Server error occurred', 500, responseData);

      expect(error.message).toBe('Server error occurred');
      expect(error.status).toBe(500);
      expect(error.response).toEqual(responseData);
      expect(error.originalError).toBeUndefined();
    });

    it('should create error with original error context', () => {
      const originalError = new Error('Network timeout');
      const error = new WordPressClientError(
        'WordPress sync failed',
        undefined,
        undefined,
        originalError
      );

      expect(error.message).toBe('WordPress sync failed');
      expect(error.originalError).toBe(originalError);
    });

    it('should have proper stack trace', () => {
      const error = new WordPressClientError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('WordPressClientError');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const payload = '{"test": "data"}';
      const signature = 'sha256=correct-signature';
      const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

      const result = validateWebhookSignature(payload, signature, secret);

      expect(result).toBe(true);
      expect(utils.SecurityUtils.validateHmacSignature).toHaveBeenCalledWith(
        payload,
        signature,
        secret
      );
    });

    it('should reject invalid signature', () => {
      const payload = '{"test": "data"}';
      const signature = 'sha256=invalid-signature';
      const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

      vi.mocked(utils.SecurityUtils.validateHmacSignature).mockReturnValueOnce(false);

      const result = validateWebhookSignature(payload, signature, secret);

      expect(result).toBe(false);
      expect(utils.SecurityUtils.validateHmacSignature).toHaveBeenCalledWith(
        payload,
        signature,
        secret
      );
    });

    it('should handle empty payload', () => {
      const payload = '';
      const signature = 'sha256=empty-signature';
      const secret = WordPressClientTestUtils.VALID_SECRETS.standard;

      const result = validateWebhookSignature(payload, signature, secret);

      expect(result).toBe(true); // Mock returns true by default
      expect(utils.SecurityUtils.validateHmacSignature).toHaveBeenCalledWith(
        payload,
        signature,
        secret
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete sync workflow successfully', async () => {
      const client = WordPressClientTestUtils.createTestClient(
        WordPressClientTestUtils.VALID_CONFIGS.custom,
        WordPressClientTestUtils.VALID_SECRETS.custom
      );
      const jobs = WordPressClientTestUtils.SAMPLE_JOBS.multiple;

      // Setup successful health check followed by successful sync
      vi.mocked(WordPressClientTestUtils.mockHttpClient.post)
        .mockResolvedValueOnce(WordPressClientTestUtils.SAMPLE_RESPONSES.healthSuccess)
        .mockResolvedValueOnce(WordPressClientTestUtils.SAMPLE_RESPONSES.syncSuccess);

      // Verify WordPress is healthy
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);

      // Perform sync operation
      const syncResult = await client.syncJobs(jobs, 'integration-test' as JobSource);

      WordPressClientTestUtils.verifyJobSyncResponse(syncResult, {
        success: true,
        syncedCount: 3,
        skippedCount: 0,
        errorCount: 0,
        message: 'Jobs synced successfully',
      });

      // Verify correct HTTP calls were made
      expect(WordPressClientTestUtils.mockHttpClient.post).toHaveBeenCalledTimes(2);
      expect(WordPressClientTestUtils.mockHttpClient.post).toHaveBeenNthCalledWith(
        1,
        WordPressClientTestUtils.VALID_CONFIGS.custom.baseUrl,
        { action: 'health_check' },
        expect.any(Object)
      );
      expect(WordPressClientTestUtils.mockHttpClient.post).toHaveBeenNthCalledWith(
        2,
        WordPressClientTestUtils.VALID_CONFIGS.custom.baseUrl,
        expect.objectContaining({
          source: 'integration-test',
          jobs: jobs,
        }),
        expect.any(Object)
      );
    });

    it('should handle unhealthy WordPress with sync attempt', async () => {
      const client = WordPressClientTestUtils.createTestClient();
      const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;

      // Setup failed health check but successful sync (WordPress recovers)
      vi.mocked(WordPressClientTestUtils.mockHttpClient.post)
        .mockResolvedValueOnce(WordPressClientTestUtils.SAMPLE_RESPONSES.serverError)
        .mockResolvedValueOnce(WordPressClientTestUtils.SAMPLE_RESPONSES.syncSuccess);

      // Health check fails
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);

      // But sync still works (WordPress recovered)
      const syncResult = await client.syncJobs(jobs, 'retry' as JobSource);
      expect(syncResult.success).toBe(true);
    });

    it('should maintain consistent behavior across multiple operations', async () => {
      const client = WordPressClientTestUtils.createTestClient();
      const jobs = WordPressClientTestUtils.SAMPLE_JOBS.single;

      WordPressClientTestUtils.setupSyncSuccessMock();
      WordPressClientTestUtils.setupHealthSuccessMock();

      // Perform multiple operations
      const results = await Promise.all([
        client.syncJobs(jobs, 'batch-1' as JobSource),
        client.syncJobs(jobs, 'batch-2' as JobSource),
        client.healthCheck(),
        client.healthCheck(),
      ]);

      // Verify all operations succeeded
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();

      // ARCHITECTURAL JUSTIFICATION: Test verification after explicit toBeDefined() assertion
      // guarantees non-null state. Non-null assertion is safe and more readable than
      // additional conditional checks in test code. Alternative optional chaining would
      // mask test failures rather than providing clear assertion points.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(results[0]!.success).toBe(true);

      // ARCHITECTURAL JUSTIFICATION: Test verification after explicit toBeDefined() assertion
      // guarantees non-null state. Non-null assertion is safe and more readable than
      // additional conditional checks in test code. Alternative optional chaining would
      // mask test failures rather than providing clear assertion points.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(results[1]!.success).toBe(true);
      expect(results[2]).toBe(true);
      expect(results[3]).toBe(true);

      // Verify request IDs are consistent (mocked to same value)
      expect(utils.StringUtils.generateRequestId).toHaveBeenCalledTimes(2); // Only sync calls generate request IDs
    });
  });
});
