/**
 * DriveHR Manual Trigger - Netlify Function
 *
 * Enterprise-grade manual trigger endpoint providing authenticated on-demand activation
 * of GitHub Actions job scraping workflows. This Netlify function serves as a secure
 * webhook endpoint that allows authorized external systems to manually initiate DriveHR
 * job synchronization processes outside of scheduled automated runs.
 *
 * The function implements comprehensive security measures including HMAC webhook signature
 * validation, GitHub API authentication, and structured error handling with detailed
 * logging for operational monitoring and debugging. All requests are validated and
 * tracked with unique request identifiers for correlation across distributed systems.
 *
 * Key Security Features:
 * - HMAC SHA-256 webhook signature validation for request authentication
 * - GitHub Personal Access Token authentication for repository workflow dispatch
 * - Comprehensive security headers enforcement (CSP, XFO, XCTO)
 * - Request payload validation and sanitization
 * - Structured error responses without sensitive information exposure
 *
 * GitHub Actions Integration:
 * - Repository workflow dispatch via GitHub REST API v3
 * - Support for force sync parameter to override caching behavior
 * - Comprehensive error handling for GitHub API rate limits and failures
 * - Detailed workflow trigger logging with response status tracking
 *
 * @example
 * ```bash
 * # Manual trigger with force sync
 * curl -X POST https://your-site.netlify.app/.netlify/functions/manual-trigger \
 *   -H "Content-Type: application/json" \
 *   -H "X-Webhook-Signature: sha256=abc123..." \
 *   -d '{
 *     "force_sync": true,
 *     "reason": "Emergency job update",
 *     "source": "admin-dashboard"
 *   }'
 *
 * # Successful response
 * {
 *   "success": true,
 *   "message": "GitHub Actions workflow triggered successfully",
 *   "github_response": {
 *     "status": 204,
 *     "statusText": "No Content"
 *   },
 *   "timestamp": "2025-08-24T19:30:00.000Z",
 *   "requestId": "trigger_abc123def456"
 * }
 *
 * # Error response (invalid signature)
 * {
 *   "success": false,
 *   "error": "Invalid webhook signature",
 *   "requestId": "trigger_xyz789",
 *   "timestamp": "2025-08-24T19:30:00.000Z"
 * }
 * ```
 *
 * @module manual-trigger-function
 * @since 2.0.0
 * @see {@link ../../lib/utils.js} for HMAC signature validation utilities
 * @see {@link ../../lib/http-client.js} for GitHub API communication
 * @see {@link ../../lib/logger.js} for structured logging capabilities
 */

import type { Context } from '@netlify/functions';
import { getEnvironmentConfig, getEnvVar } from '../lib/env.js';
import { createLogger, setLogger, getLogger } from '../lib/logger.js';
import { StringUtils, SecurityUtils } from '../lib/utils.js';
import { createHttpClient } from '../lib/http-client.js';
import type { SecurityHeaders } from '../types/api.js';

/**
 * Manual trigger request payload structure
 *
 * Defines the optional parameters that can be included in manual trigger requests
 * to control workflow execution behavior and provide operational context for
 * logging and monitoring purposes.
 *
 * @since 2.0.0
 */
interface ManualTriggerPayload {
  force_sync?: boolean;
  reason?: string;
  source?: string;
}

/**
 * GitHub workflow dispatch API payload structure
 *
 * Structured payload format required by GitHub Actions workflow dispatch API
 * for triggering repository workflows programmatically. This interface ensures
 * type-safe interaction with the GitHub REST API v3 workflow dispatch endpoint.
 *
 * @since 2.0.0
 * @see {@link https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event}
 */
interface GitHubWorkflowDispatch {
  ref: string;
  inputs: {
    force_sync: string;
  };
}

