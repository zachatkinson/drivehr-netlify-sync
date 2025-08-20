/**
 * @fileoverview Integration tests for manual-trigger Netlify function
 *
 * Tests the actual manual-trigger function implementation rather than mocks.
 * These tests focus on real function behavior, error handling, and integration
 * with dependencies like GitHub API, environment configuration, and logging.
 *
 * @since 2.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '@netlify/functions';
import { createHmac } from 'crypto';
import manualTriggerFunction from '../../src/functions/manual-trigger.mts';

// Mock node-fetch since that's what the http-client uses
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

/**
 * Integration test utilities for manual trigger function
 */
class ManualTriggerIntegrationUtils {
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

  static createContext(): Context {
    return {
      requestId: 'test-request-id',
    } as Context;
  }

  static async parseResponse(response: Response): Promise<any> {
    return JSON.parse(await response.text());
  }

  static generateValidSignature(payload: string, secret: string): string {
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return `sha256=${signature}`;
  }

  static setupTestEnvironment(): void {
    // Set required environment variables
    process.env['DRIVEHR_COMPANY_ID'] = '12345678-1234-5678-9abc-123456789012';
    process.env['WEBHOOK_SECRET'] = 'test-secret-key-at-least-32-characters-long';
    process.env['WP_API_URL'] = 'https://test-wordpress.com/wp-json/wp/v2';
    process.env['LOG_LEVEL'] = 'info';
    process.env['ENVIRONMENT'] = 'test';
    process.env['GITHUB_TOKEN'] = 'ghp_test_token';
    process.env['GITHUB_REPOSITORY'] = 'test-user/test-repo';
  }

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
      expect(data.error).toBe('Server configuration error');
    });
  });

  describe('Payload validation', () => {
    it('should handle valid JSON payload with force_sync parameter', async () => {
      const payload = JSON.stringify({ 
        force_sync: true, 
        reason: 'Manual test trigger',
        source: 'admin-panel'
      });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );
      
      // Mock successful GitHub API response - using globalThis.fetch which is what the function uses
      const originalFetch = globalThis.fetch;
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      });
      globalThis.fetch = mockFetch;

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
        expect.stringContaining('https://api.github.com/repos/test-user/test-repo/actions/workflows/scrape-jobs.yml/dispatches'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer ghp_test_token',
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"force_sync":"true"'),
        })
      );
    });

    it('should handle empty payload with default parameters', async () => {
      const payload = '';
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );
      
      // Mock successful GitHub API response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      });
      globalThis.fetch = mockFetch;

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
        })
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
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('{"message": "Bad credentials"}'),
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });
      globalThis.fetch = mockFetch;

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();
      
      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to trigger GitHub Actions workflow');
      expect(data.error).toBe('GitHub API error: 401 Unauthorized');
      expect(data.github_response?.status).toBe(401);
    });

    it('should handle GitHub API network errors', async () => {
      const payload = JSON.stringify({ force_sync: true });
      const signature = ManualTriggerIntegrationUtils.generateValidSignature(
        payload,
        'test-secret-key-at-least-32-characters-long'
      );
      
      // Mock network error - the function catches this and wraps it
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      globalThis.fetch = mockFetch;

      const req = ManualTriggerIntegrationUtils.createRequest('POST', payload, {
        'x-webhook-signature': signature,
      });
      const context = ManualTriggerIntegrationUtils.createContext();
      
      const response = await manualTriggerFunction(req, context);
      const data = await ManualTriggerIntegrationUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Failed to trigger GitHub Actions workflow');
      expect(data.error).toBe('Network error');
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
      const mockFetch = vi.fn().mockRejectedValue(new Error('Unexpected server error'));
      globalThis.fetch = mockFetch;
      
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
      expect(data.error).toBe('Unexpected server error');
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
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      });
      globalThis.fetch = mockFetch;

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
      expect(response.headers.get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=()');
    });
  });
});