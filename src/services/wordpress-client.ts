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
import { withSpan, recordWebhookMetrics, isTelemetryInitialized } from '../lib/telemetry.js';
import { BaseTelemetryStrategy, type ITelemetryStrategy } from '../lib/telemetry-strategy.js';
import { SpanKind } from '@opentelemetry/api';
import type { IHttpClient } from '../lib/http-client.js';
import type { NormalizedJob, JobSyncRequest, JobSyncResponse, JobSource } from '../types/job.js';
import type { WordPressApiConfig } from '../types/api.js';

/**
 * Strategy interface for telemetry handling during sync operations
 *
 * Defines the contract for different telemetry strategies that can be used
 * to instrument WordPress sync operations. Enables different approaches
 * for metrics collection, tracing, and monitoring based on environment
 * and requirements.
 *
 * @since 1.0.0
 * @see {@link DefaultSyncTelemetryStrategy} for the standard implementation
 */
interface ISyncTelemetryStrategy extends ITelemetryStrategy {
  /**
   * Record metrics for a sync operation
   *
   * @param operation - The operation name being tracked
   * @param status - Success or failure status
   * @param statusCode - HTTP status code from the operation
   * @param duration - Operation duration in milliseconds
   * @param attributes - Additional attributes for the metric
   * @since 1.0.0
   */
  recordMetrics(
    operation: string,
    status: 'success' | 'failure',
    statusCode: number,
    duration: number,
    attributes: Record<string, string | number | boolean>
  ): void;
}

/**
 * Default telemetry strategy implementation
 *
 * Standard implementation that uses OpenTelemetry for metrics and tracing.
 * Provides comprehensive instrumentation for production environments
 * while gracefully handling cases where telemetry is not available.
 *
 * @implements {ISyncTelemetryStrategy}
 * @since 1.0.0
 */
class DefaultSyncTelemetryStrategy extends BaseTelemetryStrategy implements ISyncTelemetryStrategy {
  /**
   * Record webhook metrics using OpenTelemetry
   *
   * @param operation - The operation name being tracked
   * @param status - Success or failure status
   * @param statusCode - HTTP status code from the operation
   * @param duration - Operation duration in milliseconds
   * @param attributes - Additional attributes for the metric
   * @since 1.0.0
   */
  public recordMetrics(
    operation: string,
    status: 'success' | 'failure',
    statusCode: number,
    duration: number,
    attributes: Record<string, string | number | boolean>
  ): void {
    if (this.isTelemetryEnabled()) {
      recordWebhookMetrics(operation, status, statusCode, duration, attributes);
    }
  }
}

/**
 * Abstract template for sync operations
 *
 * Implements the Template Method pattern to define the overall structure
 * of sync operations while allowing subclasses to customize specific steps.
 * Provides common functionality for request preparation, execution, and
 * error handling while enabling customization of telemetry strategies.
 *
 * @abstract
 * @since 1.0.0
 */
abstract class SyncOperationTemplate {
  /**
   * Create sync operation template with telemetry strategy
   *
   * @param telemetryStrategy - Strategy for handling telemetry operations
   * @since 1.0.0
   */
  constructor(protected readonly telemetryStrategy: ISyncTelemetryStrategy) {}

  /**
   * Execute the complete sync operation using template method pattern
   *
   * Defines the overall algorithm for sync operations while delegating
   * specific steps to template methods that can be customized by subclasses.
   *
   * @param jobs - Jobs to synchronize
   * @param source - Source identifier for tracking
   * @param span - Optional OpenTelemetry span for tracing
   * @returns Promise resolving to sync result
   * @since 1.0.0
   */
  public async execute(
    jobs: readonly NormalizedJob[],
    source: JobSource,
    span?: unknown
  ): Promise<JobSyncResponse> {
    const startTime = Date.now();
    const context = this.prepareContext(jobs, source);

    // Set initial span attributes
    this.telemetryStrategy.setSpanAttributes(span, {
      'wordpress.request_id': context.requestId,
      'wordpress.timestamp': context.timestamp,
      'wordpress.payload_size': JSON.stringify(context.syncRequest).length,
    });

    try {
      const response = await this.performOperation(context);
      return this.handleSuccess(response, context, startTime, span);
    } catch (error) {
      return this.handleError(error, context, startTime, span);
    }
  }

  /**
   * Prepare the operation context
   *
   * Template method for preparing the sync operation context including
   * request ID generation, timestamp creation, and payload preparation.
   *
   * @param jobs - Jobs to synchronize
   * @param source - Source identifier
   * @returns Operation context with all necessary data
   * @since 1.0.0
   */
  protected abstract prepareContext(
    jobs: readonly NormalizedJob[],
    source: JobSource
  ): SyncOperationContext;

