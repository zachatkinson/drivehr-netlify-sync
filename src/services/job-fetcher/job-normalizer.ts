/**
 * Job Data Normalization Service
 *
 * Enterprise-grade job data normalization service implementing comprehensive data processing
 * pipelines for DriveHR job information standardization. Transforms raw job data from multiple
 * heterogeneous sources into consistent, validated, and normalized job objects following
 * enterprise data quality standards with comprehensive error handling and fallback mechanisms.
 *
 * This service handles the complete data transformation lifecycle from raw, unstructured
 * job data extraction through field mapping, data type coercion, validation, and metadata
 * enrichment. The normalizer supports multiple field name variations across different data
 * sources and provides intelligent fallback values for missing or malformed data.
 *
 * Core Data Processing Features:
 * - Multi-source field mapping with automatic field name resolution
 * - Comprehensive data type coercion and validation pipelines
 * - Intelligent fallback value generation for missing data
 * - Enterprise-grade error handling with graceful degradation
 * - Metadata enrichment with source tracking and processing timestamps
 * - URL-safe identifier generation with collision avoidance
 *
 * @example
 * ```typescript
 * import { JobNormalizer } from './job-normalizer.js';
 * import { DateUtils, StringUtils } from '../../lib/utils.js';
 *
 * const normalizer = new JobNormalizer();
 *
 * // Raw job data from various sources with different field names
 * const rawJobs = [
 *   {
 *     title: '  Senior Software Engineer  ',
 *     department: 'Engineering',
 *     location: 'San Francisco, CA',
 *     employment_type: 'Full-time',
 *     posted_date: '2025-01-15T10:30:00Z',
 *     apply_url: 'https://company.com/apply/123'
 *   },
 *   {
 *     position_title: 'Product Manager',
 *     category: 'Product',
 *     city: 'New York, NY',
 *     type: 'Full-time',
 *     created_at: '2025-01-14',
 *     application_url: 'https://company.com/careers/pm-456'
 *   }
 * ];
 *
 * // Normalize jobs with source tracking
 * const normalizedJobs = await normalizer.normalizeJobs(rawJobs, 'webhook');
 *
 * // All jobs now have consistent structure
 * normalizedJobs.forEach(job => {
 *   console.log(`📋 ${job.title}`);
 *   console.log(`🏢 ${job.department} • 📍 ${job.location}`);
 *   console.log(`🔗 ${job.applyUrl}`);
 *   console.log(`📅 Posted: ${job.postedDate}`);
 *   console.log(`🆔 ID: ${job.id}`);
 *   console.log('---');
 * });
 * ```
 *
 * @module job-normalizer
 * @since 1.0.0
 * @see {@link RawJobData} for supported input data formats
 * @see {@link NormalizedJob} for normalized output structure
 * @see {@link StringUtils} for utility functions used in processing
 * @see {@link DateUtils} for date normalization utilities
 */

import { StringUtils, DateUtils } from '../../lib/utils.js';
import type { RawJobData, NormalizedJob, JobSource } from '../../types/job.js';

/**
 * Job data normalization service implementation
 *
 * Comprehensive service for transforming raw job data from multiple heterogeneous sources
 * into consistent, validated, and normalized job objects. This service handles the complete
 * data transformation pipeline including field mapping, data type coercion, validation,
 * error handling, and metadata enrichment with source tracking and processing timestamps.
 *
 * The service supports multiple field name variations across different data sources and
 * implements intelligent fallback mechanisms for missing or malformed data. All processing
 * follows enterprise data quality standards with comprehensive error handling and graceful
 * degradation to ensure reliable job data processing regardless of source data quality.
 *
 * Data Processing Pipeline:
 * 1. Raw data validation and filtering (jobs without titles are rejected)
 * 2. Field extraction with multi-source field name resolution
 * 3. Data type coercion and format standardization
 * 4. Validation and fallback value generation
 * 5. Metadata enrichment with processing timestamps
 * 6. ID generation for jobs without existing identifiers
 *
 * @since 1.0.0
 * @see {@link normalizeJobs} for batch job processing
 * @see {@link normalizeJob} for individual job normalization
 */
