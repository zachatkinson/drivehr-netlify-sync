/**
 * WordPress Webhook Client
 *
 * Enterprise-grade secure client for sending job data to WordPress via webhook
 * with HMAC signature verification. Implements comprehensive error handling,
 * request tracking, and proper authentication for reliable job synchronization.
 *
 * Features include:
 * - HMAC-SHA256 signature verification for webhook security
 * - Comprehensive error handling and logging
 * - Request ID tracking for debugging and monitoring
 * - Health check functionality for system monitoring
 * - Type-safe job data synchronization
 *
 * @module wordpress-client
 * @since 1.0.0
 * @see {@link IWordPressClient} for the client interface
 * @see {@link createWordPressClient} for the factory function
 * @see {@link validateWebhookSignature} for signature validation utility
 */

import { getLogger } from '../lib/logger.js';
import { StringUtils, SecurityUtils } from '../lib/utils.js';
import type { IHttpClient } from '../lib/http-client.js';
import type { NormalizedJob, JobSyncRequest, JobSyncResponse, JobSource } from '../types/job.js';
import type { WordPressApiConfig } from '../types/api.js';

/**
 * WordPress webhook client interface
 *
 * Defines the contract for WordPress integration clients that handle
 * job synchronization and health checking. Enables dependency injection
 * and testing with mock implementations.
 *
 * @example
 * ```typescript
 * class MockWordPressClient implements IWordPressClient {
 *   async syncJobs(jobs: NormalizedJob[], source: JobSource): Promise<JobSyncResponse> {
 *     return {
 *       success: true,
 *       syncedCount: jobs.length,
 *       skippedCount: 0,
 *       errorCount: 0,
 *       message: 'Mock sync completed',
 *       errors: [],
 *       processedAt: new Date().toISOString()
 *     };
 *   }
 *
 *   async healthCheck(): Promise<boolean> {
 *     return true;
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link WordPressWebhookClient} for the production implementation
 */
export interface IWordPressClient {
  /**
   * Synchronize jobs to WordPress
   * @param jobs - Array of normalized job data to sync
   * @param source - Source identifier for tracking job origin
   * @returns Promise resolving to sync result with success status and statistics
   */
  syncJobs(jobs: readonly NormalizedJob[], source: JobSource): Promise<JobSyncResponse>;

  /**
   * Perform health check against WordPress endpoint
   * @returns Promise resolving to true if WordPress is healthy and accessible
   */
  healthCheck(): Promise<boolean>;
}

/**
 * WordPress webhook client implementation
 *
 * Production-ready implementation of the IWordPressClient interface that
 * provides secure, reliable job synchronization with WordPress via webhooks.
 * Includes comprehensive error handling, request tracking, and HMAC signature
 * verification for enhanced security.
 *
 * @implements {IWordPressClient}
 * @example
 * ```typescript
 * const config = {
 *   baseUrl: 'https://mysite.com/wp-json/drivehr/v1/sync',
 *   token: 'wp_auth_token',
 *   timeout: 30000,
 *   retries: 3
 * };
 *
 * const client = new WordPressWebhookClient(
 *   config,
 *   httpClient,
 *   'webhook-secret-key'
 * );
 *
 * const result = await client.syncJobs(jobs, 'webhook');
 * if (result.success) {
 *   console.log(`Synced ${result.syncedCount} jobs successfully`);
 * }
 * ```
 * @since 1.0.0
 * @see {@link createWordPressClient} for the recommended factory function
 */
export class WordPressWebhookClient implements IWordPressClient {
  /**
   * Create WordPress webhook client with configuration validation
   *
   * @param config - WordPress API configuration including base URL and authentication
   * @param httpClient - HTTP client for making webhook requests
   * @param webhookSecret - Secret key for HMAC signature generation (min 32 characters)
   * @throws {WordPressClientError} When configuration is invalid
   * @since 1.0.0
   */
  constructor(
    private readonly config: WordPressApiConfig,
    private readonly httpClient: IHttpClient,
    private readonly webhookSecret: string
  ) {
    this.validateConfig();
  }

  /**
   * Synchronize jobs to WordPress via secure webhook
   *
   * Sends normalized job data to WordPress through a secure webhook endpoint
   * with HMAC signature verification. Includes comprehensive error handling
   * and detailed logging for monitoring and debugging.
   *
   * @param jobs - Array of normalized job data to synchronize
   * @param source - Source identifier for tracking job origin (e.g., 'webhook', 'manual')
   * @returns Promise resolving to sync result with statistics and status
   * @throws {WordPressClientError} When sync fails due to client or server errors
   * @example
   * ```typescript
   * const client = createWordPressClient(config, httpClient, secret);
   * const jobs = await jobFetcher.fetchJobs(driveHrConfig);
   *
   * const result = await client.syncJobs(jobs.jobs, 'webhook');
   * if (result.success) {
   *   console.log(`Successfully synced ${result.syncedCount} jobs`);
   *   console.log(`Skipped ${result.skippedCount} duplicate jobs`);
   *   if (result.errorCount > 0) {
   *     console.warn(`${result.errorCount} jobs had errors:`, result.errors);
   *   }
   * } else {
   *   console.error('Sync failed:', result.message);
   * }
   * ```
   * @since 1.0.0
   * @see {@link JobSyncResponse} for the complete response structure
   */
  public async syncJobs(
    jobs: readonly NormalizedJob[],
    source: JobSource
  ): Promise<JobSyncResponse> {
    const requestId = this.generateRequestId();
    const timestamp = new Date().toISOString();
    const syncRequest = this.createSyncRequest(jobs, source, timestamp, requestId);

    try {
      const response = await this.performSync(syncRequest, requestId, source);
      return this.createSuccessResponse(response, timestamp);
    } catch (error) {
      return this.handleSyncError(error, requestId);
    }
  }

