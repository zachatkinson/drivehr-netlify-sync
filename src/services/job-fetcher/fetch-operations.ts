/**
 * Job Fetch Operations Framework
 *
 * Enterprise-grade fetch operation framework implementing Template Method and Strategy patterns
 * for DriveHR job data extraction. Provides comprehensive error handling, telemetry integration,
 * and strategy-based job fetching with automatic fallback mechanisms.
 *
 * This module orchestrates multiple job fetch strategies, handles telemetry instrumentation,
 * and ensures reliable job data extraction with detailed error reporting and performance metrics.
 * Built for high-availability production environments with extensive observability features.
 *
 * Key Features:
 * - Template Method pattern for consistent fetch operation workflow
 * - Strategy pattern for multiple data extraction approaches
 * - Comprehensive telemetry integration with OpenTelemetry spans
 * - Automatic strategy fallback with detailed error handling
 * - Performance monitoring and metrics collection
 * - Job data normalization and validation pipeline
 *
 * @example
 * ```typescript
 * import { DriveHrFetchOperation } from './fetch-operations.js';
 * import { createHttpClient } from '../../lib/http-client.js';
 * import { JobNormalizer } from './job-normalizer.js';
 *
 * const httpClient = createHttpClient({ timeout: 30000 });
 * const jobNormalizer = new JobNormalizer();
 * const telemetryStrategy = new DefaultFetchTelemetryStrategy();
 *
 * const fetchOperation = new DriveHrFetchOperation(
 *   httpClient,
 *   jobNormalizer,
 *   telemetryStrategy
 * );
 *
 * const result = await fetchOperation.execute(
 *   driveHrConfig,
 *   'webhook',
 *   [apiStrategy, htmlStrategy, jsonLdStrategy]
 * );
 *
 * if (result.success) {
 *   console.log(`Fetched ${result.jobs.length} jobs using ${result.method}`);
 * }
 * ```
 *
 * @module fetch-operations
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for strategy implementation interface
 * @see {@link JobNormalizer} for job data normalization
 * @see {@link IFetchTelemetryStrategy} for telemetry integration
 */

import { getLogger } from '../../lib/logger.js';
import { JobFetchErrorHandler } from '../../lib/job-fetch-utils.js';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { JobFetchResult, JobSource } from '../../types/job.js';
import type { IFetchTelemetryStrategy, IJobFetchStrategy, FetchOperationContext } from './types.js';
import { JobNormalizer } from './job-normalizer.js';

/**
 * Abstract template for job fetch operations
 *
 * Implements the Template Method pattern to define the overall structure of job fetching
 * operations while allowing concrete implementations to customize specific steps. Provides
 * common functionality for strategy execution, telemetry integration, error handling,
 * and result processing.
 *
 * This template ensures consistent behavior across different fetch operation types while
 * enabling customization of context preparation, strategy execution, and result handling.
 * All fetch operations follow the same basic algorithm with telemetry instrumentation.
 *
 * @abstract
 * @since 1.0.0
 * @see {@link DriveHrFetchOperation} for concrete implementation
 */
export abstract class FetchOperationTemplate {
  /**
   * Create fetch operation template with telemetry strategy
   *
   * Initializes the template with a telemetry strategy for comprehensive
   * instrumentation and metrics collection throughout the fetch operation lifecycle.
   *
   * @param telemetryStrategy - Strategy for handling telemetry operations
   * @since 1.0.0
   */
  constructor(protected readonly telemetryStrategy: IFetchTelemetryStrategy) {}

  /**
   * Execute job fetch operation using strategy pattern with fallbacks
   *
   * Orchestrates the complete job fetching process using multiple strategies with
   * automatic fallback mechanisms. Each strategy is attempted in order until one
   * succeeds or all strategies are exhausted. Provides comprehensive telemetry
   * instrumentation and error handling throughout the process.
   *
   * The execution flow includes:
   * 1. Context preparation with timing and metadata
   * 2. Strategy validation and capability checking
   * 3. Strategy execution with telemetry instrumentation
   * 4. Success/error handling with metrics collection
   * 5. Automatic fallback to next available strategy
   *
   * @param config - DriveHR API configuration with company and endpoint details
   * @param source - Source identifier for tracking and analytics purposes
   * @param strategies - Array of fetch strategies to attempt in order
   * @param span - Optional OpenTelemetry span for distributed tracing
   * @returns Promise resolving to comprehensive fetch result with job data
   * @example
   * ```typescript
   * const strategies = [
   *   new ApiJobFetchStrategy(),
   *   new HtmlJobFetchStrategy(),
   *   new JsonLdJobFetchStrategy()
   * ];
   *
   * const result = await fetchOperation.execute(
   *   config,
   *   'webhook',
   *   strategies
   * );
   *
   * if (result.success) {
   *   console.log(`Successfully fetched using ${result.method}`);
   *   result.jobs.forEach(job => {
   *     console.log(`- ${job.title} at ${job.location}`);
   *   });
   * } else {
   *   console.error(`All strategies failed: ${result.error}`);
   * }
   * ```
   * @since 1.0.0
   */
  public async execute(
    config: DriveHrApiConfig,
    source: JobSource,
    strategies: readonly IJobFetchStrategy[],
    span?: unknown
  ): Promise<JobFetchResult> {
    const context = this.prepareContext(config, source);

    for (const strategy of strategies) {
      if (!strategy.canHandle(config)) {
        continue;
      }

      try {
        const result = await this.attemptStrategy(strategy, config, source, context, span);
        if (result) {
          return this.handleSuccess(result, strategy, context, span);
        }
      } catch (error) {
        this.handleStrategyError(strategy, error, span);
      }
    }

    return this.handleAllStrategiesFailed(context, strategies.length, span);
  }

