/**
 * Sync Jobs Function Test Suite
 *
 * Comprehensive test coverage for the DriveHR lightweight webhook receiver Netlify function
 * following enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates secure webhook-based job data forwarding from GitHub Actions
 * to WordPress, replacing monolithic client-side scraping with efficient serverless integration.
 *
 * Test Features:
 * - OPTIONS requests (CORS preflight) for cross-origin GitHub Actions integration
 * - GET requests (health check) for system status monitoring and validation
 * - POST requests (webhook data processing) for GitHub Actions payload handling
 * - HTTP method validation and comprehensive security header verification
 * - HMAC SHA-256 signature validation for webhook authenticity
 * - WordPress integration patterns with error handling and retry logic
 * - Comprehensive error scenarios and edge case coverage
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/functions/sync-jobs.test.ts -- --grep "webhook"
 * ```
 *
 * @module sync-jobs-test-suite
 * @since 1.0.0
 * @see {@link ../../src/functions/sync-jobs.mts} for the function being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '@netlify/functions';
import handler from '../../src/functions/sync-jobs.mts';
import type { NormalizedJob } from '../../src/types/job.js';
import * as env from '../../src/lib/env.js';
import * as logger from '../../src/lib/logger.js';
import * as httpClient from '../../src/lib/http-client.js';
import * as utils from '../../src/lib/utils.js';
import * as wordPressClient from '../../src/services/wordpress-client.js';
import { createHmac } from 'crypto';

// Mock all dependencies
vi.mock('../../src/lib/env.js');
vi.mock('../../src/lib/logger.js');
vi.mock('../../src/lib/http-client.js');
vi.mock('../../src/lib/utils.js');
vi.mock('../../src/services/wordpress-client.js');

/**
 * Webhook receiver function response structure
 *
 * Defines the expected response format from the sync-jobs webhook receiver function,
 * including success indicators, health status data, job processing metrics, and error
 * information for comprehensive test validation and assertion coverage.
 *
 * @since 1.0.0
 */
interface WebhookReceiverResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  data?: {
    status?: string;
    environment?: string;
    architecture?: string;
    version?: string;
    wordpress_configured?: boolean;
    message?: string;
    jobCount?: number;
    syncedCount?: number;
    errorCount?: number;
    errors?: string[];
  };
  error?: string;
}

/**
 * Sync jobs webhook receiver test utilities
 *
 * Extends enterprise testing patterns with webhook receiver-specific testing methods
 * and mock configurations. Maintains DRY principles while providing specialized utilities
 * for job data generation, HMAC signature creation, WordPress client mocking, and
 * comprehensive webhook scenario testing following the established BaseTestUtils pattern.
 *
 * @since 1.0.0
 */
