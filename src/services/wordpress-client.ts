/**
 * WordPress Webhook Client Service
 *
 * Enterprise-grade secure client for sending job data to WordPress via webhook endpoints
 * with HMAC signature verification, comprehensive error handling, request tracking, and
 * OpenTelemetry instrumentation. Built using Strategy and Template Method patterns for
 * maintainable, extensible, and thoroughly tested webhook delivery operations.
 *
 * This service provides reliable job synchronization between DriveHR systems and WordPress
 * sites through secure webhook endpoints. It includes advanced features like distributed
 * tracing, metrics collection, health monitoring, and comprehensive error recovery.
 *
 * Key Features:
 * - HMAC-SHA256 signature verification for webhook security
 * - OpenTelemetry distributed tracing and metrics collection
 * - Strategy pattern for configurable telemetry handling
 * - Template Method pattern for extensible sync operations
 * - Comprehensive error handling with custom error types
 * - Request ID tracking for debugging and monitoring
 * - Health check functionality for system monitoring
 * - Type-safe job data synchronization with validation
 *
 * @example
 * ```typescript
 * import { createWordPressClient } from './wordpress-client.js';
 * import { createHttpClient } from '../lib/http-client.js';
 *
 * const config = {
 *   baseUrl: 'https://mysite.com/webhook/drivehr-sync',
 *   timeout: 30000,
 *   retries: 3
 * };
 *
 * const httpClient = createHttpClient({ timeout: 30000 });
 * const client = createWordPressClient(config, httpClient, 'webhook-secret-key');
 *
 * // Sync jobs with comprehensive error handling
 * try {
 *   const result = await client.syncJobs(normalizedJobs, 'webhook');
 *   if (result.success) {
 *     console.log(`Synced ${result.syncedCount} jobs successfully`);
 *   }
 * } catch (error) {
 *   if (error instanceof WordPressClientError) {
 *     console.error(`WordPress error (${error.status}):`, error.message);
 *   }
 * }
 * ```
 *
 * @module wordpress-client
 * @since 1.0.0
 * @see {@link IWordPressClient} for the client interface contract
 * @see {@link createWordPressClient} for the recommended factory function
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
 * Extends the base telemetry strategy with WordPress-specific metrics recording
 * capabilities. Enables different approaches for metrics collection, tracing, and
 * monitoring based on environment requirements and instrumentation strategies.
 *
 * @since 1.0.0
 * @see {@link DefaultSyncTelemetryStrategy} for the standard implementation
 * @see {@link BaseTelemetryStrategy} for the base telemetry functionality
 */
interface ISyncTelemetryStrategy extends ITelemetryStrategy {
  /**
   * Record metrics for a WordPress sync operation
   *
   * Captures comprehensive metrics for webhook delivery operations including
   * timing, status, and contextual attributes for monitoring and alerting.
   *
   * @param operation - The operation name being tracked (e.g., 'wordpress-sync')
   * @param status - Success or failure status of the operation
   * @param statusCode - HTTP status code from the webhook response
   * @param duration - Operation duration in milliseconds
   * @param attributes - Additional attributes for enriched metrics context
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
 * Default telemetry strategy implementation for WordPress sync operations
 *
 * Standard implementation that uses OpenTelemetry for comprehensive metrics and tracing.
 * Provides production-ready instrumentation for WordPress webhook operations while
 * gracefully handling cases where telemetry infrastructure is not available.
 *
 * This strategy automatically detects telemetry availability and routes metrics
 * to the appropriate OpenTelemetry collectors for monitoring and alerting.
 *
 * @implements {ISyncTelemetryStrategy}
 * @since 1.0.0
 * @see {@link BaseTelemetryStrategy} for inherited telemetry functionality
 */
class DefaultSyncTelemetryStrategy extends BaseTelemetryStrategy implements ISyncTelemetryStrategy {
  /**
   * Record webhook metrics using OpenTelemetry infrastructure
   *
   * Delegates to the OpenTelemetry webhook metrics recorder when telemetry
   * is enabled, providing comprehensive metrics for monitoring webhook
   * performance, success rates, and error patterns.
   *
   * @param operation - The operation name being tracked
   * @param status - Success or failure status of the operation
   * @param statusCode - HTTP status code from the webhook response
   * @param duration - Operation duration in milliseconds for performance tracking
   * @param attributes - Additional contextual attributes for enriched metrics
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
 * Abstract template for WordPress sync operations
 *
 * Implements the Template Method pattern to define the overall structure of
 * WordPress sync operations while allowing concrete implementations to customize
 * specific steps. Provides common functionality for request preparation, execution,
 * error handling, and telemetry integration.
 *
 * This template ensures consistent behavior across different sync operation types
 * while enabling customization of telemetry strategies, request handling, and
 * response processing. All sync operations follow the same basic algorithm:
 * 1. Prepare operation context with request data
 * 2. Execute the sync operation with telemetry instrumentation
 * 3. Handle success or error responses appropriately
 *
 * @abstract
 * @since 1.0.0
 * @see {@link WordPressWebhookSyncOperation} for concrete implementation
 */
abstract class SyncOperationTemplate {
  /**
   * Create sync operation template with telemetry strategy
   *
   * Initializes the template with a telemetry strategy for instrumentation
   * and metrics collection throughout the sync operation lifecycle.
   *
   * @param telemetryStrategy - Strategy for handling telemetry operations
   * @since 1.0.0
   */
  constructor(protected readonly telemetryStrategy: ISyncTelemetryStrategy) {}

