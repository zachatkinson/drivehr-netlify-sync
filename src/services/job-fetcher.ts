/**
 * Job Fetching Service with Strategy Pattern
 *
 * Enterprise-grade job fetching service that implements the Strategy pattern
 * to handle multiple job data sources and formats. Follows SOLID principles
 * with each strategy responsible for one specific method of data retrieval
 * (API endpoints, JSON files, HTML scraping, embedded data).
 *
 * The service automatically tries different strategies in order of preference,
 * providing robust fallback mechanisms when primary data sources are unavailable.
 * All strategies include comprehensive error handling and data validation.
 *
 * @module job-fetcher
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for strategy interface
 * @see {@link JobFetchService} for the main orchestration service
 * @see {@link DriveHrUrlBuilder} for URL construction utilities
 */

import type { IHttpClient } from '../lib/http-client.js';
import { getLogger } from '../lib/logger.js';
import { StringUtils, DateUtils } from '../lib/utils.js';
import { DriveHrUrlBuilder, JobFetchErrorHandler } from '../lib/job-fetch-utils.js';
import { withSpan, recordJobMetrics, isTelemetryInitialized } from '../lib/telemetry.js';
import { SpanKind } from '@opentelemetry/api';
import type {
  JobFetchResult,
  RawJobData,
  NormalizedJob,
  FetchMethod,
  JobSource,
} from '../types/job.js';
import type { DriveHrApiConfig } from '../types/api.js';

/**
 * Strategy interface for fetch telemetry handling
 *
 * Defines the contract for different telemetry strategies used during
 * job fetching operations. Enables different approaches for metrics
 * collection and tracing based on environment and requirements.
 *
 * @since 1.0.0
 * @see {@link DefaultFetchTelemetryStrategy} for the standard implementation
 * @see {@link NoOpFetchTelemetryStrategy} for testing environments
 */
interface IFetchTelemetryStrategy {
  /**
   * Record metrics for a fetch operation
   *
   * @param jobId - Unique identifier for the fetch operation
   * @param operation - The operation type being performed
   * @param status - Success or failure status
   * @param duration - Operation duration in milliseconds
   * @param attributes - Additional attributes for the metric
   * @since 1.0.0
   */
  recordMetrics(
    jobId: string,
    operation: string,
    status: 'success' | 'error',
    duration: number,
    attributes: Record<string, string | number | boolean>
  ): void;

  /**
   * Set attributes on a telemetry span
   *
   * @param span - The span object to modify (if available)
   * @param attributes - Attributes to set on the span
   * @since 1.0.0
   */
  setSpanAttributes(span: unknown, attributes: Record<string, unknown>): void;
}

/**
 * Default fetch telemetry strategy implementation
 *
 * Standard implementation that uses OpenTelemetry for metrics and tracing.
 * Provides comprehensive instrumentation for production environments
 * while gracefully handling cases where telemetry is not available.
 *
 * @implements {IFetchTelemetryStrategy}
 * @since 1.0.0
 */
class DefaultFetchTelemetryStrategy implements IFetchTelemetryStrategy {
  /**
   * Record job metrics using OpenTelemetry
   *
   * @param jobId - Unique identifier for the fetch operation
   * @param operation - The operation type being performed
   * @param status - Success or failure status
   * @param duration - Operation duration in milliseconds
   * @param attributes - Additional attributes for the metric
   * @since 1.0.0
   */
  public recordMetrics(
    jobId: string,
    operation: string,
    status: 'success' | 'error',
    duration: number,
    attributes: Record<string, string | number | boolean>
  ): void {
    if (isTelemetryInitialized()) {
      recordJobMetrics(jobId, operation, status, duration, attributes);
    }
  }

  /**
   * Set attributes on an OpenTelemetry span
   *
   * @param span - The span object to modify (if available)
   * @param attributes - Attributes to set on the span
   * @since 1.0.0
   */
  public setSpanAttributes(span: unknown, attributes: Record<string, unknown>): void {
    if (
      span &&
      typeof span === 'object' &&
      span !== null &&
      'setAttributes' in span &&
      typeof span.setAttributes === 'function'
    ) {
      span.setAttributes(attributes);
    }
  }
}

