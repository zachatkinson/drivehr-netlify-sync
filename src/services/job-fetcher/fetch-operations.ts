import { getLogger } from '../../lib/logger.js';
import { JobFetchErrorHandler } from '../../lib/job-fetch-utils.js';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { JobFetchResult, JobSource } from '../../types/job.js';
import type { IFetchTelemetryStrategy, IJobFetchStrategy, FetchOperationContext } from './types.js';
import { JobNormalizer } from './job-normalizer.js';

/**
 * Abstract template for fetch operations
 *
 * Implements the Template Method pattern to define the overall structure
 * of job fetching operations while allowing customization of specific steps.
 * Provides common functionality for strategy iteration, error handling,
 * and metrics recording while enabling customization of telemetry.
 *
 * @abstract
 * @since 1.0.0
 */
export abstract class FetchOperationTemplate {
  /**
   * Create fetch operation template with telemetry strategy
   *
   * @param telemetryStrategy - Strategy for handling telemetry operations
   * @since 1.0.0
   */
  constructor(protected readonly telemetryStrategy: IFetchTelemetryStrategy) {}

  /**
   * Execute the complete fetch operation using template method pattern
   *
   * Defines the overall algorithm for fetch operations while delegating
   * specific steps to template methods that can be customized by subclasses.
   *
   * @param config - DriveHR API configuration
   * @param source - Source identifier for tracking
   * @param strategies - Array of available fetching strategies
   * @param span - Optional OpenTelemetry span for tracing
   * @returns Promise resolving to fetch result
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
   * Prepare the operation context
   *
   * Template method for preparing the fetch operation context including
   * timing information and operation identifiers.
   *
   * @param config - DriveHR API configuration
   * @param source - Source identifier
   * @returns Operation context with timing and metadata
   * @since 1.0.0
   */
  protected abstract prepareContext(
    config: DriveHrApiConfig,
    source: JobSource
  ): FetchOperationContext;

  /**
   * Attempt to fetch jobs using a specific strategy
   *
   * Template method for executing a single strategy attempt.
   * Returns the result if successful, or null to try the next strategy.
   *
   * @param strategy - The strategy to attempt
   * @param config - DriveHR API configuration
   * @param source - Source identifier
   * @param context - Operation context
   * @param span - Optional OpenTelemetry span
   * @returns Promise resolving to fetch result or null
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
   * Handle successful fetch operation
   *
   * Template method for processing successful fetch operations.
   * Records metrics, updates span attributes, and returns the result.
   *
   * @param result - The successful fetch result
   * @param strategy - The strategy that succeeded
   * @param context - Operation context
   * @param span - Optional OpenTelemetry span
   * @returns Final fetch result
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
   * Handle strategy-specific errors
   *
   * Template method for processing individual strategy failures.
   * Logs the error and updates span attributes for debugging.
   *
   * @param strategy - The strategy that failed
   * @param error - The error that occurred
   * @param span - Optional OpenTelemetry span
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
   * Handle complete fetch failure
   *
   * Template method for processing cases where all strategies failed.
   * Records failure metrics and returns appropriate error result.
   *
   * @param context - Operation context
   * @param strategiesAttempted - Number of strategies that were attempted
   * @param span - Optional OpenTelemetry span
   * @returns Failure fetch result
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
 * Concrete implementation of the fetch operation template that handles
 * DriveHR-specific job fetching logic. Encapsulates strategy execution,
 * job normalization, and result formatting for DriveHR job sources.
 *
 * @extends {FetchOperationTemplate}
 * @since 1.0.0
 */
export class DriveHrFetchOperation extends FetchOperationTemplate {
  /**
   * Create DriveHR fetch operation
   *
   * @param httpClient - HTTP client for making requests
   * @param jobNormalizer - Service for normalizing job data
   * @param telemetryStrategy - Strategy for telemetry operations
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
   * Prepare DriveHR fetch operation context
   *
   * @param config - DriveHR API configuration
   * @param source - Source identifier
   * @returns Complete operation context
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
   * Attempt to fetch jobs using a specific strategy
   *
   * @param strategy - The strategy to attempt
   * @param config - DriveHR API configuration
   * @param source - Source identifier
   * @param context - Operation context
   * @param span - Optional OpenTelemetry span
   * @returns Promise resolving to fetch result or null
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
