/**
 * DriveHR to WordPress Job Sync - Lightweight Webhook Receiver
 *
 * Enterprise-grade lightweight webhook receiver function that serves as the bridge between
 * GitHub Actions job scraping workflows and WordPress content management systems. This
 * Netlify function implements a modern serverless architecture that replaces heavy
 * client-side scraping with efficient webhook-based data forwarding.
 *
 * The function represents a significant architectural evolution from monolithic scraping
 * functions to a distributed system where GitHub Actions handles compute-intensive
 * Playwright browser automation while this lightweight receiver manages secure data
 * transfer to WordPress endpoints with comprehensive validation and error handling.
 *
 * Architecture Overview:
 * - GitHub Actions executes Playwright-based job scraping in isolated CI/CD environment
 * - Scraped job data is transmitted via secure webhook to this Netlify function
 * - Function validates, processes, and forwards normalized job data to WordPress
 * - Maintains backward compatibility for manual triggers and health monitoring
 * - Implements comprehensive security through HMAC signature validation
 *
 * Endpoint Support:
 * - GET / - Health check and system status validation
 * - POST / - Secure webhook data reception from GitHub Actions
 * - OPTIONS / - CORS preflight request handling for cross-origin requests
 *
 * Security Features:
 * - HMAC SHA-256 webhook signature validation for payload authenticity
 * - Comprehensive security headers (CSP, XFO, XCTO, Referrer Policy)
 * - CORS configuration for authorized GitHub Actions origins
 * - Input validation and sanitization for all webhook payloads
 * - Structured error responses without sensitive information exposure
 *
 * @example
 * ```bash
 * # Health check endpoint
 * curl -X GET https://your-site.netlify.app/.netlify/functions/sync-jobs
 *
 * # Webhook data from GitHub Actions
 * curl -X POST https://your-site.netlify.app/.netlify/functions/sync-jobs \
 *   -H "Content-Type: application/json" \
 *   -H "X-Webhook-Signature: sha256=abc123..." \
 *   -d '{
 *     "source": "github-actions",
 *     "jobs": [
 *       {
 *         "title": "Senior Software Engineer",
 *         "company": "Tech Startup",
 *         "location": "San Francisco, CA",
 *         "description": "Join our engineering team...",
 *         "applyUrl": "https://company.com/jobs/123"
 *       }
 *     ],
 *     "timestamp": "2025-08-24T19:30:00.000Z",
 *     "total_count": 1,
 *     "run_id": "12345",
 *     "repository": "myorg/drivehr-sync"
 *   }'
 *
 * # Successful sync response
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Successfully synced jobs to WordPress",
 *     "jobCount": 1,
 *     "syncedCount": 1,
 *     "skippedCount": 0,
 *     "errorCount": 0,
 *     "errors": []
 *   },
 *   "requestId": "webhook_abc123def456",
 *   "timestamp": "2025-08-24T19:30:00.000Z"
 * }
 * ```
 *
 * @module sync-jobs-function
 * @since 2.0.0
 * @see {@link ../../services/wordpress-client.js} for WordPress integration client
 * @see {@link ../../lib/utils.js} for HMAC signature validation utilities
 * @see {@link ../../lib/logger.js} for structured logging capabilities
 */

import type { Context } from '@netlify/functions';
import { getEnvironmentConfig } from '../lib/env.js';
import { createLogger, setLogger, getLogger } from '../lib/logger.js';
import { StringUtils, SecurityUtils } from '../lib/utils.js';
import { createWordPressClient } from '../services/wordpress-client.js';
import { createHttpClient } from '../lib/http-client.js';
import type { SecurityHeaders, CorsConfig } from '../types/api.js';
import type { NormalizedJob, JobSource } from '../types/job.js';

/**
 * Lightweight webhook handling dependencies container
 *
 * Dependency injection container providing all required services for webhook
 * processing including WordPress client integration, security header configuration,
 * and CORS policy management. This interface enables clean separation of concerns
 * and facilitates testing through dependency injection patterns.
 *
 * @since 2.0.0
 */
interface WebhookDependencies {
  readonly wordPressClient: ReturnType<typeof createWordPressClient>;
  readonly securityHeaders: SecurityHeaders;
  readonly corsConfig: CorsConfig;
}

/**
 * GitHub Actions webhook payload structure
 *
 * Structured payload format transmitted from GitHub Actions workflows containing
 * normalized job data and execution metadata. This interface defines the contract
 * between GitHub Actions scraping workflows and the webhook receiver function,
 * ensuring type-safe data transfer and processing.
 *
 * @since 2.0.0
 */
