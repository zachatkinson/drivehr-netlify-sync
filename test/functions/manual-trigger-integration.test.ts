/**
 * Manual Trigger Integration Test Suite
 *
 * Comprehensive integration test coverage for manual-trigger Netlify function
 * following enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates the actual manual-trigger function implementation
 * using real function execution rather than mocks, focusing on end-to-end behavior,
 * GitHub API integration, HMAC authentication, and comprehensive error handling.
 *
 * Test Features:
 * - Real function implementation testing (not mocked)
 * - Complete GitHub Actions workflow dispatch integration
 * - HMAC SHA-256 webhook signature validation
 * - HTTP method restriction enforcement (POST only)
 * - Comprehensive security headers validation
 * - Environment configuration and error scenarios
 * - Request ID generation and correlation tracking
 * - End-to-end authentication and authorization flows
 *
 * The test suite validates all three utility functions from the implementation:
 * triggerGitHubWorkflow, validateWebhookSignature, and generateRequestId,
 * ensuring complete alignment with the source code functionality.
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/functions/manual-trigger-integration.test.ts -- --grep "GitHub API"
 *
 * // Example of running authentication tests
 * pnpm test test/functions/manual-trigger-integration.test.ts -- --grep "Authentication"
 * ```
 *
 * @module manual-trigger-integration-test-suite
 * @since 2.0.0
 * @see {@link ../../src/functions/manual-trigger.mts} for the function being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '@netlify/functions';
import { createHmac } from 'crypto';
import manualTriggerFunction from '../../src/functions/manual-trigger.mts';
import fetch from 'node-fetch';

/**
 * Manual trigger result interface for integration testing
 *
 * Defines the expected response structure from the manual trigger function
 * for comprehensive validation of success and error scenarios including
 * GitHub API responses and operational metadata.
 *
 * @since 2.0.0
 */
interface ManualTriggerResult {
  success: boolean;
  message: string;
  workflow_run_id?: string;
  github_response?: {
    status: number;
    statusText: string;
  };
  error?: string;
  timestamp: string;
  requestId: string;
}

// Mock node-fetch since that's what the http-client uses
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

// Get reference to mocked fetch
const mockFetch = vi.mocked(fetch);

/**
 * Integration test utilities for manual trigger function
 *
 * Extends BaseTestUtils with specialized testing methods for real function
 * execution and GitHub API integration validation. Maintains DRY principles
 * while providing focused testing capabilities for end-to-end manual trigger
 * workflow validation including HMAC signature generation and environment setup.
 *
 * Provides comprehensive testing support for all three implementation functions:
 * the main handler, triggerGitHubWorkflow, validateWebhookSignature, and
 * generateRequestId utility functions.
 *
 * @since 2.0.0
 */
