/**
 * Job Fetcher Service
 *
 * Enterprise-grade orchestration service implementing comprehensive Strategy pattern architecture
 * for DriveHR job data fetching operations. Coordinates multiple job fetching strategies with
 * automatic failover mechanisms, providing robust fault-tolerant job data retrieval with
 * comprehensive telemetry integration and data normalization pipelines.
 *
 * This service acts as the main entry point for all job fetching operations, managing strategy
 * selection, execution order, error handling, and result aggregation. The service automatically
 * tries strategies in order of preference (API → JSON → HTML → Embedded) until one succeeds
 * or all strategies are exhausted, ensuring maximum data retrieval reliability.
 *
 * Core Architecture Features:
 * - Strategy Pattern: Pluggable job fetching strategies with automatic selection
 * - Template Method: Consistent operation workflow across all strategies
 * - Dependency Injection: Flexible component configuration and testing support
 * - OpenTelemetry Integration: Comprehensive distributed tracing and metrics
 * - Error Recovery: Automatic fallback mechanisms and graceful degradation
 * - Data Normalization: Consistent job data format across all strategies
 *
 * @example
 * ```typescript
 * import { JobFetchService } from './job-fetcher/job-fetch-service.js';
 * import { createHttpClient } from '../lib/http-client.js';
 * import { CheerioHtmlParser } from '../html-parser.js';
 *
 * // Initialize dependencies
 * const httpClient = createHttpClient({ timeout: 30000 });
 * const htmlParser = new CheerioHtmlParser();
 *
 * // Create service with dependency injection
 * const jobFetcher = new JobFetchService(httpClient, htmlParser);
 *
 * // Configure DriveHR endpoint
 * const config = {
 *   companyId: 'tech-startup',
 *   apiBaseUrl: 'https://api.drivehr.app',
 *   careersUrl: 'https://drivehr.app/careers/tech-startup/list'
 * };
 *
 * // Execute job fetching with automatic strategy fallbacks
 * const result = await jobFetcher.fetchJobs(config, 'webhook');
 *
 * if (result.success) {
 *   console.log(`Successfully fetched ${result.totalCount} jobs using ${result.method}`);
 *   result.jobs.forEach(job => {
 *     console.log(`- ${job.title} at ${job.location} (${job.department})`);
 *   });
 * } else {
 *   console.error('All job fetching strategies failed:', result.error);
 *   // Implement fallback logic or alerting
 * }
 * ```
 *
 * @module job-fetch-service
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for strategy interface contract
 * @see {@link DriveHrFetchOperation} for operation template implementation
 * @see {@link JobNormalizer} for data normalization pipeline
 * @see {@link DefaultFetchTelemetryStrategy} for telemetry integration
 */

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
 * Main job fetching orchestration service
 *
 * Central orchestrator for DriveHR job data retrieval operations implementing enterprise-grade
 * Strategy pattern architecture with automatic failover mechanisms. This service coordinates
 * multiple job fetching strategies, handles telemetry integration, manages error recovery,
 * and ensures consistent data normalization across all retrieval methods.
 *
 * The service uses dependency injection for flexibility and testability, allowing different
 * HTTP clients and HTML parsers to be plugged in based on environment requirements.
 * All operations are instrumented with OpenTelemetry for comprehensive observability
 * in production environments.
 *
 * Strategy Execution Order:
 * 1. HTML Strategy: Direct careers page scraping
 * 2. Future strategies can be added through constructor injection
 *
 * @since 1.0.0
 * @see {@link DriveHrFetchOperation} for the underlying fetch operation template
 * @see {@link IJobFetchStrategy} for strategy interface requirements
 */
export class JobFetchService {
  private readonly strategies: readonly IJobFetchStrategy[];
  private readonly fetchOperation: DriveHrFetchOperation;