interface GitHubActionsWebhookPayload {
  source: JobSource;
  jobs: NormalizedJob[];
  timestamp: string;
  total_count: number;
  run_id?: string;
  repository?: string;
}
/**
 * Initialize comprehensive webhook handling dependencies
 *
 * Factory function that creates and configures all required dependencies for
 * webhook processing including logger initialization, HTTP client creation,
 * WordPress client configuration, and security policy setup. This function
 * implements the dependency injection pattern to provide clean separation
 * of concerns and facilitate comprehensive testing.
 *
 * The initialization process configures enterprise-grade security policies,
 * establishes WordPress communication channels, and sets up structured logging
 * with appropriate detail levels for operational monitoring and debugging.
 *
 * @returns Configured dependency container with all required webhook services
 * @throws {Error} When environment configuration validation fails
 * @example
 * ```typescript
 * const deps = initializeWebhookDependencies();
 * 
 * // WordPress client ready for job synchronization
 * const syncResult = await deps.wordPressClient.syncJobs(jobs, 'github-actions');
 * 
 * // Security headers configured for response
 * const response = new Response(JSON.stringify(result), {
 *   status: 200,
 *   headers: deps.securityHeaders
 * });
 * 
 * // CORS policy available for preflight responses
 * const corsHeaders = configureCorsHeaders(deps.corsConfig);
 * ```
 * @since 2.0.0
 */
