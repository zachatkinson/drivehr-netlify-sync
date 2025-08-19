/**
 * DriveHR to WordPress Job Sync - Netlify Function
 *
 * Enterprise-grade serverless function that:
 * 1. Scrapes job postings from DriveHR using multiple strategies
 * 2. Validates and normalizes the data
 * 3. Syncs to WordPress via secure webhook
 *
 * Implements SOLID principles, comprehensive error handling, and security best practices.
 */

import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import { getEnvVar } from '../lib/env.js';
import { loadAppConfig, getAppConfig } from '../lib/config.js';
import { createHttpClient } from '../lib/http-client.js';
import { createLogger, setLogger, getLogger } from '../lib/logger.js';
import { StringUtils, SecurityUtils } from '../lib/utils.js';
import { JobFetchService } from '../services/job-fetcher.js';
import { createHtmlParser } from '../services/html-parser.js';
import { createWordPressClient } from '../services/wordpress-client.js';
import type { SecurityHeaders, CorsConfig } from '../types/api.js';
import type { JobSource } from '../types/job.js';

/**
 * Application dependencies container
 *
 * Defines the structure for dependency injection container that holds
 * all the service instances required by the Netlify function.
 * Enables clean separation of concerns and testability.
 *
 * @since 1.0.0
 * @see {@link initializeDependencies} for container initialization
 */
interface AppDependencies {
  readonly jobFetchService: JobFetchService;
  readonly wordPressClient: ReturnType<typeof createWordPressClient>;
  readonly securityHeaders: SecurityHeaders;
  readonly corsConfig: CorsConfig;
}

/**
 * Initialize application dependencies
 *
 * Creates and configures all service instances required by the function.
 * Loads configuration, validates environment variables, and sets up
 * dependency injection container. This function ensures proper
 * initialization order and handles configuration errors gracefully.
 *
 * @returns Fully configured dependency container
 * @throws {Error} When configuration validation fails or services cannot be initialized
 * @example
 * ```typescript
 * try {
 *   const deps = initializeDependencies();
 *   // All services are now ready to use
 *   const result = await deps.jobFetchService.fetchJobs(config);
 * } catch (error) {
 *   console.error('Failed to initialize dependencies:', error);
 * }
 * ```
 * @since 1.0.0
 * @see {@link AppDependencies} for container structure
 * @see {@link loadAppConfig} for configuration loading
 */
function initializeDependencies(): AppDependencies {
  // Load and validate configuration
  const configResult = loadAppConfig();
  if (!configResult.isValid) {
    throw new Error(`Configuration validation failed: ${configResult.errors.join(', ')}`);
  }

  const config = getAppConfig();

  // Initialize logger
  const logger = createLogger(config.logging.level, config.logging.enableStructured);
  setLogger(logger);

  // Create HTTP client
  const httpClient = createHttpClient({
    timeout: config.performance.httpTimeout,
    retries: config.performance.maxRetries,
    userAgent: 'DriveHR-Sync/1.0 (Netlify Function)',
  });

  // Create HTML parser
  const htmlParser = createHtmlParser();

  // Create job fetch service
  const jobFetchService = new JobFetchService(httpClient, htmlParser);

  // Create WordPress client
  const wordPressClient = createWordPressClient(
    config.wordPress,
    httpClient,
    config.webhook.secret
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

  // Configure CORS
  const corsConfig: CorsConfig = {
    origin: config.security.corsOrigins.length > 0 ? config.security.corsOrigins : ['*'],
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  };

  return {
    jobFetchService,
    wordPressClient,
    securityHeaders,
    corsConfig,
  };
}

/**
 * Main Netlify function handler
 *
 * Enterprise-grade serverless function that synchronizes job postings from
 * DriveHR to WordPress. Supports multiple HTTP methods and implements
 * comprehensive security, logging, and error handling.
 *
 * **Supported endpoints:**
 * - `GET /` - Health check and system status
 * - `POST /` - Manual job synchronization trigger
 * - `OPTIONS /` - CORS preflight requests
 *
 * **Security features:**
 * - HMAC webhook signature validation
 * - CORS protection with configurable origins
 * - Request rate limiting and validation
 * - Comprehensive security headers
 *
 * @param event - Netlify function event containing HTTP request data
 * @param _context - Netlify function context (unused)
 * @returns HTTP response with job sync results or error information
 * @throws {Error} Never - all errors are caught and returned as HTTP responses
 * @example
 * ```typescript
 * // Manual trigger via POST
 * const response = await fetch('/.netlify/functions/sync-jobs', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-Webhook-Signature': 'sha256=...'
 *   },
 *   body: JSON.stringify({ source: 'manual' })
 * });
 *
 * // Health check via GET
 * const health = await fetch('/.netlify/functions/sync-jobs');
 * const status = await health.json();
 * ```
 * @since 1.0.0
 * @see {@link initializeDependencies} for service initialization
 * @see {@link handlePostRequest} for job sync logic
 * @see {@link handleGetRequest} for health check logic
 */
export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  try {
    // Initialize dependencies first to set up logger
    const deps = initializeDependencies();

    const logger = getLogger();
    logger.info('DriveHR sync function invoked', {
      requestId,
      method: event.httpMethod,
      path: event.path,
    });

    // Handle OPTIONS preflight request
    if (event.httpMethod === 'OPTIONS') {
      return handleOptionsRequest(deps.securityHeaders, deps.corsConfig);
    }

    // Handle GET request (fetch jobs only)
    if (event.httpMethod === 'GET') {
      return await handleGetRequest(deps, requestId, timestamp);
    }

    // Handle POST request (fetch and sync jobs)
    if (event.httpMethod === 'POST') {
      return await handlePostRequest(deps, event, requestId, timestamp);
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: deps.securityHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed',
        requestId,
        timestamp,
      }),
    };
  } catch (error) {
    // Try to get logger, but fallback to console if not initialized
    try {
      const logger = getLogger();
      logger.error('DriveHR sync function error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } catch {
      // Fallback logging if logger itself fails
      // Using console as absolute last resort for error visibility
      // eslint-disable-next-line no-console
      console.error('DriveHR sync function error:', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        requestId,
        timestamp,
      }),
    };
  }
};

