import { getLogger } from '../../lib/logger.js';
import { JobFetchErrorHandler } from '../../lib/job-fetch-utils.js';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { JobFetchResult, JobSource } from '../../types/job.js';
import type { IFetchTelemetryStrategy, IJobFetchStrategy, FetchOperationContext } from './types.js';
import { JobNormalizer } from './job-normalizer.js';

export abstract class FetchOperationTemplate {
  constructor(protected readonly telemetryStrategy: IFetchTelemetryStrategy) {}

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

  protected abstract prepareContext(
    config: DriveHrApiConfig,
    source: JobSource
  ): FetchOperationContext;

  protected abstract attemptStrategy(
    strategy: IJobFetchStrategy,
    config: DriveHrApiConfig,
    source: JobSource,
    context: FetchOperationContext,
    span?: unknown
  ): Promise<JobFetchResult | null>;

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

  protected handleStrategyError(strategy: IJobFetchStrategy, error: unknown, span?: unknown): void {
    JobFetchErrorHandler.logStrategyFailure(strategy.name, error);

    // Record failed strategy attempt in span
    this.telemetryStrategy.setSpanAttributes(span, {
      [`job.strategy_${strategy.name}_failed`]: true,
      [`job.strategy_${strategy.name}_error`]:
        error instanceof Error ? error.message : String(error),
    });
  }

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

export class DriveHrFetchOperation extends FetchOperationTemplate {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly jobNormalizer: JobNormalizer,
    telemetryStrategy: IFetchTelemetryStrategy
  ) {
    super(telemetryStrategy);
  }

  protected prepareContext(config: DriveHrApiConfig, source: JobSource): FetchOperationContext {
    return {
      startTime: Date.now(),
      fetchedAt: new Date().toISOString(),
      jobId: `fetch-${config.companyId}-${Date.now()}`,
      source,
      companyId: config.companyId || 'unknown',
    };
  }

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
