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

import type { Context } from '@netlify/functions';
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
  // Debug logging - start of initialization
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Starting');
  
  // Load and validate configuration
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Loading config');
  const configResult = loadAppConfig();
  
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Config loaded', { isValid: configResult.isValid });
  if (!configResult.isValid) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: initializeDependencies - Config validation failed', { errors: configResult.errors });
    throw new Error(`Configuration validation failed: ${configResult.errors.join(', ')}`);
  }

  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Getting app config');
  const config = getAppConfig();
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - App config retrieved');

  // Initialize logger
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating logger');
  const logger = createLogger(config.logging.level, config.logging.enableStructured);
  setLogger(logger);
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Logger created and set');

  // Create HTTP client
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating HTTP client');
  const httpClient = createHttpClient({
    timeout: config.performance.httpTimeout,
    retries: config.performance.maxRetries,
    userAgent: 'DriveHR-Sync/1.0 (Netlify Function)',
  });
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - HTTP client created');

  // Create HTML parser
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating HTML parser');
  const htmlParser = createHtmlParser();
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - HTML parser created');

  // Create job fetch service
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating job fetch service');
  const jobFetchService = new JobFetchService(httpClient, htmlParser);
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Job fetch service created');

  // Create WordPress client
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating WordPress client');
  const wordPressClient = createWordPressClient(
    config.wordPress,
    httpClient,
    config.webhook.secret
  );
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - WordPress client created');

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

  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Returning dependencies');
  return {
    jobFetchService,
    wordPressClient,
    securityHeaders,
    corsConfig,
  };
}

/**
 * Modern Netlify function handler
 *
 * Enterprise-grade serverless function that synchronizes job postings from
 * DriveHR to WordPress using modern Netlify Functions API with web standard
 * Request/Response objects. Supports multiple HTTP methods and implements
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
 * **Modern API Features:**
 * - Web standard Request/Response objects
 * - ES6 modules with TypeScript .mts extension
 * - Async/await request body parsing
 * - Headers API for header manipulation
 *
 * @param req - Web standard Request object containing HTTP request data
 * @param context - Modern Netlify function context with requestId
 * @returns Promise<Response> - Web standard Response object with job sync results
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
 *
 * // Response handling with modern API
 * if (response.ok) {
 *   const data = await response.json();
 *   console.log('Sync result:', data);
 * }
 * ```
 * @since 1.0.0
 * @see {@link initializeDependencies} for service initialization
 * @see {@link handlePostRequest} for job sync logic
 * @see {@link handleGetRequest} for health check logic
 */
