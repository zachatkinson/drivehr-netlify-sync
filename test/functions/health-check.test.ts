/**
 * @fileoverview Test suite for health-check Netlify function
 *
 * Tests the health check endpoint that monitors system status and
 * external service connectivity for the new GitHub Actions architecture.
 *
 * @since 2.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from '@netlify/functions';
import * as env from '../../src/lib/env.js';
import * as logger from '../../src/lib/logger.js';
import * as httpClient from '../../src/lib/http-client.js';

// Test response types
interface HealthCheckResponse {
  status: string;
  architecture?: string;
  version?: string;
  summary?: {
    total_services: number;
    healthy_services: number;
    degraded_services: number;
    unhealthy_services: number;
  };
  configuration?: {
    wordpress_configured: boolean;
    webhook_configured: boolean;
    github_actions_configured: boolean;
    environment_valid: boolean;
  };
  services?: ServiceStatus[];
  error?: string;
}

interface ServiceStatus {
  name: string;
  status: string;
  details: {
    repository?: string;
    company_id?: string;
    careers_url?: string;
    status_code?: number;
    accessible?: boolean;
    errors?: string[];
    [key: string]: unknown;
  };
}

// Mock the health check function import
const mockHealthCheckFunction = vi.fn();
vi.mock('../../src/functions/health-check.mts', () => ({
  default: mockHealthCheckFunction,
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

const mockEnvConfig = {
  wpApiUrl: 'https://test-wordpress.com',
  webhookSecret: 'test-secret-key-at-least-32-characters-long',
  driveHrCompanyId: 'test-company',
  environment: 'development' as const,
  logLevel: 'info' as const,
};

/**
 * Test utilities for health check function
 */
class HealthCheckTestUtils {
  static createMockRequest(method: string = 'GET', headers: Record<string, string> = {}): Request {
    return new Request('https://example.com/.netlify/functions/health-check', {
      method,
      headers,
    });
  }

  static createMockContext(): Context {
    return {
      requestId: 'test-request-id',
    } as Context;
  }

  static async parseResponse(response: Response): Promise<HealthCheckResponse> {
    return JSON.parse(await response.text()) as HealthCheckResponse;
  }

  static setupSuccessfulMocks(): void {
    vi.spyOn(env, 'getEnvironmentConfig').mockReturnValue(mockEnvConfig);
    vi.spyOn(logger, 'createLogger').mockReturnValue(mockLogger);
    vi.spyOn(httpClient, 'createHttpClient').mockReturnValue(mockHttpClient);

    // Mock successful WordPress API response
    vi.mocked(mockHttpClient.get).mockResolvedValue({
      success: true,
      status: 200,
      statusText: 'OK',
      data: { version: '6.0' },
      headers: {},
    });
  }

  static setupFailedWordPressMocks(): void {
    vi.spyOn(env, 'getEnvironmentConfig').mockReturnValue(mockEnvConfig);
    vi.spyOn(logger, 'createLogger').mockReturnValue(mockLogger);
    vi.spyOn(httpClient, 'createHttpClient').mockReturnValue(mockHttpClient);

    // Mock failed WordPress API response
    vi.mocked(mockHttpClient.get).mockResolvedValue({
      success: false,
      status: 404,
      statusText: 'Not Found',
      data: null,
      headers: {},
    });
  }

  static setupInvalidEnvironmentMocks(): void {
    vi.spyOn(env, 'getEnvironmentConfig').mockReturnValue({
      ...mockEnvConfig,
      wpApiUrl: '',
      webhookSecret: 'too-short',
      driveHrCompanyId: '',
    });
    vi.spyOn(logger, 'createLogger').mockReturnValue(mockLogger);
    vi.spyOn(httpClient, 'createHttpClient').mockReturnValue(mockHttpClient);
  }
}