  /**
   * Execute the complete sync operation using template method pattern
   *
   * Defines the overall algorithm for WordPress sync operations while delegating
   * specific implementation details to concrete subclasses. Handles telemetry
   * instrumentation, error recovery, and response formatting consistently.
   *
   * The execution flow includes:
   * 1. Context preparation with request metadata
   * 2. Span attribute initialization for distributed tracing
   * 3. Operation execution with error handling
   * 4. Success/error response processing with metrics
   *
   * @param jobs - Array of normalized jobs to synchronize
   * @param source - Source identifier for tracking and analytics
   * @param span - Optional OpenTelemetry span for distributed tracing
   * @returns Promise resolving to comprehensive sync result
   * @throws {WordPressClientError} When sync operation fails
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
   * Prepare the operation context (template method)
   *
   * Abstract method for preparing the sync operation context including
   * request ID generation, timestamp creation, and payload preparation.
   * Concrete implementations provide operation-specific context setup.
   *
   * @param jobs - Array of jobs to synchronize
   * @param source - Source identifier for tracking
   * @returns Complete operation context with all necessary data
   * @since 1.0.0
   */
  protected abstract prepareContext(
    jobs: readonly NormalizedJob[],
    source: JobSource
  ): SyncOperationContext;

  /**
   * Perform the actual sync operation (template method)
   *
   * Abstract method for executing the core sync operation logic.
   * Concrete implementations handle the actual HTTP request execution,
   * authentication, and response processing.
   *
   * @param context - Operation context with prepared request data
   * @returns Promise resolving to the HTTP response with sync results
   * @throws {Error} When the sync operation fails
   * @since 1.0.0
   */
  protected abstract performOperation(
    context: SyncOperationContext
  ): Promise<{ success: boolean; status?: number; data: JobSyncResponse }>;