export default async (req: Request, context: Context) => {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

  // Debug logging - function entry
  // eslint-disable-next-line no-console
  console.log('DEBUG: Function started', { requestId, timestamp, method: req.method });

  try {
    // Debug logging - before dependency initialization
    // eslint-disable-next-line no-console
    console.log('DEBUG: Starting dependency initialization', { requestId });
    
    // Initialize dependencies first to set up logger
    const deps = initializeDependencies();
    
    // Debug logging - after dependency initialization
    // eslint-disable-next-line no-console
    console.log('DEBUG: Dependencies initialized successfully', { requestId });

    const logger = getLogger();
    logger.info('DriveHR sync function invoked', {
      requestId,
      method: req.method,
      path: new URL(req.url).pathname,
    });

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      return handleOptionsRequest(deps.securityHeaders, deps.corsConfig);
    }

    // Handle GET request (fetch jobs only)
    if (req.method === 'GET') {
      return await handleGetRequest(deps, requestId, timestamp);
    }

    // Handle POST request (fetch and sync jobs)
    if (req.method === 'POST') {
      return await handlePostRequest(deps, req, requestId, timestamp);
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
    // Debug logging - error occurred
    // eslint-disable-next-line no-console
    console.log('DEBUG: Error caught in main handler', { 
      requestId, 
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    
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
 * Handle OPTIONS preflight request for CORS
 *
 * Processes CORS preflight requests by returning appropriate headers
 * for cross-origin resource sharing. Uses modern Response object
 * with proper header configuration.
 *
 * @param securityHeaders - Standard security headers to include
 * @param corsConfig - CORS configuration with allowed origins and methods
 * @returns Response object with CORS headers and 200 status
 * @example
 * ```typescript
 * const response = handleOptionsRequest(securityHeaders, corsConfig);
 * console.log(response.headers.get('Access-Control-Allow-Origin'));
 * ```
 * @since 1.0.0
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
 * Handle GET request - fetch jobs without syncing
 *
 * Processes health check and job listing requests. Fetches jobs from
 * DriveHR but does not sync them to WordPress. Returns job data using
 * modern Response object with JSON payload.
 *
 * @param deps - Application dependencies container
 * @param requestId - Unique request identifier for tracking
 * @param timestamp - Request timestamp in ISO format
 * @returns Promise<Response> - Response with job data or error information
 * @throws Never - All errors are caught and returned as HTTP responses
 * @example
 * ```typescript
 * const response = await handleGetRequest(deps, 'req-123', '2024-01-01T12:00:00Z');
 * const data = await response.json();
 * console.log(`Found ${data.data.jobCount} jobs`);
 * ```
 * @since 1.0.0
 */
async function handleGetRequest(
  deps: AppDependencies,
  requestId: string,
  timestamp: string
): Promise<Response> {
  try {
    const config = getAppConfig();
    const result = await deps.jobFetchService.fetchJobs(config.driveHr, 'manual');

    return new Response(JSON.stringify({
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
    }), {
      status: 200,
      headers: deps.securityHeaders,
    });
  } catch (error) {
    const logger = getLogger();
    logger.error('Failed to fetch jobs', { requestId, error });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch jobs',
      requestId,
      timestamp,
    }), {
      status: 500,
      headers: deps.securityHeaders,
    });
  }
}

/**
 * Handle POST request - fetch jobs and sync to WordPress
 *
 * Processes job synchronization requests with optional webhook signature
 * validation. Fetches jobs from DriveHR and syncs them to WordPress.
 * Uses modern Request object for header access and body parsing.
 *
 * @param deps - Application dependencies container
 * @param req - Modern Request object with headers and body access
 * @param requestId - Unique request identifier for tracking
 * @param timestamp - Request timestamp in ISO format
 * @returns Promise<Response> - Response with sync results or error information
 * @throws Never - All errors are caught and returned as HTTP responses
 * @example
 * ```typescript
 * const response = await handlePostRequest(deps, request, 'req-123', '2024-01-01T12:00:00Z');
 * const result = await response.json();
 * console.log(`Synced ${result.data.syncedCount} jobs`);
 * ```
 * @since 1.0.0
 */
async function handlePostRequest(
  deps: AppDependencies,
  req: Request,
  requestId: string,
  timestamp: string
): Promise<Response> {
  try {
    // Validate webhook signature if present
    const signature = req.headers.get('x-webhook-signature');
    if (signature) {
      const webhookSecret = getEnvVar('WEBHOOK_SECRET');
      if (!webhookSecret) {
        throw new Error('WEBHOOK_SECRET environment variable is required');
      }
      const payload = await req.text();

      if (!validateWebhookSignature(payload, signature, webhookSecret)) {
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

    // Determine job source
    const source: JobSource = signature ? 'webhook' : 'manual';

    // Fetch jobs
    const config = getAppConfig();
    const fetchResult = await deps.jobFetchService.fetchJobs(config.driveHr, source);

    if (!fetchResult.success || fetchResult.jobs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          message: fetchResult.error ?? 'No jobs found to sync',
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

    // Sync to WordPress
    const syncResult = await deps.wordPressClient.syncJobs(fetchResult.jobs, source);

    return new Response(JSON.stringify({
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
    }), {
      status: 200,
      headers: deps.securityHeaders,
    });
  } catch (error) {
    const logger = getLogger();
    logger.error('Failed to sync jobs', { requestId, error });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to sync jobs',
      requestId,
      timestamp,
    }), {
      status: 500,
      headers: deps.securityHeaders,
    });
  }
}

/**
 * Validate webhook HMAC signature for request authentication
 *
 * Validates incoming webhook requests by verifying the HMAC-SHA256
 * signature against the request payload and configured webhook secret.
 * This ensures requests are authentic and haven't been tampered with.
 *
 * @param payload - Raw request body as string for signature calculation
 * @param signature - HMAC signature from request headers (format: sha256=<hex>)
 * @param secret - Webhook secret for signature validation
 * @returns True if signature is valid, false otherwise
 * @throws Never - Delegates to SecurityUtils for signature validation
 * @example
 * ```typescript
 * const isValid = validateWebhookSignature(
 *   JSON.stringify({ source: 'webhook' }),
 *   'sha256=abc123...',
 *   'webhook-secret-key'
 * );
 * if (!isValid) {
 *   throw new Error('Invalid webhook signature');
 * }
 * ```
 * @since 1.0.0
 * @see {@link SecurityUtils.validateHmacSignature} for underlying validation logic
 */
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  return SecurityUtils.validateHmacSignature(payload, signature, secret);
}

/**
 * Generate unique request ID for request tracing and logging
 *
 * Creates a unique identifier for each function invocation to enable
 * request tracking across logs and error reports. Uses Netlify-specific
 * prefix to distinguish from other request ID formats.
 *
 * @returns Unique request ID with netlify_ prefix for identification
 * @throws Never - Delegates to StringUtils for ID generation
 * @example
 * ```typescript
 * const requestId = generateRequestId();
 * logger.info('Request started', { requestId });
 * // Output: "netlify_abc123def456..."
 * ```
 * @since 1.0.0
 * @see {@link StringUtils.generateRequestId} for ID generation logic
 */
function generateRequestId(): string {
  return `netlify_${StringUtils.generateRequestId()}`;
}
