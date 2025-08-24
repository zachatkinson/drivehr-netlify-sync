/**
 * Job Fetcher Type Definitions
 *
 * Comprehensive type definitions for the DriveHR job fetching framework implementing
 * Strategy pattern architecture with enterprise-grade observability and data extraction
 * capabilities. These types provide the foundational contracts for job fetching strategies,
 * telemetry integration, HTML parsing, and operation context management.
 *
 * The type system ensures compile-time safety, interface consistency, and proper
 * abstraction boundaries across the job fetching architecture. All interfaces follow
 * enterprise design patterns with comprehensive error handling, telemetry integration,
 * and extensibility features for supporting multiple data sources and parsing strategies.
 *
 * Core Type Categories:
 * - Strategy Interfaces: Contract definitions for pluggable job fetching strategies
 * - Telemetry Integration: Specialized observability interfaces for metrics collection
 * - Parser Abstractions: HTML parsing interface contracts for dependency injection
 * - Operation Context: Metadata and timing structures for operation tracking
 * - Configuration Support: Type-safe configuration validation and processing
 *
 * @example
 * ```typescript
 * import type {
 *   IJobFetchStrategy,
 *   IFetchTelemetryStrategy,
 *   IHtmlParser,
 *   FetchOperationContext
 * } from './types.js';
 *
 * // Implementing a custom job fetch strategy
 * class ApiJobFetchStrategy implements IJobFetchStrategy {
 *   readonly name: FetchMethod = 'api';
 *
 *   canHandle(config: DriveHrApiConfig): boolean {
 *     return Boolean(config.apiBaseUrl && config.apiKey);
 *   }
 *
 *   async fetchJobs(config: DriveHrApiConfig, httpClient: IHttpClient): Promise<RawJobData[]> {
 *     const response = await httpClient.get(`${config.apiBaseUrl}/jobs`);
 *     return response.data;
 *   }
 * }
 *
 * // Custom telemetry strategy implementation
 * class CustomTelemetryStrategy implements IFetchTelemetryStrategy {
 *   recordMetrics(jobId: string, operation: string, status: 'success' | 'error', duration: number, attributes: Record<string, string | number | boolean>): void {
 *     // Custom metrics implementation
 *   }
 * }
 * ```
 *
 * @module job-fetcher-types
 * @since 1.0.0
 * @see {@link HtmlJobFetchStrategy} for HTML strategy implementation example
 * @see {@link DefaultFetchTelemetryStrategy} for telemetry strategy implementation
 * @see {@link DriveHrFetchOperation} for operation context usage
 * @see {@link JobNormalizer} for raw job data processing
 */

import type { ITelemetryStrategy } from '../../lib/telemetry-strategy.js';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { RawJobData, FetchMethod, JobSource } from '../../types/job.js';

/**
 * Specialized telemetry strategy interface for job fetch operations
 *
 * Extends the base telemetry strategy with job-fetch specific metrics recording
 * capabilities and observability features. This interface provides standardized
 * telemetry instrumentation contracts for all job fetching operations, enabling
 * consistent metrics collection, performance monitoring, and distributed tracing
 * across different fetching strategies and execution environments.
 *
 * The interface enables dependency injection of different telemetry approaches
 * based on deployment requirements, observability infrastructure, and performance
 * constraints. Implementations can range from full OpenTelemetry integration to
 * lightweight custom metrics solutions for specific operational needs.
 *
 * @extends {ITelemetryStrategy}
 * @since 1.0.0
 * @see {@link DefaultFetchTelemetryStrategy} for the standard OpenTelemetry implementation
 * @see {@link BaseTelemetryStrategy} for inherited base telemetry capabilities
 */
