/**
 * Job Fetching Utilities
 *
 * Enterprise-grade shared utilities for job fetching strategies that eliminate
 * DRY violations and provide consistent patterns for URL construction, error
 * handling, and data extraction across multiple job fetching implementations.
 *
 * This module centralizes common patterns used by different job fetching
 * strategies to ensure consistency, maintainability, and testability.
 * All utilities follow enterprise patterns with comprehensive error handling.
 *
 * @module job-fetch-utils
 * @since 1.0.0
 * @see {@link DriveHrUrlBuilder} for URL construction utilities
 * @see {@link JobFetchErrorHandler} for error handling utilities
 * @see {@link JobDataExtractor} for data extraction utilities
 */

import { getLogger } from './logger.js';
import type { DriveHrApiConfig } from '../types/api.js';
import type { RawJobData } from '../types/job.js';

/**
 * Constants for DriveHR API endpoints and configuration
 *
 * Centralized constants for all DriveHR API endpoints, base URLs, and
 * path configurations. Using `as const` to ensure type safety and
 * prevent accidental mutations in production code.
 *
 * @example
 * ```typescript
 * // Building API URLs
 * const apiUrl = `${DRIVEHR_API_CONSTANTS.BASE_URL}${DRIVEHR_API_CONSTANTS.API_PATHS.CAREERS}/123/jobs`;
 *
 * // Type-safe access to constants
 * const basePath = DRIVEHR_API_CONSTANTS.API_PATHS.CAREERS; // '/api/careers'
 * ```
 * @since 1.0.0
 * @see {@link DriveHrUrlBuilder} for URL construction using these constants
 */
export const DRIVEHR_API_CONSTANTS = {
  /** Base URL for all DriveHR API requests */
  BASE_URL: 'https://drivehris.app',
  /** API path configurations for different endpoints */
  API_PATHS: {
    /** Legacy careers API endpoint */
    CAREERS: '/api/careers',
    /** Version 1 careers API endpoint */
    CAREERS_V1: '/api/v1/careers',
    /** Direct jobs API endpoint */
    JOBS: '/api/jobs',
  },
} as const;

/**
 * URL builder utility for DriveHR API endpoints
 *
 * Centralized URL construction service that eliminates duplicate URL building
 * patterns across different job fetching strategies. Provides type-safe methods
 * for building various DriveHR API endpoints with proper validation and
 * fallback handling.
 *
 * All methods are static to allow usage without instantiation and to emphasize
 * the stateless utility nature of this class. URL construction follows DriveHR
 * API conventions and handles multiple endpoint formats.
 *
 * @example
 * ```typescript
 * const config = {
 *   companyId: 'acme-corp',
 *   apiBaseUrl: 'https://api.drivehris.app',
 *   careersUrl: 'https://drivehris.app/careers/acme-corp/list'
 * };
 *
 * // Build multiple API URLs for fallback strategies
 * const apiUrls = DriveHrUrlBuilder.buildApiUrls(config);
 * // Returns: ['https://drivehris.app/api/careers/acme-corp/jobs', ...]
 *
 * // Build careers page URL
 * const careersUrl = DriveHrUrlBuilder.buildCareersPageUrl(config);
 * // Returns: 'https://drivehris.app/careers/acme-corp/list'
 * ```
 * @since 1.0.0
 * @see {@link DRIVEHR_API_CONSTANTS} for endpoint constants
 * @see {@link DriveHrApiConfig} for configuration interface
 */