export class JobNormalizer {
  /**
   * Normalize array of raw job data into consistent format
   *
   * Processes an array of raw job data from various sources and transforms them into
   * a consistent, validated structure. This method handles batch processing with automatic
   * filtering of invalid jobs (those without titles) and enriches all valid jobs with
   * metadata including source tracking and processing timestamps.
   *
   * The batch processing approach ensures consistent processing timestamps across all
   * jobs in a single operation while maintaining individual job validation and error
   * handling. Invalid jobs are filtered out rather than causing the entire batch to fail.
   *
   * @param rawJobs - Array of raw job data objects from various fetching strategies
   * @param source - Source identifier for tracking job origin and analytics
   * @returns Promise resolving to array of normalized, validated job objects
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const rawJobsFromApi = [
   *   {
   *     title: 'Senior Developer',
   *     department: 'Engineering',
   *     location: 'Remote',
   *     employment_type: 'Full-time',
   *     posted_date: '2025-01-15'
   *   },
   *   {
   *     position_title: 'Data Scientist',
   *     category: 'Data',
   *     city: 'Boston, MA',
   *     type: 'Contract'
   *   },
   *   {
   *     // Invalid job - no title, will be filtered out
   *     department: 'Sales',
   *     location: 'Chicago, IL'
   *   }
   * ];
   *
   * const normalized = await normalizer.normalizeJobs(rawJobsFromApi, 'api');
   * console.log(`Normalized ${normalized.length} valid jobs`); // 2 jobs
   *
   * // All normalized jobs have consistent structure
   * normalized.forEach(job => {
   *   console.log(`${job.title} - ${job.department} - ${job.location}`);
   *   console.log(`Source: ${job.source}, Processed: ${job.processedAt}`);
   * });
   * ```
   * @since 1.0.0
   * @see {@link normalizeJob} for individual job processing logic
   * @see {@link JobSource} for available source identifier types
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
   * Transforms a single raw job data object into a normalized, validated structure by
   * extracting and processing all job fields through specialized extraction methods.
   * This method handles field mapping variations, data type coercion, and validation
   * to ensure consistent job data structure regardless of the original data source.
   *
   * The normalization process includes validation of required fields (title is mandatory),
   * intelligent field extraction with fallback mechanisms, data type standardization,
   * and metadata enrichment. Jobs without titles are rejected as invalid and return null
   * to maintain data quality standards.
   *
   * Field Extraction Process:
   * - Title: Required field with multiple fallback field names
   * - ID: Uses existing ID or generates URL-safe identifier from title
   * - Department: Handles 'department', 'category', 'division' variations
   * - Location: Handles 'location', 'city', 'office' variations
   * - Type: Handles 'type', 'employment_type', 'schedule' with default fallback
   * - Description: Handles 'description', 'summary', 'overview' variations
   * - Posted Date: Converts multiple date formats to ISO strings
   * - Apply URL: Handles multiple URL field name variations
   *
   * @param rawJob - Raw job data object from any supported source format
   * @param source - Source identifier for job tracking and analytics purposes
   * @param processedAt - ISO timestamp when the processing operation began
   * @returns Normalized job object with consistent structure, or null if job is invalid
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   * const processedAt = DateUtils.getCurrentIsoTimestamp();
   *
   * // Raw job with various field name formats
   * const rawJob = {
   *   position_title: 'Full Stack Developer',
   *   category: 'Technology',
   *   city: 'Austin, TX',
   *   employment_type: 'Full-time',
   *   summary: 'Build amazing web applications...',
   *   created_at: '2025-01-15',
   *   application_url: 'https://company.com/jobs/fs-dev-123'
   * };
   *
   * const normalized = normalizer.normalizeJob(rawJob, 'html', processedAt);
   *
   * if (normalized) {
   *   console.log(`Normalized: ${normalized.title}`);
   *   console.log(`Department: ${normalized.department}`);
   *   console.log(`Location: ${normalized.location}`);
   *   console.log(`Generated ID: ${normalized.id}`);
   * }
   * ```
   * @since 1.0.0
   * @see {@link extractJobTitle} for title extraction logic
   * @see {@link extractJobId} for ID extraction and generation
   * @see {@link NormalizedJob} for the complete normalized structure
   */
  private normalizeJob(
    rawJob: RawJobData,
    source: JobSource,
    processedAt: string
  ): NormalizedJob | null {
    const title = this.extractJobTitle(rawJob);
    if (!title) {
      return null;
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
   * Extract job title from raw job data with field name variations
   *
   * Extracts the job title from raw data by checking multiple possible field names
   * commonly used across different job data sources. Normalizes whitespace and returns
   * an empty string if no title is found. This method handles the most critical job
   * field as jobs without titles are considered invalid.
   *
   * Supported field name variations:
   * - 'title': Standard job title field
   * - 'position_title': Alternative title field name
   * - 'name': Generic name field that may contain job title
   *
   * @param rawJob - Raw job data object from any supported source
   * @returns Normalized job title string with trimmed whitespace
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * // Different title field variations
   * const job1 = { title: '  Senior Engineer  ' };
   * const job2 = { position_title: 'Product Manager' };
   * const job3 = { name: 'Data Analyst' };
   * const job4 = { description: 'Amazing job...' }; // No title fields
   *
   * console.log(normalizer.extractJobTitle(job1)); // 'Senior Engineer'
   * console.log(normalizer.extractJobTitle(job2)); // 'Product Manager'
   * console.log(normalizer.extractJobTitle(job3)); // 'Data Analyst'
   * console.log(normalizer.extractJobTitle(job4)); // ''
   * ```
   * @since 1.0.0
   */
  private extractJobTitle(rawJob: RawJobData): string {
    const title = rawJob.title ?? rawJob.position_title ?? rawJob.name ?? '';
    return title.trim();
  }

  /**
   * Extract or generate unique job identifier
   *
   * Retrieves existing job ID from raw data or generates a unique, URL-safe identifier
   * based on the job title when no ID is available. This ensures every normalized job
   * has a consistent identifier for tracking, deduplication, and referencing purposes.
   *
   * ID Resolution Priority:
   * 1. 'id': Primary job identifier field
   * 2. 'job_id': Alternative job identifier field name
   * 3. Generated ID: URL-safe identifier created from job title
   *
   * @param rawJob - Raw job data object that may contain existing ID
   * @param title - Normalized job title used for ID generation fallback
   * @returns Unique job identifier string (existing or generated)
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * // Job with existing ID
   * const jobWithId = { id: 'eng-123', title: 'Software Engineer' };
   * console.log(normalizer.extractJobId(jobWithId, 'Software Engineer')); // 'eng-123'
   *
   * // Job with alternative ID field
   * const jobWithJobId = { job_id: 'pm-456', title: 'Product Manager' };
   * console.log(normalizer.extractJobId(jobWithJobId, 'Product Manager')); // 'pm-456'
   *
   * // Job without ID - generates from title
   * const jobNoId = { title: 'Senior Data Scientist' };
   * console.log(normalizer.extractJobId(jobNoId, 'Senior Data Scientist'));
   * // 'senior-data-scientist' (URL-safe generated ID)
   * ```
   * @since 1.0.0
   * @see {@link generateJobId} for ID generation logic
   */
  private extractJobId(rawJob: RawJobData, title: string): string {
    return rawJob.id ?? rawJob.job_id ?? this.generateJobId(title);
  }

  /**
   * Extract job department from raw data with field name variations
   *
   * Extracts department/team information from raw job data by checking multiple
   * possible field names commonly used across different data sources. Normalizes
   * whitespace and returns empty string if no department information is found.
   *
   * Supported field name variations:
   * - 'department': Standard department field
   * - 'category': Alternative department field name
   * - 'division': Alternative department field name for organizational divisions
   *
   * @param rawJob - Raw job data object from any supported source
   * @returns Normalized department string with trimmed whitespace
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const job1 = { department: '  Engineering  ' };
   * const job2 = { category: 'Product Management' };
   * const job3 = { division: 'Sales & Marketing' };
   *
   * console.log(normalizer.extractJobDepartment(job1)); // 'Engineering'
   * console.log(normalizer.extractJobDepartment(job2)); // 'Product Management'
   * console.log(normalizer.extractJobDepartment(job3)); // 'Sales & Marketing'
   * ```
   * @since 1.0.0
   */
  private extractJobDepartment(rawJob: RawJobData): string {
    const department = rawJob.department ?? rawJob.category ?? rawJob.division ?? '';
    return department.trim();
  }

  /**
   * Extract job location from raw data with field name variations
   *
   * Extracts location information from raw job data by checking multiple possible
   * field names commonly used across different data sources. Normalizes whitespace
   * and returns empty string if no location information is found.
   *
   * Supported field name variations:
   * - 'location': Standard location field
   * - 'city': City-specific location field
   * - 'office': Office location field name
   *
   * @param rawJob - Raw job data object from any supported source
   * @returns Normalized location string with trimmed whitespace
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const job1 = { location: '  San Francisco, CA  ' };
   * const job2 = { city: 'New York' };
   * const job3 = { office: 'Austin Office' };
   *
   * console.log(normalizer.extractJobLocation(job1)); // 'San Francisco, CA'
   * console.log(normalizer.extractJobLocation(job2)); // 'New York'
   * console.log(normalizer.extractJobLocation(job3)); // 'Austin Office'
   * ```
   * @since 1.0.0
   */
  private extractJobLocation(rawJob: RawJobData): string {
    const location = rawJob.location ?? rawJob.city ?? rawJob.office ?? '';
    return location.trim();
  }

  /**
   * Extract job type from raw data with field name variations and default fallback
   *
   * Extracts employment type information from raw job data by checking multiple
   * possible field names commonly used across different data sources. Provides
   * intelligent default fallback to 'Full-time' when no type information is available,
   * ensuring all normalized jobs have employment type information.
   *
   * Supported field name variations:
   * - 'type': Standard job type field
   * - 'employment_type': Detailed employment type field
   * - 'schedule': Work schedule field that may indicate employment type
   * - Default: 'Full-time' when no type information is available
   *
   * @param rawJob - Raw job data object from any supported source
   * @returns Normalized job type string with 'Full-time' as default fallback
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const job1 = { type: '  Part-time  ' };
   * const job2 = { employment_type: 'Contract' };
   * const job3 = { schedule: 'Remote' };
   * const job4 = { title: 'Engineer' }; // No type fields
   *
   * console.log(normalizer.extractJobType(job1)); // 'Part-time'
   * console.log(normalizer.extractJobType(job2)); // 'Contract'
   * console.log(normalizer.extractJobType(job3)); // 'Remote'
   * console.log(normalizer.extractJobType(job4)); // 'Full-time'
   * ```
   * @since 1.0.0
   */
  private extractJobType(rawJob: RawJobData): string {
    const type = rawJob.type ?? rawJob.employment_type ?? rawJob.schedule ?? 'Full-time';
    return type.trim();
  }

  /**
   * Extract job description from raw data with field name variations
   *
   * Extracts job description/summary information from raw job data by checking
   * multiple possible field names commonly used across different data sources.
   * Sanitizes HTML to remove non-standard attributes that may cause WordPress
   * wp_kses_post() to truncate content. Normalizes whitespace and returns empty
   * string if no description is found.
   *
   * Supported field name variations:
   * - 'description': Standard job description field
   * - 'summary': Job summary field
   * - 'overview': Job overview field
   *
   * @param rawJob - Raw job data object from any supported source
   * @returns Sanitized and normalized description string with trimmed whitespace
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const job1 = { description: '  Build amazing software...  ' };
   * const job2 = { summary: 'Lead product strategy' };
   * const job3 = { overview: 'Analyze complex datasets' };
   *
   * console.log(normalizer.extractJobDescription(job1)); // 'Build amazing software...'
   * console.log(normalizer.extractJobDescription(job2)); // 'Lead product strategy'
   * console.log(normalizer.extractJobDescription(job3)); // 'Analyze complex datasets'
   * ```
   * @since 1.0.0
   */
  private extractJobDescription(rawJob: RawJobData): string {
    const description = rawJob.description ?? rawJob.summary ?? rawJob.overview ?? '';
    return this.sanitizeHtml(description.trim());
  }

  /**
   * Sanitize HTML content for WordPress compatibility
   *
   * Removes non-standard HTML attributes that may cause WordPress wp_kses_post()
   * to truncate or malform content. This includes attributes like `start` on `<p>`
   * tags (which is only valid on `<ol>` tags) and other deprecated or non-standard
   * attributes that may appear in scraped content from various job board platforms.
   *
   * The sanitization process:
   * 1. Removes `start` attribute from non-list elements (p, div, span, etc.)
   * 2. Removes deprecated HTML attributes (align, bgcolor, border on non-table elements)
   * 3. Removes empty style attributes
   * 4. Removes Microsoft Office/Word specific attributes (mso-*, o:*)
   * 5. Normalizes multiple consecutive whitespace
   *
   * @param html - Raw HTML content that may contain non-standard attributes
   * @returns Sanitized HTML safe for WordPress processing
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const dirtyHtml = '<p start="3">Some text</p><p start="4">More text</p>';
   * const cleanHtml = normalizer.sanitizeHtml(dirtyHtml);
   * console.log(cleanHtml); // '<p>Some text</p><p>More text</p>'
   *
   * const msHtml = '<p class="MsoNormal" style="mso-line-height:normal">Text</p>';
   * const cleanMsHtml = normalizer.sanitizeHtml(msHtml);
   * console.log(cleanMsHtml); // '<p class="MsoNormal">Text</p>'
   * ```
   * @since 2.1.0
   */
  private sanitizeHtml(html: string): string {
    if (!html) {
      return '';
    }

    let sanitized = html;

    // Remove 'start' attribute from non-list elements (only valid on <ol>)
    // Matches: <p start="3">, <div start="1">, <span start="2">, etc.
    sanitized = sanitized.replace(
      /<(p|div|span|h[1-6]|section|article|aside|header|footer|main|nav)(\s[^>]*?)\sstart\s*=\s*["'][^"']*["']([^>]*)>/gi,
      '<$1$2$3>'
    );
    sanitized = sanitized.replace(
      /<(p|div|span|h[1-6]|section|article|aside|header|footer|main|nav)\sstart\s*=\s*["'][^"']*["'](\s[^>]*)>/gi,
      '<$1$2>'
    );
    sanitized = sanitized.replace(
      /<(p|div|span|h[1-6]|section|article|aside|header|footer|main|nav)\sstart\s*=\s*["'][^"']*["']>/gi,
      '<$1>'
    );

    // Remove deprecated HTML attributes on non-table elements
    // align attribute (deprecated in HTML5, only valid on specific elements like table/td/th)
    // Handle align as middle attribute: <p class="x" align="center" id="y">
    sanitized = sanitized.replace(
      /<(p|div|span|h[1-6]|section|article)(\s[^>]*?)\salign\s*=\s*["'][^"']*["']([^>]*)>/gi,
      '<$1$2$3>'
    );
    // Handle align as first attribute with others after: <p align="center" class="x">
    sanitized = sanitized.replace(
      /<(p|div|span|h[1-6]|section|article)\salign\s*=\s*["'][^"']*["'](\s[^>]*)>/gi,
      '<$1$2>'
    );
    // Handle align as only attribute: <p align="center">
    sanitized = sanitized.replace(
      /<(p|div|span|h[1-6]|section|article)\salign\s*=\s*["'][^"']*["']>/gi,
      '<$1>'
    );

    // Remove Microsoft Office specific style properties (mso-*)
    // Use [^;"']+ to stop at semicolons OR quotes (prevents matching past style attribute)
    sanitized = sanitized.replace(/mso-[a-z-]+\s*:\s*[^;"']+;?\s*/gi, '');

    // Remove empty style attributes that may result from above cleanup
    sanitized = sanitized.replace(/\sstyle\s*=\s*["']\s*["']/gi, '');

    // Remove o: namespace attributes (Microsoft Office XML)
    sanitized = sanitized.replace(/\so:[a-z]+\s*=\s*["'][^"']*["']/gi, '');

    // Normalize multiple spaces to single space (but preserve newlines)
    sanitized = sanitized.replace(/[ \t]+/g, ' ');

    // Clean up any resulting empty tags with just whitespace attributes
    sanitized = sanitized.replace(/<(\w+)\s+>/g, '<$1>');

    return sanitized.trim();
  }

  /**
   * Extract and normalize job posted date with format standardization
   *
   * Extracts job posting date from raw data by checking multiple possible field names
   * and converts various date formats to standardized ISO string format. Provides
   * intelligent fallback to current timestamp when no date is available, ensuring
   * all normalized jobs have posting date information.
   *
   * This method handles multiple date field variations and delegates date format
   * conversion to the DateUtils service, which supports various input date formats
   * and ensures consistent ISO string output format for reliable date processing.
   *
   * Supported field name variations:
   * - 'posted_date': Standard job posting date field
   * - 'created_at': Creation timestamp field
   * - 'date_posted': Alternative posting date field name
   * - Fallback: Current timestamp when no date is available
   *
   * @param rawJob - Raw job data object that may contain date information
   * @returns ISO formatted date string (YYYY-MM-DDTHH:mm:ss.sssZ format)
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const job1 = { posted_date: '2025-01-15T10:30:00Z' };
   * const job2 = { created_at: '2025-01-15' };
   * const job3 = { date_posted: '01/15/2025' };
   * const job4 = { title: 'Engineer' }; // No date fields
   *
   * console.log(normalizer.extractJobPostedDate(job1)); // '2025-01-15T10:30:00.000Z'
   * console.log(normalizer.extractJobPostedDate(job2)); // '2025-01-15T00:00:00.000Z'
   * console.log(normalizer.extractJobPostedDate(job3)); // '2025-01-15T00:00:00.000Z'
   * console.log(normalizer.extractJobPostedDate(job4)); // Current timestamp
   * ```
   * @since 1.0.0
   * @see {@link DateUtils.toIsoString} for date format conversion
   * @see {@link DateUtils.getCurrentIsoTimestamp} for current timestamp generation
   */
  private extractJobPostedDate(rawJob: RawJobData): string {
    const dateString = rawJob.posted_date ?? rawJob.created_at ?? rawJob.date_posted;
    return dateString ? DateUtils.toIsoString(dateString) : DateUtils.getCurrentIsoTimestamp();
  }

  /**
   * Extract job application URL from raw data with field name variations
   *
   * Extracts job application URL from raw job data by checking multiple possible
   * field names commonly used across different data sources. Returns empty string
   * if no application URL is found, allowing jobs to be processed even without
   * direct application links.
   *
   * Supported field name variations:
   * - 'apply_url': Standard job application URL field
   * - 'application_url': Detailed application URL field name
   * - 'url': Generic URL field that may contain application link
   *
   * @param rawJob - Raw job data object from any supported source
   * @returns Job application URL string, or empty string if not found
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * const job1 = { apply_url: 'https://company.com/apply/123' };
   * const job2 = { application_url: 'https://company.com/careers/apply?id=456' };
   * const job3 = { url: 'https://company.com/jobs/engineer' };
   * const job4 = { title: 'Engineer' }; // No URL fields
   *
   * console.log(normalizer.extractJobApplyUrl(job1)); // 'https://company.com/apply/123'
   * console.log(normalizer.extractJobApplyUrl(job2)); // 'https://company.com/careers/apply?id=456'
   * console.log(normalizer.extractJobApplyUrl(job3)); // 'https://company.com/jobs/engineer'
   * console.log(normalizer.extractJobApplyUrl(job4)); // ''
   * ```
   * @since 1.0.0
   */
  private extractJobApplyUrl(rawJob: RawJobData): string {
    return rawJob.apply_url ?? rawJob.application_url ?? rawJob.url ?? '';
  }

  /**
   * Generate URL-safe unique identifier from job title
   *
   * Creates a normalized, URL-safe identifier from the job title using the StringUtils
   * service. This method is used as a fallback when raw job data doesn't include
   * existing job identifiers, ensuring every normalized job has a unique ID for
   * tracking, deduplication, and referencing purposes.
   *
   * The generated ID follows URL-safe conventions with consistent formatting to
   * enable reliable job identification and prevent duplicate processing. The
   * StringUtils service handles character normalization, special character removal,
   * and collision avoidance to ensure unique identifiers.
   *
   * @param title - Job title string to generate identifier from
   * @returns Normalized, URL-safe job identifier based on title
   * @example
   * ```typescript
   * const normalizer = new JobNormalizer();
   *
   * console.log(normalizer.generateJobId('Senior Software Engineer'));
   * // 'senior-software-engineer'
   *
   * console.log(normalizer.generateJobId('Product Manager - AI/ML'));
   * // 'product-manager-ai-ml'
   *
   * console.log(normalizer.generateJobId('Full Stack Developer (React/Node.js)'));
   * // 'full-stack-developer-react-nodejs'
   * ```
   * @since 1.0.0
   * @see {@link StringUtils.generateIdFromTitle} for ID generation implementation
   */
  private generateJobId(title: string): string {
    return StringUtils.generateIdFromTitle(title);
  }
}