/**
 * No-operation fetch telemetry strategy for testing
 *
 * Implementation that doesn't perform any telemetry operations.
 * Useful for testing environments where telemetry instrumentation
 * should be disabled to avoid interference with test execution.
 *
 * @implements {IFetchTelemetryStrategy}
 * @since 1.0.0
 */
class _NoOpFetchTelemetryStrategy implements IFetchTelemetryStrategy {
  /**
   * No-operation metrics recording
   *
   * @param _jobId - Ignored job ID
   * @param _operation - Ignored operation
   * @param _status - Ignored status
   * @param _duration - Ignored duration
   * @param _attributes - Ignored attributes
   * @since 1.0.0
   */
  public recordMetrics(
    _jobId: string,
    _operation: string,
    _status: 'success' | 'error',
    _duration: number,
    _attributes: Record<string, string | number | boolean>
  ): void {
    // No-op implementation for testing
  }

  /**
   * No-operation span attribute setting
   *
   * @param _span - Ignored span object
   * @param _attributes - Ignored attributes
   * @since 1.0.0
   */
  public setSpanAttributes(_span: unknown, _attributes: Record<string, unknown>): void {
    // No-op implementation for testing
  }
}

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
abstract class FetchOperationTemplate {
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
 * Context object for fetch operations
 *
 * Contains all the data needed to perform a fetch operation,
 * including timing information, identifiers, and configuration data.
 *
 * @interface
 * @since 1.0.0
 */
interface FetchOperationContext {
  /** Operation start time for duration calculation */
  readonly startTime: number;
  /** ISO timestamp when fetch was initiated */
  readonly fetchedAt: string;
  /** Unique identifier for this fetch operation */
  readonly jobId: string;
  /** Source identifier for tracking */
  readonly source: JobSource;
  /** Company ID from configuration */
  readonly companyId: string;
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
class DriveHrFetchOperation extends FetchOperationTemplate {
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

/**
 * Job normalization service
 *
 * Handles the normalization of raw job data into consistent format.
 * Separated from the main fetch service to follow Single Responsibility
 * Principle and enable easier testing and reuse.
 *
 * @since 1.0.0
 */
class JobNormalizer {
  /**
   * Normalize raw job data into consistent format
   *
   * Processes an array of raw job data from various sources and normalizes
   * them into a consistent structure. Filters out invalid jobs (e.g., those
   * without titles) and adds metadata like source and processing timestamp.
   *
   * @param rawJobs - Array of raw job data from fetching strategies
   * @param source - Source identifier for tracking job origin
   * @returns Promise resolving to array of normalized job objects
   * @since 1.0.0
   * @see {@link normalizeJob} for individual job normalization
   */
  public async normalizeJobs(rawJobs: RawJobData[], source: JobSource): Promise<NormalizedJob[]> {
    const processedAt = DateUtils.getCurrentIsoTimestamp();

    return rawJobs
      .map(rawJob => this.normalizeJob(rawJob, source, processedAt))
      .filter((job): job is NormalizedJob => job !== null);
  }

  /**
   * Normalize individual job data into consistent format
   *
   * Extracts and normalizes job fields from raw data, handling various
   * field name variations across different data sources. Generates fallback
   * values for missing data and ensures consistent data types.
   *
   * @param rawJob - Raw job data from any source
   * @param source - Source identifier for tracking job origin
   * @param processedAt - Timestamp when processing occurred
   * @returns Normalized job object or null if job is invalid (no title)
   * @since 1.0.0
   * @see {@link NormalizedJob} for the normalized job structure
   */
  private normalizeJob(
    rawJob: RawJobData,
    source: JobSource,
    processedAt: string
  ): NormalizedJob | null {
    const title = this.extractJobTitle(rawJob);
    if (!title) {
      return null; // Skip jobs without titles
    }

    return {
      id: this.extractJobId(rawJob, title),
      title,
      department: this.extractJobDepartment(rawJob),
      location: this.extractJobLocation(rawJob),
      type: this.extractJobType(rawJob),
      description: this.extractJobDescription(rawJob),
      postedDate: this.extractJobPostedDate(rawJob),
      applyUrl: this.extractJobApplyUrl(rawJob),
      source,
      rawData: rawJob,
      processedAt,
    };
  }