export class DriveHrUrlBuilder {
  /**
   * Build multiple API URLs for job fetching with fallback strategies
   *
   * Constructs an array of potential API endpoints that job fetching strategies
   * can attempt in order. Each URL represents a different API version or
   * endpoint format that DriveHR may expose job data through.
   *
   * @param config - DriveHR API configuration containing company ID and base URLs
   * @returns Array of API URLs ordered by preference (most reliable first)
   * @example
   * ```typescript
   * const config = {
   *   companyId: 'tech-startup',
   *   apiBaseUrl: 'https://api.drivehris.app/tech-startup'
   * };
   *
   * const urls = DriveHrUrlBuilder.buildApiUrls(config);
   * // Returns:
   * // [
   * //   'https://drivehris.app/api/careers/tech-startup/jobs',
   * //   'https://drivehris.app/api/v1/careers/tech-startup/positions',
   * //   'https://api.drivehris.app/tech-startup/api/jobs'
   * // ]
   * ```
   * @since 1.0.0
   * @see {@link DRIVEHR_API_CONSTANTS.API_PATHS} for endpoint path definitions
   */
  public static buildApiUrls(config: DriveHrApiConfig): string[] {
    const { companyId, apiBaseUrl } = config;

    return [
      `${DRIVEHR_API_CONSTANTS.BASE_URL}${DRIVEHR_API_CONSTANTS.API_PATHS.CAREERS}/${companyId}/jobs`,
      `${DRIVEHR_API_CONSTANTS.BASE_URL}${DRIVEHR_API_CONSTANTS.API_PATHS.CAREERS_V1}/${companyId}/positions`,
      `${apiBaseUrl}${DRIVEHR_API_CONSTANTS.API_PATHS.JOBS}`,
    ];
  }

  /**
   * Build careers page URL with fallback to default format
   *
   * Constructs the URL for the company's careers page, preferring the
   * explicitly configured URL but falling back to the standard DriveHR
   * careers page format if not provided.
   *
   * @param config - DriveHR API configuration with optional careers URL
   * @returns The complete careers page URL
   * @example
   * ```typescript
   * // With explicit careers URL
   * const configWithUrl = {
   *   companyId: 'my-company',
   *   careersUrl: 'https://custom.example.com/jobs'
   * };
   * const url1 = DriveHrUrlBuilder.buildCareersPageUrl(configWithUrl);
   * // Returns: 'https://custom.example.com/jobs'
   *
   * // With default URL construction
   * const configWithoutUrl = { companyId: 'my-company' };
   * const url2 = DriveHrUrlBuilder.buildCareersPageUrl(configWithoutUrl);
   * // Returns: 'https://drivehris.app/careers/my-company/list'
   * ```
   * @since 1.0.0
   * @see {@link buildCareersJsonUrl} for JSON endpoint variant
   */
  public static buildCareersPageUrl(config: DriveHrApiConfig): string {
    return (
      config.careersUrl || `${DRIVEHR_API_CONSTANTS.BASE_URL}/careers/${config.companyId}/list`
    );
  }

  /**
   * Build careers JSON endpoint URL from careers page URL
   *
   * Converts the careers page URL to its corresponding JSON API endpoint
   * by replacing the '/list' suffix with '.json'. This follows DriveHR's
   * convention where JSON data is available at the same path with a
   * different extension.
   *
   * @param config - DriveHR API configuration
   * @returns The JSON API endpoint URL
   * @example
   * ```typescript
   * const config = { companyId: 'startup-co' };
   * const jsonUrl = DriveHrUrlBuilder.buildCareersJsonUrl(config);
   * // Returns: 'https://drivehris.app/careers/startup-co.json'
   *
   * // Works with custom careers URLs too
   * const customConfig = {
   *   companyId: 'startup-co',
   *   careersUrl: 'https://custom.example.com/careers/startup-co/list'
   * };
   * const customJsonUrl = DriveHrUrlBuilder.buildCareersJsonUrl(customConfig);
   * // Returns: 'https://custom.example.com/careers/startup-co.json'
   * ```
   * @since 1.0.0
   * @see {@link buildCareersPageUrl} for the base careers page URL
   */
  public static buildCareersJsonUrl(config: DriveHrApiConfig): string {
    const careersUrl = this.buildCareersPageUrl(config);
    return careersUrl.replace('/list', '.json');
  }
}

/**
 * Centralized error handling utilities for job fetching strategies
 *
 * Provides consistent error handling patterns across all job fetching
 * implementations to eliminate code duplication and ensure uniform
 * error logging and recovery behavior. All methods use the application
 * logger for consistent log formatting and level management.
 *
 * This class follows the principle of fail-fast for critical errors
 * while allowing graceful degradation for non-critical failures
 * (like individual API endpoint failures in a multi-strategy approach).
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetch(apiUrl);
 *   // ... process response
 * } catch (error) {
 *   // Log the failure but continue with next strategy
 *   JobFetchErrorHandler.logAndContinue('API fetch', apiUrl, error);
 * }
 *
 * // When an entire strategy fails
 * JobFetchErrorHandler.logStrategyFailure('HTMLParsingStrategy', error);
 * ```
 * @since 1.0.0
 * @see {@link getLogger} for the underlying logging implementation
 */