/**
 * Manual trigger operation result structure
 *
 * Comprehensive result container providing detailed information about manual
 * trigger execution including success status, GitHub API response details,
 * error information, and operational metadata for monitoring and debugging.
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
/**
 * Netlify manual trigger function handler
 *
 * Main entry point for the manual trigger endpoint providing secure, authenticated
 * activation of GitHub Actions workflows. This function handles all aspects of
 * request validation, authentication, payload processing, and GitHub API integration
 * with comprehensive error handling and operational logging.
 *
 * The function implements enterprise-grade security practices including HMAC signature
 * validation, comprehensive input sanitization, and structured error responses. All
 * operations are tracked with unique request identifiers and logged with appropriate
 * detail levels for operational monitoring and incident response.
 *
 * Authentication Flow:
 * 1. HTTP method validation (POST only)
 * 2. HMAC webhook signature extraction and validation
 * 3. Request payload parsing and validation
 * 4. GitHub API authentication and workflow dispatch
 * 5. Response formatting and logging
 *
 * @param req - Web standard Request object containing HTTP request details and payload
 * @param context - Netlify function execution context with environment access
 * @returns Promise resolving to HTTP Response with trigger results and status
 * @throws {Error} When critical system failures prevent trigger execution
 * @example
 * ```typescript
 * // Netlify function deployment
 * const response = await manualTriggerFunction(request, context);
 *
 * // Success response (status 200)
 * {
 *   success: true,
 *   message: "GitHub Actions workflow triggered successfully",
 *   github_response: { status: 204, statusText: "No Content" },
 *   timestamp: "2025-08-24T19:30:00.000Z",
 *   requestId: "trigger_abc123def456"
 * }
 *
 * // Authentication error (status 401)
 * {
 *   success: false,
 *   error: "Invalid webhook signature",
 *   requestId: "trigger_xyz789",
 *   timestamp: "2025-08-24T19:30:00.000Z"
 * }
 *
 * // GitHub API error (status 500)
 * {
 *   success: false,
 *   message: "Failed to trigger GitHub Actions workflow",
 *   error: "GitHub API error: 401 Unauthorized",
 *   github_response: { status: 401, statusText: "Unauthorized" },
 *   timestamp: "2025-08-24T19:30:00.000Z",
 *   requestId: "trigger_def456ghi789"
 * }
 * ```
 * @since 2.0.0
 */
export default async (req: Request, context: Context): Promise<Response> => {
  const requestId = generateRequestId();
  const timestamp = new Date().toISOString();

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
    // Initialize logger
    const env = getEnvironmentConfig();
    const logger = createLogger(env.logLevel || 'info', env.environment === 'development');
    setLogger(logger);

    logger.info('Manual trigger function invoked', {
      requestId,
      method: req.method,
    });

    // Only support POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed',
        requestId,
        timestamp,
      }), {
        status: 405,
        headers: securityHeaders,
      });
    }

    // Validate webhook signature
    const payload = await req.text();
    const signature = req.headers.get('x-webhook-signature');

    if (!signature) {
      logger.warn('Missing webhook signature', { requestId });
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing webhook signature',
        requestId,
        timestamp,
      }), {
        status: 401,
        headers: securityHeaders,
      });
    }

    if (!env.webhookSecret) {
      logger.error('WEBHOOK_SECRET not configured', { requestId });
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error',
        requestId,
        timestamp,
      }), {
        status: 500,
        headers: securityHeaders,
      });
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
        headers: securityHeaders,
      });
    }

    // Parse request payload
    let triggerPayload: ManualTriggerPayload = {};
    if (payload.trim()) {
      try {
        triggerPayload = JSON.parse(payload);
      } catch (parseError) {
        logger.error('Invalid JSON payload', { requestId, parseError });
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON payload',
          requestId,
          timestamp,
        }), {
          status: 400,
          headers: securityHeaders,
        });
      }
    }

    // Trigger GitHub Actions workflow
    const triggerResult = await triggerGitHubWorkflow(triggerPayload, requestId);

    logger.info('Manual trigger completed', {
      requestId,
      success: triggerResult.success,
      workflowRunId: triggerResult.workflow_run_id,
    });

    const statusCode = triggerResult.success ? 200 : 500;

    return new Response(JSON.stringify(triggerResult), {
      status: statusCode,
      headers: securityHeaders,
    });

  } catch (error) {
    const logger = getLogger();
    logger.error('Manual trigger function error', { requestId, error });

    const errorResult: ManualTriggerResult = {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
      requestId,
    };

    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: securityHeaders,
    });
  }
};