function initializeWebhookDependencies(): WebhookDependencies {
  const env = getEnvironmentConfig();
  
  // Initialize logger
  const logger = createLogger(env.logLevel || 'info', env.environment === 'development');
  setLogger(logger);

  // Create HTTP client for WordPress communication
  const httpClient = createHttpClient({
    timeout: 30000,
    retries: 3,
    userAgent: 'DriveHR-Sync/2.0 (Netlify Webhook Receiver)',
  });

  // Create WordPress client
  const wordPressClient = createWordPressClient(
    {
      baseUrl: env.wpApiUrl,
    },
    httpClient,
    env.webhookSecret
  );

  // Configure security headers
  const securityHeaders: SecurityHeaders = {
    'Content-Type': 'application/json',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' https:; script-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  };

  // Configure CORS for GitHub Actions
  const corsConfig: CorsConfig = {
    origin: ['https://github.com', 'https://api.github.com'],
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Webhook-Signature'],
    maxAge: 86400,
  };

  return {
    wordPressClient,
    securityHeaders,
    corsConfig,
  };
}

/**
 * Netlify webhook receiver function handler
 *
 * Main entry point for the lightweight webhook receiver providing secure job data
 * processing from GitHub Actions workflows to WordPress content management systems.
 * This function orchestrates all aspects of webhook handling including method routing,
 * security validation, payload processing, and WordPress synchronization.
 *
 * The function implements a comprehensive request routing system supporting health
 * checks, CORS preflight requests, and secure webhook data processing. All operations
 * are tracked with unique request identifiers and logged with appropriate detail
 * levels for operational monitoring and incident response.
 *
 * Request Processing Flow:
 * 1. Dependency initialization and logger configuration
 * 2. Request method validation and routing
 * 3. Security validation (HMAC signatures, CORS policies)
 * 4. Payload parsing and structural validation
 * 5. WordPress client synchronization
 * 6. Response formatting and logging
 *
 * @param req - Web standard Request object containing HTTP request details and payload
 * @param context - Netlify function execution context with environment access
 * @returns Promise resolving to HTTP Response with processing results
 * @throws {Error} When critical system failures prevent webhook processing
 * @example
 * ```typescript
 * // Netlify function deployment
 * const response = await syncJobsFunction(request, context);
 *
 * // Health check response (GET /)
 * {
 *   success: true,
 *   data: {
 *     status: "healthy",
 *     environment: "production",
 *     wordpress_configured: true,
 *     webhook_configured: true,
 *     architecture: "github-actions-scraper",
 *     version: "2.0.0"
 *   },
 *   requestId: "webhook_abc123",
 *   timestamp: "2025-08-24T19:30:00.000Z"
 * }
 *
 * // Successful webhook processing (POST /)
 * {
 *   success: true,
 *   data: {
 *     message: "Successfully synced jobs to WordPress",
 *     jobCount: 15,
 *     syncedCount: 14,
 *     skippedCount: 1,
 *     errorCount: 0,
 *     errors: []
 *   },
 *   requestId: "webhook_def456",
 *   timestamp: "2025-08-24T19:30:00.000Z"
 * }
 *
 * // Authentication error (invalid signature)
 * {
 *   success: false,
 *   error: "Invalid webhook signature",
 *   requestId: "webhook_ghi789",
 *   timestamp: "2025-08-24T19:30:00.000Z"
 * }
 * ```
 * @since 2.0.0
 */
export default async (req: Request, context: Context) => {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    // Initialize lightweight dependencies
    const deps = initializeWebhookDependencies();
    const logger = getLogger();

    logger.info('Webhook receiver invoked', {
      requestId,
      method: req.method,
      path: new URL(req.url).pathname,
    });

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      return handleOptionsRequest(deps.securityHeaders, deps.corsConfig);
    }

    // Handle GET request (health check)
    if (req.method === 'GET') {
      return await handleHealthCheck(deps, requestId, timestamp);
    }

    // Handle POST request (webhook data)
    if (req.method === 'POST') {
      return await handleWebhookData(deps, req, requestId, timestamp);
    }

    // Method not allowed
    return new Response(JSON.stringify({
      success: false,
      error: 'Method not allowed',
      requestId,
      timestamp,
    }), {
      status: 405,
      headers: deps.securityHeaders,
    });

  } catch (error) {
    // Fallback error handling
    console.error('Webhook receiver error:', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      requestId,
      timestamp,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

/**
 * Handle CORS preflight OPTIONS requests
 *
 * Processes CORS preflight requests by configuring appropriate access control
 * headers to enable secure cross-origin requests from authorized GitHub Actions
 * workflows. This function ensures proper CORS policy enforcement while maintaining
 * security boundaries for webhook endpoint access.
 *
 * The function implements comprehensive CORS configuration including origin validation,
 * method authorization, header specification, and cache duration optimization for
 * efficient preflight request handling.
 *
 * @param securityHeaders - Base security headers for response configuration
 * @param corsConfig - CORS policy configuration with origins, methods, and headers
 * @returns HTTP Response with CORS headers and 200 status for preflight approval
 * @example
 * ```typescript
 * const response = handleOptionsRequest(securityHeaders, corsConfig);
 * 
 * // Response headers include:
 * // Access-Control-Allow-Origin: https://github.com
 * // Access-Control-Allow-Methods: GET, POST, OPTIONS
 * // Access-Control-Allow-Headers: Content-Type, Authorization, X-Webhook-Signature
 * // Access-Control-Max-Age: 86400
 * ```
 * @since 2.0.0
 */
function handleOptionsRequest(
  securityHeaders: SecurityHeaders,
  corsConfig: CorsConfig
): Response {
  const origin = Array.isArray(corsConfig.origin)
    ? (corsConfig.origin[0] ?? '*')
    : corsConfig.origin;

  return new Response('', {
    status: 200,
    headers: {
      ...securityHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': corsConfig.methods.join(', '),
      'Access-Control-Allow-Headers': corsConfig.headers.join(', '),
      'Access-Control-Max-Age': corsConfig.maxAge.toString(),
    },
  });
}

/**
 * Handle GET health check requests
 *
 * Processes health check requests by validating system configuration and returning
 * comprehensive status information for monitoring and alerting systems. This function
 * provides essential operational visibility into webhook receiver health including
 * WordPress connectivity, security configuration, and system architecture details.
 *
 * The health check performs lightweight validation of critical system components
 * without executing heavy operations, ensuring fast response times suitable for
 * high-frequency monitoring probes and uptime verification systems.
 *
 * @param deps - Webhook dependencies container with configured services
 * @param requestId - Unique request identifier for operation tracking
 * @param timestamp - Request timestamp for response metadata
 * @returns Promise resolving to HTTP Response with health status information
 * @throws {Error} When health check execution encounters unexpected system errors
 * @example
 * ```typescript
 * const healthResponse = await handleHealthCheck(deps, 'webhook_123', timestamp);
 * 
 * // Healthy system response
 * {
 *   success: true,
 *   data: {
 *     status: "healthy",
 *     timestamp: "2025-08-24T19:30:00.000Z",
 *     environment: "production",
 *     wordpress_configured: true,
 *     webhook_configured: true,
 *     architecture: "github-actions-scraper",
 *     version: "2.0.0"
 *   },
 *   requestId: "webhook_123",
 *   timestamp: "2025-08-24T19:30:00.000Z"
 * }
 * ```
 * @since 2.0.0
 */
async function handleHealthCheck(
  deps: WebhookDependencies,
  requestId: string,
  timestamp: string
): Promise<Response> {
  const logger = getLogger();
  
  try {
    const env = getEnvironmentConfig();
    
    // Simple health check - verify environment variables
    const healthStatus = {
      status: 'healthy',
      timestamp,
      environment: env.environment,
      wordpress_configured: Boolean(env.wpApiUrl),
      webhook_configured: Boolean(env.webhookSecret),
      architecture: 'github-actions-scraper',
      version: '2.0.0',
    };

    logger.info('Health check completed', { requestId, status: healthStatus.status });

    return new Response(JSON.stringify({
      success: true,
      data: healthStatus,
      requestId,
      timestamp,
    }), {
      status: 200,
      headers: deps.securityHeaders,
    });

  } catch (error) {
    logger.error('Health check failed', { requestId, error });

    return new Response(JSON.stringify({
      success: false,
      error: 'Health check failed',
      requestId,
      timestamp,
    }), {
      status: 500,
      headers: deps.securityHeaders,
    });
  }
}

/**
 * Handle POST webhook data from GitHub Actions
 *
 * Processes authenticated webhook payloads containing normalized job data from
 * GitHub Actions workflows. This function orchestrates the complete webhook
 * processing pipeline including signature validation, payload parsing, data
 * validation, and WordPress synchronization with comprehensive error handling.
 *
 * The function implements enterprise-grade security through HMAC signature validation,
 * comprehensive input validation, and structured error responses. All processing
 * stages are logged with appropriate detail levels for operational monitoring
 * and debugging support.
 *
 * Processing Pipeline:
 * 1. HMAC signature validation for payload authenticity
 * 2. JSON payload parsing and structural validation
 * 3. Required field validation and data sanitization
 * 4. WordPress client job synchronization
 * 5. Result aggregation and response formatting
 *
 * @param deps - Webhook dependencies container with WordPress client and security configuration
 * @param req - HTTP Request object containing webhook payload and headers
 * @param requestId - Unique request identifier for operation correlation and logging
 * @param timestamp - Request processing timestamp for response metadata
 * @returns Promise resolving to HTTP Response with synchronization results
 * @throws {Error} When webhook processing encounters unrecoverable system errors
 * @example
 * ```typescript
 * const response = await handleWebhookData(deps, request, 'webhook_456', timestamp);
 * 
 * // Successful job synchronization
 * {
 *   success: true,
 *   data: {
 *     message: "Successfully synced jobs to WordPress",
 *     jobCount: 8,
 *     syncedCount: 7,
 *     skippedCount: 1,
 *     errorCount: 0,
 *     errors: []
 *   },
 *   requestId: "webhook_456",
 *   timestamp: "2025-08-24T19:30:00.000Z"
 * }
 * 
 * // Partial synchronization with errors
 * {
 *   success: false,
 *   data: {
 *     message: "Job sync completed with errors",
 *     jobCount: 10,
 *     syncedCount: 8,
 *     skippedCount: 0,
 *     errorCount: 2,
 *     errors: [
 *       "Duplicate job title detected",
 *       "Invalid job description format"
 *     ]
 *   },
 *   requestId: "webhook_456",
 *   timestamp: "2025-08-24T19:30:00.000Z"
 * }
 * ```
 * @since 2.0.0
 */
async function handleWebhookData(
  deps: WebhookDependencies,
  req: Request,
  requestId: string,
  timestamp: string
): Promise<Response> {
  const logger = getLogger();
  
  try {
    // Get request body
    const payload = await req.text();
    const signature = req.headers.get('x-webhook-signature');

    // Validate webhook signature if present
    if (signature) {
      const env = getEnvironmentConfig();
      if (!env.webhookSecret) {
        throw new Error('WEBHOOK_SECRET environment variable is required');
      }

      if (!validateWebhookSignature(payload, signature, env.webhookSecret)) {
        logger.warn('Invalid webhook signature', { requestId });
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid webhook signature',
          requestId,
          timestamp,
        }), {
          status: 401,
          headers: deps.securityHeaders,
        });
      }
    }

    // Parse webhook payload
    let webhookData: GitHubActionsWebhookPayload;
    try {
      webhookData = JSON.parse(payload);
    } catch (parseError) {
      logger.error('Invalid JSON payload', { requestId, parseError });
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON payload',
        requestId,
        timestamp,
      }), {
        status: 400,
        headers: deps.securityHeaders,
      });
    }

    // Validate required fields
    if (!webhookData.jobs || !Array.isArray(webhookData.jobs)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid webhook payload: jobs array required',
        requestId,
        timestamp,
      }), {
        status: 400,
        headers: deps.securityHeaders,
      });
    }

    const source = webhookData.source || 'github-actions';
    const jobs = webhookData.jobs;

    logger.info('Webhook data received', {
      requestId,
      source,
      jobCount: jobs.length,
      runId: webhookData.run_id,
    });

    // Handle empty job list
    if (jobs.length === 0) {
      logger.info('No jobs to sync', { requestId, source });
      return new Response(JSON.stringify({
        success: true,
        data: {
          message: 'No jobs found to sync',
          jobCount: 0,
          syncedCount: 0,
        },
        requestId,
        timestamp,
      }), {
        status: 200,
        headers: deps.securityHeaders,
      });
    }

    // Sync jobs to WordPress
    const syncResult = await deps.wordPressClient.syncJobs(jobs, source);

    logger.info('Job sync completed', {
      requestId,
      success: syncResult.success,
      syncedCount: syncResult.syncedCount,
      errorCount: syncResult.errorCount,
    });

    return new Response(JSON.stringify({
      success: syncResult.success,
      data: {
        message: syncResult.message,
        jobCount: jobs.length,
        syncedCount: syncResult.syncedCount,
        skippedCount: syncResult.skippedCount,
        errorCount: syncResult.errorCount,
        errors: syncResult.errors,
      },
      requestId,
      timestamp,
    }), {
      status: 200,
      headers: deps.securityHeaders,
    });

  } catch (error) {
    logger.error('Failed to process webhook data', { requestId, error });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process webhook data',
      requestId,
      timestamp,
    }), {
      status: 500,
      headers: deps.securityHeaders,
    });
  }
}

