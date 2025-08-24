/**
 * DriveHR System Health Check - Netlify Function
 *
 * Comprehensive system health monitoring endpoint providing detailed status information
 * for all critical system components and external dependencies. This Netlify function
 * serves as the central monitoring hub for the DriveHR job synchronization system,
 * validating configuration, testing connectivity, and providing structured diagnostics
 * for operational monitoring and alerting systems.
 *
 * The health check function performs deep validation across multiple system layers including
 * environment configuration, WordPress API connectivity, GitHub Actions integration status,
 * and DriveHR scraper dependencies. Each component is individually assessed with detailed
 * timing metrics and error reporting to provide comprehensive operational visibility.
 *
 * Key System Validations:
 * - Environment variable configuration and format validation
 * - WordPress webhook endpoint connectivity and response testing
 * - GitHub Actions integration status and repository configuration
 * - DriveHR careers page accessibility and scraper dependency validation
 * - Security headers enforcement and HTTP method validation
 *
 * @example
 * ```bash
 * # Health check endpoint usage
 * curl -X GET https://your-site.netlify.app/.netlify/functions/health-check
 *
 * # Response structure for healthy system
 * {
 *   "status": "healthy",
 *   "timestamp": "2025-08-24T19:30:00.000Z",
 *   "version": "2.0.0",
 *   "architecture": "github-actions-scraper",
 *   "environment": "production",
 *   "services": [
 *     {
 *       "name": "environment_configuration",
 *       "status": "healthy",
 *       "responseTime": 5
 *     }
 *   ],
 *   "configuration": {
 *     "wordpress_configured": true,
 *     "webhook_configured": true,
 *     "github_actions_configured": true,
 *     "environment_valid": true
 *   },
 *   "summary": {
 *     "total_services": 4,
 *     "healthy_services": 4,
 *     "degraded_services": 0,
 *     "unhealthy_services": 0
 *   }
 * }
 * ```
 *
 * @module health-check-function
 * @since 2.0.0
 * @see {@link ../../lib/env.js} for environment configuration utilities
 * @see {@link ../../lib/http-client.js} for HTTP connectivity testing
 * @see {@link ../../lib/logger.js} for structured logging capabilities
 */

import type { Context } from '@netlify/functions';
import { getEnvironmentConfig, getEnvVar } from '../lib/env.js';
import { createLogger } from '../lib/logger.js';
import { createHttpClient } from '../lib/http-client.js';
import type { SecurityHeaders } from '../types/api.js';

/**
 * Health status enumeration for service and system status reporting
 *
 * Provides standardized status levels for health check reporting with clear
 * operational meanings for monitoring and alerting systems.
 *
 * @since 2.0.0
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual service health check result structure
 *
 * Comprehensive result container for individual service health validation including
 * performance metrics, status assessment, and detailed diagnostic information.
 * Each service check provides standardized reporting for aggregation into overall
 * system health assessment.
 *
 * @since 2.0.0
 */