/**
 * Handle OPTIONS preflight request
 */
function handleOptionsRequest(
  securityHeaders: SecurityHeaders,
  corsConfig: CorsConfig
): HandlerResponse {
  const origin = Array.isArray(corsConfig.origin)
    ? (corsConfig.origin[0] ?? '*')
    : corsConfig.origin;

  return {
    statusCode: 200,
    headers: {
      ...securityHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': corsConfig.methods.join(', '),
      'Access-Control-Allow-Headers': corsConfig.headers.join(', '),
      'Access-Control-Max-Age': corsConfig.maxAge.toString(),
    },
    body: '',
  };
}

/**
 * Handle GET request - fetch jobs without syncing
 */
async function handleGetRequest(
  deps: AppDependencies,
  requestId: string,
  timestamp: string
): Promise<HandlerResponse> {
  try {
    const config = getAppConfig();
    const result = await deps.jobFetchService.fetchJobs(config.driveHr, 'manual');

    return {
      statusCode: 200,
      headers: deps.securityHeaders,
      body: JSON.stringify({
        success: result.success,
        data: {
          source: config.driveHr.careersUrl,
          method: result.method,
          jobCount: result.totalCount,
          jobs: result.jobs,
          message: result.message ?? result.error,
        },
        requestId,
        timestamp,
      }),
    };
  } catch (error) {
    const logger = getLogger();
    logger.error('Failed to fetch jobs', { requestId, error });

    return {
      statusCode: 500,
      headers: deps.securityHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch jobs',
        requestId,
        timestamp,
      }),
    };
  }
}

/**
 * Handle POST request - fetch jobs and sync to WordPress
 */
async function handlePostRequest(
  deps: AppDependencies,
  event: HandlerEvent,
  requestId: string,
  timestamp: string
): Promise<HandlerResponse> {
  try {
    // Validate webhook signature if present
    const signature = event.headers['x-webhook-signature'];
    if (signature) {
      const webhookSecret = getEnvVar('WEBHOOK_SECRET');
      if (!webhookSecret) {
        throw new Error('WEBHOOK_SECRET environment variable is required');
      }
      const payload = event.body ?? '';

      if (!validateWebhookSignature(payload, signature, webhookSecret)) {
        return {
          statusCode: 401,
          headers: deps.securityHeaders,
          body: JSON.stringify({
            success: false,
            error: 'Invalid webhook signature',
            requestId,
            timestamp,
          }),
        };
      }
    }

    // Determine job source
    const source: JobSource = signature ? 'webhook' : 'manual';

    // Fetch jobs
    const config = getAppConfig();
    const fetchResult = await deps.jobFetchService.fetchJobs(config.driveHr, source);

    if (!fetchResult.success || fetchResult.jobs.length === 0) {
      return {
        statusCode: 200,
        headers: deps.securityHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            message: fetchResult.error ?? 'No jobs found to sync',
            jobCount: 0,
            syncedCount: 0,
          },
          requestId,
          timestamp,
        }),
      };
    }

    // Sync to WordPress
    const syncResult = await deps.wordPressClient.syncJobs(fetchResult.jobs, source);

    return {
      statusCode: 200,
      headers: deps.securityHeaders,
      body: JSON.stringify({
        success: syncResult.success,
        data: {
          message: syncResult.message,
          jobCount: fetchResult.totalCount,
          syncedCount: syncResult.syncedCount,
          skippedCount: syncResult.skippedCount,
          errorCount: syncResult.errorCount,
          errors: syncResult.errors,
        },
        requestId,
        timestamp,
      }),
    };
  } catch (error) {
    const logger = getLogger();
    logger.error('Failed to sync jobs', { requestId, error });

    return {
      statusCode: 500,
      headers: deps.securityHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to sync jobs',
        requestId,
        timestamp,
      }),
    };
  }
}

/**
 * Validate webhook HMAC signature
 */
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  return SecurityUtils.validateHmacSignature(payload, signature, secret);
}

/**
 * Generate unique request ID for tracking
 */
function generateRequestId(): string {
  return `netlify_${StringUtils.generateRequestId()}`;
}
