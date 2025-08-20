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
 * Constants for DriveHR base URL
 *
 * Centralized constants for DriveHR base URL used for careers page construction.
 * Using `as const` to ensure type safety and prevent accidental mutations in production code.
 *
 * @example
 * ```typescript
 * // Building careers page URL
 * const careersUrl = `${DRIVEHR_CONSTANTS.BASE_URL}/careers/company-id/list`;
 * ```
 * @since 1.0.0
 * @see {@link DriveHrUrlBuilder} for URL construction using these constants
 */
export const DRIVEHR_CONSTANTS = {
  /** Base URL for all DriveHR requests */
  BASE_URL: 'https://drivehris.app',
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
 * @see {@link DRIVEHR_CONSTANTS} for base URL constant
 * @see {@link DriveHrApiConfig} for configuration interface
 */
export class DriveHrUrlBuilder {
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
   */
  public static buildCareersPageUrl(config: DriveHrApiConfig): string {
    return config.careersUrl || `${DRIVEHR_CONSTANTS.BASE_URL}/careers/${config.companyId}/list`;
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
