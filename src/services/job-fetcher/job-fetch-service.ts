import { isTelemetryInitialized, withSpan } from '../../lib/telemetry.js';
import { SpanKind } from '@opentelemetry/api';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { JobFetchResult, JobSource } from '../../types/job.js';
import type { IJobFetchStrategy, IHtmlParser } from './types.js';
import { DefaultFetchTelemetryStrategy } from './telemetry.js';
import { JobNormalizer } from './job-normalizer.js';
import { HtmlJobFetchStrategy } from './html-strategy.js';
import { DriveHrFetchOperation } from './fetch-operations.js';

/**
 * Main job fetching service that orchestrates all strategies
 *
 * Enterprise-grade service that coordinates multiple job fetching strategies
 * to provide robust, fault-tolerant job data retrieval. Automatically tries
 * strategies in order of preference (API -> JSON -> HTML -> Embedded) until
 * one succeeds or all fail.
 *
 * Includes comprehensive data normalization, validation, and error handling
 * to ensure consistent job data format regardless of the source strategy.
 *
 * @example
 * ```typescript
 * const httpClient = createHttpClient();
 * const htmlParser = createHtmlParser();
 * const jobFetcher = new JobFetchService(httpClient, htmlParser);
 *
 * const config = {
 *   companyId: 'acme-corp',
 *   apiBaseUrl: 'https://api.drivehr.app',
 *   careersUrl: 'https://drivehr.app/careers/acme-corp/list'
 * };
 *
 * const result = await jobFetcher.fetchJobs(config, 'manual');
 * if (result.success) {
 *   console.log(`Fetched ${result.jobs.length} jobs using ${result.method}`);
 * }
 * ```
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for individual strategy implementations
 * @see {@link JobFetchResult} for the result structure
 */
export class JobFetchService {
  private readonly strategies: readonly IJobFetchStrategy[];
  private readonly fetchOperation: DriveHrFetchOperation;

  /**
   * Create job fetch service with dependency injection
   *
   * @param httpClient - HTTP client for making requests
   * @param htmlParser - HTML parser for scraping job data
   * @since 1.0.0
   */
  constructor(
    private readonly httpClient: IHttpClient,
    htmlParser: IHtmlParser
  ) {
    this.strategies = [new HtmlJobFetchStrategy(htmlParser)] as const;

    // Initialize with default telemetry strategy and job normalizer
    const telemetryStrategy = new DefaultFetchTelemetryStrategy();
    const jobNormalizer = new JobNormalizer();
    this.fetchOperation = new DriveHrFetchOperation(httpClient, jobNormalizer, telemetryStrategy);
  }

  /**
   * Fetch jobs using all available strategies with automatic failover
   *
   * Orchestrates multiple job fetching strategies using enterprise-grade Template
   * Method pattern for maintainable, extensible, and well-tested fetch operations.
   * Provides comprehensive error handling and automatic normalization of job data.
   *
   * @param config - DriveHR API configuration with endpoint details
   * @param source - Source identifier for tracking job origin
   * @returns Promise resolving to job fetch result with success status and data
   * @example
   * ```typescript
   * const jobFetcher = new JobFetchService(httpClient, htmlParser);
   * const config = {
   *   companyId: 'tech-startup',
   *   apiBaseUrl: 'https://api.drivehr.app',
   *   careersUrl: 'https://drivehr.app/careers/tech-startup/list'
   * };
   *
   * const result = await jobFetcher.fetchJobs(config, 'webhook');
   *
   * if (result.success) {
   *   console.log(`Fetched ${result.totalCount} jobs using ${result.method}`);
   *   result.jobs.forEach(job => console.log(`${job.title} - ${job.location}`));
   * } else {
   *   console.error('All strategies failed:', result.error);
   * }
   * ```
   * @since 1.0.0
   * @see {@link JobFetchResult} for the complete result structure
   * @see {@link IJobFetchStrategy} for individual strategy implementations
   */
  public async fetchJobs(
    config: DriveHrApiConfig,
    source: JobSource = 'drivehr'
  ): Promise<JobFetchResult> {
    // Use OpenTelemetry distributed tracing if available
    if (isTelemetryInitialized()) {
      return withSpan(
        'job-fetcher.fetch-jobs',
        async span => {
          span.setAttributes({
            'job.source': source,
            'job.company_id': config.companyId || 'unknown',
            'job.strategies_count': this.strategies.length,
          });

          return this.fetchOperation.execute(config, source, this.strategies, span);
        },
        { 'operation.type': 'fetch', 'service.name': 'job-fetcher' },
        SpanKind.INTERNAL
      );
    }

    // Fallback to non-instrumented execution
    return this.fetchOperation.execute(config, source, this.strategies);
  }
}