  /**
   * Prepare the fetch operation context (template method)
   *
   * Abstract method for preparing the fetch operation context including
   * timing information, request identifiers, and metadata. Concrete
   * implementations provide operation-specific context setup.
   *
   * @param config - DriveHR API configuration with company details
   * @param source - Source identifier for tracking purposes
   * @returns Complete operation context with timing and metadata
   * @since 1.0.0
   */
  protected abstract prepareContext(
    config: DriveHrApiConfig,
    source: JobSource
  ): FetchOperationContext;

  /**
   * Attempt job fetching using a specific strategy (template method)
   *
   * Abstract method for executing a specific fetch strategy. Concrete
   * implementations handle strategy execution, job normalization, and
   * result formatting with comprehensive error handling.
   *
   * @param strategy - Specific fetch strategy to attempt
   * @param config - DriveHR API configuration
   * @param source - Source identifier for job tracking
   * @param context - Operation context with timing and metadata
   * @param span - Optional OpenTelemetry span for tracing
   * @returns Promise resolving to fetch result or null if strategy failed
   * @since 1.0.0
   */
  protected abstract attemptStrategy(
    strategy: IJobFetchStrategy,
    config: DriveHrApiConfig,
    source: JobSource,
    context: FetchOperationContext,
    span?: unknown
  ): Promise<JobFetchResult | null>;

  /**
   * Handle successful fetch operation completion
   *
   * Processes successful fetch operations by recording success metrics,
   * updating telemetry spans, and returning the formatted result.
   * Provides comprehensive instrumentation for monitoring and alerting.
   *
   * @param result - Successful fetch result with job data
   * @param strategy - Strategy that succeeded in fetching jobs
   * @param context - Operation context with timing information
   * @param span - Optional OpenTelemetry span for distributed tracing
   * @returns Enhanced fetch result with telemetry metadata
   * @since 1.0.0
   */
  protected handleSuccess(
    result: JobFetchResult,
    strategy: IJobFetchStrategy,
    context: FetchOperationContext,
    span?: unknown
  ): JobFetchResult {
    const duration = Date.now() - context.startTime;

    // Record success metrics
    this.telemetryStrategy.recordMetrics(context.jobId, 'fetch', 'success', duration, {
      source: context.source,
      strategy: strategy.name,
      jobCount: result.totalCount,
      companyId: context.companyId,
    });

    // Update span with success attributes
    this.telemetryStrategy.setSpanAttributes(span, {
      'job.count': result.totalCount,
      'job.strategy_used': strategy.name,
      'job.duration_ms': duration,
    });

    return result;
  }

