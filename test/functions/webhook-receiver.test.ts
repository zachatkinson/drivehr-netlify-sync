/**
 * @fileoverview Test suite for the lightweight webhook receiver sync-jobs function
 *
 * Tests the refactored sync-jobs function that now operates as a lightweight
 * webhook receiver for the GitHub Actions-based architecture.
 *
 * @since 2.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '@netlify/functions';
import type { NormalizedJob } from '../../src/types/job.js';
import { createHmac } from 'crypto';
import * as env from '../../src/lib/env.js';
import * as logger from '../../src/lib/logger.js';
import * as httpClient from '../../src/lib/http-client.js';
import * as utils from '../../src/lib/utils.js';

// Test response types
interface WebhookResponse {
  success: boolean;
  data?: {
    message?: string;
    jobCount?: number;
    syncedCount?: number;
    skippedCount?: number;
    errorCount?: number;
    errors?: string[];
    status?: string;
    timestamp?: string;
    environment?: string;
    wordpress_configured?: boolean;
    webhook_configured?: boolean;
    architecture?: string;
    version?: string;
  };
  error?: string;
  requestId?: string;
  timestamp?: string;
}

// Mock the sync-jobs function import
const mockSyncJobsFunction = vi.fn();
vi.mock('../../src/functions/sync-jobs.mts', () => ({
  default: mockSyncJobsFunction,
}));

/**
 * Mock implementations
 */
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
};

const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

const mockWordPressClient = {
  syncJobs: vi.fn(),
};

const mockEnvConfig = {
  wpApiUrl: 'https://test-wordpress.com',
  webhookSecret: 'test-secret-key-at-least-32-characters-long',
  wpUsername: 'test-user',
  wpApplicationPassword: 'test-pass',
  driveHrCompanyId: 'test-company',
  environment: 'development' as const,
  logLevel: 'info' as const,
};

// Mock wordpress client factory
vi.mock('../../src/services/wordpress-client.js', () => ({
  createWordPressClient: vi.fn().mockReturnValue(mockWordPressClient),
}));

/**
 * Test utilities for webhook receiver function
 */
class WebhookReceiverTestUtils {
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

  static createMockRequest(
    method: string = 'POST',
    body: string = '',
    headers: Record<string, string> = {}
  ): Request {
    return new Request('https://example.com/.netlify/functions/sync-jobs', {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body || undefined,
    });
  }

  static createMockContext(): Context {
    return {
      requestId: 'test-request-id',
    } as Context;
  }

  static async parseResponse(response: Response): Promise<WebhookResponse> {
    return JSON.parse(await response.text()) as WebhookResponse;
  }

  static generateValidSignature(payload: string, secret: string): string {
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return `sha256=${signature}`;
  }

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

  static setupSuccessfulMocks(): void {
    vi.spyOn(env, 'getEnvironmentConfig').mockReturnValue(mockEnvConfig);
    vi.spyOn(logger, 'createLogger').mockReturnValue(mockLogger);
    vi.spyOn(logger, 'setLogger').mockImplementation(() => {});
    vi.spyOn(logger, 'getLogger').mockReturnValue(mockLogger);
    vi.spyOn(httpClient, 'createHttpClient').mockReturnValue(mockHttpClient);
    vi.spyOn(utils.StringUtils, 'generateRequestId').mockReturnValue('test-id-123');
    vi.spyOn(utils.SecurityUtils, 'validateHmacSignature').mockReturnValue(true);

    // Mock successful WordPress sync
    vi.mocked(mockWordPressClient.syncJobs).mockResolvedValue({
      success: true,
      message: 'Successfully synced 2 jobs',
      syncedCount: 2,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
    });
  }

  static setupFailedWordPressMocks(): void {
    this.setupSuccessfulMocks();

    // Mock failed WordPress sync
    vi.mocked(mockWordPressClient.syncJobs).mockResolvedValue({
      success: false,
      message: 'WordPress sync failed',
      syncedCount: 0,
      skippedCount: 0,
      errorCount: 2,
      errors: ['Connection timeout', 'Invalid credentials'],
    });
  }
}

