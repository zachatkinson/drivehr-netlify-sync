import type { ITelemetryStrategy } from '../../lib/telemetry-strategy.js';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { RawJobData, FetchMethod, JobSource } from '../../types/job.js';

/**
 * Fetch telemetry strategy interface
 *
 * Extends the base telemetry strategy with fetch-specific metrics recording
 * capabilities. Provides standardized telemetry instrumentation for all
 * job fetching operations. Enables different approaches for metrics
 * collection and tracing based on environment and requirements.
 *
 * @since 1.0.0
 * @see {@link DefaultFetchTelemetryStrategy} for the standard implementation
 */
export interface IFetchTelemetryStrategy extends ITelemetryStrategy {
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
}

/**
 * Fetch operation context interface
 *
 * Contains metadata and timing information for a specific job fetch operation.
 * Used to pass context between different stages of the fetch process and
 * for telemetry tracking.
 *
 * @since 1.0.0
 */
export interface FetchOperationContext {
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