  /**
   * Handle individual strategy failure with comprehensive error reporting
   *
   * Processes individual strategy failures by logging detailed error information
   * and updating telemetry spans with failure context. Enables detailed debugging
   * and monitoring of strategy-specific issues.
   *
   * @param strategy - Strategy that failed during execution
   * @param error - Error that occurred during strategy execution
   * @param span - Optional OpenTelemetry span for error attribution
   * @since 1.0.0
   */
  protected handleStrategyError(strategy: IJobFetchStrategy, error: unknown, span?: unknown): void {
    JobFetchErrorHandler.logStrategyFailure(strategy.name, error);

    // Record failed strategy attempt in span
    this.telemetryStrategy.setSpanAttributes(span, {
      [`job.strategy_${strategy.name}_failed`]: true,
      [`job.strategy_${strategy.name}_error`]:
        error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Handle complete fetch operation failure when all strategies fail
   *
   * Creates a comprehensive failure result when all configured strategies have
   * been attempted and failed. Records detailed failure metrics and telemetry
   * information for debugging and monitoring purposes.
   *
   * @param context - Operation context with timing and metadata
   * @param strategiesAttempted - Number of strategies that were attempted
   * @param span - Optional OpenTelemetry span for failure attribution
   * @returns Comprehensive failure result with error details
   * @since 1.0.0
   */
  protected handleAllStrategiesFailed(
    context: FetchOperationContext,
    strategiesAttempted: number,
    span?: unknown
  ): JobFetchResult {
    const duration = Date.now() - context.startTime;

    // Record failure metrics
    this.telemetryStrategy.recordMetrics(context.jobId, 'fetch', 'error', duration, {
      source: context.source,
      error: 'all_strategies_failed',
      strategiesAttempted,
      companyId: context.companyId,
    });

    // Update span with failure attributes
    this.telemetryStrategy.setSpanAttributes(span, {
      'job.all_strategies_failed': true,
      'job.strategies_attempted': strategiesAttempted,
      'job.duration_ms': duration,
    });

    return {
      jobs: [],
      method: 'none',
      success: false,
      error: 'All fetch strategies failed',
      fetchedAt: context.fetchedAt,
      totalCount: 0,
    };
  }
}

/**
 * DriveHR-specific fetch operation implementation
 *
 * Concrete implementation of the fetch operation template specifically designed
 * for DriveHR job data extraction. Handles HTTP client integration, job normalization,
 * and DriveHR-specific context preparation with comprehensive error handling.
 *
 * This implementation provides production-ready DriveHR integration with:
 * - HTTP client management for API and web scraping
 * - Job data normalization and validation
 * - Company-specific context preparation
 * - Comprehensive telemetry and error reporting
 *
 * @extends {FetchOperationTemplate}
 * @since 1.0.0
 * @see {@link FetchOperationTemplate} for base template functionality
 */
export class DriveHrFetchOperation extends FetchOperationTemplate {
  /**
   * Create DriveHR fetch operation with dependencies
   *
   * Initializes the fetch operation with all necessary dependencies for
   * DriveHR job data extraction including HTTP client, job normalization,
   * and telemetry integration.
   *
   * @param httpClient - HTTP client for API requests and web scraping
   * @param jobNormalizer - Service for normalizing and validating job data
   * @param telemetryStrategy - Strategy for comprehensive telemetry integration
   * @since 1.0.0
   */
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly jobNormalizer: JobNormalizer,
    telemetryStrategy: IFetchTelemetryStrategy
  ) {
    super(telemetryStrategy);
  }

  /**
   * Prepare DriveHR-specific fetch operation context
   *
   * Creates comprehensive operation context with DriveHR-specific identifiers,
   * timing information, and company metadata for tracking and debugging.
   *
   * @param config - DriveHR API configuration with company details
   * @param source - Source identifier for tracking and analytics
   * @returns Complete operation context ready for DriveHR job fetching
   * @since 1.0.0
   */
  protected prepareContext(config: DriveHrApiConfig, source: JobSource): FetchOperationContext {
    return {
      startTime: Date.now(),
      fetchedAt: new Date().toISOString(),
      jobId: `fetch-${config.companyId}-${Date.now()}`,
      source,
      companyId: config.companyId || 'unknown',
    };
  }

  /**
   * Attempt DriveHR job fetching using specific strategy with normalization
   *
   * Executes a specific fetch strategy against DriveHR systems, handles job data
   * normalization, and provides comprehensive logging and telemetry instrumentation.
   * Includes detailed error handling and performance monitoring.
   *
   * @param strategy - Specific fetch strategy to execute
   * @param config - DriveHR API configuration with endpoints and credentials
   * @param source - Source identifier for job tracking and analytics
   * @param context - Operation context with timing and metadata
   * @param span - Optional OpenTelemetry span for distributed tracing
   * @returns Promise resolving to normalized job data or null if strategy failed
   * @throws {Error} When strategy execution encounters unrecoverable errors
   * @since 1.0.0
   */
  protected async attemptStrategy(
    strategy: IJobFetchStrategy,
    config: DriveHrApiConfig,
    source: JobSource,
    context: FetchOperationContext,
    span?: unknown
  ): Promise<JobFetchResult | null> {
    const logger = getLogger();
    logger.info(`Attempting to fetch jobs using strategy: ${strategy.name}`);

    // Add strategy-specific attributes to span
    this.telemetryStrategy.setSpanAttributes(span, {
      'job.strategy': strategy.name,
      'job.strategy_attempt': true,
    });

    const rawJobs = await strategy.fetchJobs(config, this.httpClient);
    const normalizedJobs = await this.jobNormalizer.normalizeJobs(rawJobs, source);

    logger.info(`Successfully fetched ${normalizedJobs.length} jobs using ${strategy.name}`);

    return {
      jobs: normalizedJobs,
      method: strategy.name,
      success: true,
      message: `Successfully fetched ${normalizedJobs.length} jobs`,
      fetchedAt: context.fetchedAt,
      totalCount: normalizedJobs.length,
    };
  }
}