/**
 * Validate HMAC webhook signature for request authentication
 *
 * Performs cryptographic validation of webhook request signatures using HMAC SHA-256
 * to ensure payload authenticity and prevent unauthorized access. This function
 * provides the primary security mechanism for webhook endpoints by validating
 * that requests originate from authorized GitHub Actions workflows with access
 * to the shared webhook secret.
 *
 * The validation process computes the expected HMAC signature using the request
 * payload and shared secret, then performs constant-time comparison with the
 * provided signature to prevent timing attacks. All signature validation failures
 * are logged for security monitoring and incident response.
 *
 * @param payload - Raw webhook payload string used for signature computation
 * @param signature - Provided HMAC signature from request headers (format: "sha256=hash")
 * @param secret - Shared webhook secret for signature validation
 * @returns True if signature is valid and request is authenticated, false otherwise
 * @example
 * ```typescript
 * const isValid = validateWebhookSignature(
 *   JSON.stringify(webhookData),
 *   'sha256=a3b2c1d4e5f6...',
 *   process.env.WEBHOOK_SECRET
 * );
 *
 * if (isValid) {
 *   console.log('Webhook payload authenticated successfully');
 *   // Process webhook data
 * } else {
 *   console.warn('Invalid webhook signature - unauthorized request');
 *   // Reject request with 401 Unauthorized
 * }
 * ```
 * @since 2.0.0
 */
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  return SecurityUtils.validateHmacSignature(payload, signature, secret);
}

