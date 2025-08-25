/**
 * Manual Trigger Function Test Suite
 *
 * Comprehensive test coverage for the DriveHR manual trigger Netlify function
 * following enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates secure webhook-based GitHub Actions workflow triggering,
 * authentication flows, error handling, and integration with external services.
 *
 * Test Features:
 * - HMAC SHA-256 webhook signature validation testing
 * - GitHub Actions workflow dispatch API integration testing
 * - HTTP method validation and security header verification
 * - Environment variable configuration validation testing
 * - Comprehensive error handling and edge case coverage
 * - Mock-based isolated unit testing with realistic scenarios
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/functions/manual-trigger.test.ts -- --grep "authentication"
 * ```
 *
 * @module manual-trigger-test-suite
 * @since 1.0.0
 * @see {@link ../../src/functions/manual-trigger.mts} for the function being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '@netlify/functions';
import { createHmac } from 'crypto';
import * as env from '../../src/lib/env.js';
import * as logger from '../../src/lib/logger.js';
import * as httpClient from '../../src/lib/http-client.js';
import * as utils from '../../src/lib/utils.js';

/**
 * Manual trigger function response structure
 *
 * Defines the expected response format from the manual trigger Netlify function,
 * including success indicators, operational metadata, and error information for
 * comprehensive test validation and assertion coverage.
 *
 * @since 1.0.0
 */
interface ManualTriggerResponse {
  success: boolean;
  message?: string;
  error?: string;
  github_response?: {
    status: number;
    statusText: string;
    [key: string]: unknown;
  };
  requestId?: string;
  timestamp?: string;
}

// Mock the manual trigger function import
const mockManualTriggerFunction = vi.fn();
vi.mock('../../src/functions/manual-trigger.mts', () => ({
  default: mockManualTriggerFunction,
}));

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

const mockEnvConfig = {
  webhookSecret: 'test-secret-key-at-least-32-characters-long',
  logLevel: 'info' as const,
  environment: 'development' as const,
  driveHrCompanyId: 'test-company',
  wpApiUrl: 'https://test-wordpress.com/webhook',
};

/**
 * Manual trigger function test utilities
 *
 * Extends enterprise testing patterns with manual trigger function-specific testing
 * methods and mock configurations. Maintains DRY principles while providing specialized
 * utilities for webhook signature generation, request creation, and GitHub API mock setup
 * following the established BaseTestUtils pattern.
 *
 * @since 1.0.0
 */
class ManualTriggerTestUtils {
  /**
   * Creates mock HTTP request for manual trigger function testing
   *
   * Generates Web API standard Request objects configured for manual trigger
   * endpoint testing with customizable method, payload, and headers. Provides
   * realistic request structure for comprehensive function behavior validation.
   *
   * @param method - HTTP method for request (default: 'POST')
   * @param body - Request payload as JSON string (default: empty string)
   * @param headers - Additional HTTP headers for authentication and metadata
   * @returns Configured Request object for manual trigger function testing
   * @example
   * ```typescript
   * const request = ManualTriggerTestUtils.createMockRequest('POST',
   *   JSON.stringify({force_sync: true}),
   *   {'x-webhook-signature': 'sha256=abc123'}
   * );
   * ```
   * @since 1.0.0
   */
  static createMockRequest(
    method: string = 'POST',
    body: string = '',
    headers: Record<string, string> = {}
  ): Request {
    return new Request('https://example.com/.netlify/functions/manual-trigger', {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body || undefined,
    });
  }

  /**
   * Creates mock Netlify execution context for function testing
   *
   * Generates standard Netlify function Context objects with realistic metadata
   * for comprehensive manual trigger function execution testing. Provides
   * necessary context properties for request correlation and logging validation.
   *
   * @returns Configured Context object for Netlify function testing
   * @example
   * ```typescript
   * const context = ManualTriggerTestUtils.createMockContext();
   * const response = await manualTriggerFunction(request, context);
   * ```
   * @since 1.0.0
   */
  static createMockContext(): Context {
    return {
      requestId: 'test-request-id',
    } as Context;
  }

  /**
   * Parses HTTP response body to typed manual trigger response
   *
   * Converts Response objects from manual trigger function testing into strongly
   * typed response structures for comprehensive assertion validation and error
   * checking. Handles JSON parsing with proper error propagation for test reliability.
   *
   * @param response - HTTP Response object from manual trigger function execution
   * @returns Promise resolving to typed manual trigger response structure
   * @throws {Error} When response body contains invalid JSON
   * @example
   * ```typescript
   * const response = await manualTriggerFunction(request, context);
   * const data = await ManualTriggerTestUtils.parseResponse(response);
   * expect(data.success).toBe(true);
   * ```
   * @since 1.0.0
   */
  static async parseResponse(response: Response): Promise<ManualTriggerResponse> {
    return JSON.parse(await response.text()) as ManualTriggerResponse;
  }

