/**
 * DriveHR Job Data Types
 *
 * Comprehensive type definitions for job-related data structures used throughout
 * the DriveHR integration system. Covers the complete job data lifecycle from
 * raw data fetching through normalization to WordPress synchronization.
 *
 * These types ensure type safety for:
 * - Raw job data from various sources (API, HTML, JSON-LD)
 * - Normalized job objects with consistent structure
 * - Job fetching results and synchronization responses
 * - Validation and error handling
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
 *
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
 *   position_title: 'Software Engineer', // different field name
 *   category: 'Engineering', // maps to department
 *   city: 'San Francisco, CA', // maps to location
 *   application_url: 'https://company.com/careers/apply/123'
 * };
 * ```
 * @since 1.0.0
 * @see {@link NormalizedJob} for the processed, consistent structure
 */
export interface RawJobData {
  /** Job identifier (various naming conventions) */
  readonly id?: string;
  /** Alternative job identifier field name */
  readonly job_id?: string;

  /** Job title (various naming conventions) */
  readonly title?: string;
  /** Alternative job title field name */
  readonly position_title?: string;
  /** Generic name field that may contain job title */
  readonly name?: string;

  /** Department/category information (various naming conventions) */
  readonly department?: string;
  /** Alternative department field name */
  readonly category?: string;
  /** Alternative department field name */
  readonly division?: string;

  /** Location information (various naming conventions) */
  readonly location?: string;
  /** Alternative location field name */
  readonly city?: string;
  /** Alternative location field name */
  readonly office?: string;

  /** Employment type information (various naming conventions) */
  readonly type?: string;
  /** Alternative employment type field name */
  readonly employment_type?: string;
  /** Alternative employment type field name */
  readonly schedule?: string;

  /** Job description (various naming conventions) */
  readonly description?: string;
  /** Alternative description field name */
  readonly summary?: string;
  /** Alternative description field name */
  readonly overview?: string;

  /** Posted date information (various naming conventions) */
  readonly posted_date?: string;
  /** Alternative posted date field name */
  readonly created_at?: string;
  /** Alternative posted date field name */
  readonly date_posted?: string;

  /** Application URL (various naming conventions) */
  readonly apply_url?: string;
  /** Alternative application URL field name */
  readonly application_url?: string;
  /** Generic URL field that may contain application link */
  readonly url?: string;

  /** Allow additional properties for extensibility */
  readonly [key: string]: unknown;
}

/**
 * Normalized job data interface with consistent structure
 *
 * Represents job data after processing and normalization from raw sources.
 * All fields are required and follow consistent naming conventions.
 * Includes metadata for tracking source and processing information.
 *
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
 *   rawData: {}, // original raw data
 *   processedAt: '2025-01-15T10:30:00.000Z'
 * };
 * ```
 * @since 1.0.0
 * @see {@link RawJobData} for the original unprocessed data structure
 * @see {@link JobSource} for available source types
 */
export interface NormalizedJob {
  /** Unique job identifier (generated if not provided) */
  readonly id: string;
  /** Normalized job title */
  readonly title: string;
  /** Normalized department/category name */
  readonly department: string;
  /** Normalized location information */
  readonly location: string;
  /** Normalized employment type */
  readonly type: string;
  /** Normalized job description (may be truncated) */
  readonly description: string;
  /** Posted date in ISO format */
  readonly postedDate: string;
  /** Absolute URL for job application */
  readonly applyUrl: string;
  /** Source system that provided this job data */
  readonly source: JobSource;
  /** Original raw data before normalization */
  readonly rawData: RawJobData;
  /** Timestamp when normalization was performed */
  readonly processedAt: string;
}

/**
 * Job fetching operation result interface
 *
 * Contains the results of a job fetching operation including the
 * retrieved jobs, metadata about the fetch method used, and
 * success/error information.
 *
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
  /** Array of successfully fetched and normalized jobs */
  readonly jobs: readonly NormalizedJob[];
  /** Method that was used to fetch the jobs */
  readonly method: FetchMethod;
  /** Whether the fetch operation was successful */
  readonly success: boolean;
  /** Success message (when operation succeeded) */
  readonly message?: string;
  /** Error message (when operation failed) */
  readonly error?: string;
  /** Timestamp when the fetch operation was performed */
  readonly fetchedAt: string;
  /** Total number of jobs found/processed */
  readonly totalCount: number;
}

