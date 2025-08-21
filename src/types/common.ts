/**
 * Common Shared Types
 *
 * Fundamental type definitions and interfaces used across the entire DriveHR
 * Netlify Sync application. These types provide the foundation for consistent
 * data structures, API responses, and logging interfaces throughout the system.
 *
 * These common types include:
 * - Environment configuration and validation
 * - Standardized API response wrappers
 * - Job posting data structures
 * - Logging interface definitions
 *
 * @module common-types
 * @since 1.0.0
 */

/**
 * Environment configuration interface
 *
 * Defines the structure for environment-specific configuration loaded from
 * environment variables. This interface ensures all required settings are
 * present and properly typed for application initialization.
 *
 * @example
 * ```typescript
 * const envConfig: EnvironmentConfig = {
 *   driveHrCompanyId: process.env.DRIVEHR_COMPANY_ID!,
 *   wpApiUrl: process.env.WP_API_URL!,
 *   webhookSecret: process.env.WEBHOOK_SECRET!,
 *   environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
 *   logLevel: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | 'trace') || 'info'
 * };
 *
 * // Validate required environment variables
 * if (!envConfig.driveHrCompanyId) {
 *   throw new Error('DRIVEHR_COMPANY_ID environment variable is required');
 * }
 * ```
 * @since 1.0.0
 * @see {@link AppConfig} for the complete application configuration structure
 */
export interface EnvironmentConfig {
  /** DriveHR company UUID identifier from environment */
  readonly driveHrCompanyId: string;
  /** WordPress webhook endpoint URL for job synchronization */
  readonly wpApiUrl: string;
  /** Secret key for webhook signature verification (minimum 32 characters) */
  readonly webhookSecret: string;
  /** Current application environment */
  readonly environment: 'development' | 'staging' | 'production';
  /** Minimum log level for application logging */
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

/**
 * Generic API response wrapper interface
 *
 * Standardized response structure for all API operations throughout the
 * application. Provides consistent error handling and success indication
 * with strongly-typed data payloads.
 *
 * @template T - Type of the response data payload
 * @example
 * ```typescript
 * // Successful API response
 * const successResponse: ApiResponse<JobPosting[]> = {
 *   success: true,
 *   data: [job1, job2, job3],
 *   timestamp: new Date()
 * };
 *
 * // Error API response
 * const errorResponse: ApiResponse<never> = {
 *   success: false,
 *   error: 'Failed to fetch jobs: Network timeout',
 *   timestamp: new Date()
 * };
 *
 * // Usage in function
 * async function fetchJobs(): Promise<ApiResponse<JobPosting[]>> {
 *   try {
 *     const jobs = await jobService.fetchAll();
 *     return {
 *       success: true,
 *       data: jobs,
 *       timestamp: new Date()
 *     };
 *   } catch (error) {
 *     return {
 *       success: false,
 *       error: error instanceof Error ? error.message : 'Unknown error',
 *       timestamp: new Date()
 *     };
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link HttpResponse} for HTTP-specific response structures
 */
export interface ApiResponse<T = unknown> {
  /** Whether the API operation was successful */
  readonly success: boolean;
  /** Response data payload (only present when success is true) */
  readonly data?: T;
  /** Error message (only present when success is false) */
  readonly error?: string;
  /** Timestamp when the response was generated */
  readonly timestamp: Date;
}

/**
 * Basic job posting data structure
 *
 * Simplified job posting interface for common operations throughout the
 * application. This interface provides the essential job information needed
 * for display and basic processing. For more detailed job data structures,
 * use the interfaces in the job-types module.
 *
 * Note: This is a simplified interface. For comprehensive job data handling,
 * use {@link NormalizedJob} and {@link RawJobData} from the job-types module.
 *
 * @example
 * ```typescript
 * const jobPosting: JobPosting = {
 *   id: 'sw-eng-001',
 *   title: 'Senior Software Engineer',
 *   description: 'Join our engineering team to build amazing software...',
 *   department: 'Engineering',
 *   location: 'San Francisco, CA',
 *   salaryRange: '$120,000 - $180,000',
 *   postedDate: new Date('2025-01-15'),
 *   expiryDate: new Date('2025-03-15')
 * };
 *
 * // Usage in components
 * function JobCard({ job }: { job: JobPosting }) {
 *   return (
 *     <div>
 *       <h3>{job.title}</h3>
 *       <p>{job.department} • {job.location}</p>
 *       <p>Posted: {job.postedDate.toLocaleDateString()}</p>
 *       {job.salaryRange && <p>Salary: {job.salaryRange}</p>}
 *     </div>
 *   );
 * }
 * ```
 * @since 1.0.0
 * @see {@link NormalizedJob} for the complete job data structure
 * @see {@link RawJobData} for unprocessed job data from external sources
 */
export interface JobPosting {
  /** Unique job identifier */
  readonly id: string;
  /** Job title or position name */
  readonly title: string;
  /** Detailed job description */
  readonly description: string;
  /** Department or team (optional) */
  readonly department?: string;
  /** Job location (optional) */
  readonly location?: string;
  /** Salary range information (optional) */
  readonly salaryRange?: string;
  /** Date when the job was posted */
  readonly postedDate: Date;
  /** Date when the job posting expires (optional) */
  readonly expiryDate?: Date;
}