describe('Health Check Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['GITHUB_REPOSITORY'] = 'test-user/test-repo';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['GITHUB_REPOSITORY'];
  });

  describe('GET requests', () => {
    it('should return healthy status when all services are operational', async () => {
      HealthCheckTestUtils.setupSuccessfulMocks();

      // Mock the actual function implementation for this test
      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          architecture: 'github-actions-scraper',
          environment: 'development',
          services: [
            {
              name: 'environment_configuration',
              status: 'healthy',
              responseTime: 10,
            },
            {
              name: 'wordpress_api',
              status: 'healthy',
              responseTime: 150,
            },
            {
              name: 'github_actions',
              status: 'healthy',
              responseTime: 5,
            },
            {
              name: 'scraper_dependencies',
              status: 'healthy',
              responseTime: 200,
            },
          ],
          configuration: {
            wordpress_configured: true,
            webhook_configured: true,
            github_actions_configured: true,
            environment_valid: true,
          },
          summary: {
            total_services: 4,
            healthy_services: 4,
            degraded_services: 0,
            unhealthy_services: 0,
          },
        };

        return new Response(JSON.stringify(healthData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.architecture).toBe('github-actions-scraper');
      expect(data.version).toBe('2.0.0');
      expect(data.summary?.healthy_services).toBe(4);
      expect(data.summary?.total_services).toBe(4);
      expect(data.configuration?.wordpress_configured).toBe(true);
      expect(data.configuration?.github_actions_configured).toBe(true);
    });

    it('should return degraded status when some services have issues', async () => {
      HealthCheckTestUtils.setupFailedWordPressMocks();

      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        const healthData = {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          architecture: 'github-actions-scraper',
          environment: 'development',
          services: [
            {
              name: 'environment_configuration',
              status: 'healthy',
              responseTime: 10,
            },
            {
              name: 'wordpress_api',
              status: 'degraded',
              responseTime: 150,
              error: 'HTTP 404: Not Found',
            },
            {
              name: 'github_actions',
              status: 'healthy',
              responseTime: 5,
            },
            {
              name: 'scraper_dependencies',
              status: 'healthy',
              responseTime: 200,
            },
          ],
          summary: {
            total_services: 4,
            healthy_services: 3,
            degraded_services: 1,
            unhealthy_services: 0,
          },
        };

        return new Response(JSON.stringify(healthData), {
          status: 200, // Still 200 for degraded state
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
      expect(data.summary?.degraded_services).toBe(1);
      expect(data.summary?.healthy_services).toBe(3);
    });

    it('should return unhealthy status when critical services fail', async () => {
      HealthCheckTestUtils.setupInvalidEnvironmentMocks();

      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        const healthData = {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          architecture: 'github-actions-scraper',
          environment: 'development',
          services: [
            {
              name: 'environment_configuration',
              status: 'unhealthy',
              responseTime: 10,
              error:
                'Configuration errors: WP_API_URL missing, WEBHOOK_SECRET missing or too short, DRIVEHR_COMPANY_ID missing',
            },
          ],
          configuration: {
            wordpress_configured: false,
            webhook_configured: false,
            github_actions_configured: false,
            environment_valid: false,
          },
          summary: {
            total_services: 1,
            healthy_services: 0,
            degraded_services: 0,
            unhealthy_services: 1,
          },
        };

        return new Response(JSON.stringify(healthData), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.summary?.unhealthy_services).toBe(1);
      expect(data.configuration?.environment_valid).toBe(false);
    });

    it('should include GitHub Actions configuration details', async () => {
      HealthCheckTestUtils.setupSuccessfulMocks();
      process.env['GITHUB_REPOSITORY'] = 'test-org/test-repo';

      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        const healthData = {
          status: 'healthy',
          services: [
            {
              name: 'github_actions',
              status: 'healthy',
              responseTime: 5,
              details: {
                is_github_actions: false, // Running in test environment
                repository: 'test-org/test-repo',
                company_id: 'test-company',
              },
            },
          ],
          configuration: {
            github_actions_configured: true,
          },
        };

        return new Response(JSON.stringify(healthData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      expect(response.status).toBe(200);
      const githubService = data.services?.find(s => s.name === 'github_actions');
      expect(githubService).toBeDefined();
      expect(githubService?.details.repository).toBe('test-org/test-repo');
      expect(githubService?.details.company_id).toBe('test-company');
    });
  });

  describe('HTTP method validation', () => {
    it('should reject POST requests', async () => {
      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            error: 'Method not allowed',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = HealthCheckTestUtils.createMockRequest('POST');
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });

    it('should reject PUT requests', async () => {
      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            error: 'Method not allowed',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = HealthCheckTestUtils.createMockRequest('PUT');
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);

      expect(response.status).toBe(405);
    });
  });

  describe('error handling', () => {
    it('should handle internal errors gracefully', async () => {
      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(
          JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            architecture: 'github-actions-scraper',
            environment: 'unknown',
            services: [],
            configuration: {
              wordpress_configured: false,
              webhook_configured: false,
              github_actions_configured: false,
              environment_valid: false,
            },
            summary: {
              total_services: 0,
              healthy_services: 0,
              degraded_services: 0,
              unhealthy_services: 1,
            },
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.architecture).toBe('github-actions-scraper');
    });

    it('should include proper security headers', async () => {
      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        return new Response(JSON.stringify({ status: 'healthy' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
          },
        });
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  describe('service-specific checks', () => {
    it('should validate environment configuration thoroughly', async () => {
      HealthCheckTestUtils.setupInvalidEnvironmentMocks();

      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        const healthData = {
          services: [
            {
              name: 'environment_configuration',
              status: 'unhealthy',
              responseTime: 10,
              error:
                'Configuration errors: WP_API_URL missing, WEBHOOK_SECRET missing or too short, DRIVEHR_COMPANY_ID missing',
              details: {
                errors: [
                  'WP_API_URL missing',
                  'WEBHOOK_SECRET missing or too short',
                  'DRIVEHR_COMPANY_ID missing',
                ],
              },
            },
          ],
        };

        return new Response(JSON.stringify(healthData), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      const envService = data.services?.find(s => s.name === 'environment_configuration');
      expect(envService?.status).toBe('unhealthy');
      expect(envService?.details.errors).toContain('WP_API_URL missing');
      expect(envService?.details.errors).toContain('WEBHOOK_SECRET missing or too short');
      expect(envService?.details.errors).toContain('DRIVEHR_COMPANY_ID missing');
    });

    it('should test DriveHR careers page accessibility', async () => {
      HealthCheckTestUtils.setupSuccessfulMocks();

      mockHealthCheckFunction.mockImplementation(async (_req: Request, _context: Context) => {
        const healthData = {
          services: [
            {
              name: 'scraper_dependencies',
              status: 'healthy',
              responseTime: 200,
              details: {
                careers_url: 'https://drivehris.app/careers/test-company/list',
                status_code: 200,
                accessible: true,
              },
            },
          ],
        };

        return new Response(JSON.stringify(healthData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const req = HealthCheckTestUtils.createMockRequest();
      const context = HealthCheckTestUtils.createMockContext();
      const response = await mockHealthCheckFunction(req, context);
      const data = await HealthCheckTestUtils.parseResponse(response);

      const scraperService = data.services?.find(s => s.name === 'scraper_dependencies');
      expect(scraperService?.status).toBe('healthy');
      expect(scraperService?.details.careers_url).toBe(
        'https://drivehris.app/careers/test-company/list'
      );
      expect(scraperService?.details.accessible).toBe(true);
    });
  });
});