export interface IFetchTelemetryStrategy extends ITelemetryStrategy {
  /**
   * Record comprehensive metrics for job fetch operations
   *
   * Captures detailed performance metrics, success/failure rates, and contextual
   * attributes for comprehensive observability of job fetching operations. This method
   * serves as the primary interface for collecting telemetry data throughout the
   * job fetch lifecycle, enabling performance monitoring, error tracking, and
   * operational insights for production deployments.
   *
   * The method should handle various metric types including timing data, throughput
   * measurements, error rates, and strategy effectiveness metrics. Implementations
   * must provide graceful handling of telemetry infrastructure unavailability to
   * ensure job fetching operations remain functional regardless of observability
   * system status.
   *
   * @param jobId - Unique identifier for correlating the specific fetch operation across logs
   * @param operation - Operation type identifier for categorizing different phases of job processing
   * @param status - Operation outcome status for success/failure rate calculation and alerting
   * @param duration - Operation execution duration in milliseconds for performance analysis
   * @param attributes - Additional contextual metadata for metric enrichment and debugging
   * @example
   * ```typescript
   * const telemetryStrategy: IFetchTelemetryStrategy = new CustomTelemetryStrategy();
   *
   * // Record successful fetch operation
   * telemetryStrategy.recordMetrics(
   *   'fetch-operation-001',
   *   'html-scraping',
   *   'success',
   *   2500,
   *   {
   *     source: 'webhook',
   *     strategy: 'html',
   *     jobCount: 15,
   *     companyId: 'tech-startup',
   *     careersUrl: 'https://company.com/careers'
   *   }
   * );
   *
   * // Record failed operation with error context
   * telemetryStrategy.recordMetrics(
   *   'fetch-operation-002',
   *   'api-request',
   *   'error',
   *   5000,
   *   {
   *     source: 'manual',
   *     strategy: 'api',
   *     error: 'timeout',
   *     endpoint: 'https://api.company.com/jobs'
   *   }
   * );
   * ```
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
 * Operation context metadata for job fetch operations
 *
 * Comprehensive context container providing metadata, timing information, and
 * tracking identifiers for specific job fetch operations. This interface serves
 * as a data carrier for operation state, enabling proper context propagation
 * throughout the fetch operation lifecycle including telemetry tracking, error
 * reporting, and performance monitoring.
 *
 * The context enables correlation of operation phases, provides timing anchors
 * for duration calculations, and maintains operation identity across distributed
 * system boundaries. All context data is immutable to ensure consistency and
 * prevent accidental modification during operation execution.
 *
 * Context Usage Flow:
 * 1. Created at operation initiation with timing and identification data
 * 2. Passed through all operation phases for context continuity
 * 3. Used for telemetry correlation and performance measurement
 * 4. Referenced in error handling for debugging and incident response
 *
 * @since 1.0.0
 * @see {@link DriveHrFetchOperation} for context creation and usage
 * @see {@link IFetchTelemetryStrategy} for context utilization in metrics
 */
export interface FetchOperationContext {
  /** High-resolution operation start timestamp for precise duration calculation */
  readonly startTime: number;
  /** ISO 8601 formatted timestamp when the fetch operation was initiated */
  readonly fetchedAt: string;
  /** Unique operation identifier for correlation across logs and telemetry systems */
  readonly jobId: string;
  /** Source system identifier for tracking operation origin and analytics */
  readonly source: JobSource;
  /** Company identifier from configuration for tenant isolation and metrics segmentation */
  readonly companyId: string;
}

/**
 * Strategy pattern interface for job fetching implementations
 *
 * Defines the comprehensive contract that all job fetching strategies must implement
 * to ensure consistent behavior, error handling, and integration capabilities across
 * different data extraction methods. Each strategy encapsulates one specific approach
 * to retrieving job data from DriveHR systems while maintaining uniform interfaces
 * for capability checking, configuration validation, and job data extraction.
 *
 * The interface enables the Strategy pattern implementation with automatic strategy
 * selection based on configuration capabilities, providing robust fallback mechanisms
 * and consistent error handling across all data sources. Strategies can implement
 * various approaches including API calls, HTML scraping, JSON parsing, or custom
 * data extraction methods while maintaining interface compatibility.
 *
 * Strategy Implementation Requirements:
 * - Configuration compatibility validation through canHandle method
 * - Consistent error handling and exception propagation
 * - Raw job data return in standardized format for normalization
 * - Graceful handling of network failures and data source unavailability
 * - Performance-conscious implementation with appropriate timeouts
 *
 * @since 1.0.0
 * @see {@link HtmlJobFetchStrategy} for HTML scraping strategy implementation
 * @see {@link FetchMethod} for available strategy type identifiers
 * @see {@link DriveHrApiConfig} for configuration structure requirements
 */
export interface IJobFetchStrategy {
  /** Unique strategy identifier used for logging, telemetry, and strategy selection */
  readonly name: FetchMethod;

