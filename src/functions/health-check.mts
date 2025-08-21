/**
 * DriveHR System Health Check - Netlify Function
 *
 * Dedicated health check endpoint that provides comprehensive system status
 * information for monitoring and alerting. This function tests connectivity
 * to all external services and validates the configuration without performing
 * actual job synchronization.
 *
 * **Features:**
 * - Environment variable validation
 * - WordPress API connectivity test
 * - GitHub Actions scraper status check
 * - Configuration validation
 * - Detailed error reporting for debugging
 *
 * **Usage:**
 * - GET /.netlify/functions/health-check - Full health check
 * - Suitable for uptime monitoring services
 * - Returns structured health status with diagnostics
 */

import type { Context } from '@netlify/functions';
import { getEnvironmentConfig, getEnvVar } from '../lib/env.js';
import { createLogger } from '../lib/logger.js';
import { createHttpClient } from '../lib/http-client.js';
import type { SecurityHeaders } from '../types/api.js';

/**
 * Health check status levels
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual service health check result
 */
interface ServiceHealthCheck {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Complete system health check result
 */
interface SystemHealthCheck {
  status: HealthStatus;
  timestamp: string;
  version: string;
  architecture: string;
  environment: string;
  services: ServiceHealthCheck[];
  configuration: {
    wordpress_configured: boolean;
    webhook_configured: boolean;
    github_actions_configured: boolean;
    environment_valid: boolean;
  };
  summary: {
    total_services: number;
    healthy_services: number;
    degraded_services: number;
    unhealthy_services: number;
  };
}

/**
 * Netlify health check function
 *
 * Performs comprehensive health checks on all system components and
 * returns detailed status information for monitoring purposes.
 *
 * @param req - Web standard Request object
 * @param context - Netlify function context
 * @returns Promise<Response> - Health check results
 */
export default async (req: Request, context: Context): Promise<Response> => {
  const timestamp = new Date().toISOString();
  const logger = createLogger('info', false);

  // Configure security headers
  const securityHeaders: SecurityHeaders = {
    'Content-Type': 'application/json',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' https:; script-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };

  try {
    logger.info('Health check started');

    // Only support GET requests
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({
        error: 'Method not allowed',
        timestamp,
      }), {
        status: 405,
        headers: securityHeaders,
      });
    }

    // Perform comprehensive health check
    const healthResult = await performHealthCheck();

    // Determine overall status code
    const statusCode = healthResult.status === 'healthy' ? 200 :
                      healthResult.status === 'degraded' ? 200 : 503;

    logger.info('Health check completed', {
      status: healthResult.status,
      healthyServices: healthResult.summary.healthy_services,
      totalServices: healthResult.summary.total_services,
    });

    return new Response(JSON.stringify(healthResult), {
      status: statusCode,
      headers: securityHeaders,
    });

  } catch (error) {
    logger.error('Health check failed', { error });

    const errorResult: SystemHealthCheck = {
      status: 'unhealthy',
      timestamp,
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
    };

    return new Response(JSON.stringify(errorResult), {
      status: 503,
      headers: securityHeaders,
    });
  }
};

/**
 * Perform comprehensive system health check
 */
async function performHealthCheck(): Promise<SystemHealthCheck> {
  const timestamp = new Date().toISOString();
  const services: ServiceHealthCheck[] = [];

  // Check environment configuration
  const envCheck = await checkEnvironmentConfiguration();
  services.push(envCheck);

  // Check WordPress connectivity
  const wpCheck = await checkWordPressConnectivity();
  services.push(wpCheck);

  // Check GitHub Actions configuration
  const githubCheck = await checkGitHubActionsConfiguration();
  services.push(githubCheck);

  // Check scraper dependencies
  const scraperCheck = await checkScraperDependencies();
  services.push(scraperCheck);

  // Calculate summary
  const summary = {
    total_services: services.length,
    healthy_services: services.filter(s => s.status === 'healthy').length,
    degraded_services: services.filter(s => s.status === 'degraded').length,
    unhealthy_services: services.filter(s => s.status === 'unhealthy').length,
  };

  // Determine overall status
  const overallStatus: HealthStatus = 
    summary.unhealthy_services > 0 ? 'unhealthy' :
    summary.degraded_services > 0 ? 'degraded' : 'healthy';

  const env = getEnvironmentConfig();

  return {
    status: overallStatus,
    timestamp,
    version: '2.0.0',
    architecture: 'github-actions-scraper',
    environment: env.environment || 'unknown',
    services,
    configuration: {
      wordpress_configured: Boolean(env.wpApiUrl),
      webhook_configured: Boolean(env.webhookSecret),
      github_actions_configured: Boolean(env.driveHrCompanyId),
      environment_valid: envCheck.status === 'healthy',
    },
    summary,
  };
}

/**
 * Check environment configuration validity
 */
