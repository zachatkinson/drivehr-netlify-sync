/**
 * Job Fetching Utility System
 *
 * Enterprise-grade shared utilities providing consistent patterns for job fetching
 * strategies that eliminate code duplication and ensure uniform behavior across
 * multiple implementation approaches. This system centralizes common functionality
 * for URL construction, error handling, and data extraction.
 *
 * The utility system follows DRY principles by extracting repeated patterns from
 * job fetching strategies into reusable, testable components. Each utility class
 * provides static methods to emphasize their stateless, functional nature.
 *
 * Core Components:
 * - DriveHrUrlBuilder: Centralized URL construction with fallback strategies
 * - JobFetchErrorHandler: Consistent error logging and recovery patterns
 * - JobDataExtractor: Robust data validation and extraction utilities
 * - DRIVEHR_CONSTANTS: Centralized constants for API endpoints
 *
 * All utilities include comprehensive error handling, logging integration,
 * and type safety to support enterprise-grade job fetching operations.
 *
 * @example
 * ```typescript
 * import {
 *   DriveHrUrlBuilder,
 *   JobFetchErrorHandler,
 *   JobDataExtractor,
 *   DRIVEHR_CONSTANTS
 * } from './job-fetch-utils.js';
 *
 * // URL construction with fallback
 * const careersUrl = DriveHrUrlBuilder.buildCareersPageUrl(config);
 *
 * // Error handling with context
 * try {
 *   const data = await fetchJobData(url);
 * } catch (error) {
 *   JobFetchErrorHandler.logAndContinue('API fetch', url, error);
 * }
 *
 * // Data validation
 * if (JobDataExtractor.isValidJobArray(rawData)) {
 *   const processedJobs = rawData.map(normalizeJob);
 * }
 * ```
 *
 * @module job-fetch-utility-system
 * @since 1.0.0
 * @see {@link ../types/api.ts} for DriveHrApiConfig interface
 * @see {@link ../types/job.ts} for RawJobData interface
 * @see {@link DriveHrUrlBuilder} for URL construction utilities
 * @see {@link JobFetchErrorHandler} for error handling utilities
 * @see {@link JobDataExtractor} for data extraction utilities
 */

import { getLogger } from './logger.js';
import type { DriveHrApiConfig } from '../types/api.js';
import type { RawJobData } from '../types/job.js';

/**
 * DriveHR API constants for centralized URL management
 *
 * Centralized constant definitions for DriveHR base URLs and API endpoints.
 * Using `as const` assertion ensures type safety and prevents accidental
 * mutations in production code. These constants provide a single source of
 * truth for DriveHR API URLs across the application.
 *
 * The constants are structured as a readonly object to maintain consistency
 * and enable easy extension for additional DriveHR endpoints in the future.
 *
 * @example
 * ```typescript
 * // Building careers page URL
 * const careersUrl = `${DRIVEHR_CONSTANTS.BASE_URL}/careers/company-123/list`;
 *
 * // API endpoint construction
 * const apiEndpoint = `${DRIVEHR_CONSTANTS.BASE_URL}/api/careers/company-123/jobs`;
 * ```
 * @since 1.0.0
 * @see {@link DriveHrUrlBuilder} for URL construction using these constants
 */
export const DRIVEHR_CONSTANTS = {
  /** Base URL for all DriveHR requests and career pages */
  BASE_URL: 'https://drivehris.app',
} as const;