  /**
   * Create job synchronization request payload
   *
   * Builds the request payload that will be sent to WordPress,
   * including metadata for tracking and debugging.
   *
   * @param jobs - Array of normalized job data
   * @param source - Source identifier for tracking
   * @param timestamp - ISO timestamp of the sync request
   * @param requestId - Unique request identifier
   * @returns Structured sync request payload
   * @since 1.0.0
   */
  private createSyncRequest(
    jobs: readonly NormalizedJob[],
    source: JobSource,
    timestamp: string,
    requestId: string
  ): JobSyncRequest {
    return { source, jobs, timestamp, requestId };
  }

  /**
   * Perform the actual sync operation with WordPress
   *
   * Executes the HTTP request to WordPress with proper headers,
   * HMAC signature, and error handling. Logs the operation for
   * monitoring and debugging purposes.
   *
   * @param syncRequest - The job sync request payload
   * @param requestId - Unique request identifier for tracking
   * @param source - Source identifier for logging context
   * @returns Promise resolving to the HTTP response with sync results
   * @throws {WordPressClientError} When the HTTP request fails
   * @since 1.0.0
   */
  private async performSync(
    syncRequest: JobSyncRequest,
    requestId: string,
    source: JobSource
  ): Promise<{ success: boolean; status?: number; data: JobSyncResponse }> {
    const logger = getLogger();
    logger.info(`Syncing ${syncRequest.jobs.length} jobs to WordPress`, { requestId, source });

    const payload = JSON.stringify(syncRequest);
    const signature = this.generateSignature(payload);

    const response = await this.httpClient.post<JobSyncResponse>(this.config.baseUrl, syncRequest, {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Request-ID': requestId,
      'User-Agent': 'DriveHR-Sync-Netlify/1.0',
    });

    if (!response.success) {
      throw new WordPressClientError(
        `WordPress sync failed with status ${response.status}`,
        response.status,
        response.data
      );
    }

    logger.info('WordPress sync completed successfully', {
      requestId,
      processed: response.data.syncedCount,
      skipped: response.data.skippedCount,
      errors: response.data.errorCount,
    });

    return response;
  }

  private createSuccessResponse(
    response: { data: JobSyncResponse },
    timestamp: string
  ): JobSyncResponse {
    return {
      success: true,
      syncedCount: response.data.syncedCount || 0,
      skippedCount: response.data.skippedCount ?? 0,
      errorCount: response.data.errorCount ?? 0,
      message: response.data.message ?? 'Sync completed successfully',
      errors: response.data.errors ?? [],
      processedAt: response.data.processedAt ?? timestamp,
    };
  }