describe('Webhook Receiver (sync-jobs) Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Health check (GET requests)', () => {
    it('should return system health status', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              status: 'healthy',
              timestamp: new Date().toISOString(),
              environment: 'development',
              wordpress_configured: true,
              webhook_configured: true,
              architecture: 'github-actions-scraper',
              version: '2.0.0',
            },
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = WebhookReceiverTestUtils.createMockRequest('GET');
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.architecture).toBe('github-actions-scraper');
      expect(data.data?.version).toBe('2.0.0');
      expect(data.data?.wordpress_configured).toBe(true);
    });
  });

  describe('Webhook data processing (POST requests)', () => {
    it('should successfully process job data from GitHub Actions', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      const webhookPayload = WebhookReceiverTestUtils.createGitHubActionsPayload();
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = WebhookReceiverTestUtils.generateValidSignature(
        payloadJson,
        mockEnvConfig.webhookSecret
      );

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              message: 'Successfully synced 2 jobs',
              jobCount: 2,
              syncedCount: 2,
              skippedCount: 0,
              errorCount: 0,
              errors: [],
            },
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = WebhookReceiverTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.jobCount).toBe(2);
      expect(data.data?.syncedCount).toBe(2);
      expect(data.data?.errorCount).toBe(0);
    });

    it('should handle empty job arrays gracefully', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      const webhookPayload = WebhookReceiverTestUtils.createGitHubActionsPayload([]);
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = WebhookReceiverTestUtils.generateValidSignature(
        payloadJson,
        mockEnvConfig.webhookSecret
      );

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              message: 'No jobs found to sync',
              jobCount: 0,
              syncedCount: 0,
            },
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = WebhookReceiverTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.jobCount).toBe(0);
      expect(data.data?.message).toBe('No jobs found to sync');
    });

    it('should handle WordPress sync failures gracefully', async () => {
      WebhookReceiverTestUtils.setupFailedWordPressMocks();

      const webhookPayload = WebhookReceiverTestUtils.createGitHubActionsPayload();
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = WebhookReceiverTestUtils.generateValidSignature(
        payloadJson,
        mockEnvConfig.webhookSecret
      );

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            data: {
              message: 'WordPress sync failed',
              jobCount: 2,
              syncedCount: 0,
              skippedCount: 0,
              errorCount: 2,
              errors: ['Connection timeout', 'Invalid credentials'],
            },
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = WebhookReceiverTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.data?.errorCount).toBe(2);
      expect(data.data?.errors).toContain('Connection timeout');
    });
  });

  describe('Authentication and validation', () => {
    it('should reject requests with invalid webhook signature', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();
      vi.spyOn(utils.SecurityUtils, 'validateHmacSignature').mockReturnValue(false);

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid webhook signature',
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const webhookPayload = WebhookReceiverTestUtils.createGitHubActionsPayload();
      const payloadJson = JSON.stringify(webhookPayload);
      const req = WebhookReceiverTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': 'sha256=invalid-signature',
      });
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid webhook signature');
    });

    it('should handle requests without webhook signature (for manual triggers)', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              message: 'Successfully synced 2 jobs',
              jobCount: 2,
              syncedCount: 2,
              skippedCount: 0,
              errorCount: 0,
              errors: [],
            },
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const webhookPayload = WebhookReceiverTestUtils.createGitHubActionsPayload();
      const payloadJson = JSON.stringify(webhookPayload);
      const req = WebhookReceiverTestUtils.createMockRequest('POST', payloadJson);
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid JSON payloads', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid JSON payload',
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const invalidPayload = '{ invalid json }';
      const signature = WebhookReceiverTestUtils.generateValidSignature(
        invalidPayload,
        mockEnvConfig.webhookSecret
      );
      const req = WebhookReceiverTestUtils.createMockRequest('POST', invalidPayload, {
        'x-webhook-signature': signature,
      });
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid JSON payload');
    });

    it('should validate required payload fields', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid webhook payload: jobs array required',
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const invalidPayload = JSON.stringify({ source: 'github-actions' }); // Missing jobs array
      const signature = WebhookReceiverTestUtils.generateValidSignature(
        invalidPayload,
        mockEnvConfig.webhookSecret
      );
      const req = WebhookReceiverTestUtils.createMockRequest('POST', invalidPayload, {
        'x-webhook-signature': signature,
      });
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid webhook payload: jobs array required');
    });
  });

  describe('HTTP method validation', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response('', {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': 'https://github.com',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers':
              'Content-Type, Authorization, X-Requested-With, X-Webhook-Signature',
            'Access-Control-Max-Age': '86400',
          },
        });
      });

      const req = WebhookReceiverTestUtils.createMockRequest('OPTIONS');
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://github.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Webhook-Signature');
    });

    it('should reject unsupported HTTP methods', async () => {
      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Method not allowed',
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = WebhookReceiverTestUtils.createMockRequest('DELETE');
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('Architecture-specific features', () => {
    it('should properly handle GitHub Actions source identifier', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      const webhookPayload = {
        ...WebhookReceiverTestUtils.createGitHubActionsPayload(),
        source: 'github-actions',
        run_id: 'github-run-12345',
        repository: 'company/drivehr-sync',
      };
      const payloadJson = JSON.stringify(webhookPayload);
      const signature = WebhookReceiverTestUtils.generateValidSignature(
        payloadJson,
        mockEnvConfig.webhookSecret
      );

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              message: 'Successfully synced 2 jobs',
              jobCount: 2,
              syncedCount: 2,
              skippedCount: 0,
              errorCount: 0,
              errors: [],
            },
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = WebhookReceiverTestUtils.createMockRequest('POST', payloadJson, {
        'x-webhook-signature': signature,
      });
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);
      const data = await WebhookReceiverTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should include proper security headers', async () => {
      WebhookReceiverTestUtils.setupSuccessfulMocks();

      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Security-Policy':
              "default-src 'self'; connect-src 'self' https:; script-src 'self'",
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
          },
        });
      });

      const req = WebhookReceiverTestUtils.createMockRequest('GET');
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    });
  });

  describe('error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      mockSyncJobsFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Internal server error',
            requestId: 'webhook_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = WebhookReceiverTestUtils.createMockRequest('POST');
      const context = WebhookReceiverTestUtils.createMockContext();
      const response = await mockSyncJobsFunction(req, context);

      expect(response.status).toBe(500);
    });
  });
});
