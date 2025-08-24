/**
 * DriveHR Job Data Types
 *
 * Comprehensive type definitions for job-related data structures used throughout
 * the DriveHR integration system. Covers the complete job data lifecycle from
 * raw data fetching through normalization to WordPress synchronization.
 *
 * These types ensure type safety across the entire job processing pipeline,
 * from initial data extraction to final WordPress webhook delivery. The
 * architecture supports multiple data sources and validation strategies.
 *
 * @example
 * ```typescript
 * import type { NormalizedJob, JobFetchResult, JobSyncRequest } from './job.js';
 *
 * const fetchResult: JobFetchResult = {
 *   jobs: [normalizedJob],
 *   method: 'api',
 *   success: true,
 *   fetchedAt: new Date().toISOString(),
 *   totalCount: 1
 * };
 *
 * const syncRequest: JobSyncRequest = {
 *   source: 'webhook',
 *   jobs: fetchResult.jobs,
 *   timestamp: new Date().toISOString(),
 *   requestId: crypto.randomUUID()
 * };
 * ```
 *
 * @module job-types
 * @since 1.0.0
 */

/**
 * Raw job data interface from various sources
 *
 * Represents unprocessed job data as it comes from different sources
 * (DriveHR API, HTML scraping, JSON-LD, etc.). Uses optional properties
 * to accommodate varying data structures across different sources.
 *
 * The interface includes common field name variations to handle
 * inconsistencies in naming conventions across different data sources.
 * All properties are optional to support partial data extraction.
 *
 * @param id - Primary job identifier
 * @param job_id - Alternative job identifier field name
 * @param title - Job title or position name
 * @param position_title - Alternative job title field name
 * @param name - Generic name field that may contain job title
 * @param department - Department or team name
 * @param category - Alternative department field name
 * @param division - Alternative department field name
 * @param location - Job location information
 * @param city - Alternative location field name
 * @param office - Alternative location field name
 * @param type - Employment type information
 * @param employment_type - Alternative employment type field name
 * @param schedule - Alternative employment type field name
 * @param description - Job description or requirements
 * @param summary - Alternative description field name
 * @param overview - Alternative description field name
 * @param posted_date - Job posting date
 * @param created_at - Alternative posted date field name
 * @param date_posted - Alternative posted date field name
 * @param apply_url - Application URL
 * @param application_url - Alternative application URL field name
 * @param url - Generic URL field that may contain application link
 * @returns Interface supporting flexible raw job data structures
 * @example
 * ```typescript
 * // From API response
 * const apiJobData: RawJobData = {
 *   id: 'job-123',
 *   title: 'Software Engineer',
 *   department: 'Engineering',
 *   location: 'San Francisco, CA',
 *   employment_type: 'Full-time',
 *   posted_date: '2025-01-15T10:00:00Z',
 *   apply_url: 'https://company.com/apply/123'
 * };
 *
 * // From HTML scraping (different field names)
 * const htmlJobData: RawJobData = {
 *   position_title: 'Software Engineer',
 *   category: 'Engineering',
 *   city: 'San Francisco, CA',
 *   application_url: 'https://company.com/careers/apply/123'
 * };
 * ```
 * @since 1.0.0
 * @see {@link NormalizedJob} for the processed, consistent structure
 */
export interface RawJobData {
  id?: string;
  job_id?: string;
  title?: string;
  position_title?: string;
  name?: string;
  department?: string;
  category?: string;
  division?: string;
  location?: string;
  city?: string;
  office?: string;
  type?: string;
  employment_type?: string;
  schedule?: string;
  description?: string;
  summary?: string;
  overview?: string;
  posted_date?: string;
  created_at?: string;
  date_posted?: string;
  apply_url?: string;
  application_url?: string;
  url?: string;
  [key: string]: unknown;
}

/**
 * Normalized job data interface with consistent structure
 *
 * Represents job data after processing and normalization from raw sources.
 * All fields are required and follow consistent naming conventions.
 * Includes metadata for tracking source and processing information.
 *
 * This interface ensures data consistency across the entire job processing
 * pipeline and provides a standardized format for WordPress synchronization.
 * All normalized jobs include audit trail information for debugging.
 *
 * @param id - Unique job identifier (generated if not provided)
 * @param title - Normalized job title
 * @param department - Normalized department/category name
 * @param location - Normalized location information
 * @param type - Normalized employment type
 * @param description - Normalized job description (may be truncated)
 * @param postedDate - Posted date in ISO format
 * @param applyUrl - Absolute URL for job application
 * @param source - Source system that provided this job data
 * @param rawData - Original raw data before normalization
 * @param processedAt - Timestamp when normalization was performed
 * @returns Normalized job object with consistent structure
 * @example
 * ```typescript
 * const normalizedJob: NormalizedJob = {
 *   id: 'sw-eng-sf-001',
 *   title: 'Software Engineer',
 *   department: 'Engineering',
 *   location: 'San Francisco, CA',
 *   type: 'Full-time',
 *   description: 'Join our engineering team to build amazing software...',
 *   postedDate: '2025-01-15T10:00:00.000Z',
 *   applyUrl: 'https://company.com/apply/sw-eng-sf-001',
 *   source: 'webhook',
 *   rawData: {},
 *   processedAt: '2025-01-15T10:30:00.000Z'
 * };
 * ```
 * @since 1.0.0
 * @see {@link RawJobData} for the original unprocessed data structure
 * @see {@link JobSource} for available source types
 */