  private handleSyncError(error: unknown, requestId: string): never {
    const logger = getLogger();
    logger.error('WordPress sync failed', { requestId, error });

    if (error instanceof WordPressClientError) {
      throw error;
    }

    throw new WordPressClientError(
      `WordPress sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      error
    );
  }

  /**
   * Perform health check against WordPress endpoint
   *
   * Sends a lightweight health check request to verify that WordPress
   * is accessible and properly configured to receive webhook requests.
   * Includes proper authentication headers for security validation.
   *
   * @returns Promise resolving to true if WordPress is healthy and accessible
   * @example
   * ```typescript
   * const client = createWordPressClient(config, httpClient, secret);
   * const isHealthy = await client.healthCheck();
   *
   * if (isHealthy) {
   *   console.log('WordPress is ready to receive job data');
   * } else {
   *   console.error('WordPress is not accessible or misconfigured');
   * }
   * ```
   * @since 1.0.0
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        action: 'health_check',
        timestamp: new Date().toISOString(),
      });
      const signature = this.generateSignature(payload);

      const response = await this.httpClient.post(
        this.config.baseUrl,
        { action: 'health_check' },
        {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'DriveHR-Sync-Netlify/1.0',
        }
      );

      return response.success && response.status < 400;
    } catch (error) {
      const logger = getLogger();
      logger.warn('WordPress health check failed', { error });
      return false;
    }
  }

  /**
   * Generate HMAC signature for webhook authentication
   *
   * Creates a secure HMAC-SHA256 signature for the request payload
   * to ensure webhook authenticity and prevent tampering.
   *
   * @param payload - JSON string payload to sign
   * @returns HMAC signature in the format 'sha256=<hex_digest>'
   * @since 1.0.0
   * @see {@link SecurityUtils.generateHmacSignature} for implementation details
   */
  private generateSignature(payload: string): string {
    return SecurityUtils.generateHmacSignature(payload, this.webhookSecret);
  }

  /**
   * Generate unique request ID for tracking and debugging
   *
   * Creates a unique identifier for each sync request to enable
   * request tracing across logs and systems.
   *
   * @returns Unique request ID with 'req_' prefix
   * @since 1.0.0
   * @see {@link StringUtils.generateRequestId} for ID generation logic
   */
  private generateRequestId(): string {
    return `req_${StringUtils.generateRequestId()}`;
  }

  /**
   * Validate client configuration on instantiation
   *
   * Performs comprehensive validation of the WordPress client configuration
   * to ensure all required parameters are present and properly formatted.
   * Helps catch configuration errors early in the application lifecycle.
   *
   * @throws {WordPressClientError} When configuration is invalid or incomplete
   * @since 1.0.0
   */
  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new WordPressClientError('WordPress API URL is required');
    }

    if (!this.webhookSecret) {
      throw new WordPressClientError('Webhook secret is required');
    }

    if (this.webhookSecret.length < 32) {
      throw new WordPressClientError('Webhook secret must be at least 32 characters');
    }

    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new WordPressClientError('Invalid WordPress API URL format');
    }
  }
}

/**
 * WordPress client error class for enhanced error handling
 *
 * Custom error class that provides detailed error information for
 * WordPress integration failures, including HTTP status codes,
 * response data, and original error context for debugging.
 *
 * @example
 * ```typescript
 * try {
 *   await wordPressClient.syncJobs(jobs, 'webhook');
 * } catch (error) {
 *   if (error instanceof WordPressClientError) {
 *     console.error(`WordPress error (${error.status}):`, error.message);
 *     if (error.response) {
 *       console.error('Response data:', error.response);
 *     }
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link Error} for the base error class
 */
export class WordPressClientError extends Error {
  /** HTTP status code (if applicable) */
  public readonly status?: number;
  /** HTTP response data (if available) */
  public readonly response?: unknown;
  /** Original error that caused this error (if any) */
  public readonly originalError?: unknown;

  /**
   * Create a new WordPress client error
   *
   * @param message - Human-readable error message
   * @param status - HTTP status code (if applicable)
   * @param response - HTTP response data (if available)
   * @param originalError - Original error that caused this error (if any)
   * @since 1.0.0
   */
  constructor(message: string, status?: number, response?: unknown, originalError?: unknown) {
    super(message);
    this.name = 'WordPressClientError';
    this.status = status;
    this.response = response;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WordPressClientError);
    }
  }
}

/**
 * Factory function for creating WordPress client instances
 *
 * Recommended way to create WordPress client instances with proper
 * dependency injection. Encapsulates the instantiation logic and
 * provides a clean API for creating configured clients.
 *
 * @param config - WordPress API configuration including base URL and settings
 * @param httpClient - HTTP client instance for making requests
 * @param webhookSecret - Secret key for HMAC signature generation (min 32 chars)
 * @returns Configured WordPress client instance
 * @throws {WordPressClientError} When configuration is invalid
 * @example
 * ```typescript
 * const config = {
 *   baseUrl: 'https://mysite.com/wp-json/drivehr/v1/sync',
 *   timeout: 30000,
 *   retries: 3
 * };
 *
 * const httpClient = createHttpClient({ timeout: 30000 });
 * const client = createWordPressClient(config, httpClient, 'my-webhook-secret');
 *
 * // Client is ready to use
 * const result = await client.syncJobs(jobs, 'manual');
 * ```
 * @since 1.0.0
 * @see {@link WordPressWebhookClient} for the implementation class
 * @see {@link WordPressApiConfig} for configuration options
 */
export function createWordPressClient(
  config: WordPressApiConfig,
  httpClient: IHttpClient,
  webhookSecret: string
): IWordPressClient {
  return new WordPressWebhookClient(config, httpClient, webhookSecret);
}

/**
 * Utility function to validate WordPress webhook signatures
 *
 * Standalone utility for validating HMAC signatures from WordPress webhooks.
 * Useful for validating incoming webhook requests in other parts of the
 * application or in custom webhook handlers.
 *
 * @param payload - The raw request payload to validate
 * @param signature - The HMAC signature from the webhook header
 * @param secret - The webhook secret used for signature generation
 * @returns True if the signature is valid and matches the payload
 * @example
 * ```typescript
 * // In a webhook handler
 * const isValid = validateWebhookSignature(
 *   requestBody,
 *   req.headers['x-webhook-signature'],
 *   process.env.WEBHOOK_SECRET
 * );
 *
 * if (!isValid) {
 *   throw new Error('Invalid webhook signature');
 * }
 * ```
 * @since 1.0.0
 * @see {@link SecurityUtils.validateHmacSignature} for the underlying implementation
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  return SecurityUtils.validateHmacSignature(payload, signature, secret);
}