export class JobFetchErrorHandler {
  /**
   * Log non-critical errors and continue processing
   *
   * Used for logging individual endpoint failures that shouldn't stop
   * the overall job fetching process. Logs at DEBUG level to avoid
   * noise in production while still capturing failure information
   * for troubleshooting.
   *
   * @param context - Description of what operation failed (e.g., 'API fetch', 'HTML parsing')
   * @param url - The URL that failed to provide additional context
   * @param error - The error that occurred (Error object or unknown)
   * @example
   * ```typescript
   * // In a strategy that tries multiple endpoints
   * for (const url of apiUrls) {
   *   try {
   *     return await this.fetchFromUrl(url);
   *   } catch (error) {
   *     JobFetchErrorHandler.logAndContinue('API endpoint', url, error);
   *   }
   * }
   * ```
   * @since 1.0.0
   * @see {@link logStrategyFailure} for logging complete strategy failures
   */
  public static logAndContinue(context: string, url: string, error: unknown): void {
    const logger = getLogger();
    logger.debug(`${context} failed: ${url}`, { error });
  }

  /**
   * Log complete strategy failures at warning level
   *
   * Used when an entire job fetching strategy fails completely.
   * Logs at WARN level since strategy failures are more significant
   * than individual endpoint failures but not necessarily critical
   * if other strategies are available.
   *
   * @param strategyName - Name of the strategy that failed (e.g., 'APIStrategy', 'HTMLParsingStrategy')
   * @param error - The error that caused the strategy to fail
   * @example
   * ```typescript
   * export class APIStrategy implements JobFetchStrategy {
   *   async fetchJobs(config: DriveHrApiConfig): Promise<JobFetchResult> {
   *     try {
   *       // ... strategy implementation
   *     } catch (error) {
   *       JobFetchErrorHandler.logStrategyFailure('APIStrategy', error);
   *       return { success: false, jobs: [], totalCount: 0, error: error.message };
   *     }
   *   }
   * }
   * ```
   * @since 1.0.0
   * @see {@link logAndContinue} for logging non-critical endpoint failures
   */
  public static logStrategyFailure(strategyName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const logger = getLogger();
    logger.warn(`Strategy ${strategyName} failed: ${errorMessage}`);
  }
}

/**
 * Centralized data extraction utilities for job fetching strategies
 *
 * Provides robust data extraction methods that handle the various response
 * formats and data structures that DriveHR APIs and websites may return.
 * Each method includes type guards and validation to ensure data integrity
 * and prevent runtime errors from malformed responses.
 *
 * This class eliminates duplicate data extraction patterns across different
 * strategies and provides a consistent interface for processing job data
 * regardless of the source format (API responses, JSON-LD, embedded JS, etc.).
 *
 * @example
 * ```typescript
 * // Extract from API response
 * const apiJobs = JobDataExtractor.extractFromApiResponse(apiResponse);
 *
 * // Extract from JSON-LD structured data
 * const structuredJobs = JobDataExtractor.extractFromJsonLd(jsonLdData);
 *
 * // Validate extracted data
 * if (JobDataExtractor.isValidJobArray(extractedJobs)) {
 *   // Process the jobs
 * }
 * ```
 * @since 1.0.0
 * @see {@link RawJobData} for the job data structure
 */