  /**
   * Extract job title from raw job data
   *
   * Handles various field name variations for job titles across different
   * data sources and normalizes whitespace.
   *
   * @param rawJob - Raw job data from any source
   * @returns Normalized job title string
   * @since 1.0.0
   */
  private extractJobTitle(rawJob: RawJobData): string {
    const title = rawJob.title ?? rawJob.position_title ?? rawJob.name ?? '';
    return title.trim();
  }

  /**
   * Extract or generate job ID from raw job data
   *
   * Uses existing job ID if available, otherwise generates a unique ID
   * based on the job title.
   *
   * @param rawJob - Raw job data from any source
   * @param title - Normalized job title for fallback ID generation
   * @returns Unique job identifier
   * @since 1.0.0
   */
  private extractJobId(rawJob: RawJobData, title: string): string {
    return rawJob.id ?? rawJob.job_id ?? this.generateJobId(title);
  }

  private extractJobDepartment(rawJob: RawJobData): string {
    const department = rawJob.department ?? rawJob.category ?? rawJob.division ?? '';
    return department.trim();
  }

  private extractJobLocation(rawJob: RawJobData): string {
    const location = rawJob.location ?? rawJob.city ?? rawJob.office ?? '';
    return location.trim();
  }

  private extractJobType(rawJob: RawJobData): string {
    const type = rawJob.type ?? rawJob.employment_type ?? rawJob.schedule ?? 'Full-time';
    return type.trim();
  }

  private extractJobDescription(rawJob: RawJobData): string {
    const description = rawJob.description ?? rawJob.summary ?? rawJob.overview ?? '';
    return description.trim();
  }

  /**
   * Extract and normalize job posted date
   *
   * Handles various date field names and formats, converting to ISO string.
   * Uses current timestamp as fallback if no date is provided.
   *
   * @param rawJob - Raw job data from any source
   * @returns ISO formatted date string
   * @since 1.0.0
   */
  private extractJobPostedDate(rawJob: RawJobData): string {
    const dateString = rawJob.posted_date ?? rawJob.created_at ?? rawJob.date_posted;
    return dateString ? DateUtils.toIsoString(dateString) : DateUtils.getCurrentIsoTimestamp();
  }

  private extractJobApplyUrl(rawJob: RawJobData): string {
    return rawJob.apply_url ?? rawJob.application_url ?? rawJob.url ?? '';
  }

  /**
   * Generate unique job ID from title
   *
   * Creates a normalized, URL-safe identifier from the job title.
   *
   * @param title - Job title to generate ID from
   * @returns Normalized job identifier
   * @since 1.0.0
   */
  private generateJobId(title: string): string {
    return StringUtils.generateIdFromTitle(title);
  }
}

/**
 * Interface for job fetching strategies
 *
 * Defines the contract that all job fetching strategies must implement.
 * Each strategy handles one specific method of retrieving job data from
 * DriveHR systems, ensuring consistent behavior and error handling across
 * different data sources.
 *
 * @example
 * ```typescript
 * class CustomJobFetchStrategy implements IJobFetchStrategy {
 *   readonly name: FetchMethod = 'custom';
 *
 *   canHandle(config: DriveHrApiConfig): boolean {
 *     return Boolean(config.customEndpoint);
 *   }
 *
 *   async fetchJobs(config: DriveHrApiConfig, httpClient: IHttpClient): Promise<RawJobData[]> {
 *     // Implementation here
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link FetchMethod} for available strategy types
 * @see {@link DriveHrApiConfig} for configuration structure
 */
export interface IJobFetchStrategy {
  /** Unique identifier for this strategy */
  readonly name: FetchMethod;

  /**
   * Determine if this strategy can handle the given configuration
   * @param config - DriveHR API configuration to evaluate
   * @returns True if strategy can process this configuration
   */
  canHandle(config: DriveHrApiConfig): boolean;