  /**
   * Handle successful sync operation completion
   *
   * Template method for processing successful sync operations. Records
   * success metrics, updates distributed tracing spans, and formats
   * the response for consistent return values.
   *
   * @param response - HTTP response from the successful sync operation
   * @param context - Operation context with request metadata
   * @param startTime - Operation start time for duration calculation
   * @param span - Optional OpenTelemetry span for distributed tracing
   * @returns Formatted success response with comprehensive statistics
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
   * Handle sync operation errors with comprehensive error processing
   *
   * Template method for processing sync operation errors. Records error metrics,
   * updates distributed tracing spans with error details, and throws appropriately
   * formatted exceptions with comprehensive error context.
   *
   * @param error - Error that occurred during sync operation
   * @param context - Operation context with request metadata
   * @param startTime - Operation start time for duration calculation
   * @param span - Optional OpenTelemetry span for error attribution
   * @throws {WordPressClientError} Always throws with comprehensive error details
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
   * Extract HTTP status code from various error types
   *
   * Utility method for extracting status codes from different error object
   * structures to ensure consistent error reporting and metrics collection.
   * Handles multiple common error formats from HTTP clients.
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
 * Context object for WordPress sync operations
 *
 * Contains all the data and metadata needed to perform a complete sync operation,
 * including job data, request identifiers, timestamps, and structured payloads.
 * Provides a consistent data structure for all sync operation implementations.
 *
 * @interface
 * @since 1.0.0
 */
interface SyncOperationContext {
  /** Array of normalized jobs to synchronize */
  readonly jobs: readonly NormalizedJob[];
  /** Source identifier for tracking and analytics */
  readonly source: JobSource;
  /** ISO timestamp when the operation was initiated */
  readonly timestamp: string;
  /** Unique request identifier for tracking and debugging */
  readonly requestId: string;
  /** Structured sync request payload for WordPress */
  readonly syncRequest: JobSyncRequest;
}

/**
 * WordPress webhook sync operation implementation
 *
 * Concrete implementation of the sync operation template that handles WordPress-specific
 * webhook delivery logic. Encapsulates HMAC signature generation, HTTP communication,
 * request formatting, and response processing for WordPress webhook endpoints.
 *
 * This implementation provides production-ready WordPress integration with comprehensive
 * error handling, security features, and observability instrumentation.
 *
 * @extends {SyncOperationTemplate}
 * @since 1.0.0
 * @see {@link SyncOperationTemplate} for the base template functionality
 */
class WordPressWebhookSyncOperation extends SyncOperationTemplate {
  /**
   * Create WordPress webhook sync operation with dependencies
   *
   * Initializes the sync operation with all necessary dependencies for
   * WordPress webhook communication including HTTP client, configuration,
   * and security credentials.
   *
   * @param httpClient - HTTP client for making webhook requests
   * @param config - WordPress API configuration with endpoint details
   * @param webhookSecret - Secret key for HMAC signature generation
   * @param telemetryStrategy - Strategy for telemetry and metrics collection
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
   * Prepare WordPress-specific sync operation context
   *
   * Creates comprehensive operation context with WordPress-specific request
   * structure, unique identifiers, and properly formatted sync payloads.
   *
   * @param jobs - Array of normalized jobs to synchronize
   * @param source - Source identifier for tracking and analytics
   * @returns Complete operation context ready for WordPress webhook delivery
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
   * Perform WordPress webhook sync operation with security and logging
   *
   * Executes the actual WordPress webhook delivery including HMAC signature
   * generation, secure HTTP request transmission, and comprehensive response
   * validation. Includes detailed logging for debugging and monitoring.
   *
   * @param context - Operation context with prepared request data
   * @returns Promise resolving to WordPress webhook response
   * @throws {WordPressClientError} When webhook delivery fails
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

    const response = await this.httpClient.post<JobSyncResponse>(this.config.baseUrl, payload, {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
      'X-Request-ID': context.requestId,
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
      requestId: context.requestId,
      processed: response.data.syncedCount,
      skipped: response.data.skippedCount,
      errors: response.data.errorCount,
    });

    return response;
  }
}

/**
 * WordPress webhook client interface contract
 *
 * Defines the standard interface for WordPress integration clients that handle
 * job synchronization and health monitoring. Enables dependency injection,
 * testing with mock implementations, and consistent API across different
 * WordPress integration strategies.
 *
 * This interface provides a clean contract for all WordPress webhook operations,
 * ensuring consistent behavior and enabling easy testing and maintenance.
 *
 * @example
 * ```typescript
 * // Mock implementation for testing
 * class MockWordPressClient implements IWordPressClient {
 *   async syncJobs(jobs: NormalizedJob[], source: JobSource): Promise<JobSyncResponse> {
 *     return {
 *       success: true,
 *       syncedCount: jobs.length,
 *       skippedCount: 0,
 *       errorCount: 0,
 *       message: 'Mock sync completed successfully',
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
 *
 * @since 1.0.0
 * @see {@link WordPressWebhookClient} for the production implementation
 * @see {@link createWordPressClient} for the recommended factory function
 */
export interface IWordPressClient {
  /**
   * Synchronize jobs to WordPress via webhook
   *
   * @param jobs - Array of normalized job data to synchronize
   * @param source - Source identifier for tracking job origin
   * @returns Promise resolving to sync result with success status and statistics
   */
  syncJobs(jobs: readonly NormalizedJob[], source: JobSource): Promise<JobSyncResponse>;