export interface NormalizedJob {
  readonly id: string;
  readonly title: string;
  readonly department: string;
  readonly location: string;
  readonly type: string;
  readonly description: string;
  readonly postedDate: string;
  readonly applyUrl: string;
  readonly source: JobSource;
  readonly rawData: RawJobData;
  readonly processedAt: string;
}

/**
 * Job fetching operation result interface
 *
 * Contains the results of a job fetching operation including the
 * retrieved jobs, metadata about the fetch method used, and
 * success/error information. Used to track fetch operations and
 * provide debugging information for failed attempts.
 *
 * @param jobs - Array of successfully fetched and normalized jobs
 * @param method - Method that was used to fetch the jobs
 * @param success - Whether the fetch operation was successful
 * @param message - Success message (when operation succeeded)
 * @param error - Error message (when operation failed)
 * @param fetchedAt - Timestamp when the fetch operation was performed
 * @param totalCount - Total number of jobs found/processed
 * @returns Job fetch operation result with metadata
 * @example
 * ```typescript
 * const fetchResult: JobFetchResult = {
 *   jobs: [job1, job2, job3],
 *   method: 'api',
 *   success: true,
 *   message: 'Successfully fetched 3 jobs',
 *   fetchedAt: '2025-01-15T10:30:00.000Z',
 *   totalCount: 3
 * };
 *
 * // Error case
 * const errorResult: JobFetchResult = {
 *   jobs: [],
 *   method: 'none',
 *   success: false,
 *   error: 'All fetch strategies failed',
 *   fetchedAt: '2025-01-15T10:30:00.000Z',
 *   totalCount: 0
 * };
 * ```
 * @since 1.0.0
 * @see {@link FetchMethod} for available fetching methods
 * @see {@link NormalizedJob} for the job data structure
 */
export interface JobFetchResult {
  readonly jobs: readonly NormalizedJob[];
  readonly method: FetchMethod;
  readonly success: boolean;
  readonly message?: string;
  readonly error?: string;
  readonly fetchedAt: string;
  readonly totalCount: number;
}

/**
 * Job synchronization request interface
 *
 * Payload structure for sending job data to WordPress via webhook.
 * Includes metadata for tracking and debugging purposes. Used to
 * maintain audit trail and enable request tracing across systems.
 *
 * @param source - Source system that provided the job data
 * @param jobs - Array of normalized jobs to synchronize
 * @param timestamp - Timestamp when the sync request was created
 * @param requestId - Unique identifier for tracking this sync request
 * @returns Job sync request payload for WordPress webhook
 * @example
 * ```typescript
 * const syncRequest: JobSyncRequest = {
 *   source: 'webhook',
 *   jobs: [normalizedJob1, normalizedJob2],
 *   timestamp: '2025-01-15T10:30:00.000Z',
 *   requestId: 'req_abc123def456'
 * };
 * ```
 * @since 1.0.0
 * @see {@link JobSource} for available source types
 * @see {@link NormalizedJob} for the job data structure
 */
export interface JobSyncRequest {
  readonly source: JobSource;
  readonly jobs: readonly NormalizedJob[];
  readonly timestamp: string;
  readonly requestId: string;
}

/**
 * Job synchronization response interface
 *
 * Response structure from WordPress after processing a job sync request.
 * Provides detailed statistics about the synchronization operation and
 * enables comprehensive error reporting and debugging.
 *
 * @param success - Whether the overall sync operation was successful
 * @param syncedCount - Number of jobs successfully synchronized
 * @param skippedCount - Number of jobs skipped (e.g., duplicates)
 * @param errorCount - Number of jobs that failed to sync
 * @param message - Overall sync operation message
 * @param errors - Detailed error messages for failed jobs
 * @param processedAt - Timestamp when the sync operation was completed
 * @returns Job sync operation response with statistics
 * @example
 * ```typescript
 * const syncResponse: JobSyncResponse = {
 *   success: true,
 *   syncedCount: 8,
 *   skippedCount: 2, // duplicates
 *   errorCount: 0,
 *   message: 'Successfully synchronized 8 jobs',
 *   errors: [],
 *   processedAt: '2025-01-15T10:35:00.000Z'
 * };
 *
 * // Error case
 * const errorResponse: JobSyncResponse = {
 *   success: false,
 *   syncedCount: 5,
 *   skippedCount: 0,
 *   errorCount: 3,
 *   message: 'Partial sync completed with errors',
 *   errors: [
 *     'Job ID job-123: Invalid department value',
 *     'Job ID job-456: Missing required field: title',
 *     'Job ID job-789: Duplicate entry detected'
 *   ],
 *   processedAt: '2025-01-15T10:35:00.000Z'
 * };
 * ```
 * @since 1.0.0
 */