/**
 * DriveHR URL construction utility for consistent endpoint building
 *
 * Centralized URL builder that eliminates duplicate URL construction patterns
 * across different job fetching strategies. Provides type-safe methods for
 * building various DriveHR API endpoints with proper validation, fallback
 * handling, and error recovery.
 *
 * All methods are static to emphasize the stateless utility nature and allow
 * usage without instantiation. URL construction follows DriveHR API conventions
 * and handles multiple endpoint formats for maximum compatibility.
 *
 * Features:
 * - Fallback URL construction when explicit URLs are not provided
 * - Type-safe parameter handling with proper validation
 * - Consistent URL format across different strategies
 * - Support for custom career page URLs and default formats
 * - Integration with centralized constants for maintainability
 *
 * @example
 * ```typescript
 * const config = {
 *   companyId: 'acme-corp',
 *   careersUrl: 'https://custom.acme-corp.com/jobs'
 * };
 *
 * // Build careers page URL (uses custom URL if provided)
 * const careersUrl = DriveHrUrlBuilder.buildCareersPageUrl(config);
 * // Returns: 'https://custom.acme-corp.com/jobs'
 *
 * // Without custom URL (fallback to standard format)
 * const configDefault = { companyId: 'acme-corp' };
 * const defaultUrl = DriveHrUrlBuilder.buildCareersPageUrl(configDefault);
 * // Returns: 'https://drivehris.app/careers/acme-corp/list'
 * ```
 * @since 1.0.0
 * @see {@link DRIVEHR_CONSTANTS} for base URL constants
 * @see {@link DriveHrApiConfig} for configuration interface
 */
export class DriveHrUrlBuilder {
  /**
   * Build careers page URL with intelligent fallback strategy
   *
   * Constructs the URL for a company's careers page by preferring explicitly
   * configured URLs while falling back to the standard DriveHR careers page
   * format. This approach maximizes compatibility with both custom career sites
   * and standard DriveHR implementations.
   *
   * The method handles two scenarios:
   * 1. Custom careers URL: Returns the explicitly configured URL
   * 2. Default format: Constructs standard DriveHR URL using company ID
   *
   * @param config - DriveHR API configuration containing company ID and optional careers URL
   * @returns Complete careers page URL ready for fetching or navigation
   * @example
   * ```typescript
   * // With explicit custom careers URL
   * const configWithCustomUrl = {
   *   companyId: 'tech-startup',
   *   careersUrl: 'https://jobs.techstartup.com/openings'
   * };
   * const customUrl = DriveHrUrlBuilder.buildCareersPageUrl(configWithCustomUrl);
   * // Returns: 'https://jobs.techstartup.com/openings'
   *
   * // With default URL construction (no custom URL provided)
   * const configDefault = {
   *   companyId: 'tech-startup'
   * };
   * const defaultUrl = DriveHrUrlBuilder.buildCareersPageUrl(configDefault);
   * // Returns: 'https://drivehris.app/careers/tech-startup/list'
   * ```
   * @since 1.0.0
   * @see {@link DRIVEHR_CONSTANTS.BASE_URL} for the base URL used in default construction
   */
  public static buildCareersPageUrl(config: DriveHrApiConfig): string {
    return config.careersUrl || `${DRIVEHR_CONSTANTS.BASE_URL}/careers/${config.companyId}/list`;
  }
}

/**
 * Centralized error handling system for job fetching strategies
 *
 * Provides consistent error handling patterns across all job fetching
 * implementations to eliminate code duplication and ensure uniform error
 * logging, categorization, and recovery behavior. All methods integrate with
 * the application logger for consistent formatting and level management.
 *
 * Error Handling Philosophy:
 * - Fail-fast for critical system errors that prevent operation
 * - Graceful degradation for non-critical failures (individual endpoint failures)
 * - Comprehensive logging with appropriate levels for different error types
 * - Contextual error information for effective debugging and monitoring
 *
 * The class distinguishes between different error severities:
 * - DEBUG level: Individual endpoint failures that don't stop processing
 * - WARN level: Strategy failures that are significant but not critical
 * - ERROR level: Critical system failures (handled elsewhere in application)
 *
 * @example
 * ```typescript
 * // In a multi-endpoint strategy
 * const apiUrls = ['url1', 'url2', 'url3'];
 * for (const url of apiUrls) {
 *   try {
 *     const result = await fetchFromEndpoint(url);
 *     if (result.success) return result;
 *   } catch (error) {
 *     // Log individual failure but continue to next endpoint
 *     JobFetchErrorHandler.logAndContinue('API endpoint', url, error);
 *   }
 * }
 *
 * // When entire strategy fails
 * JobFetchErrorHandler.logStrategyFailure('MultiEndpointStrategy', lastError);
 * ```
 * @since 1.0.0
 * @see {@link getLogger} for the underlying logging implementation
 */