  /**
   * Perform health check against WordPress endpoint
   *
   * @returns Promise resolving to true if WordPress is healthy and accessible
   */
  healthCheck(): Promise<boolean>;
}

/**
 * WordPress webhook client implementation with enterprise security features
 *
 * Production-ready implementation of the IWordPressClient interface that provides
 * secure, reliable job synchronization with WordPress via webhook endpoints.
 * Includes comprehensive error handling, request tracking, HMAC signature
 * verification, health monitoring, and OpenTelemetry instrumentation.
 *
 * This client implements enterprise-grade security practices including:
 * - HMAC-SHA256 signature verification for webhook authenticity
 * - Request ID tracking for debugging and correlation
 * - Comprehensive configuration validation
 * - Structured error handling with detailed context
 * - OpenTelemetry distributed tracing integration
 *
 * @implements {IWordPressClient}
 * @example
 * ```typescript
 * const config = {
 *   baseUrl: 'https://mysite.com/webhook/drivehr-sync',
 *   timeout: 30000,
 *   retries: 3
 * };
 *
 * const client = new WordPressWebhookClient(
 *   config,
 *   httpClient,
 *   'secure-webhook-secret-key'
 * );
 *
 * // Synchronize jobs with error handling
 * try {
 *   const result = await client.syncJobs(normalizedJobs, 'webhook');
 *   if (result.success) {
 *     console.log(`Successfully synced ${result.syncedCount} jobs`);
 *     if (result.skippedCount > 0) {
 *       console.log(`Skipped ${result.skippedCount} duplicate jobs`);
 *     }
 *   }
 * } catch (error) {
 *   if (error instanceof WordPressClientError) {
 *     console.error(`WordPress sync failed (${error.status}):`, error.message);
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @see {@link createWordPressClient} for the recommended factory function
 * @see {@link IWordPressClient} for the interface contract
 */
export class WordPressWebhookClient implements IWordPressClient {
  private readonly syncOperation: WordPressWebhookSyncOperation;

  /**
   * Create WordPress webhook client with comprehensive configuration validation
   *
   * Initializes the client with all necessary dependencies and performs thorough
   * validation of configuration parameters to ensure security and reliability.
   * Sets up the sync operation with appropriate telemetry strategy.
   *
   * @param config - WordPress API configuration including base URL and settings
   * @param httpClient - HTTP client for making webhook requests
   * @param webhookSecret - Secret key for HMAC signature generation (min 32 characters)
   * @throws {WordPressClientError} When configuration validation fails
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
   * Synchronize jobs to WordPress via secure webhook with distributed tracing
   *
   * Sends normalized job data to WordPress through a secure webhook endpoint with
   * HMAC signature verification and comprehensive telemetry instrumentation. Uses
   * enterprise-grade Strategy and Template Method patterns for maintainable,
   * extensible, and thoroughly tested sync operations.
   *
   * The sync process includes:
   * 1. OpenTelemetry distributed tracing setup (when available)
   * 2. Request context preparation with unique identifiers
   * 3. HMAC signature generation for webhook security
   * 4. Secure HTTP delivery with proper headers
   * 5. Response validation and metrics collection
   * 6. Comprehensive error handling and recovery
   *
   * @param jobs - Array of normalized job data to synchronize
   * @param source - Source identifier for tracking job origin (e.g., 'webhook', 'manual')
   * @returns Promise resolving to comprehensive sync result with statistics
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
   * Perform comprehensive health check against WordPress webhook endpoint
   *
   * Sends a lightweight health check request to verify that the WordPress endpoint
   * is accessible, properly configured, and ready to receive webhook requests.
   * Includes proper HMAC authentication to validate the complete webhook chain.
   *
   * The health check validates:
   * - WordPress endpoint accessibility
   * - HMAC signature verification setup
   * - Authentication header processing
   * - Basic webhook handler functionality
   *
   * @returns Promise resolving to true if WordPress is healthy and accessible
   * @example
   * ```typescript
   * const client = createWordPressClient(config, httpClient, secret);
   *
   * const isHealthy = await client.healthCheck();
   * if (isHealthy) {
   *   console.log('WordPress is ready to receive job synchronization requests');
   *   // Proceed with job sync operations
   * } else {
   *   console.error('WordPress endpoint is not accessible or misconfigured');
   *   // Handle health check failure (retry, alert, fallback)
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

      const response = await this.httpClient.post(this.config.baseUrl, payload, {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
        'User-Agent': 'DriveHR-Sync-Netlify/1.0',
      });

      return response.success && response.status < 400;
    } catch (error) {
      const logger = getLogger();
      logger.warn('WordPress health check failed', { error });
      return false;
    }
  }

  /**
   * Validate WordPress client configuration comprehensively
   *
   * Performs thorough validation of all configuration parameters to ensure
   * security, reliability, and proper integration setup. Catches configuration
   * errors early in the application lifecycle to prevent runtime failures.
   *
   * Validation includes:
   * - WordPress API URL presence and format validation
   * - Webhook secret presence and minimum length requirements
   * - URL format and accessibility validation
   * - Security parameter validation
   *
   * @throws {WordPressClientError} When any configuration parameter is invalid
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
 * WordPress client error class for enhanced error handling and debugging
 *
 * Custom error class that provides comprehensive error information for WordPress
 * integration failures, including HTTP status codes, response data, and original
 * error context. Enables detailed error handling and debugging in production environments.
 *
 * This error class maintains the complete error context chain, allowing applications
 * to handle different error scenarios appropriately and provide meaningful
 * feedback to users and monitoring systems.
 *
 * @example
 * ```typescript
 * try {
 *   await wordPressClient.syncJobs(jobs, 'webhook');
 * } catch (error) {
 *   if (error instanceof WordPressClientError) {
 *     console.error(`WordPress error (${error.status}):`, error.message);
 *
 *     // Handle specific error types
 *     if (error.status === 401) {
 *       console.error('Authentication failed - check webhook secret');
 *     } else if (error.status === 500) {
 *       console.error('WordPress server error:', error.response);
 *     }
 *
 *     // Log original error for debugging
 *     if (error.originalError) {
 *       console.error('Original error:', error.originalError);
 *     }
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @see {@link Error} for the base error class
 */
export class WordPressClientError extends Error {
  /**
   * HTTP status code from the failed request (if applicable)
   *
   * @since 1.0.0
   */
  public readonly status?: number;