interface ServiceHealthCheck {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Complete system health check result structure
 *
 * Comprehensive system health report aggregating all individual service checks
 * into overall system status with configuration validation, service summaries,
 * and operational metadata. This structure provides complete visibility into
 * system health for monitoring dashboards and alerting systems.
 *
 * @since 2.0.0
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
 * Netlify health check function handler
 *
 * Main entry point for the health check endpoint providing comprehensive system
 * status validation and reporting. This function orchestrates all health checks
 * across system components and returns structured diagnostic information suitable
 * for monitoring systems, uptime services, and operational dashboards.
 *
 * The function enforces security policies through comprehensive security headers,
 * validates HTTP methods, and provides detailed error handling with appropriate
 * status codes. All operations are logged with structured data for operational
 * monitoring and debugging purposes.
 *
 * @param req - Web standard Request object containing HTTP request details
 * @param context - Netlify function execution context with environment access
 * @returns Promise resolving to HTTP Response with health check results
 * @throws {Error} When critical system failures prevent health check execution
 * @example
 * ```typescript
 * // Netlify function deployment
 * const response = await healthCheckFunction(request, context);
 *
 * // Success response (status 200)
 * {
 *   status: "healthy",
 *   services: [...],
 *   configuration: {...},
 *   summary: {...}
 * }
 *
 * // Degraded system response (status 200 with warnings)
 * {
 *   status: "degraded",
 *   services: [
 *     { name: "wordpress_api", status: "degraded", error: "Slow response" }
 *   ]
 * }
 *
 * // Unhealthy system response (status 503)
 * {
 *   status: "unhealthy",
 *   services: [
 *     { name: "environment_configuration", status: "unhealthy", error: "Missing required variables" }
 *   ]
 * }
 * ```
 * @since 2.0.0
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
 * Perform comprehensive system health check across all components
 *
 * Orchestrates health validation across all system components including environment
 * configuration, external service connectivity, and scraper dependencies. This function
 * aggregates individual service checks into overall system health assessment with
 * detailed metrics and status categorization.
 *
 * The health check process validates critical system dependencies in parallel where
 * possible, measures response times for performance monitoring, and categorizes
 * overall system status based on individual component health. Failed services are
 * captured with detailed error information for debugging and remediation.
 *
 * @returns Promise resolving to complete system health assessment
 * @throws {Error} When health check orchestration fails
 * @example
 * ```typescript
 * const healthResult = await performHealthCheck();
 * console.log(`System status: ${healthResult.status}`);
 * console.log(`Healthy services: ${healthResult.summary.healthy_services}/${healthResult.summary.total_services}`);
 *
 * // Check specific service status
 * const wpService = healthResult.services.find(s => s.name === 'wordpress_api');
 * if (wpService?.status === 'unhealthy') {
 *   console.error('WordPress API issue:', wpService.error);
 * }
 * ```
 * @since 2.0.0
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
 * Validate environment configuration and required variables
 *
 * Performs comprehensive validation of all required environment variables including
 * format validation, URL structure verification, and security requirements checking.
 * This function ensures the system has proper configuration before attempting
 * external service connections or operational activities.
 *
 * Validation includes checking for presence of required variables, validating URL
 * formats, ensuring security token lengths meet minimum requirements, and verifying
 * configuration consistency across the environment setup.
 *
 * @returns Promise resolving to environment configuration health status
 * @throws {Error} When configuration validation encounters unexpected errors
 * @example
 * ```typescript
 * const envCheck = await checkEnvironmentConfiguration();
 * if (envCheck.status === 'unhealthy') {
 *   console.error('Configuration errors:', envCheck.error);
 *   // Typical errors: "WP_API_URL missing, WEBHOOK_SECRET too short"
 * }
 *
 * // Healthy configuration response
 * {
 *   name: "environment_configuration",
 *   status: "healthy",
 *   responseTime: 15,
 *   details: {
 *     environment: "production",
 *     log_level: "info",
 *     company_id: "tech-startup"
 *   }
 * }
 * ```
 * @since 2.0.0
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
 * Test WordPress API connectivity and webhook endpoint availability
 *
 * Validates connectivity to the configured WordPress webhook endpoint by performing
 * actual HTTP requests to test reachability, response times, and basic functionality.
 * This check ensures the WordPress integration is operational and can receive job
 * synchronization webhooks from the DriveHR system.
 *
 * The connectivity test uses a dedicated health endpoint to avoid triggering actual
 * webhook processing while validating network connectivity, DNS resolution, SSL
 * certificate validation, and basic HTTP response handling.
 *
 * @returns Promise resolving to WordPress connectivity status and metrics
 * @throws {Error} When connectivity testing encounters unexpected network errors
 * @example
 * ```typescript
 * const wpCheck = await checkWordPressConnectivity();
 * console.log(`WordPress response time: ${wpCheck.responseTime}ms`);
 *
 * // Healthy WordPress connectivity
 * {
 *   name: "wordpress_api",
 *   status: "healthy",
 *   responseTime: 245,
 *   details: {
 *     url: "https://mysite.com/webhook/health",
 *     status_code: 200
 *   }
 * }
 *
 * // Degraded connectivity (slow or error responses)
 * {
 *   name: "wordpress_api",
 *   status: "degraded",
 *   responseTime: 8500,
 *   error: "HTTP 503: Service Temporarily Unavailable"
 * }
 * ```
 * @since 2.0.0
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
 * Validate GitHub Actions environment and configuration
 *
 * Verifies GitHub Actions integration status by checking for required environment
 * variables, repository configuration, and deployment context. This validation
 * ensures the system can properly integrate with GitHub Actions workflows for
 * automated job scraping and synchronization processes.
 *
 * The check validates both runtime environment detection (whether running in GitHub
 * Actions) and configuration completeness including repository identification and
 * DriveHR company configuration for proper scraping target identification.
 *
 * @returns Promise resolving to GitHub Actions configuration status
 * @throws {Error} When GitHub Actions configuration validation fails
 * @example
 * ```typescript
 * const githubCheck = await checkGitHubActionsConfiguration();
 *
 * // Healthy GitHub Actions configuration
 * {
 *   name: "github_actions",
 *   status: "healthy",
 *   responseTime: 8,
 *   details: {
 *     is_github_actions: true,
 *     repository: "myorg/drivehr-sync",
 *     company_id: "tech-startup"
 *   }
 * }
 *
 * // Degraded configuration (missing variables)
 * {
 *   name: "github_actions",
 *   status: "degraded",
 *   error: "Configuration issues: GITHUB_REPOSITORY not set",
 *   details: {
 *     is_github_actions: false,
 *     repository: "unknown",
 *     company_id: "tech-startup"
 *   }
 * }
 * ```
 * @since 2.0.0
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
 * Validate DriveHR scraper dependencies and target accessibility
 *
 * Tests accessibility of the DriveHR careers page that serves as the scraping target
 * for job data extraction. This check ensures the external DriveHR system is
 * reachable and responding properly, validating that job scraping operations will
 * succeed when executed.
 *
 * The dependency check performs actual HTTP requests to the configured DriveHR
 * careers URL, validates response codes, measures response times, and ensures
 * the target system is accessible for automated scraping operations.
 *
 * @returns Promise resolving to scraper dependency status and accessibility metrics
 * @throws {Error} When scraper dependency validation encounters unexpected errors
 * @example
 * ```typescript
 * const scraperCheck = await checkScraperDependencies();
 *
 * // Healthy scraper dependencies
 * {
 *   name: "scraper_dependencies",
 *   status: "healthy",
 *   responseTime: 320,
 *   details: {
 *     careers_url: "https://drivehris.app/careers/tech-startup/list",
 *     status_code: 200,
 *     accessible: true
 *   }
 * }
 *
 * // Degraded dependencies (slow or error responses)
 * {
 *   name: "scraper_dependencies",
 *   status: "degraded",
 *   error: "DriveHR careers page returned HTTP 503",
 *   details: {
 *     careers_url: "https://drivehris.app/careers/tech-startup/list",
 *     status_code: 503,
 *     accessible: false
 *   }
 * }
 * ```
 * @since 2.0.0
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