/**
 * Trigger GitHub Actions workflow via repository dispatch API
 *
 * Orchestrates the GitHub Actions workflow dispatch process including environment
 * validation, GitHub API authentication, request formatting, and comprehensive
 * error handling. This function handles all aspects of GitHub API integration
 * with proper retry logic, timeout management, and detailed response processing.
 *
 * The function validates all required GitHub configuration including repository
 * identification, authentication tokens, and workflow file references. It formats
 * requests according to GitHub API specifications and processes responses with
 * appropriate error categorization and logging for operational monitoring.
 *
 * GitHub API Integration:
 * - Repository workflow dispatch endpoint interaction
 * - Bearer token authentication with GitHub Personal Access Token
 * - Workflow input parameter processing and validation
 * - HTTP status code interpretation and error handling
 * - Response metadata extraction and logging
 *
 * @param payload - Manual trigger payload containing workflow execution parameters
 * @param requestId - Unique request identifier for operation tracking and correlation
 * @returns Promise resolving to comprehensive trigger result with status and metadata
 * @throws {Error} When GitHub configuration validation or API communication fails
 * @example
 * ```typescript
 * const result = await triggerGitHubWorkflow(
 *   { force_sync: true, reason: "Emergency update" },
 *   "trigger_abc123"
 * );
 *
 * // Successful workflow trigger
 * {
 *   success: true,
 *   message: "GitHub Actions workflow triggered successfully",
 *   github_response: { status: 204, statusText: "No Content" },
 *   timestamp: "2025-08-24T19:30:00.000Z",
 *   requestId: "trigger_abc123"
 * }
 *
 * // GitHub API authentication error
 * {
 *   success: false,
 *   message: "Failed to trigger GitHub Actions workflow",
 *   error: "GitHub API error: 401 Unauthorized",
 *   github_response: { status: 401, statusText: "Unauthorized" },
 *   timestamp: "2025-08-24T19:30:00.000Z",
 *   requestId: "trigger_abc123"
 * }
 * ```
 * @since 2.0.0
 */