  /**
   * Perform the actual sync operation
   *
   * Template method for executing the core sync operation.
   * Implementations should handle the actual HTTP request and
   * return the response data.
   *
   * @param context - Operation context with request data
   * @returns Promise resolving to the HTTP response
   * @since 1.0.0
   */
  protected abstract performOperation(
    context: SyncOperationContext
  ): Promise<{ success: boolean; status?: number; data: JobSyncResponse }>;

  /**
   * Handle successful operation completion
   *
   * Template method for processing successful sync operations.
   * Records metrics, updates span attributes, and formats the response.
   *
   * @param response - HTTP response from the sync operation
   * @param context - Operation context
   * @param startTime - Operation start time for duration calculation
   * @param span - Optional OpenTelemetry span
   * @returns Formatted success response
   * @since 1.0.0
   */
  protected handleSuccess(
    response: { success: boolean; status?: number; data: JobSyncResponse },
    context: SyncOperationContext,
    startTime: number,
    span?: unknown
  ): JobSyncResponse {
    const duration = Date.now() - startTime;

    // Record success metrics
    this.telemetryStrategy.recordMetrics(
      'wordpress-sync',
      'success',
      response.status ?? 200,
      duration,
      {
        'webhook.event': 'job.sync',
        'webhook.job_count': context.jobs.length,
        'webhook.source': context.source,
        'webhook.request_id': context.requestId,
      }
    );

    // Update span with success attributes
    this.telemetryStrategy.setSpanAttributes(span, {
      'wordpress.response_status': response.status ?? 200,
      'wordpress.synced_count': response.data.syncedCount ?? 0,
      'wordpress.duration_ms': duration,
      'wordpress.success': true,
    });

    return {
      success: true,
      syncedCount: response.data.syncedCount || 0,
      skippedCount: response.data.skippedCount ?? 0,
      errorCount: response.data.errorCount ?? 0,
      message: response.data.message ?? 'Sync completed successfully',
      errors: response.data.errors ?? [],
      processedAt: response.data.processedAt ?? context.timestamp,
    };
  }

  /**
   * Handle operation errors
   *
   * Template method for processing sync operation errors.
   * Records error metrics, updates span attributes, and throws
   * appropriate exceptions.
   *
   * @param error - Error that occurred during sync
   * @param context - Operation context
   * @param startTime - Operation start time for duration calculation
   * @param span - Optional OpenTelemetry span
   * @throws {WordPressClientError} Always throws with error details
   * @since 1.0.0
   */
  protected handleError(
    error: unknown,
    context: SyncOperationContext,
    startTime: number,
    span?: unknown
  ): never {
    const duration = Date.now() - startTime;
    const statusCode = this.extractStatusCode(error);

    // Record error metrics
    this.telemetryStrategy.recordMetrics('wordpress-sync', 'failure', statusCode, duration, {
      'webhook.event': 'job.sync',
      'webhook.job_count': context.jobs.length,
      'webhook.source': context.source,
      'webhook.request_id': context.requestId,
      'webhook.error': error instanceof Error ? error.message : String(error),
    });

    // Update span with error attributes
    this.telemetryStrategy.setSpanAttributes(span, {
      'wordpress.response_status': statusCode,
      'wordpress.duration_ms': duration,
      'wordpress.success': false,
      'wordpress.error': error instanceof Error ? error.message : String(error),
    });

    throw new WordPressClientError(
      `WordPress sync failed: ${error instanceof Error ? error.message : String(error)}`,
      statusCode,
      undefined,
      error
    );
  }

  /**
   * Extract HTTP status code from error
   *
   * Utility method for extracting status codes from various error types
   * to ensure consistent error reporting and metrics.
   *
   * @param error - Error object that may contain status information
   * @returns HTTP status code or 500 for unknown errors
   * @since 1.0.0
   */
  private extractStatusCode(error: unknown): number {
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if (typeof errorObj['status'] === 'number') return errorObj['status'];
      if (typeof errorObj['statusCode'] === 'number') return errorObj['statusCode'];
      if (typeof errorObj['code'] === 'number') return errorObj['code'];
    }
    return 500;
  }
}

/**
 * Context object for sync operations
 *
 * Contains all the data needed to perform a sync operation,
 * including request metadata, job data, and timing information.
 *
 * @interface
 * @since 1.0.0
 */
interface SyncOperationContext {
  /** Array of jobs to synchronize */
  readonly jobs: readonly NormalizedJob[];
  /** Source identifier for tracking */
  readonly source: JobSource;
  /** ISO timestamp of the operation */
  readonly timestamp: string;
  /** Unique request identifier */
  readonly requestId: string;
  /** Structured sync request payload */
  readonly syncRequest: JobSyncRequest;
}