  /**
   * HTTP response data from the failed request (if available)
   *
   * @since 1.0.0
   */
  public readonly response?: unknown;

  /**
   * Original error that caused this WordPress client error (if any)
   *
   * @since 1.0.0
   */
  public readonly originalError?: unknown;

  /**
   * Create a new WordPress client error with comprehensive context
   *
   * @param message - Human-readable error message describing the failure
   * @param status - HTTP status code from the failed request (if applicable)
   * @param response - HTTP response data from the failed request (if available)
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
 * Factory function for creating WordPress client instances with dependency injection
 *
 * Recommended way to create WordPress client instances with proper dependency injection
 * and configuration validation. Encapsulates the instantiation logic and provides a
 * clean, testable API for creating configured WordPress webhook clients.
 *
 * This factory function ensures consistent client creation and enables easy testing
 * by allowing dependency injection of HTTP clients and configuration objects.
 *
 * @param config - WordPress API configuration including base URL and settings
 * @param httpClient - HTTP client instance for making webhook requests
 * @param webhookSecret - Secret key for HMAC signature generation (minimum 32 characters)
 * @returns Configured and validated WordPress client instance
 * @throws {WordPressClientError} When configuration validation fails
 * @example
 * ```typescript
 * import { createWordPressClient } from './wordpress-client.js';
 * import { createHttpClient } from '../lib/http-client.js';
 *
 * const config = {
 *   baseUrl: 'https://mysite.com/webhook/drivehr-sync',
 *   timeout: 30000,
 *   retries: 3
 * };
 *
 * const httpClient = createHttpClient({
 *   timeout: 30000,
 *   retries: 3
 * });
 *
 * const client = createWordPressClient(
 *   config,
 *   httpClient,
 *   'secure-webhook-secret-key-at-least-32-chars'
 * );
 *
 * // Client is ready for immediate use
 * const result = await client.syncJobs(normalizedJobs, 'manual');
 * ```
 * @since 1.0.0
 * @see {@link WordPressWebhookClient} for the implementation class
 * @see {@link WordPressApiConfig} for configuration options
 * @see {@link IWordPressClient} for the interface contract
 */
export function createWordPressClient(
  config: WordPressApiConfig,
  httpClient: IHttpClient,
  webhookSecret: string
): IWordPressClient {
  return new WordPressWebhookClient(config, httpClient, webhookSecret);
}

/**
 * Utility function to validate WordPress webhook HMAC signatures
 *
 * Standalone utility for validating HMAC-SHA256 signatures from WordPress webhook
 * requests. Useful for validating incoming webhook requests in webhook handlers,
 * middleware, or other parts of the application that need to verify webhook authenticity.
 *
 * This function provides a clean interface for signature validation without requiring
 * a full WordPress client instance, making it ideal for webhook validation middleware
 * and request preprocessing.
 *
 * @param payload - The raw request payload string to validate
 * @param signature - The HMAC signature from the webhook request header
 * @param secret - The webhook secret used for signature generation
 * @returns True if the signature is valid and matches the payload
 * @example
 * ```typescript
 * import { validateWebhookSignature } from './wordpress-client.js';
 * import { getEnvVar } from '../lib/env.js';
 *
 * // In a webhook handler or middleware
 * function validateIncomingWebhook(req: Request) {
 *   const signature = req.headers['x-webhook-signature'] as string;
 *   const payload = JSON.stringify(req.body);
 *   const secret = getEnvVar('WEBHOOK_SECRET', true);
 *
 *   const isValid = validateWebhookSignature(payload, signature, secret);
 *
 *   if (!isValid) {
 *     throw new Error('Invalid webhook signature - request rejected');
 *   }
 *
 *   return true;
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