  /**
   * Validate if strategy can process the provided configuration
   *
   * Performs capability assessment to determine if this specific strategy can
   * successfully process the given DriveHR configuration. This method enables
   * automatic strategy selection by testing configuration requirements and
   * dependencies for successful job data extraction.
   *
   * The validation should check for required configuration properties, endpoint
   * availability, authentication requirements, and any strategy-specific
   * dependencies. The method must return quickly and not perform actual data
   * retrieval operations to maintain performance during strategy selection.
   *
   * @param config - DriveHR API configuration to evaluate for strategy compatibility
   * @returns True if strategy can successfully process this configuration, false otherwise
   * @example
   * ```typescript
   * class ApiJobFetchStrategy implements IJobFetchStrategy {
   *   readonly name: FetchMethod = 'api';
   *
   *   canHandle(config: DriveHrApiConfig): boolean {
   *     // Check for required API configuration
   *     return Boolean(
   *       config.apiBaseUrl &&
   *       config.apiKey &&
   *       config.companyId
   *     );
   *   }
   * }
   *
   * class HtmlJobFetchStrategy implements IJobFetchStrategy {
   *   readonly name: FetchMethod = 'html';
   *
   *   canHandle(config: DriveHrApiConfig): boolean {
   *     // Check for required HTML scraping configuration
   *     return Boolean(config.careersUrl);
   *   }
   * }
   * ```
   * @since 1.0.0
   */
  canHandle(config: DriveHrApiConfig): boolean;