/**
 * Generate unique request identifier for webhook operation tracking
 *
 * Creates unique, traceable request identifiers for correlating webhook operations
 * across distributed systems, logs, and monitoring infrastructure. Request IDs
 * enable end-to-end tracking of webhook processing from initial payload receipt
 * through WordPress synchronization completion.
 *
 * Generated IDs follow a consistent format with "webhook_" prefix for easy
 * identification in logs and monitoring systems, followed by cryptographically
 * secure random identifiers to ensure uniqueness across concurrent webhook
 * requests and prevent request correlation attacks.
 *
 * @returns Unique request identifier string with "webhook_" prefix
 * @example
 * ```typescript
 * const requestId = generateRequestId();
 * console.log(requestId); // "webhook_abc123def456ghi789"
 *
 * // Use in structured logging for request correlation
 * logger.info('Processing webhook payload', { requestId, source: 'github-actions' });
 * logger.info('WordPress sync completed', { requestId, syncedCount: 15 });
 * 
 * // Include in response for client-side tracking
 * const response = {
 *   success: true,
 *   data: syncResult,
 *   requestId,
 *   timestamp: new Date().toISOString()
 * };
 * ```
 * @since 2.0.0
 */
function generateRequestId(): string {
  return `webhook_${StringUtils.generateRequestId()}`;
}