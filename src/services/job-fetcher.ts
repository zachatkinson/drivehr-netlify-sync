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
import type {
  JobFetchResult,
  RawJobData,
  NormalizedJob,
  FetchMethod,
  JobSource,
} from '../types/job.js';
import type { DriveHrApiConfig } from '../types/api.js';

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
  }

  /**
   * Fetch jobs using all available strategies with automatic failover
   *
   * Orchestrates multiple job fetching strategies, trying each in order of
   * preference until one succeeds. Provides comprehensive error handling
   * and automatic normalization of job data into a consistent format.
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
    const fetchedAt = new Date().toISOString();

    for (const strategy of this.strategies) {
      if (!strategy.canHandle(config)) {
        continue;
      }

      try {
        const logger = getLogger();
        logger.info(`Attempting to fetch jobs using strategy: ${strategy.name}`);

        const rawJobs = await strategy.fetchJobs(config, this.httpClient);
        const normalizedJobs = await this.normalizeJobs(rawJobs, source);

        logger.info(`Successfully fetched ${normalizedJobs.length} jobs using ${strategy.name}`);

        return {
          jobs: normalizedJobs,
          method: strategy.name,
          success: true,
          message: `Successfully fetched ${normalizedJobs.length} jobs`,
          fetchedAt,
          totalCount: normalizedJobs.length,
        };
      } catch (error) {
        JobFetchErrorHandler.logStrategyFailure(strategy.name, error);

        // Continue to next strategy
      }
    }

    // All strategies failed
    return {
      jobs: [],
      method: 'none',
      success: false,
      error: 'All fetch strategies failed',
      fetchedAt,
      totalCount: 0,
    };
  }

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
  private async normalizeJobs(rawJobs: RawJobData[], source: JobSource): Promise<NormalizedJob[]> {
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