  /**
   * Execute job data extraction using strategy-specific implementation
   *
   * Performs the actual job data retrieval using the strategy's specialized approach
   * for data extraction. This method implements the core strategy logic including
   * HTTP requests, data parsing, error handling, and result formatting. The method
   * must return raw job data in a consistent format for subsequent normalization
   * processing regardless of the underlying data source format or structure.
   *
   * Implementation requirements include comprehensive error handling, appropriate
   * timeout management, retry logic for transient failures, and consistent data
   * format return. The method should provide detailed error information for
   * debugging and telemetry purposes while maintaining security by not exposing
   * sensitive configuration details in error messages.
   *
   * @param config - Complete DriveHR API configuration with endpoint and authentication details
   * @param httpClient - HTTP client instance configured with appropriate timeout and retry settings
   * @returns Promise resolving to array of raw job data objects for normalization processing
   * @throws {Error} When strategy fails to retrieve job data due to network, parsing, or configuration errors
   * @example
   * ```typescript
   * class ApiJobFetchStrategy implements IJobFetchStrategy {
   *   async fetchJobs(config: DriveHrApiConfig, httpClient: IHttpClient): Promise<RawJobData[]> {
   *     try {
   *       const response = await httpClient.get(`${config.apiBaseUrl}/jobs`, {
   *         headers: {
   *           'Authorization': `Bearer ${config.apiKey}`,
   *           'X-Company-ID': config.companyId
   *         }
   *       });
   *
   *       if (!response.success) {
   *         throw new Error(`API request failed with status ${response.status}`);
   *       }
   *
   *       return response.data.jobs || [];
   *     } catch (error) {
   *       throw new Error(`API job fetch failed: ${error.message}`);
   *     }
   *   }
   * }
   * ```
   * @since 1.0.0
   */
  fetchJobs(config: DriveHrApiConfig, httpClient: IHttpClient): Promise<RawJobData[]>;
}

/**
 * HTML parsing strategy interface for job data extraction
 *
 * Defines the contract for HTML parsing implementations that extract structured
 * job data from unstructured HTML content. This interface enables dependency
 * injection and strategy pattern implementation for HTML parsing, allowing
 * different parsing approaches based on HTML structure, performance requirements,
 * and data extraction complexity.
 *
 * The interface supports various parsing strategies including CSS selector-based
 * extraction, regular expression parsing, DOM traversal approaches, or machine
 * learning-based content extraction. Implementations should provide robust error
 * handling, graceful degradation for malformed HTML, and consistent data format
 * output regardless of the underlying parsing technology.
 *
 * Parser Implementation Considerations:
 * - Memory-efficient processing for large HTML documents
 * - Graceful handling of malformed or incomplete HTML content
 * - Consistent data extraction across different HTML structures
 * - Performance optimization for high-throughput processing
 * - Security considerations for untrusted HTML content processing
 *
 * @since 1.0.0
 * @see {@link HtmlJobFetchStrategy} for usage in HTML fetching strategy implementation
 * @see {@link CheerioHtmlParser} for DOM-based parsing implementation example
 */
export interface IHtmlParser {
  /**
   * Extract structured job data from HTML content
   *
   * Parses HTML content to extract job posting information using strategy-specific
   * parsing logic. This method transforms unstructured HTML into structured raw
   * job data objects suitable for normalization processing. The implementation
   * must handle various HTML structures, extract relevant job fields, and resolve
   * relative URLs using the provided base URL.
   *
   * The method should implement robust error handling for malformed HTML, missing
   * job data, or unexpected content structures. Parsing failures should not throw
   * exceptions but instead return empty arrays or partial data with appropriate
   * logging for debugging purposes.
   *
   * @param html - Complete HTML content from careers page for parsing and data extraction
   * @param baseUrl - Base URL for resolving relative links in job application URLs and images
   * @returns Array of raw job data objects extracted from HTML content structure
   * @example
   * ```typescript
   * class CheerioHtmlParser implements IHtmlParser {
   *   parseJobsFromHtml(html: string, baseUrl: string): RawJobData[] {
   *     const $ = cheerio.load(html);
   *     const jobs: RawJobData[] = [];
   *
   *     $('.job-listing').each((index, element) => {
   *       const $job = $(element);
   *       const job: RawJobData = {
   *         title: $job.find('.job-title').text().trim(),
   *         department: $job.find('.job-department').text().trim(),
   *         location: $job.find('.job-location').text().trim(),
   *         description: $job.find('.job-description').text().trim(),
   *         apply_url: new URL($job.find('.apply-link').attr('href') || '', baseUrl).href
   *       };
   *
   *       if (job.title) { // Only include jobs with valid titles
   *         jobs.push(job);
   *       }
   *     });
   *
   *     return jobs;
   *   }
   * }
   *
   * // Usage with regex-based parsing approach
   * class RegexHtmlParser implements IHtmlParser {
   *   parseJobsFromHtml(html: string, baseUrl: string): RawJobData[] {
   *     const jobPattern = /<div[^>]*class="job-item"[^>]*>(.+?)<\/div>/gis;
   *     const titlePattern = /<h3[^>]*>(.+?)<\/h3>/i;
   *     const jobs: RawJobData[] = [];
   *
   *     let match;
   *     while ((match = jobPattern.exec(html)) !== null) {
   *       const jobHtml = match[1];
   *       const titleMatch = titlePattern.exec(jobHtml);
   *
   *       if (titleMatch) {
   *         jobs.push({
   *           title: titleMatch[1].trim(),
   *           // Additional field extraction...
   *         });
   *       }
   *     }
   *
   *     return jobs;
   *   }
   * }
   * ```
   * @since 1.0.0
   */
  parseJobsFromHtml(html: string, baseUrl: string): RawJobData[];
}