class SyncJobsTestUtils {
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
      source: 'github-actions',
      rawData: { id: 'job-001', title: 'Senior Software Engineer' },
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
      source: 'github-actions',
      rawData: { id: 'job-002', title: 'Product Manager' },
      processedAt: '2024-01-01T12:00:00.000Z',
    },
  ];

  static readonly WEBHOOK_SECRET = 'test-secret-key-at-least-32-characters-long';

  static readonly MOCK_ENV_CONFIG = {
    wpApiUrl: 'https://test-wordpress.com/webhook/drivehr-sync',
    webhookSecret: this.WEBHOOK_SECRET,
    driveHrCompanyId: 'test-company',
    environment: 'development' as const,
    logLevel: 'info' as const,
  };

  /**
   * Creates mock HTTP request for webhook receiver function testing
   *
   * Generates Web API standard Request objects configured for sync-jobs endpoint
   * testing with customizable method, payload, and headers. Provides realistic
   * request structure for comprehensive webhook processing behavior validation.
   *
   * @param method - HTTP method for request (default: 'GET')
   * @param body - Request payload as JSON string (optional)
   * @param headers - Additional HTTP headers for authentication and metadata
   * @returns Configured Request object for webhook receiver function testing
   * @example
   * ```typescript
   * const request = SyncJobsTestUtils.createMockRequest('POST',
   *   JSON.stringify(payload),
   *   {'x-webhook-signature': 'sha256=abc123'}
   * );
   * ```
   * @since 1.0.0
   */
  static createMockRequest(
    method: string = 'GET',
    body?: string,
    headers: Record<string, string> = {}
  ): Request {
    return new Request('https://example.com/.netlify/functions/sync-jobs', {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ?? undefined,
    });
  }

  /**
   * Creates mock Netlify execution context for webhook function testing
   *
   * Generates standard Netlify function Context objects with realistic metadata
   * for comprehensive webhook receiver function execution testing. Provides
   * necessary context properties for request correlation and logging validation.
   *
   * @returns Configured Context object for Netlify webhook function testing
   * @example
   * ```typescript
   * const context = SyncJobsTestUtils.createMockContext();
   * const response = await handler(request, context);
   * ```
   * @since 1.0.0
   */
  static createMockContext(): Context {
    return {
      requestId: 'test-request-id',
    } as Context;
  }

  /**
   * Parses HTTP response body to typed webhook receiver response
   *
   * Converts Response objects from webhook receiver function testing into strongly
   * typed response structures for comprehensive assertion validation and data
   * verification. Handles JSON parsing with proper error propagation for test reliability.
   *
   * @param response - HTTP Response object from webhook receiver function execution
   * @returns Promise resolving to typed webhook receiver response structure
   * @throws {Error} When response body contains invalid JSON
   * @example
   * ```typescript
   * const response = await handler(request, context);
   * const data = await SyncJobsTestUtils.parseResponse(response);
   * expect(data.success).toBe(true);
   * ```
   * @since 1.0.0
   */
  static async parseResponse(response: Response): Promise<WebhookReceiverResponse> {
    return JSON.parse(await response.text()) as WebhookReceiverResponse;
  }

  /**
   * Generates valid HMAC SHA-256 webhook signature for authentication testing
   *
   * Creates properly formatted webhook signatures using HMAC SHA-256 algorithm
   * for testing webhook receiver function authentication flows. Produces signatures
   * compatible with GitHub Actions webhook signature validation standards.
   *
   * @param payload - Request body content for signature calculation
   * @param secret - Webhook secret key for HMAC signature generation
   * @returns Formatted webhook signature with 'sha256=' prefix
   * @example
   * ```typescript
   * const signature = SyncJobsTestUtils.generateValidSignature(
   *   JSON.stringify(payload), 'webhook-secret'
   * );
   * // Returns: 'sha256=abc123def456...'
   * ```
   * @since 1.0.0
   */
  static generateValidSignature(payload: string, secret: string): string {
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return `sha256=${signature}`;
  }

  /**
   * Creates realistic GitHub Actions webhook payload for testing
   *
   * Generates structured payload objects matching the format expected from GitHub
   * Actions job scraping workflows. Includes job data, metadata, and repository
   * information for comprehensive webhook receiver testing scenarios.
   *
   * @param jobs - Array of normalized job data for payload (default: SAMPLE_JOBS)
   * @returns GitHub Actions webhook payload structure for testing
   * @example
   * ```typescript
   * const payload = SyncJobsTestUtils.createGitHubActionsPayload([customJob]);
   * const body = JSON.stringify(payload);
   * ```
   * @since 1.0.0
   */
  static createGitHubActionsPayload(jobs: NormalizedJob[] = this.SAMPLE_JOBS) {
    return {
      source: 'github-actions',
      jobs,
      timestamp: new Date().toISOString(),
      total_count: jobs.length,
      run_id: 'test-run-123',
      repository: 'test-user/test-repo',
    };
  }

  /**
   * Configures comprehensive successful mock scenario for webhook testing
   *
   * Sets up complete mock environment simulating successful webhook processing
   * including environment configuration, logging, HTTP clients, utilities, and
   * WordPress integration. Provides realistic success scenario baseline for
   * comprehensive webhook receiver function testing.
   *
   * @returns void
   * @example
   * ```typescript
   * SyncJobsTestUtils.setupSuccessfulMocks();
   * // All mocks configured for successful webhook processing
   * const response = await handler(request, context);
   * expect(response.status).toBe(200);
   * ```
   * @since 1.0.0
   */
  static setupSuccessfulMocks() {
    // Environment config
    vi.mocked(env.getEnvironmentConfig).mockReturnValue(this.MOCK_ENV_CONFIG);

    // Logger
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };
    vi.mocked(logger.createLogger).mockReturnValue(mockLogger);
    vi.mocked(logger.setLogger).mockImplementation(() => {});
    vi.mocked(logger.getLogger).mockReturnValue(mockLogger);

    // HTTP Client
    const mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
    vi.mocked(httpClient.createHttpClient).mockReturnValue(mockHttpClient);

    // Utils
    vi.mocked(utils.StringUtils.generateRequestId).mockReturnValue('test-id-123');
    vi.mocked(utils.SecurityUtils.validateHmacSignature).mockReturnValue(true);

    // WordPress Client
    const mockWordPressClient = {
      healthCheck: vi.fn().mockResolvedValue({ success: true }),
      syncJobs: vi.fn().mockResolvedValue({
        success: true,
        message: 'Successfully synced 2 jobs',
        syncedCount: 2,
        skippedCount: 0,
        errorCount: 0,
        errors: [],
      }),
    };
    vi.mocked(wordPressClient.createWordPressClient).mockReturnValue(mockWordPressClient);

    return { mockLogger, mockHttpClient, mockWordPressClient };
  }

  static setupFailedWordPressMocks() {
    const mocks = this.setupSuccessfulMocks();

    // Override WordPress client to return failure
    mocks.mockWordPressClient.syncJobs.mockResolvedValue({
      success: false,
      message: 'WordPress sync failed',
      syncedCount: 0,
      skippedCount: 0,
      errorCount: 2,
      errors: ['Connection timeout', 'Invalid credentials'],
    });

    return mocks;
  }
}