async function triggerGitHubWorkflow(
  payload: ManualTriggerPayload,
  requestId: string
): Promise<ManualTriggerResult> {
  const logger = getLogger();
  const timestamp = new Date().toISOString();

  try {
    // Get environment configuration
    const env = getEnvironmentConfig();
    
    // Validate GitHub configuration
    if (!getEnvVar('GITHUB_TOKEN')) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    if (!getEnvVar('GITHUB_REPOSITORY')) {
      throw new Error('GITHUB_REPOSITORY environment variable is required');
    }

    const [owner, repo] = getEnvVar('GITHUB_REPOSITORY')!.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid GITHUB_REPOSITORY format. Expected: owner/repo');
    }

    // Create HTTP client for GitHub API
    const httpClient = createHttpClient({
      timeout: 30000,
      retries: process.env['ENVIRONMENT'] === 'test' ? 0 : 3,
      userAgent: 'DriveHR-Manual-Trigger/2.0',
    });

    // Prepare workflow dispatch payload
    const workflowDispatch: GitHubWorkflowDispatch = {
      ref: 'main',
      inputs: {
        force_sync: String(payload.force_sync || false),
      },
    };

    // GitHub API endpoint for workflow dispatch
    const workflowFile = 'scrape-jobs.yml';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

    logger.info('Triggering GitHub Actions workflow', {
      requestId,
      repository: getEnvVar('GITHUB_REPOSITORY'),
      workflow: workflowFile,
      forceSync: payload.force_sync,
      reason: payload.reason,
    });

    // Make GitHub API request
    const response = await httpClient.post(apiUrl, workflowDispatch, {
      'Authorization': `Bearer ${getEnvVar('GITHUB_TOKEN')}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    });

    if (response.success) {
      // GitHub workflow dispatch returns 204 No Content on success
      logger.info('GitHub workflow triggered successfully', {
        requestId,
        status: response.status,
      });

      return {
        success: true,
        message: 'GitHub Actions workflow triggered successfully',
        github_response: {
          status: response.status,
          statusText: response.statusText,
        },
        timestamp,
        requestId,
      };
    } else {
      // Handle GitHub API errors
      const errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      logger.error('GitHub workflow trigger failed', {
        requestId,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });

      return {
        success: false,
        message: 'Failed to trigger GitHub Actions workflow',
        error: errorMessage,
        github_response: {
          status: response.status,
          statusText: response.statusText,
        },
        timestamp,
        requestId,
      };
    }

  } catch (error) {
    logger.error('GitHub workflow trigger error', { requestId, error });

    // Extract GitHub API response info from HttpClientError if available
    const result: ManualTriggerResult = {
      success: false,
      message: 'Failed to trigger GitHub Actions workflow',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
      requestId,
    };

    // If this is an HttpClientError with status info, include github_response
    if (error && typeof error === 'object' && 'status' in error && 'statusText' in error) {
      result.github_response = {
        status: error.status as number,
        statusText: error.statusText as string,
      };
    }

    return result;
  }
}

/**
 * Validate HMAC webhook signature for request authentication
 *
 * Performs cryptographic validation of webhook request signatures using HMAC SHA-256
 * to ensure request authenticity and prevent unauthorized access. This function
 * provides the primary security mechanism for the manual trigger endpoint by
 * validating that requests originate from authorized systems with access to the
 * shared webhook secret.
 *
 * The validation process computes the expected HMAC signature using the request
 * payload and shared secret, then performs constant-time comparison with the
 * provided signature to prevent timing attacks. All signature validation failures
 * are logged for security monitoring and incident response.
 *
 * @param payload - Raw request payload string used for signature computation
 * @param signature - Provided HMAC signature from request headers (format: "sha256=hash")
 * @param secret - Shared webhook secret for signature validation
 * @returns True if signature is valid and request is authenticated, false otherwise
 * @example
 * ```typescript
 * const isValid = validateWebhookSignature(
 *   '{"force_sync": true}',
 *   'sha256=a3b2c1d4e5f6...',
 *   'your-webhook-secret'
 * );
 *
 * if (isValid) {
 *   console.log('Request authenticated successfully');
 * } else {
 *   console.warn('Invalid signature - unauthorized request');
 * }
 * ```
 * @since 2.0.0
 */
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  return SecurityUtils.validateHmacSignature(payload, signature, secret);
}

/**
 * Generate unique request identifier for operation tracking
 *
 * Creates unique, traceable request identifiers for correlating operations
 * across distributed systems, logs, and monitoring infrastructure. Request IDs
 * enable end-to-end tracking of manual trigger operations from initial webhook
 * receipt through GitHub workflow dispatch completion.
 *
 * Generated IDs follow a consistent format with "trigger_" prefix for easy
 * identification in logs and monitoring systems, followed by cryptographically
 * secure random identifiers to ensure uniqueness across concurrent requests.
 *
 * @returns Unique request identifier string with "trigger_" prefix
 * @example
 * ```typescript
 * const requestId = generateRequestId();
 * console.log(requestId); // "trigger_abc123def456ghi789"
 *
 * // Use in logging for request correlation
 * logger.info('Processing manual trigger', { requestId });
 * logger.info('GitHub workflow dispatched', { requestId, status: 204 });
 * ```
 * @since 2.0.0
 */
function generateRequestId(): string {
  return `trigger_${StringUtils.generateRequestId()}`;
}