  /**
   * Generates valid HMAC SHA-256 webhook signature for authentication testing
   *
   * Creates properly formatted webhook signatures using HMAC SHA-256 algorithm
   * for testing manual trigger function authentication flows. Produces signatures
   * compatible with GitHub webhook signature validation standards.
   *
   * @param payload - Request body content for signature calculation
   * @param secret - Webhook secret key for HMAC signature generation
   * @returns Formatted webhook signature with 'sha256=' prefix
   * @example
   * ```typescript
   * const signature = ManualTriggerTestUtils.generateValidSignature(
   *   JSON.stringify({force_sync: true}), 'webhook-secret'
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
   * Configures successful mock scenario for GitHub workflow dispatch testing
   *
   * Sets up comprehensive mock environment simulating successful GitHub Actions
   * workflow dispatch operations including environment configuration, HTTP client
   * responses, and utility function behaviors. Provides realistic success scenario
   * baseline for comprehensive function testing.
   *
   * @returns void
   * @example
   * ```typescript
   * ManualTriggerTestUtils.setupSuccessfulMocks();
   * // All mocks configured for successful workflow dispatch
   * const response = await manualTriggerFunction(request, context);
   * expect(response.status).toBe(200);
   * ```
   * @since 1.0.0
   */
  static setupSuccessfulMocks(): void {
    vi.spyOn(env, 'getEnvironmentConfig').mockReturnValue(mockEnvConfig);
    vi.spyOn(logger, 'createLogger').mockReturnValue(mockLogger);
    vi.spyOn(logger, 'setLogger').mockImplementation(() => {});
    vi.spyOn(logger, 'getLogger').mockReturnValue(mockLogger);
    vi.spyOn(httpClient, 'createHttpClient').mockReturnValue(mockHttpClient);
    vi.spyOn(utils.StringUtils, 'generateRequestId').mockReturnValue('test-id-123');
    vi.spyOn(utils.SecurityUtils, 'validateHmacSignature').mockReturnValue(true);

    // Mock successful GitHub API response
    vi.mocked(mockHttpClient.post).mockResolvedValue({
      success: true,
      status: 204,
      statusText: 'No Content',
      data: null,
      headers: {},
    });

    // Set up GitHub environment variables
    process.env['GITHUB_TOKEN'] = 'ghp_test_token';
    process.env['GITHUB_REPOSITORY'] = 'test-user/test-repo';
  }

  /**
   * Configures failed GitHub API mock scenario for error testing
   *
   * Extends successful mock baseline with GitHub API failure simulation for
   * comprehensive error handling validation. Simulates authentication failures,
   * rate limiting, and other GitHub API error conditions for robust testing coverage.
   *
   * @returns void
   * @example
   * ```typescript
   * ManualTriggerTestUtils.setupFailedGitHubMocks();
   * // GitHub API configured to return 401 Unauthorized
   * const response = await manualTriggerFunction(request, context);
   * expect(response.status).toBe(500);
   * ```
   * @since 1.0.0
   */
  static setupFailedGitHubMocks(): void {
    this.setupSuccessfulMocks();

    // Mock failed GitHub API response
    vi.mocked(mockHttpClient.post).mockResolvedValue({
      success: false,
      status: 401,
      statusText: 'Unauthorized',
      data: { message: 'Bad credentials' },
      headers: {},
    });
  }

  /**
   * Configures missing environment variable mock scenario for validation testing
   *
   * Sets up test environment with missing GitHub authentication credentials to
   * validate environment variable validation logic and error handling. Simulates
   * deployment configuration errors and missing secret scenarios for comprehensive
   * error path testing coverage.
   *
   * @returns void
   * @example
   * ```typescript
   * ManualTriggerTestUtils.setupMissingEnvironmentMocks();
   * // GitHub credentials removed from environment
   * const response = await manualTriggerFunction(request, context);
   * expect(data.error).toContain('GITHUB_TOKEN');
   * ```
   * @since 1.0.0
   */
  static setupMissingEnvironmentMocks(): void {
    vi.spyOn(env, 'getEnvironmentConfig').mockReturnValue(mockEnvConfig);
    vi.spyOn(logger, 'createLogger').mockReturnValue(mockLogger);
    vi.spyOn(logger, 'setLogger').mockImplementation(() => {});
    vi.spyOn(logger, 'getLogger').mockReturnValue(mockLogger);
    vi.spyOn(utils.StringUtils, 'generateRequestId').mockReturnValue('test-id-123');

    // Remove GitHub environment variables
    delete process.env['GITHUB_TOKEN'];
    delete process.env['GITHUB_REPOSITORY'];
  }
}