export class JobFetchErrorHandler {
  /**
   * Log non-critical errors and continue processing gracefully
   *
   * Used for logging individual endpoint or operation failures that shouldn't
   * terminate the overall job fetching process. Logs at DEBUG level to reduce
   * production noise while preserving detailed failure information for
   * troubleshooting and monitoring purposes.
   *
   * This method supports graceful degradation patterns where multiple strategies
   * or endpoints are attempted, and individual failures are expected and handled.
   *
   * @param context - Descriptive context of the failed operation (e.g., 'API fetch', 'HTML parsing', 'JSON extraction')
   * @param url - The specific URL or endpoint that failed (provides debugging context)
   * @param error - The error that occurred (Error object, string, or unknown type)
   * @example
   * ```typescript
   * // Multi-strategy job fetching with graceful failure handling
   * const strategies = [apiStrategy, htmlStrategy, jsonLdStrategy];
   * for (const strategy of strategies) {
   *   try {
   *     const result = await strategy.execute(url);
   *     if (result.success) return result;
   *   } catch (error) {
   *     JobFetchErrorHandler.logAndContinue(
   *       `${strategy.name} execution`,
   *       url,
   *       error
   *     );
   *   }
   * }
   *
   * // API endpoint fallback pattern
   * const endpoints = [primaryApi, fallbackApi, emergencyApi];
   * for (const endpoint of endpoints) {
   *   try {
   *     return await fetchFromEndpoint(endpoint);
   *   } catch (error) {
   *     JobFetchErrorHandler.logAndContinue('API endpoint', endpoint, error);
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
   * Used when an entire job fetching strategy fails completely and cannot
   * provide any results. Logs at WARN level since strategy failures are more
   * significant than individual endpoint failures but may not be critical if
   * other strategies are available as fallbacks.
   *
   * The method extracts meaningful error messages from various error types
   * and provides consistent formatting for strategy failure logging.
   *
   * @param strategyName - Name identifier of the failed strategy (e.g., 'APIStrategy', 'HTMLParsingStrategy', 'JSONLDStrategy')
   * @param error - The error that caused the complete strategy failure (any type)
   * @example
   * ```typescript
   * // In a job fetching strategy implementation
   * export class APIStrategy implements JobFetchStrategy {
   *   async fetchJobs(config: DriveHrApiConfig): Promise<JobFetchResult> {
   *     try {
   *       const response = await this.httpClient.get(apiUrl);
   *       return this.processResponse(response);
   *     } catch (error) {
   *       // Strategy completely failed - log at warning level
   *       JobFetchErrorHandler.logStrategyFailure('APIStrategy', error);
   *       return {
   *         success: false,
   *         jobs: [],
   *         totalCount: 0,
   *         method: 'api',
   *         error: error instanceof Error ? error.message : 'Strategy failed'
   *       };
   *     }
   *   }
   * }
   *
   * // In orchestrator with multiple strategies
   * for (const strategy of [apiStrategy, htmlStrategy]) {
   *   try {
   *     const result = await strategy.fetchJobs(config);
   *     if (result.success) return result;
   *   } catch (error) {
   *     JobFetchErrorHandler.logStrategyFailure(strategy.name, error);
   *   }
   * }
   * ```
   * @since 1.0.0
   * @see {@link logAndContinue} for logging non-critical individual failures
   */
  public static logStrategyFailure(strategyName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const logger = getLogger();
    logger.warn(`Strategy ${strategyName} failed: ${errorMessage}`);
  }
}