describe('Sync Jobs Webhook Receiver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OPTIONS requests (CORS preflight)', () => {
    it('should handle CORS preflight request correctly', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req = SyncJobsTestUtils.createMockRequest('OPTIONS');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toContain('github.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Webhook-Signature');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should include security headers in OPTIONS response', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req = SyncJobsTestUtils.createMockRequest('OPTIONS');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    });
  });

  describe('GET requests (health check)', () => {
    it('should return system health status', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req = SyncJobsTestUtils.createMockRequest('GET');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.status).toBe('healthy');
      expect(data.data?.architecture).toBe('github-actions-scraper');
      expect(data.data?.wordpress_configured).toBe(true);
      expect(data.requestId).toBe('webhook_test-id-123');
    });

    it('should include proper security headers in health check response', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req = SyncJobsTestUtils.createMockRequest('GET');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('POST requests (webhook data)', () => {
    it('should successfully process job data from GitHub Actions', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const webhookPayload = SyncJobsTestUtils.createGitHubActionsPayload();
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = SyncJobsTestUtils.generateValidSignature(
        payloadJson,
        SyncJobsTestUtils.WEBHOOK_SECRET
      );

      const req = SyncJobsTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.message).toBe('Successfully synced 2 jobs');
      expect(data.data?.jobCount).toBe(2);
      expect(data.data?.syncedCount).toBe(2);
      expect(data.data?.errorCount).toBe(0);
    });

    it('should handle empty job arrays gracefully', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const webhookPayload = SyncJobsTestUtils.createGitHubActionsPayload([]);
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = SyncJobsTestUtils.generateValidSignature(
        payloadJson,
        SyncJobsTestUtils.WEBHOOK_SECRET
      );

      const req = SyncJobsTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.jobCount).toBe(0);
      expect(data.data?.message).toBeDefined();
    });

    it('should validate HMAC signature when present', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();
      vi.mocked(utils.SecurityUtils.validateHmacSignature).mockReturnValue(false);

      const webhookPayload = SyncJobsTestUtils.createGitHubActionsPayload();
      const payloadJson = JSON.stringify(webhookPayload);

      const req = SyncJobsTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': 'sha256=invalid-signature',
      });
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid webhook signature');
    });

    it('should handle WordPress sync failures gracefully', async () => {
      SyncJobsTestUtils.setupFailedWordPressMocks();

      const webhookPayload = SyncJobsTestUtils.createGitHubActionsPayload();
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = SyncJobsTestUtils.generateValidSignature(
        payloadJson,
        SyncJobsTestUtils.WEBHOOK_SECRET
      );

      const req = SyncJobsTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.data?.errorCount).toBe(2);
      expect(data.data?.errors).toContain('Connection timeout');
    });

    it('should handle invalid JSON payload', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const invalidPayload = '{ invalid json }';
      const signature = SyncJobsTestUtils.generateValidSignature(
        invalidPayload,
        SyncJobsTestUtils.WEBHOOK_SECRET
      );

      const req = SyncJobsTestUtils.createMockRequest('POST', invalidPayload, {
        'x-webhook-signature': signature,
      });
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should validate required payload fields', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const invalidPayload = JSON.stringify({ source: 'github-actions' }); // Missing jobs array
      const signature = SyncJobsTestUtils.generateValidSignature(
        invalidPayload,
        SyncJobsTestUtils.WEBHOOK_SECRET
      );

      const req = SyncJobsTestUtils.createMockRequest('POST', invalidPayload, {
        'x-webhook-signature': signature,
      });
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid webhook payload');
    });
  });

  describe('HTTP method validation', () => {
    it('should reject unsupported HTTP methods', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req = SyncJobsTestUtils.createMockRequest('DELETE');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });

    it('should include security headers in method not allowed response', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req = SyncJobsTestUtils.createMockRequest('PUT');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('Error handling', () => {
    it('should handle configuration loading errors', async () => {
      vi.mocked(env.getEnvironmentConfig).mockImplementation(() => {
        throw new Error('Config loading failed');
      });

      const req = SyncJobsTestUtils.createMockRequest('GET');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Internal server error');
    });

    it('should handle unexpected errors gracefully', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      // Mock logger creation to throw error
      vi.mocked(logger.createLogger).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const req = SyncJobsTestUtils.createMockRequest('GET');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Internal server error');
    });

    it('should generate unique request IDs', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req1 = SyncJobsTestUtils.createMockRequest('GET');
      const req2 = SyncJobsTestUtils.createMockRequest('GET');
      const context = SyncJobsTestUtils.createMockContext();

      // Mock different request IDs
      vi.mocked(utils.StringUtils.generateRequestId)
        .mockReturnValueOnce('req-001')
        .mockReturnValueOnce('req-002');

      const response1 = await handler(req1, context);
      const response2 = await handler(req2, context);

      const data1 = await SyncJobsTestUtils.parseResponse(response1);
      const data2 = await SyncJobsTestUtils.parseResponse(response2);

      expect(data1.requestId).toBe('webhook_req-001');
      expect(data2.requestId).toBe('webhook_req-002');
      expect(data1.requestId).not.toBe(data2.requestId);
    });
  });

  describe('Security and architecture features', () => {
    it('should properly handle GitHub Actions source identifier', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const webhookPayload = {
        ...SyncJobsTestUtils.createGitHubActionsPayload(),
        source: 'github-actions',
        run_id: 'github-run-12345',
        repository: 'company/drivehr-sync',
      };
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = SyncJobsTestUtils.generateValidSignature(
        payloadJson,
        SyncJobsTestUtils.WEBHOOK_SECRET
      );

      const req = SyncJobsTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);
      const data = await SyncJobsTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should include comprehensive security headers', async () => {
      SyncJobsTestUtils.setupSuccessfulMocks();

      const req = SyncJobsTestUtils.createMockRequest('GET');
      const context = SyncJobsTestUtils.createMockContext();

      const response = await handler(req, context);

      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Permissions-Policy')).toContain('geolocation=()');
    });
  });
});