/**
 * Job synchronization request interface
 *
 * Payload structure for sending job data to WordPress via webhook.
 * Includes metadata for tracking and debugging purposes.
 *
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
  /** Source system that provided the job data */
  readonly source: JobSource;
  /** Array of normalized jobs to synchronize */
  readonly jobs: readonly NormalizedJob[];
  /** Timestamp when the sync request was created */
  readonly timestamp: string;
  /** Unique identifier for tracking this sync request */
  readonly requestId: string;
}

/**
 * Job synchronization response interface
 *
 * Response structure from WordPress after processing a job sync request.
 * Provides detailed statistics about the synchronization operation.
 *
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
  /** Whether the overall sync operation was successful */
  readonly success: boolean;
  /** Number of jobs successfully synchronized */
  readonly syncedCount: number;
  /** Number of jobs skipped (e.g., duplicates) */
  readonly skippedCount: number;
  /** Number of jobs that failed to sync */
  readonly errorCount: number;
  /** Overall sync operation message */
  readonly message?: string;
  /** Detailed error messages for failed jobs */
  readonly errors?: readonly string[];
  /** Timestamp when the sync operation was completed */
  readonly processedAt: string;
}

/**
 * Job source enumeration
 *
 * Identifies the source system or trigger that initiated the job data fetch.
 * Used for tracking, analytics, and conditional processing logic.
 *
 * @example
 * ```typescript
 * // Automatic webhook trigger
 * const webhookJob: JobSource = 'webhook';
 *
 * // Manual sync request
 * const manualJob: JobSource = 'manual';
 *
 * // Direct DriveHR system fetch
 * const driveHrJob: JobSource = 'drivehris';
 * ```
 * @since 1.0.0
 */
export type JobSource =
  /** Job data fetched directly from DriveHR system */
  | 'drivehris'
  /** Job data fetched via manual user-initiated sync */
  | 'manual'
  /** Job data fetched via automated webhook trigger */
  | 'webhook';

/**
 * Job fetching method enumeration
 *
 * Identifies the specific strategy used to fetch job data from DriveHR.
 * Each method represents a different approach to data extraction.
 *
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
export type FetchMethod =
  /** Fetched via DriveHR REST API endpoints */
  | 'api'
  /** Fetched via dedicated JSON endpoint */
  | 'json'
  /** Fetched via HTML scraping and parsing */
  | 'html'
  /** Fetched via JSON-LD structured data extraction */
  | 'json-ld'
  /** Fetched via embedded JavaScript data extraction */
  | 'embedded-js'
  /** No method succeeded in fetching data */
  | 'none';

/**
 * Employment type enumeration
 *
 * Standardized employment types for job postings. Used for consistent
 * categorization and filtering of job opportunities.
 *
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
  /** Standard full-time employment */
  | 'Full-time'
  /** Part-time employment with reduced hours */
  | 'Part-time'
  /** Contract-based employment */
  | 'Contract'
  /** Temporary employment with fixed duration */
  | 'Temporary'
  /** Internship or educational opportunity */
  | 'Internship'
  /** Remote work arrangement */
  | 'Remote'
  /** Hybrid work arrangement (office + remote) */
  | 'Hybrid';

/**
 * Job validation error interface
 *
 * Represents a single validation error encountered during job data
 * processing or normalization. Provides detailed error information
 * for debugging and error reporting.
 *
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
  /** Name of the field that failed validation */
  readonly field: string;
  /** The actual value that caused the validation failure */
  readonly value: unknown;
  /** Human-readable error message */
  readonly message: string;
  /** Machine-readable error code for programmatic handling */
  readonly code: string;
}

/**
 * Job validation result interface
 *
 * Aggregates validation results for a job data object, including
 * both errors (blocking issues) and warnings (non-blocking issues).
 * Used to provide comprehensive feedback about data quality.
 *
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
  /** Whether the job data passed validation (no errors) */
  readonly isValid: boolean;
  /** Array of validation errors that prevent processing */
  readonly errors: readonly JobValidationError[];
  /** Array of validation warnings that don't prevent processing */
  readonly warnings: readonly JobValidationError[];
}