  /**
   * Fetch jobs using this strategy's specific method
   * @param config - DriveHR API configuration
   * @param httpClient - HTTP client for making requests
   * @returns Promise resolving to array of raw job data
   * @throws {Error} When strategy fails to fetch job data
   */
  fetchJobs(config: DriveHrApiConfig, httpClient: IHttpClient): Promise<RawJobData[]>;
}

/**
 * HTML scraping strategy interface
 *
 * Defines the contract for HTML parsing implementations that extract
 * job data from HTML content. Enables dependency injection and testing
 * by allowing different HTML parsing strategies to be used.
 *
 * @example
 * ```typescript
 * class CustomHtmlParser implements IHtmlParser {
 *   parseJobsFromHtml(html: string, baseUrl: string): RawJobData[] {
 *     // Custom parsing logic here
 *     return extractedJobs;
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link HtmlJobFetchStrategy} for usage in HTML fetching strategy
 */
export interface IHtmlParser {
  /**
   * Parse job data from HTML content
   * @param html - The HTML content to parse
   * @param baseUrl - Base URL for resolving relative links
   * @returns Array of raw job data extracted from HTML
   */
  parseJobsFromHtml(html: string, baseUrl: string): RawJobData[];
}

/**
 * HTML-based job fetching strategy
 *
 * Fetches job data by scraping HTML content from careers pages.
 * Uses an injected HTML parser to extract structured job data from
 * unstructured HTML content. Includes intelligent detection of
 * "no jobs available" scenarios.
 *
 * @implements {IJobFetchStrategy}
 * @example
 * ```typescript
 * const htmlParser = new CheerioHtmlParser();
 * const strategy = new HtmlJobFetchStrategy(htmlParser);
 * const config = { careersUrl: 'https://example.com/careers' };
 *
 * if (strategy.canHandle(config)) {
 *   const jobs = await strategy.fetchJobs(config, httpClient);
 *   console.log(`Scraped ${jobs.length} jobs from HTML`);
 * }
 * ```
 * @since 1.0.0
 * @see {@link IHtmlParser} for the parser interface
 */
export class HtmlJobFetchStrategy implements IJobFetchStrategy {
  public readonly name: FetchMethod = 'html';

  /**
   * Create HTML job fetch strategy with parser dependency
   *
   * @param htmlParser - HTML parser implementation for extracting job data
   * @since 1.0.0
   */
  constructor(private readonly htmlParser: IHtmlParser) {}

  /**
   * Check if HTML strategy can handle the configuration
   *
   * Requires a careers URL to be present for HTML scraping.
   *
   * @param config - DriveHR API configuration to validate
   * @returns True if careersUrl is provided
   * @since 1.0.0
   */
  public canHandle(config: DriveHrApiConfig): boolean {
    return Boolean(config.careersUrl);
  }

  /**
   * Fetch jobs by scraping HTML content
   *
   * Downloads the careers page HTML and uses the injected parser to extract
   * job data. Includes intelligent detection of "no jobs available" scenarios
   * by scanning for common phrases that indicate empty job listings.
   *
   * @param config - DriveHR API configuration with careers URL
   * @param httpClient - HTTP client for downloading HTML content
   * @returns Promise resolving to array of raw job data
   * @throws {Error} When HTML page is not accessible
   * @example
   * ```typescript
   * const strategy = new HtmlJobFetchStrategy(htmlParser);
   * try {
   *   const jobs = await strategy.fetchJobs(config, httpClient);
   *   if (jobs.length === 0) {
   *     console.log('No jobs found or "no jobs" indicator detected');
   *   } else {
   *     console.log(`Scraped ${jobs.length} jobs from HTML`);
   *   }
   * } catch (error) {
   *   console.error('HTML scraping failed:', error.message);
   * }
   * ```
   * @since 1.0.0
   */
  public async fetchJobs(config: DriveHrApiConfig, httpClient: IHttpClient): Promise<RawJobData[]> {
    const careersUrl = DriveHrUrlBuilder.buildCareersPageUrl(config);
    const response = await httpClient.get<string>(careersUrl, {
      Accept: 'text/html,application/xhtml+xml',
    });

    if (!response.success) {
      throw new Error('HTML page not accessible');
    }

    // Store response data to avoid "body used already" error
    const htmlContent = response.data;
    const jobs = this.htmlParser.parseJobsFromHtml(htmlContent, careersUrl);

    // Check for "no jobs" indicators
    const htmlLower = htmlContent.toLowerCase();
    const noJobsIndicators = [
      'no positions available',
      'no current openings',
      'no job availabilities',
      'no opportunities',
    ];

    if (noJobsIndicators.some(indicator => htmlLower.includes(indicator))) {
      return [];
    }

    return jobs;
  }
}

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