  /**
   * Create job fetch service with dependency injection
   *
   * Initializes the service with pluggable dependencies for HTTP communication and HTML
   * parsing. Sets up the strategy pipeline with available fetch strategies and configures
   * the operation template with telemetry integration and job normalization capabilities.
   *
   * The service uses a composition pattern to aggregate multiple strategies while
   * maintaining a clean separation of concerns between HTTP operations, HTML parsing,
   * telemetry collection, and data normalization.
   *
   * @param httpClient - HTTP client implementation for API requests and content retrieval
   * @param htmlParser - HTML parser implementation for structured data extraction
   * @example
   * ```typescript
   * import { createHttpClient } from '../lib/http-client.js';
   * import { CheerioHtmlParser } from '../html-parser.js';
   *
   * const httpClient = createHttpClient({
   *   timeout: 30000,
   *   retries: 3,
   *   userAgent: 'DriveHR-Sync/1.0'
   * });
   *
   * const htmlParser = new CheerioHtmlParser();
   * const jobFetcher = new JobFetchService(httpClient, htmlParser);
   * ```
   * @since 1.0.0
   */
  constructor(
    private readonly httpClient: IHttpClient,
    htmlParser: IHtmlParser
  ) {
    this.strategies = [new HtmlJobFetchStrategy(htmlParser)] as const;

    const telemetryStrategy = new DefaultFetchTelemetryStrategy();
    const jobNormalizer = new JobNormalizer();
    this.fetchOperation = new DriveHrFetchOperation(httpClient, jobNormalizer, telemetryStrategy);
  }

  /**
   * Fetch jobs using all available strategies with automatic failover
   *
   * Orchestrates comprehensive job data retrieval using multiple strategies with automatic
   * failover mechanisms. This method implements enterprise-grade Template Method pattern
   * execution with full OpenTelemetry instrumentation for production monitoring and
   * debugging capabilities.
   *
   * The operation includes:
   * 1. OpenTelemetry span creation with distributed tracing context
   * 2. Strategy capability validation and selection
   * 3. Sequential strategy execution with automatic failover
   * 4. Comprehensive error handling and recovery mechanisms
   * 5. Job data normalization and validation
   * 6. Telemetry metrics recording and span completion
   *
   * @param config - DriveHR API configuration containing endpoint URLs and company details
   * @param source - Source identifier for tracking job origin and analytics purposes
   * @returns Promise resolving to comprehensive job fetch result with success status and data
   * @example
   * ```typescript
   * const config = {
   *   companyId: 'innovative-tech',
   *   apiBaseUrl: 'https://api.drivehr.app',
   *   careersUrl: 'https://drivehr.app/careers/innovative-tech/list'
   * };
   *
   * try {
   *   const result = await jobFetcher.fetchJobs(config, 'manual');
   *
   *   if (result.success) {
   *     console.log(`✅ Success: Fetched ${result.totalCount} jobs using ${result.method}`);
   *
   *     // Process jobs
   *     for (const job of result.jobs) {
   *       console.log(`📋 ${job.title}`);
   *       console.log(`🏢 ${job.department} • 📍 ${job.location}`);
   *       console.log(`🔗 ${job.applyUrl}`);
   *       console.log('---');
   *     }
   *   } else {
   *     console.error('❌ All strategies failed:', result.error);
   *     // Handle failure case - maybe retry later or use cached data
   *   }
   * } catch (error) {
   *   console.error('🚨 Critical error during job fetching:', error);
   *   // Handle unexpected errors
   * }
   * ```
   * @since 1.0.0
   * @see {@link JobFetchResult} for complete result structure documentation
   * @see {@link DriveHrApiConfig} for configuration requirements
   * @see {@link JobSource} for available source type values
   */
  public async fetchJobs(
    config: DriveHrApiConfig,
    source: JobSource = 'drivehr'
  ): Promise<JobFetchResult> {
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

    return this.fetchOperation.execute(config, source, this.strategies);
  }
}