export class JobDataExtractor {
  /**
   * Extract jobs from API response with multiple possible data structures
   *
   * Handles the various ways DriveHR APIs may structure job data in their
   * responses. Uses nullish coalescing to try different property names
   * in order of preference, falling back to an empty array if no jobs
   * are found.
   *
   * @param data - API response object that may contain job data under various property names
   * @returns Array of raw job data, empty array if no jobs found
   * @example
   * ```typescript
   * // API response format 1
   * const response1 = { jobs: [job1, job2, job3] };
   * const jobs1 = JobDataExtractor.extractFromApiResponse(response1);
   * // Returns: [job1, job2, job3]
   *
   * // API response format 2
   * const response2 = { positions: [position1, position2] };
   * const jobs2 = JobDataExtractor.extractFromApiResponse(response2);
   * // Returns: [position1, position2]
   *
   * // Empty/invalid response
   * const response3 = { message: 'No data' };
   * const jobs3 = JobDataExtractor.extractFromApiResponse(response3);
   * // Returns: []
   * ```
   * @since 1.0.0
   * @see {@link RawJobData} for the structure of individual job objects
   */
  public static extractFromApiResponse(data: {
    jobs?: RawJobData[];
    positions?: RawJobData[];
    data?: RawJobData[];
  }): RawJobData[] {
    return data.jobs ?? data.positions ?? data.data ?? [];
  }

  /**
   * Extract jobs from JSON-LD structured data
   *
   * Processes JSON-LD structured data to find JobPosting objects according
   * to schema.org standards. Performs type checking to ensure objects
   * are valid JobPosting entities before including them in the result.
   *
   * @param data - Array of JSON-LD objects that may contain JobPosting entries
   * @returns Array of job data extracted from valid JobPosting objects
   * @example
   * ```typescript
   * const jsonLdData = [
   *   {
   *     '@type': 'JobPosting',
   *     'title': 'Software Engineer',
   *     'description': 'Build amazing software'
   *   },
   *   {
   *     '@type': 'Organization',
   *     'name': 'Acme Corp'
   *   },
   *   {
   *     '@type': 'JobPosting',
   *     'title': 'Product Manager',
   *     'description': 'Lead product development'
   *   }
   * ];
   *
   * const jobs = JobDataExtractor.extractFromJsonLd(jsonLdData);
   * // Returns: [{ title: 'Software Engineer', ... }, { title: 'Product Manager', ... }]
   * ```
   * @since 1.0.0
   * @see {@link https://schema.org/JobPosting} for JobPosting schema definition
   */
  public static extractFromJsonLd(data: unknown[]): RawJobData[] {
    return data.filter(
      item =>
        typeof item === 'object' &&
        item !== null &&
        '@type' in item &&
        item['@type'] === 'JobPosting'
    ) as RawJobData[];
  }

  /**
   * Extract jobs from embedded JavaScript data
   *
   * Processes job data that has been embedded in JavaScript variables
   * within HTML pages. This is common when DriveHR embeds job data
   * directly in the page for client-side rendering.
   *
   * @param data - JavaScript object containing embedded job data
   * @returns Array of job data, empty array if no positions found
   * @example
   * ```typescript
   * // Embedded JS data format
   * const embeddedData = {
   *   positions: [
   *     { id: '1', title: 'Developer', location: 'Remote' },
   *     { id: '2', title: 'Designer', location: 'NYC' }
   *   ],
   *   metadata: { company: 'Tech Corp', timestamp: '2025-01-01' }
   * };
   *
   * const jobs = JobDataExtractor.extractFromEmbeddedJs(embeddedData);
   * // Returns: [{ id: '1', title: 'Developer', ... }, { id: '2', title: 'Designer', ... }]
   * ```
   * @since 1.0.0
   * @see {@link RawJobData} for the job data structure
   */
  public static extractFromEmbeddedJs(data: { positions?: RawJobData[] }): RawJobData[] {
    return data.positions ?? [];
  }

  /**
   * Validate that extracted data is a non-empty array of jobs
   *
   * Type guard function that checks if the extracted data is a valid,
   * non-empty array that can be processed as job data. This prevents
   * runtime errors and provides type safety for downstream processing.
   *
   * @param jobs - The data to validate
   * @returns Type predicate indicating if data is a valid job array
   * @example
   * ```typescript
   * const extractedData = await fetchJobData();
   *
   * if (JobDataExtractor.isValidJobArray(extractedData)) {
   *   // TypeScript now knows extractedData is RawJobData[]
   *   const processedJobs = extractedData.map(job => normalizeJob(job));
   * } else {
   *   logger.warn('No valid job data extracted');
   * }
   * ```
   * @since 1.0.0
   * @see {@link RawJobData} for the expected job data structure
   */
  public static isValidJobArray(jobs: unknown): jobs is RawJobData[] {
    return Array.isArray(jobs) && jobs.length > 0;
  }
}
