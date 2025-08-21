/**
 * DriveHR Manual Trigger - Netlify Function
 *
 * Netlify function that manually triggers the GitHub Actions job scraping
 * workflow via the GitHub API. This provides an on-demand way to
 * initiate job scraping outside of the scheduled runs.
 *
 * **Features:**
 * - GitHub repository workflow dispatch
 * - Optional force sync parameter
 * - Authentication with GitHub API
 * - Webhook signature validation for security
 * - Comprehensive error handling and logging
 *
 * **Security:**
 * - Requires valid webhook signature for authentication
 * - Uses GitHub API tokens for repository access
 * - Rate limiting to prevent abuse
 *
 * **Usage:**
 * - POST /.netlify/functions/manual-trigger
 * - Requires X-Webhook-Signature header
 * - Optional force_sync parameter in request body
 */

import type { Context } from '@netlify/functions';
import { getEnvironmentConfig, getEnvVar } from '../lib/env.js';
import { createLogger, setLogger, getLogger } from '../lib/logger.js';
import { StringUtils, SecurityUtils } from '../lib/utils.js';
import { createHttpClient } from '../lib/http-client.js';
import type { SecurityHeaders } from '../types/api.js';

/**
 * Manual trigger request payload
 */
interface ManualTriggerPayload {
  force_sync?: boolean;
  reason?: string;
  source?: string;
}

/**
 * GitHub workflow dispatch payload
 */
interface GitHubWorkflowDispatch {
  ref: string;
  inputs: {
    force_sync: string;
  };
}

/**
 * Manual trigger result
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
 * Netlify manual trigger function
 *
 * Authenticates requests and triggers the GitHub Actions workflow for
 * job scraping. Provides manual control over the scraping process.
 *
 * @param req - Web standard Request object
 * @param context - Netlify function context
 * @returns Promise<Response> - Trigger result
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
 * Trigger GitHub Actions workflow via repository dispatch
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
      retries: 3,
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
 * Validate webhook HMAC signature for request authentication
 */
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  return SecurityUtils.validateHmacSignature(payload, signature, secret);
}

/**
 * Generate unique request ID for request tracing
 */
function generateRequestId(): string {
  return `trigger_${StringUtils.generateRequestId()}`;
}