export interface JobSyncResponse {
  readonly success: boolean;
  readonly syncedCount: number;
  readonly skippedCount: number;
  readonly errorCount: number;
  readonly message?: string;
  readonly errors?: readonly string[];
  readonly processedAt: string;
}

/**
 * Job source enumeration
 *
 * Identifies the source system or trigger that initiated the job data fetch.
 * Used for tracking, analytics, and conditional processing logic. Enables
 * audit trail and helps identify data quality issues by source.
 *
 * @returns Union type representing job data sources
 * @example
 * ```typescript
 * // Automatic webhook trigger
 * const webhookJob: JobSource = 'webhook';
 *
 * // Manual sync request
 * const manualJob: JobSource = 'manual';
 *
 * // Direct DriveHR system fetch
 * const driveHrJob: JobSource = 'drivehr';
 * ```
 * @since 1.0.0
 */
export type JobSource = 'drivehr' | 'manual' | 'webhook' | 'github-actions' | 'automated';

/**
 * Job fetching method enumeration
 *
 * Identifies the specific strategy used to fetch job data from DriveHR.
 * Each method represents a different approach to data extraction with
 * varying reliability and data completeness characteristics.
 *
 * @returns Union type representing job fetching strategies
 * @example
 * ```typescript
 * // Successful API fetch
 * const apiMethod: FetchMethod = 'api';
 *
 * // Fallback to HTML scraping
 * const htmlMethod: FetchMethod = 'html';
 *
 * // All methods failed
 * const failedMethod: FetchMethod = 'none';
 * ```
 * @since 1.0.0
 */
export type FetchMethod = 'api' | 'json' | 'html' | 'json-ld' | 'embedded-js' | 'none';

/**
 * Employment type enumeration
 *
 * Standardized employment types for job postings. Used for consistent
 * categorization and filtering of job opportunities. Supports both
 * traditional employment models and modern work arrangements.
 *
 * @returns Union type representing employment types
 * @example
 * ```typescript
 * // Standard employment types
 * const fullTime: JobType = 'Full-time';
 * const contract: JobType = 'Contract';
 * const remote: JobType = 'Remote';
 * ```
 * @since 1.0.0
 */
export type JobType =
  | 'Full-time'
  | 'Part-time'
  | 'Contract'
  | 'Temporary'
  | 'Internship'
  | 'Remote'
  | 'Hybrid';

/**
 * Job validation error interface
 *
 * Represents a single validation error encountered during job data
 * processing or normalization. Provides detailed error information
 * for debugging and error reporting. Includes both human-readable
 * messages and machine-readable error codes.
 *
 * @param field - Name of the field that failed validation
 * @param value - The actual value that caused the validation failure
 * @param message - Human-readable error message
 * @param code - Machine-readable error code for programmatic handling
 * @returns Single validation error with context
 * @example
 * ```typescript
 * const validationError: JobValidationError = {
 *   field: 'title',
 *   value: '', // empty string
 *   message: 'Job title is required and cannot be empty',
 *   code: 'REQUIRED_FIELD_MISSING'
 * };
 *
 * const formatError: JobValidationError = {
 *   field: 'postedDate',
 *   value: 'invalid-date',
 *   message: 'Posted date must be in ISO format',
 *   code: 'INVALID_DATE_FORMAT'
 * };
 * ```
 * @since 1.0.0
 * @see {@link JobValidationResult} for validation result aggregation
 */
export interface JobValidationError {
  readonly field: string;
  readonly value: unknown;
  readonly message: string;
  readonly code: string;
}

/**
 * Job validation result interface
 *
 * Aggregates validation results for a job data object, including
 * both errors (blocking issues) and warnings (non-blocking issues).
 * Used to provide comprehensive feedback about data quality and
 * enable conditional processing based on validation status.
 *
 * @param isValid - Whether the job data passed validation (no errors)
 * @param errors - Array of validation errors that prevent processing
 * @param warnings - Array of validation warnings that don't prevent processing
 * @returns Complete validation result with errors and warnings
 * @example
 * ```typescript
 * // Successful validation
 * const validResult: JobValidationResult = {
 *   isValid: true,
 *   errors: [],
 *   warnings: []
 * };
 *
 * // Validation with warnings but no errors
 * const warningResult: JobValidationResult = {
 *   isValid: true,
 *   errors: [],
 *   warnings: [
 *     {
 *       field: 'description',
 *       value: 'Very short desc',
 *       message: 'Job description is unusually short',
 *       code: 'SHORT_DESCRIPTION'
 *     }
 *   ]
 * };
 *
 * // Validation failure
 * const invalidResult: JobValidationResult = {
 *   isValid: false,
 *   errors: [
 *     {
 *       field: 'title',
 *       value: null,
 *       message: 'Job title is required',
 *       code: 'REQUIRED_FIELD_MISSING'
 *     }
 *   ],
 *   warnings: []
 * };
 * ```
 * @since 1.0.0
 * @see {@link JobValidationError} for individual error details
 */
export interface JobValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly JobValidationError[];
  readonly warnings: readonly JobValidationError[];
}