/**
 * WordPress webhook sync operation implementation
 *
 * Concrete implementation of the sync operation template that handles
 * WordPress-specific sync logic. Encapsulates request preparation,
 * HTTP communication, and response processing for WordPress webhooks.
 *
 * @extends {SyncOperationTemplate}
 * @since 1.0.0
 */
class WordPressWebhookSyncOperation extends SyncOperationTemplate {
  /**
   * Create WordPress webhook sync operation
   *
   * @param httpClient - HTTP client for making requests
   * @param config - WordPress API configuration
   * @param webhookSecret - Secret for HMAC signature generation
   * @param telemetryStrategy - Strategy for telemetry operations
   * @since 1.0.0
   */
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly config: WordPressApiConfig,
    private readonly webhookSecret: string,
    telemetryStrategy: ISyncTelemetryStrategy
  ) {
    super(telemetryStrategy);
  }

  /**
   * Prepare sync operation context with WordPress-specific data
   *
   * @param jobs - Jobs to synchronize
   * @param source - Source identifier for tracking
   * @returns Complete operation context
   * @since 1.0.0
   */
  protected prepareContext(
    jobs: readonly NormalizedJob[],
    source: JobSource
  ): SyncOperationContext {
    const requestId = `req_${StringUtils.generateRequestId()}`;
    const timestamp = new Date().toISOString();
    const syncRequest: JobSyncRequest = { source, jobs, timestamp, requestId };

    return { jobs, source, timestamp, requestId, syncRequest };
  }

  /**
   * Perform WordPress webhook sync operation
   *
   * @param context - Operation context with request data
   * @returns Promise resolving to HTTP response
   * @since 1.0.0
   */
  protected async performOperation(
    context: SyncOperationContext
  ): Promise<{ success: boolean; status?: number; data: JobSyncResponse }> {
    const logger = getLogger();
    logger.info(`Syncing ${context.jobs.length} jobs to WordPress`, {
      requestId: context.requestId,
      source: context.source,
    });

    const payload = JSON.stringify(context.syncRequest);
    const signature = SecurityUtils.generateHmacSignature(payload, this.webhookSecret);

    const response = await this.httpClient.post<JobSyncResponse>(
      this.config.baseUrl,
      context.syncRequest,
      {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Request-ID': context.requestId,
        'User-Agent': 'DriveHR-Sync-Netlify/1.0',
      }
    );

    if (!response.success) {
      throw new WordPressClientError(
        `WordPress sync failed with status ${response.status}`,
        response.status,
        response.data
      );
    }

    logger.info('WordPress sync completed successfully', {
      requestId: context.requestId,
      processed: response.data.syncedCount,
      skipped: response.data.skippedCount,
      errors: response.data.errorCount,
    });

    return response;
  }
}

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
 *   baseUrl: 'https://mysite.com/webhook/drivehr-sync',
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
  private readonly syncOperation: WordPressWebhookSyncOperation;

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

    // Initialize with default telemetry strategy
    const telemetryStrategy = new DefaultSyncTelemetryStrategy();
    this.syncOperation = new WordPressWebhookSyncOperation(
      httpClient,
      config,
      webhookSecret,
      telemetryStrategy
    );
  }

  /**
   * Synchronize jobs to WordPress via secure webhook
   *
   * Sends normalized job data to WordPress through a secure webhook endpoint
   * with HMAC signature verification. Uses enterprise-grade Strategy and Template
   * Method patterns for maintainable, extensible, and well-tested sync operations.
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
    // Use OpenTelemetry distributed tracing if available
    if (isTelemetryInitialized()) {
      return withSpan(
        'wordpress-client.sync-jobs',
        async span => {
          span.setAttributes({
            'wordpress.job_count': jobs.length,
            'wordpress.source': source,
            'wordpress.endpoint': this.config.baseUrl,
            'operation.type': 'webhook_delivery',
          });

          return this.syncOperation.execute(jobs, source, span);
        },
        { 'service.name': 'wordpress-client' },
        SpanKind.CLIENT
      );
    }

    // Fallback to non-instrumented execution
    return this.syncOperation.execute(jobs, source);
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
      const signature = SecurityUtils.generateHmacSignature(payload, this.webhookSecret);

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
 *   baseUrl: 'https://mysite.com/webhook/drivehr-sync',
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
 * import { getEnvVar } from '../lib/env.js';
 *
 * const isValid = validateWebhookSignature(
 *   requestBody,
 *   req.headers['x-webhook-signature'],
 *   getEnvVar('WEBHOOK_SECRET', true)
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