/**
 * Data extraction and validation utilities for job fetching
 *
 * Provides robust data extraction methods that handle the various response
 * formats and data structures returned by DriveHR APIs and websites. Each
 * method includes comprehensive type guards, validation logic, and error
 * prevention to ensure data integrity throughout the job processing pipeline.
 *
 * This utility class eliminates duplicate data extraction patterns across
 * different job fetching strategies and provides a consistent, type-safe
 * interface for processing job data regardless of source format (API responses,
 * JSON-LD structures, embedded JavaScript, HTML parsing results).
 *
 * Validation Philosophy:
 * - Type-safe validation using TypeScript type guards
 * - Fail-fast validation to prevent downstream processing errors
 * - Comprehensive null/undefined/empty checks
 * - Runtime type validation for external data sources
 * - Graceful handling of malformed or unexpected data structures
 *
 * @example
 * ```typescript
 * // Extract data from various sources
 * const apiResponse = await fetchFromAPI();
 * const htmlData = await parseFromHTML();
 * const jsonLdData = await extractFromJSONLD();
 *
 * // Validate all extracted data consistently
 * const validDataSources = [
 *   { data: apiResponse, source: 'API' },
 *   { data: htmlData, source: 'HTML' },
 *   { data: jsonLdData, source: 'JSON-LD' }
 * ].filter(({ data, source }) => {
 *   const isValid = JobDataExtractor.isValidJobArray(data);
 *   if (!isValid) {
 *     console.warn(`No valid jobs found from ${source}`);
 *   }
 *   return isValid;
 * });
 *
 * // Process only valid data
 * for (const { data } of validDataSources) {
 *   // TypeScript knows data is RawJobData[] here
 *   const normalizedJobs = data.map(normalizeJobData);
 *   await processJobs(normalizedJobs);
 * }
 * ```
 * @since 1.0.0
 * @see {@link RawJobData} for the expected job data structure
 */
export class JobDataExtractor {
  /**
   * Validate extracted data as a non-empty array of job objects
   *
   * Type guard function that performs runtime validation to ensure extracted
   * data meets the minimum requirements for job processing. This prevents
   * downstream errors and provides TypeScript type narrowing for safe
   * processing of validated data.
   *
   * Validation Criteria:
   * - Must be an array (not null, undefined, or other types)
   * - Must contain at least one element (non-empty)
   * - Elements are assumed to be job-like objects (further validation in normalization)
   *
   * This validation serves as the first line of defense against malformed
   * responses from external APIs or parsing operations.
   *
   * @param jobs - The extracted data to validate (can be any type from external sources)
   * @returns Type predicate indicating whether data is a valid job array
   * @example
   * ```typescript
   * // API response validation
   * const apiResponse = await fetch('/api/jobs').then(r => r.json());
   * if (JobDataExtractor.isValidJobArray(apiResponse)) {
   *   // TypeScript now knows apiResponse is RawJobData[]
   *   console.log(`Found ${apiResponse.length} jobs from API`);
   *   const processedJobs = apiResponse.map(job => normalizeJobData(job));
   * } else {
   *   console.warn('API returned invalid or empty job data');
   * }
   *
   * // HTML parsing validation
   * const extractedJobs = parseJobsFromHTML(htmlContent);
   * if (JobDataExtractor.isValidJobArray(extractedJobs)) {
   *   await saveJobs(extractedJobs);
   * } else {
   *   throw new Error('Failed to extract valid jobs from HTML');
   * }
   *
   * // Multi-source validation
   * const dataSources = [apiData, htmlData, jsonLdData];
   * const validSources = dataSources.filter(JobDataExtractor.isValidJobArray);
   * console.log(`${validSources.length}/${dataSources.length} sources provided valid data`);
   * ```
   * @since 1.0.0
   * @see {@link RawJobData} for the job data structure definition
   */
  public static isValidJobArray(jobs: unknown): jobs is RawJobData[] {
    return Array.isArray(jobs) && jobs.length > 0;
  }
}