class ManualTriggerIntegrationUtils {
  /**
   * Create HTTP request for manual trigger integration testing
   *
   * Generates standardized HTTP Request objects for testing the manual
   * trigger function with configurable methods, payloads, and headers
   * including HMAC signature generation for authentication validation.
   *
   * @param method - HTTP method to use in request
   * @param body - JSON payload body for request
   * @param headers - Additional headers to include
   * @returns Request object configured for manual trigger testing
   * @example
   * ```typescript
   * const postRequest = ManualTriggerIntegrationUtils.createRequest('POST', '{"force_sync": true}');
   * const getRequest = ManualTriggerIntegrationUtils.createRequest('GET');
   * ```
   * @since 2.0.0
   */
  static createRequest(
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
   * Create Netlify function context for integration testing
   *
   * Generates standardized Netlify Context objects with consistent
   * request IDs and execution environment for reliable integration
   * testing scenarios.
   *
   * @returns Netlify Context object for testing
   * @example
   * ```typescript
   * const context = ManualTriggerIntegrationUtils.createContext();
   * ```
   * @since 2.0.0
   */
  static createContext(): Context {
    return {
      requestId: 'test-request-id',
    } as Context;
  }

  /**
   * Parse manual trigger response for testing validation
   *
   * Extracts and parses JSON response body from manual trigger function
   * responses for comprehensive validation of success/error scenarios
   * and GitHub API integration results.
   *
   * @param response - HTTP Response from manual trigger function
   * @returns Promise resolving to parsed manual trigger result
   * @example
   * ```typescript
   * const result = await ManualTriggerIntegrationUtils.parseResponse(response);
   * expect(result.success).toBe(true);
   * ```
   * @since 2.0.0
   */
  static async parseResponse(response: Response): Promise<ManualTriggerResult> {
    return JSON.parse(await response.text()) as ManualTriggerResult;
  }

  /**
   * Generate valid HMAC signature for webhook authentication
   *
   * Creates cryptographic HMAC SHA-256 signature for webhook payload
   * validation testing using the same algorithm as the implementation
   * to ensure authentication flow validation.
   *
   * @param payload - JSON payload to sign
   * @param secret - Webhook secret for HMAC generation
   * @returns Hex-encoded HMAC SHA-256 signature
   * @example
   * ```typescript
   * const signature = ManualTriggerIntegrationUtils.generateValidSignature('{"test": true}', 'secret');
   * const headers = { 'X-Webhook-Signature': `sha256=${signature}` };
   * ```
   * @since 2.0.0
   */
  static generateValidSignature(payload: string, secret: string): string {
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return `sha256=${signature}`;
  }

  static createMockResponse(options: {
    ok: boolean;
    status: number;
    statusText: string;
    body?: string;
    headers?: Record<string, string>;
  }): Response {
    const defaultHeaders = {
      'content-type': 'application/json',
      'x-ratelimit-remaining': '5000',
      ...options.headers,
    };

    const mockHeaders = new Map(Object.entries(defaultHeaders));
    const bodyText = options.body ?? '';

    return {
      ok: options.ok,
      status: options.status,
      statusText: options.statusText,
      bodyUsed: false,
      headers: {
        forEach: (callback: (value: string, key: string) => void) => {
          for (const [key, value] of mockHeaders) {
            callback(value, key);
          }
        },
        get: (key: string) => mockHeaders.get(key.toLowerCase()),
        has: (key: string) => mockHeaders.has(key.toLowerCase()),
        entries: () => mockHeaders.entries(),
        keys: () => mockHeaders.keys(),
        values: () => mockHeaders.values(),
      },
      // Allow multiple calls to text() to handle HttpClient's double-call pattern
      text: () => Promise.resolve(bodyText),
      json: () => Promise.resolve(bodyText ? JSON.parse(bodyText) : {}),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      clone: () => ManualTriggerIntegrationUtils.createMockResponse(options),
    } as unknown as Response;
  }

  /**
   * Setup comprehensive test environment configuration
   *
   * Configures all required environment variables for manual trigger
   * function testing including GitHub authentication, webhook secrets,
   * and WordPress configuration for realistic integration testing.
   *
   * @example
   * ```typescript
   * ManualTriggerIntegrationUtils.setupTestEnvironment();
   * // All required environment variables are now configured
   * ```
   * @since 2.0.0
   */
  static setupTestEnvironment(): void {
    // Set required environment variables
    process.env['DRIVEHR_COMPANY_ID'] = '12345678-1234-5678-9abc-123456789012';
    process.env['WEBHOOK_SECRET'] = 'test-secret-key-at-least-32-characters-long';
    process.env['WP_API_URL'] = 'https://test-wordpress.com/webhook';
    process.env['LOG_LEVEL'] = 'info';
    process.env['ENVIRONMENT'] = 'test';
    process.env['GITHUB_TOKEN'] = 'ghp_test_token';
    process.env['GITHUB_REPOSITORY'] = 'test-user/test-repo';
  }

  /**
   * Clean up test environment configuration
   *
   * Removes all environment variables configured during testing
   * to prevent interference between test runs and ensure clean
   * test isolation for reliable integration testing.
   *
   * @example
   * ```typescript
   * ManualTriggerIntegrationUtils.cleanupTestEnvironment();
   * // All test environment variables are now removed
   * ```
   * @since 2.0.0
   */
  static cleanupTestEnvironment(): void {
    delete process.env['DRIVEHR_COMPANY_ID'];
    delete process.env['WEBHOOK_SECRET'];
    delete process.env['WP_API_URL'];
    delete process.env['LOG_LEVEL'];
    delete process.env['ENVIRONMENT'];
    delete process.env['GITHUB_TOKEN'];
    delete process.env['GITHUB_REPOSITORY'];
  }
}

describe('Manual Trigger Function - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    ManualTriggerIntegrationUtils.setupTestEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ManualTriggerIntegrationUtils.cleanupTestEnvironment();
  });

  describe('HTTP method validation', () => {
    it('should reject GET requests with proper error response', async () => {
      const req = ManualTriggerIntegrationUtils.createRequest('GET');
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
      expect(data.requestId).toMatch(/^trigger_/);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should reject PUT requests with proper error response', async () => {
      const req = ManualTriggerIntegrationUtils.createRequest('PUT');
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });

    it('should include security headers in error responses', async () => {
      const req = ManualTriggerIntegrationUtils.createRequest('GET');
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    });
  });

  describe('Authentication validation', () => {
    it('should reject POST requests without webhook signature', async () => {
      const payload = JSON.stringify({ force_sync: true });
      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload);
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing webhook signature');
      expect(data.requestId).toMatch(/^trigger_/);
    });

    it('should reject POST requests with invalid webhook signature', async () => {
      const payload = JSON.stringify({ force_sync: true });
      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': 'sha256=invalid-signature',
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid webhook signature');
    });

    it('should handle missing WEBHOOK_SECRET environment variable', async () => {
      delete process.env['WEBHOOK_SECRET'];

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );
      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('WEBHOOK_SECRET');
    });
  });

  describe('Payload validation', () => {
    it('should handle valid JSON payload with force_sync parameter', async () => {
      const payload = JSON.stringify({
        force_sync: true,
        reason: 'Manual test trigger',
        source: 'admin-panel',
      });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      // Mock successful GitHub API response
      mockFetch.mockResolvedValue(
        ManualTriggerIntegrationUtils.createMockResponse({
          ok: true,
          status: 204,
          statusText: 'No Content',
        }) as unknown as import('node-fetch').Response
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('GitHub Actions workflow triggered successfully');
      expect(data.github_response?.status).toBe(204);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.github.com/repos/test-user/test-repo/actions/workflows/scrape-jobs.yml/dispatches'
        ),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer ghp_test_token',
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"force_sync":"true"'),
        }) as unknown as import('node-fetch').Response
      );
    });

    it('should handle empty payload with default parameters', async () => {
      const payload = '';
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      // Mock successful GitHub API response
      mockFetch.mockResolvedValue(
        ManualTriggerIntegrationUtils.createMockResponse({
          ok: true,
          status: 204,
          statusText: 'No Content',
        }) as unknown as import('node-fetch').Response
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"force_sync":"false"'),
        }) as unknown as import('node-fetch').Response
      );
    });

    it('should reject invalid JSON payload', async () => {
      const payload = '{ invalid json }';
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid JSON payload');
    });
  });

  describe('GitHub API integration', () => {
    it('should handle GitHub API authentication errors', async () => {
      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      // Mock GitHub API 401 error
      mockFetch.mockResolvedValue(
        ManualTriggerIntegrationUtils.createMockResponse({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          body: '{"message": "Bad credentials"}',
        }) as unknown as import('node-fetch').Response
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to trigger GitHub Actions workflow');
      expect(data.error).toContain('401');
      expect(data.github_response?.status).toBe(401);
    });

    it('should handle GitHub API network errors', async () => {
      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      // Mock network error - the function catches this and wraps it
      mockFetch.mockRejectedValue(new Error('Network error'));

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to trigger GitHub Actions workflow');
      expect(data.error).toBeDefined();
    });

    it('should handle missing GITHUB_TOKEN environment variable', async () => {
      delete process.env['GITHUB_TOKEN'];

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('GITHUB_TOKEN environment variable is required');
    });

    it('should handle missing GITHUB_REPOSITORY environment variable', async () => {
      delete process.env['GITHUB_REPOSITORY'];

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('GITHUB_REPOSITORY environment variable is required');
    });

    it('should handle invalid GITHUB_REPOSITORY format', async () => {
      process.env['GITHUB_REPOSITORY'] = 'invalid-format'; // Should be owner/repo

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid GITHUB_REPOSITORY format. Expected: owner/repo');
    });
  });

  describe('Error handling and resilience', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock GitHub API failure to trigger error path
      mockFetch.mockRejectedValue(new Error('Unexpected server error'));

      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to trigger GitHub Actions workflow');
      expect(data.error).toBeDefined();
      expect(data.requestId).toMatch(/^trigger_/);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should generate unique request IDs for each request', async () => {
      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );

      // Mock successful GitHub API response
      mockFetch.mockResolvedValue(
        ManualTriggerIntegrationUtils.createMockResponse({
          ok: true,
          status: 204,
          statusText: 'No Content',
        }) as unknown as import('node-fetch').Response
      );

      const req1 = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const req2 = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();

      const response1 = await manualTriggerFunction(req1, context);
      const response2 = await manualTriggerFunction(req2, context);

      const data1 = await ManualTriggerIntegrationUtils.parseResponse(response1);
      const data2 = await ManualTriggerIntegrationUtils.parseResponse(response2);

      expect(data1.requestId).toMatch(/^trigger_/);
      expect(data2.requestId).toMatch(/^trigger_/);
      expect(data1.requestId).not.toBe(data2.requestId);
    });
  });

  describe('Security headers', () => {
    it('should include comprehensive security headers in all responses', async () => {
      const req = ManualTriggerIntegrationUtils.createRequest('GET');
      const context = ManualTriggerIntegrationUtils.createContext();

      const response = await manualTriggerFunction(req, context);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Content-Security-Policy')).toBe(
        "default-src 'self'; connect-src 'self' https:; script-src 'self'"
      );
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Permissions-Policy')).toBe(
        'geolocation=(), microphone=(), camera=()'
      );
    });
  });
});