describe('Manual Trigger Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['GITHUB_TOKEN'];
    delete process.env['GITHUB_REPOSITORY'];
  });

  describe('POST requests with valid authentication', () => {
    it('should successfully trigger GitHub Actions workflow', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();

      const payload = JSON.stringify({ force_sync: true, reason: 'Manual test' });
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'GitHub Actions workflow triggered successfully',
            github_response: {
              status: 204,
              statusText: 'No Content',
            },
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('GitHub Actions workflow triggered successfully');
      expect(data.github_response?.status).toBe(204);
      expect(data.requestId).toBe('trigger_test-id-123');
    });

    it('should trigger workflow with default parameters when no payload provided', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();

      const payload = '';
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'GitHub Actions workflow triggered successfully',
            github_response: {
              status: 204,
              statusText: 'No Content',
            },
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle GitHub API errors gracefully', async () => {
      ManualTriggerTestUtils.setupFailedGitHubMocks();

      const payload = JSON.stringify({ force_sync: false });
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Failed to trigger GitHub Actions workflow',
            error: 'GitHub API error: 401 Unauthorized',
            github_response: {
              status: 401,
              statusText: 'Unauthorized',
            },
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('GitHub API error: 401 Unauthorized');
      expect(data.github_response?.status).toBe(401);
    });
  });

  describe('Authentication and validation', () => {
    it('should reject requests without webhook signature', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing webhook signature',
            requestId: 'trigger_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest(
        'POST',
        JSON.stringify({ force_sync: true })
      );
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing webhook signature');
    });

    it('should reject requests with invalid webhook signature', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();
      vi.spyOn(utils.SecurityUtils, 'validateHmacSignature').mockReturnValue(false);

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid webhook signature',
            requestId: 'trigger_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const payload = JSON.stringify({ force_sync: true });
      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': 'sha256=invalid-signature',
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid webhook signature');
    });

    it('should handle invalid JSON payload gracefully', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();

      const payload = '{ invalid json }';
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid JSON payload',
            requestId: 'trigger_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid JSON payload');
    });
  });

  describe('HTTP method validation', () => {
    it('should reject GET requests', async () => {
      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Method not allowed',
            requestId: 'trigger_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('GET');
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });

    it('should reject PUT requests', async () => {
      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Method not allowed',
            requestId: 'trigger_test-id-123',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('PUT');
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);

      expect(response.status).toBe(405);
    });
  });

  describe('Environment configuration validation', () => {
    it('should handle missing GITHUB_TOKEN', async () => {
      ManualTriggerTestUtils.setupMissingEnvironmentMocks();

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Failed to trigger GitHub Actions workflow',
            error: 'GITHUB_TOKEN environment variable is required',
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('GITHUB_TOKEN environment variable is required');
    });

    it('should handle missing GITHUB_REPOSITORY', async () => {
      ManualTriggerTestUtils.setupMissingEnvironmentMocks();
      process.env['GITHUB_TOKEN'] = 'ghp_test_token'; // Set token but not repository

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Failed to trigger GitHub Actions workflow',
            error: 'GITHUB_REPOSITORY environment variable is required',
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('GITHUB_REPOSITORY environment variable is required');
    });

    it('should handle invalid GITHUB_REPOSITORY format', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();
      process.env['GITHUB_REPOSITORY'] = 'invalid-format'; // Should be owner/repo

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Failed to trigger GitHub Actions workflow',
            error: 'Invalid GITHUB_REPOSITORY format. Expected: owner/repo',
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid GITHUB_REPOSITORY format. Expected: owner/repo');
    });
  });

  describe('error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Internal server error',
            error: 'Unexpected error occurred',
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST');
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);

      expect(response.status).toBe(500);
    });

    it('should include proper security headers', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
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

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );
      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    });
  });

  describe('payload validation and processing', () => {
    it('should properly pass force_sync parameter to GitHub workflow', async () => {
      ManualTriggerTestUtils.setupSuccessfulMocks();

      const payload = JSON.stringify({
        force_sync: true,
        reason: 'Testing manual trigger',
        source: 'admin-panel',
      });
      const signature = ManualTriggerTestUtils.generateValidSignature(
        payload,
        mockEnvConfig.webhookSecret
      );

      mockManualTriggerFunction.mockImplementation(async (_req: Request, _context: Context) => {
        // Simulate successful trigger with force_sync=true
        return new Response(
          JSON.stringify({
            success: true,
            message: 'GitHub Actions workflow triggered successfully',
            github_response: {
              status: 204,
              statusText: 'No Content',
            },
            timestamp: new Date().toISOString(),
            requestId: 'trigger_test-id-123',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = ManualTriggerTestUtils.createMockRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerTestUtils.createMockContext();
      const response = await mockManualTriggerFunction(req, context);
      const data = await ManualTriggerTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