async function checkEnvironmentConfiguration(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    const env = getEnvironmentConfig();
    const errors: string[] = [];

    // Check required environment variables
    if (!env.wpApiUrl) errors.push('WP_API_URL missing');
    if (!env.webhookSecret || env.webhookSecret.length < 32) {
      errors.push('WEBHOOK_SECRET missing or too short');
    }
    if (!env.driveHrCompanyId) errors.push('DRIVEHR_COMPANY_ID missing');

    // Validate URLs
    if (env.wpApiUrl) {
      try {
        new URL(env.wpApiUrl);
      } catch {
        errors.push('WP_API_URL is not a valid URL');
      }
    }

    const responseTime = Date.now() - startTime;

    if (errors.length > 0) {
      return {
        name: 'environment_configuration',
        status: 'unhealthy',
        responseTime,
        error: `Configuration errors: ${errors.join(', ')}`,
        details: { errors },
      };
    }

    return {
      name: 'environment_configuration',
      status: 'healthy',
      responseTime,
      details: {
        environment: env.environment,
        log_level: env.logLevel,
        company_id: env.driveHrCompanyId,
      },
    };

  } catch (error) {
    return {
      name: 'environment_configuration',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Configuration check failed',
    };
  }
}

/**
 * Check WordPress API connectivity
 */
async function checkWordPressConnectivity(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    const env = getEnvironmentConfig();
    
    if (!env.wpApiUrl) {
      return {
        name: 'wordpress_api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: 'WordPress API URL not configured',
      };
    }

    // Create HTTP client for testing
    const httpClient = createHttpClient({
      timeout: 10000,
      retries: 1,
      userAgent: 'DriveHR-HealthCheck/2.0',
    });

    // Test WordPress webhook endpoint
    const testUrl = `${env.wpApiUrl}/webhook/health`;
    const response = await httpClient.get(testUrl);

    const responseTime = Date.now() - startTime;

    if (response.success) {
      return {
        name: 'wordpress_api',
        status: 'healthy',
        responseTime,
        details: {
          url: testUrl,
          status_code: response.status,
        },
      };
    } else {
      return {
        name: 'wordpress_api',
        status: 'degraded',
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: {
          url: testUrl,
          status_code: response.status,
        },
      };
    }

  } catch (error) {
    return {
      name: 'wordpress_api',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'WordPress connectivity check failed',
    };
  }
}

/**
 * Check GitHub Actions configuration
 */
async function checkGitHubActionsConfiguration(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    const env = getEnvironmentConfig();
    const issues: string[] = [];

    // Check if we're running in GitHub Actions
    const isGitHubActions = Boolean(getEnvVar('GITHUB_ACTIONS'));
    
    // Check required GitHub Actions environment variables
    if (!getEnvVar('GITHUB_REPOSITORY')) {
      issues.push('GITHUB_REPOSITORY not set');
    }
    
    if (!env.driveHrCompanyId) {
      issues.push('DRIVEHR_COMPANY_ID not configured');
    }

    const responseTime = Date.now() - startTime;

    if (issues.length > 0) {
      return {
        name: 'github_actions',
        status: 'degraded',
        responseTime,
        error: `Configuration issues: ${issues.join(', ')}`,
        details: {
          is_github_actions: isGitHubActions,
          repository: getEnvVar('GITHUB_REPOSITORY') || 'unknown',
          company_id: env.driveHrCompanyId || 'not configured',
        },
      };
    }

    return {
      name: 'github_actions',
      status: 'healthy',
      responseTime,
      details: {
        is_github_actions: isGitHubActions,
        repository: getEnvVar('GITHUB_REPOSITORY') || 'local',
        company_id: env.driveHrCompanyId,
      },
    };

  } catch (error) {
    return {
      name: 'github_actions',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'GitHub Actions check failed',
    };
  }
}

/**
 * Check scraper dependencies and configuration
 */
async function checkScraperDependencies(): Promise<ServiceHealthCheck> {
  const startTime = Date.now();
  
  try {
    // Check if we can access the DriveHR careers URL
    const env = getEnvironmentConfig();
    
    if (!env.driveHrCompanyId) {
      return {
        name: 'scraper_dependencies',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: 'DriveHR company ID not configured',
      };
    }

    // Test if the DriveHR careers URL is accessible
    const careersUrl = `https://drivehris.app/careers/${env.driveHrCompanyId}/list`;
    
    try {
      const httpClient = createHttpClient({
        timeout: 10000,
        retries: 1,
        userAgent: 'DriveHR-HealthCheck/2.0',
      });

      const response = await httpClient.get(careersUrl);
      const responseTime = Date.now() - startTime;

      if (response.success) {
        return {
          name: 'scraper_dependencies',
          status: 'healthy',
          responseTime,
          details: {
            careers_url: careersUrl,
            status_code: response.status,
            accessible: true,
          },
        };
      } else {
        return {
          name: 'scraper_dependencies',
          status: 'degraded',
          responseTime,
          error: `DriveHR careers page returned HTTP ${response.status}`,
          details: {
            careers_url: careersUrl,
            status_code: response.status,
            accessible: false,
          },
        };
      }

    } catch (networkError) {
      return {
        name: 'scraper_dependencies',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: 'DriveHR careers page not accessible',
        details: {
          careers_url: careersUrl,
          accessible: false,
          network_error: networkError instanceof Error ? networkError.message : 'Unknown error',
        },
      };
    }

  } catch (error) {
    return {
      name: 'scraper_dependencies',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Scraper dependencies check failed',
    };
  }
}