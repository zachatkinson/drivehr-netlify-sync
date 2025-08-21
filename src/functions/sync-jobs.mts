/**
 * DriveHR to WordPress Job Sync - Lightweight Webhook Receiver
 *
 * Lightweight Netlify function that receives job data from GitHub Actions
 * and forwards it to WordPress. This function replaces the heavy scraping
 * logic with a simple webhook receiver that handles data from the new
 * GitHub Actions-based scraping architecture.
 *
 * **Architecture Changes:**
 * - GitHub Actions handles job scraping with Playwright
 * - This function receives scraped data via webhook
 * - Simple validation and forwarding to WordPress
 * - Maintains backward compatibility for manual triggers
 *
 * **Supported endpoints:**
 * - `GET /` - Health check and system status
 * - `POST /` - Receive job data from GitHub Actions or manual trigger
 * - `OPTIONS /` - CORS preflight requests
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
 * Lightweight application dependencies for webhook handling
 */
interface WebhookDependencies {
  readonly wordPressClient: ReturnType<typeof createWordPressClient>;
  readonly securityHeaders: SecurityHeaders;
  readonly corsConfig: CorsConfig;
}

/**
 * Webhook payload structure from GitHub Actions
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
 * Initialize lightweight dependencies for webhook handling
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
 * Modern Netlify webhook receiver function
 *
 * Lightweight serverless function that receives job data from GitHub Actions
 * and forwards it to WordPress. Implements HMAC signature validation for
 * security and provides health check endpoints for monitoring.
 *
 * @param req - Web standard Request object
 * @param context - Netlify function context
 * @returns Promise<Response> - Web standard Response object
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
 * Handle OPTIONS preflight request for CORS
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
 * Handle GET request - health check and system status
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
 * Handle POST request - receive webhook data from GitHub Actions
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
 * Validate webhook HMAC signature for request authentication
 */
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  return SecurityUtils.validateHmacSignature(payload, signature, secret);
}

/**
 * Generate unique request ID for request tracing
 */
function generateRequestId(): string {
  return `webhook_${StringUtils.generateRequestId()}`;
}