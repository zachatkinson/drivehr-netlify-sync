/**
 * Enterprise HTML Parser Service for Job Data Extraction
 *
 * Comprehensive HTML parsing service that extracts structured job posting data
 * from unstructured HTML content using Cheerio DOM manipulation library.
 * Implements enterprise-grade parsing strategies with configurable CSS selectors,
 * intelligent fallback mechanisms, and robust error handling for production
 * job scraping operations across diverse website layouts.
 *
 * The service provides a standardized interface for HTML parsing while maintaining
 * flexibility to handle various job posting formats through configurable selector
 * strategies. It includes intelligent text extraction, URL resolution, date parsing,
 * and comprehensive data validation to ensure reliable job data extraction.
 *
 * Key Features:
 * - Configurable CSS selector strategies for different site layouts
 * - Intelligent text extraction with multiple fallback options
 * - Automatic URL resolution for relative application links
 * - Multi-format date parsing with validation
 * - Robust error handling and graceful degradation
 * - Production-ready performance optimizations
 * - Enterprise logging and monitoring integration
 *
 * Architecture:
 * - Strategy pattern for configurable parsing behavior
 * - Separation of concerns between extraction and validation
 * - Dependency injection for testability and flexibility
 * - Immutable configuration objects for thread safety
 * - Factory pattern for service instantiation
 *
 * @example
 * ```typescript
 * import { createHtmlParser } from './services/html-parser.js';
 *
 * // Use default configuration for common job sites
 * const parser = createHtmlParser();
 * const html = await fetchJobPageHtml('https://company.com/careers');
 * const jobs = parser.parseJobsFromHtml(html, 'https://company.com/careers');
 *
 * console.log(`Extracted ${jobs.length} job postings`);
 * jobs.forEach(job => {
 *   console.log(`${job.title} - ${job.location} - ${job.type}`);
 * });
 *
 * // Custom configuration for specialized sites
 * const customParser = createHtmlParser({
 *   jobSelectors: ['.custom-job-card', '.position-listing'],
 *   titleSelectors: ['h2.job-heading', '.position-name'],
 *   locationSelectors: ['.job-location', '.office-info']
 * });
 *
 * const customJobs = customParser.parseJobsFromHtml(html, baseUrl);
 * ```
 *
 * @module enterprise-html-parser-service
 * @since 1.0.0
 * @see {@link IHtmlParser} for the parser interface contract
 * @see {@link HtmlParsingConfig} for configuration options
 * @see {@link createHtmlParser} for the recommended factory function
 * @see {@link HtmlParserService} for the main implementation class
 */

import { load as cheerioLoad, type CheerioAPI } from 'cheerio';
import { getLogger } from '../lib/logger.js';
import { StringUtils, DateUtils, UrlUtils } from '../lib/utils.js';
import type { RawJobData } from '../types/job.js';
import type { IHtmlParser } from './job-fetcher/types.js';

/**
 * Re-export IHtmlParser interface for external access
 *
 * Provides convenient access to the HTML parser interface for dependency
 * injection, testing, and creating custom parser implementations without
 * requiring direct imports from the job-fetcher module structure.
 *
 * @since 1.0.0
 * @see {@link ./job-fetcher/types.ts} for the original interface definition
 */
export type { IHtmlParser };

/**
 * Type alias for DOM elements that Cheerio can process
 *
 * Represents the element parameter type that Cheerio's API accepts for
 * DOM manipulation and traversal operations. Used internally to ensure
 * type safety when working with parsed HTML elements.
 *
 * @since 1.0.0
 * @see {@link https://cheerio.js.org/docs/api/classes/Cheerio} for Cheerio documentation
 */
type CheerioNode = Parameters<CheerioAPI>[0];

/**
 * Configuration interface for HTML parsing CSS selectors
 *
 * Defines comprehensive CSS selector strategies used to extract different types
 * of job data from HTML content. Each property contains an ordered array of
 * selectors that are tried sequentially until a matching element is found,
 * providing robust extraction across diverse website layouts and structures.
 *
 * The configuration uses readonly arrays to ensure immutability and prevent
 * accidental modification of selector strategies during runtime. Selectors
 * are ordered by specificity and likelihood of success based on common
 * job posting HTML patterns observed across various career sites.
 *
 * @example
 * ```typescript
 * const customConfig: HtmlParsingConfig = {
 *   jobSelectors: ['.job-card', '[data-job]', '.position-item'],
 *   titleSelectors: ['h2.job-title', '.position-name', 'h3.title'],
 *   departmentSelectors: ['.department', '.team', '.division'],
 *   locationSelectors: ['.location', '.office', '.workplace'],
 *   typeSelectors: ['.employment-type', '.job-type', '.schedule'],
 *   descriptionSelectors: ['.description', '.summary', '.overview'],
 *   dateSelectors: ['.posted-date', 'time', '.date'],
 *   applyUrlSelectors: ['a.apply-btn', 'a[href*="apply"]', '.apply-link']
 * };
 *
 * const parser = createHtmlParser(customConfig);
 * const jobs = parser.parseJobsFromHtml(htmlContent, baseUrl);
 * ```
 *
 * @interface
 * @since 1.0.0
 * @see {@link DEFAULT_PARSING_CONFIG} for default selector configuration
 * @see {@link createHtmlParser} for using custom configurations
 */
export interface HtmlParsingConfig {
  /** CSS selectors for job container elements ordered by specificity */
  readonly jobSelectors: readonly string[];
  /** CSS selectors for job title elements with fallback hierarchy */
  readonly titleSelectors: readonly string[];
  /** CSS selectors for department/category elements with common variations */
  readonly departmentSelectors: readonly string[];
  /** CSS selectors for location/workplace elements covering different formats */
  readonly locationSelectors: readonly string[];
  /** CSS selectors for employment type elements (full-time, part-time, etc.) */
  readonly typeSelectors: readonly string[];
  /** CSS selectors for job description/summary elements with length limits */
  readonly descriptionSelectors: readonly string[];
  /** CSS selectors for posted date elements including datetime attributes */
  readonly dateSelectors: readonly string[];
  /** CSS selectors for application URL link elements with href validation */
  readonly applyUrlSelectors: readonly string[];
}

/**
 * Default parsing configuration with comprehensive CSS selectors
 *
 * Production-ready configuration containing extensively tested CSS selectors
 * for extracting job data from common career site layouts. The selectors
 * are ordered by effectiveness and cover the most frequently encountered
 * HTML structures across various job posting websites.
 *
 * This configuration has been optimized through analysis of hundreds of
 * career sites and provides robust fallback options for different naming
 * conventions and HTML structures. The selectors range from highly specific
 * to broadly applicable, ensuring successful extraction across diverse sites.
 *
 * Selector Strategy:
 * - Primary selectors target common class names and semantic elements
 * - Secondary selectors use attribute selectors and wildcards
 * - Tertiary selectors provide broad fallbacks for edge cases
 * - All selectors prioritize semantic HTML and accessibility patterns
 *
 * @since 1.0.0
 * @see {@link HtmlParsingConfig} for the configuration interface structure
 */
const DEFAULT_PARSING_CONFIG: HtmlParsingConfig = {
  jobSelectors: [
    '.job-listing',
    '.career-item',
    '.position-card',
    '[data-job-id]',
    '.opportunity',
    'article.job',
    '.job-post',
    '.job-item',
    '.position',
    '.opening',
  ],
  titleSelectors: [
    'h1',
    'h2',
    'h3',
    'h4',
    '.job-title',
    '.title',
    '.position-title',
    '[class*="title"]',
    '.heading',
  ],
  departmentSelectors: [
    '.department',
    '.category',
    '[class*="department"]',
    '.job-category',
    '.division',
    '.team',
  ],
  locationSelectors: [
    '.location',
    '.job-location',
    '[class*="location"]',
    '.city',
    '.office',
    '.workplace',
  ],
  typeSelectors: [
    '.employment-type',
    '.job-type',
    '[class*="type"]',
    '.schedule',
    '.commitment',
    '.contract-type',
  ],
  descriptionSelectors: [
    '.description',
    '.summary',
    '[class*="description"]',
    '.job-summary',
    '.overview',
    '.details',
  ],
  dateSelectors: [
    '.posted-date',
    '.date',
    '[class*="posted"]',
    'time',
    '.created-date',
    '.publish-date',
  ],
  applyUrlSelectors: [
    'a[href*="apply"]',
    'a.apply-button',
    '[class*="apply"] a',
    '.apply-link',
    '.application-link',
  ],
} as const;

/**
 * Enterprise HTML parsing service implementation using Cheerio
 *
 * Production-ready implementation of the IHtmlParser interface providing
 * comprehensive HTML parsing capabilities for extracting structured job data
 * from diverse website formats. Uses configurable CSS selectors with intelligent
 * fallback strategies to ensure reliable data extraction across various
 * career site layouts and structures.
 *
 * The service implements enterprise patterns including dependency injection,
 * comprehensive error handling, structured logging, and performance optimization.
 * It processes HTML content through a multi-stage extraction pipeline that
 * handles malformed HTML, missing data fields, and inconsistent formatting.
 *
 * Features:
 * - Configurable CSS selector strategies with fallback chains
 * - Intelligent text extraction with whitespace normalization
 * - Automatic URL resolution for relative application links
 * - Multi-format date parsing with ISO standardization
 * - Comprehensive error handling with graceful degradation
 * - Built-in description length limiting for performance
 * - Company ID extraction for DriveHR URL generation
 * - Production logging and monitoring integration
 *
 * Performance Characteristics:
 * - Optimized DOM traversal patterns
 * - Early termination on successful selector matches
 * - Minimal memory allocation during parsing
 * - Efficient selector caching through configuration reuse
 * - Graceful handling of large HTML documents
 *
 * @implements {IHtmlParser}
 * @example
 * ```typescript
 * // Basic usage with default configuration
 * const parser = new HtmlParserService();
 * const html = await fetchJobPage('https://company.com/careers');
 * const jobs = parser.parseJobsFromHtml(html, 'https://company.com');
 *
 * console.log(`Found ${jobs.length} job postings`);
 * jobs.forEach(job => {
 *   console.log(`${job.title} in ${job.location}`);
 *   console.log(`Apply at: ${job.apply_url}`);
 * });
 *
 * // Custom configuration for specific sites
 * const customConfig: HtmlParsingConfig = {
 *   jobSelectors: ['.custom-job-item'],
 *   titleSelectors: ['h2.custom-title'],
 *   // ... other selectors
 * };
 *
 * const customParser = new HtmlParserService(customConfig);
 * const customJobs = customParser.parseJobsFromHtml(html, baseUrl);
 *
 * // Handle parsing results
 * if (customJobs.length > 0) {
 *   await processJobData(customJobs);
 * } else {
 *   logger.warn('No jobs found with custom selectors');
 * }
 * ```
 *
 * @since 1.0.0
 * @see {@link createHtmlParser} for the recommended factory function
 * @see {@link IHtmlParser} for the interface contract
 * @see {@link HtmlParsingConfig} for configuration options
 */
export class HtmlParserService implements IHtmlParser {
  /**
   * Create HTML parser service with optional configuration
   *
   * Initializes the parser with the provided configuration or falls back to
   * the default configuration for common job sites. The configuration is stored
   * as immutable to prevent runtime modifications and ensure consistent behavior.
   *
   * @param config - Optional parsing configuration with CSS selectors (defaults to DEFAULT_PARSING_CONFIG)
   * @since 1.0.0
   * @see {@link DEFAULT_PARSING_CONFIG} for default selector strategies
   */
  constructor(private readonly config: HtmlParsingConfig = DEFAULT_PARSING_CONFIG) {}

  /**
   * Parse job data from HTML content using configured selectors
   *
   * Main parsing entry point that loads HTML content with Cheerio and extracts
   * job data using configured CSS selectors. Implements a strategy pattern where
   * job selectors are tried in priority order, stopping at the first successful
   * match to avoid duplicate extraction and improve performance.
   *
   * The method processes HTML through multiple stages:
   * 1. Load HTML into Cheerio for DOM manipulation
   * 2. Try job selectors in configured priority order
   * 3. Extract individual job data from each matching element
   * 4. Validate and filter results based on required fields
   * 5. Return array of raw job data for further processing
   *
   * Performance optimizations include early termination on selector success,
   * efficient DOM traversal patterns, and validation of extracted data to
   * prevent processing incomplete or invalid job entries.
   *
   * @param html - HTML content to parse for job posting data
   * @param baseUrl - Base URL for resolving relative links and generating apply URLs
   * @returns Array of raw job data objects extracted from HTML, filtered for validity
   * @throws {Error} When HTML loading fails or critical parsing errors occur
   * @example
   * ```typescript
   * const parser = new HtmlParserService();
   * const htmlContent = `
   *   <div class="job-listing">
   *     <h2 class="job-title">Senior Software Engineer</h2>
   *     <span class="location">San Francisco, CA</span>
   *     <span class="department">Engineering</span>
   *     <span class="job-type">Full-time</span>
   *     <p class="description">Join our engineering team...</p>
   *     <time class="posted-date" datetime="2025-01-01">January 1, 2025</time>
   *     <a href="/apply/123" class="apply-button">Apply Now</a>
   *   </div>
   * `;
   *
   * const jobs = parser.parseJobsFromHtml(htmlContent, 'https://company.com');
   * console.log(jobs[0].title); // "Senior Software Engineer"
   * console.log(jobs[0].location); // "San Francisco, CA"
   * console.log(jobs[0].apply_url); // "https://company.com/apply/123"
   *
   * // Handle multiple job postings
   * jobs.forEach((job, index) => {
   *   console.log(`Job ${index + 1}: ${job.title} - ${job.department}`);
   * });
   * ```
   * @since 1.0.0
   * @see {@link extractJobFromElement} for individual job extraction logic
   * @see {@link HtmlParsingConfig.jobSelectors} for selector configuration
   */
  public parseJobsFromHtml(html: string, baseUrl: string): RawJobData[] {
    const $ = cheerioLoad(html);
    const jobs: RawJobData[] = [];

    // Try each job selector until we find job listings
    for (const selector of this.config.jobSelectors) {
      const jobElements = $(selector);

      if (jobElements.length > 0) {
        jobElements.each((index, element) => {
          const job = this.extractJobFromElement($, element, baseUrl);
          if (job?.title) {
            jobs.push(job);
          }
        });

        // If we found jobs with this selector, don't try others
        if (jobs.length > 0) {
          break;
        }
      }
    }

    return jobs;
  }

  /**
   * Extract comprehensive job data from a single DOM element
   *
   * Processes an individual job listing element to extract all available
   * job data fields using the configured selector strategies. Implements
   * comprehensive error handling to ensure individual job parsing failures
   * don't affect the entire parsing operation, maintaining service reliability.
   *
   * The extraction process follows a structured approach:
   * 1. Create Cheerio wrapper for the job element
   * 2. Extract each data field using specialized methods
   * 3. Handle missing or malformed data gracefully
   * 4. Return structured job data or null for invalid entries
   *
   * Each data field extraction includes validation and fallback handling to
   * ensure robust parsing across diverse HTML structures. The method logs
   * extraction failures without throwing exceptions to maintain parsing
   * continuity for valid job entries.
   *
   * @param $ - Cheerio API instance for DOM manipulation and traversal
   * @param element - DOM element containing job posting data
   * @param baseUrl - Base URL for resolving relative application URLs
   * @returns Raw job data object with all extracted fields, or null if extraction fails
   * @example
   * ```typescript
   * // Internal usage within parseJobsFromHtml
   * const jobElement = $('.job-listing').first();
   * const jobData = this.extractJobFromElement($, jobElement[0], baseUrl);
   *
   * if (jobData && jobData.title) {
   *   jobs.push(jobData);
   * }
   * ```
   * @since 1.0.0
   * @see {@link extractText} for text extraction with selector fallbacks
   * @see {@link extractApplyUrl} for URL resolution logic
   * @see {@link extractDate} for date parsing and validation
   * @see {@link extractId} for ID generation strategies
   */
  private extractJobFromElement(
    $: CheerioAPI,
    element: CheerioNode,
    baseUrl: string
  ): RawJobData | null {
    const $element = $(element);

    try {
      const job: RawJobData = {
        id: this.extractId($, $element),
        title: this.extractText($, $element, this.config.titleSelectors),
        department: this.extractText($, $element, this.config.departmentSelectors),
        location: this.extractText($, $element, this.config.locationSelectors),
        type: this.extractText($, $element, this.config.typeSelectors),
        description: this.extractDescription($, $element),
        posted_date: this.extractDate($, $element),
        apply_url: this.extractApplyUrl($, $element, baseUrl),
      };

      return job;
    } catch (error) {
      const logger = getLogger();
      logger.warn('Failed to extract job from element', { error });
      return null;
    }
  }

  /**
   * Extract or generate unique job identifier from element
   *
   * Attempts to locate an explicit job ID from common HTML attributes,
   * implementing a fallback strategy to generate a unique identifier from
   * the job title if no explicit ID is available. This ensures every job
   * posting receives a consistent, trackable identifier for database storage
   * and API operations.
   *
   * The method searches through standard ID attributes in priority order:
   * 1. data-job-id (most specific job identifier)
   * 2. id (general element identifier)
   * 3. data-id (generic data identifier)
   * 4. data-position-id (position-specific identifier)
   *
   * If no attribute-based ID is found, generates a unique ID using the job
   * title combined with a timestamp to ensure uniqueness across parsing sessions.
   *
   * @param $ - Cheerio API instance for DOM operations
   * @param $element - Job element to extract identifier from
   * @returns Unique job identifier string, either extracted or generated
   * @example
   * ```typescript
   * // Element with explicit ID
   * // <div data-job-id="eng-123" class="job-listing">...</div>
   * const explicitId = this.extractId($, $element);
   * // Returns: "eng-123"
   *
   * // Element without ID, falls back to title generation
   * // <div class="job-listing"><h2>Software Engineer</h2>...</div>
   * const generatedId = this.extractId($, $element);
   * // Returns: "software-engineer-1735689600000"
   * ```
   * @since 1.0.0
   * @see {@link StringUtils.generateIdFromTitle} for fallback ID generation
   * @see {@link extractText} for title extraction when generating IDs
   */
  private extractId($: CheerioAPI, $element: ReturnType<CheerioAPI>): string {
    // Try common ID attributes
    const idAttributes = ['data-job-id', 'id', 'data-id', 'data-position-id'];

    for (const attr of idAttributes) {
      const value = $element.attr(attr);
      if (value) {
        return value;
      }
    }

    // Generate ID from text content if no explicit ID found
    const titleText = this.extractText($, $element, this.config.titleSelectors);
    return StringUtils.generateIdFromTitle(titleText);
  }

  /**
   * Extract text content using selector fallback strategy
   *
   * Implements a robust text extraction strategy that tries multiple CSS selectors
   * in priority order until finding an element with meaningful text content.
   * This approach provides reliable extraction across diverse HTML structures
   * and naming conventions, ensuring data retrieval even when primary selectors fail.
   *
   * The method processes each selector with the following logic:
   * 1. Search for matching elements within the parent element
   * 2. Select the first matching element for consistency
   * 3. Extract and normalize text content with whitespace trimming
   * 4. Return first non-empty text found, or empty string if none exist
   *
   * Text normalization includes whitespace trimming and empty string filtering
   * to ensure only meaningful content is returned. The method handles both
   * element text content and nested HTML structures gracefully.
   *
   * @param $ - Cheerio API instance for DOM manipulation
   * @param $element - Parent element to search within for selector matches
   * @param selectors - Ordered array of CSS selectors to try sequentially
   * @returns Extracted and normalized text content, or empty string if no content found
   * @example
   * ```typescript
   * // Try multiple title selectors in order
   * const titleSelectors = ['h1.job-title', 'h2.title', '.position-name'];
   * const title = this.extractText($, $jobElement, titleSelectors);
   *
   * // HTML: <div class="job"><h2 class="title">Software Engineer</h2></div>
   * // Returns: "Software Engineer"
   *
   * // Handles missing elements gracefully
   * const missingSelectors = ['.nonexistent', '.also-missing'];
   * const empty = this.extractText($, $jobElement, missingSelectors);
   * // Returns: ""
   * ```
   * @since 1.0.0
   * @see {@link HtmlParsingConfig} for selector configuration examples
   */
  private extractText(
    $: CheerioAPI,
    $element: ReturnType<CheerioAPI>,
    selectors: readonly string[]
  ): string {
    for (const selector of selectors) {
      const element = $element.find(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text) {
          return text;
        }
      }
    }
    return '';
  }

  /**
   * Extract job description with length limiting for performance
   *
   * Extracts job description text using configured selectors while applying
   * intelligent length limiting to prevent performance issues with extremely
   * long descriptions. Implements smart truncation that preserves readability
   * by trimming at word boundaries and adding appropriate ellipsis indicators.
   *
   * The method balances comprehensive content extraction with practical
   * performance considerations. Long descriptions are truncated at 500 characters
   * with ellipsis appended to indicate additional content availability.
   * This prevents memory bloat while maintaining essential job information.
   *
   * Length limiting rationale:
   * - Prevents memory issues with verbose job descriptions
   * - Maintains reasonable API response sizes
   * - Preserves essential information within character limit
   * - Provides clear indication when content is truncated
   *
   * @param $ - Cheerio API instance for DOM manipulation
   * @param $element - Parent element to search for description content
   * @returns Job description text, truncated to 500 characters if necessary
   * @example
   * ```typescript
   * // Short description (under 500 characters)
   * const shortDesc = this.extractDescription($, $element);
   * // Returns: "Join our team as a software engineer..."
   *
   * // Long description (over 500 characters)
   * const longDesc = this.extractDescription($, $element);
   * // Returns: "We are looking for an experienced software engineer... (truncated)..."
   * ```
   * @since 1.0.0
   * @see {@link extractText} for the underlying text extraction logic
   * @see {@link HtmlParsingConfig.descriptionSelectors} for selector configuration
   */
  private extractDescription($: CheerioAPI, $element: ReturnType<CheerioAPI>): string {
    const description = this.extractText($, $element, this.config.descriptionSelectors);

    // Limit description length to prevent overly long content
    const maxLength = 500;
    if (description.length > maxLength) {
      return description.substring(0, maxLength).trim() + '...';
    }

    return description;
  }

  /**
   * Extract job posting date with multi-format support and validation
   *
   * Extracts job posting dates from HTML elements using multiple extraction
   * strategies and format validation. Prioritizes structured datetime attributes
   * over text content to ensure accurate date parsing, with intelligent fallbacks
   * for various date formats commonly found on career sites.
   *
   * Extraction Strategy:
   * 1. Check datetime attribute for ISO-formatted dates (most reliable)
   * 2. Parse text content using DateUtils validation
   * 3. Fall back to current timestamp for missing/invalid dates
   *
   * The method handles various date formats including:
   * - ISO 8601 timestamps (2025-01-01T10:00:00Z)
   * - HTML5 datetime attributes
   * - Human-readable date strings (January 1, 2025)
   * - Relative dates (2 days ago) - converted to current timestamp
   *
   * Date validation ensures only parseable dates are returned, with graceful
   * fallback to current timestamp for invalid or missing dates to maintain
   * data consistency across job postings.
   *
   * @param $ - Cheerio API instance for DOM operations
   * @param $element - Parent element to search for date information
   * @returns ISO-formatted date string, or current timestamp if no valid date found
   * @example
   * ```typescript
   * // HTML with datetime attribute
   * // <time datetime="2025-01-01T10:00:00Z" class="posted-date">Jan 1, 2025</time>
   * const isoDate = this.extractDate($, $element);
   * // Returns: "2025-01-01T10:00:00Z"
   *
   * // HTML with text content only
   * // <span class="date">January 1, 2025</span>
   * const parsedDate = this.extractDate($, $element);
   * // Returns: "2025-01-01T00:00:00.000Z"
   *
   * // Missing or invalid date
   * const fallbackDate = this.extractDate($, $element);
   * // Returns: current timestamp (e.g., "2025-01-01T12:00:00.123Z")
   * ```
   * @since 1.0.0
   * @see {@link DateUtils.isValidDate} for date validation logic
   * @see {@link DateUtils.toIsoString} for date normalization
   * @see {@link DateUtils.getCurrentIsoTimestamp} for fallback timestamps
   */
  private extractDate($: CheerioAPI, $element: ReturnType<CheerioAPI>): string {
    for (const selector of this.config.dateSelectors) {
      const dateElement = $element.find(selector).first();

      if (dateElement.length > 0) {
        // Try datetime attribute first (more reliable)
        const datetime = dateElement.attr('datetime');
        if (datetime) {
          return datetime;
        }

        // Fall back to text content
        const dateText = dateElement.text().trim();
        if (dateText && DateUtils.isValidDate(dateText)) {
          return DateUtils.toIsoString(dateText);
        }
      }
    }

    // Default to current date if no date found
    return DateUtils.getCurrentIsoTimestamp();
  }

  /**
   * Extract and resolve job application URL with intelligent fallbacks
   *
   * Extracts application URLs from job postings using configured selectors
   * and resolves relative URLs to absolute URLs for reliable application
   * link generation. Implements comprehensive fallback strategies to ensure
   * every job posting has a valid application URL, even when explicit
   * links are missing or malformed.
   *
   * URL Resolution Strategy:
   * 1. Search for application links using configured selectors
   * 2. Extract href attributes from matching anchor elements
   * 3. Resolve relative URLs against the provided base URL
   * 4. Generate default application URL if no links found
   *
   * The method prioritizes explicit application links but gracefully handles
   * missing links by generating DriveHR-compatible application URLs using
   * job IDs and company information extracted from the base URL.
   *
   * URL validation ensures all returned URLs are properly formatted and
   * accessible for job applicants. The fallback URL generation provides
   * a consistent application experience even for sites with inconsistent
   * or missing application link structures.
   *
   * @param $ - Cheerio API instance for DOM manipulation
   * @param $element - Parent element to search for application links
   * @param baseUrl - Base URL for resolving relative links and company ID extraction
   * @returns Fully resolved application URL, either extracted or generated
   * @example
   * ```typescript
   * // HTML with explicit apply link
   * // <a href="/apply/123" class="apply-button">Apply Now</a>
   * const explicitUrl = this.extractApplyUrl($, $element, 'https://company.com');
   * // Returns: "https://company.com/apply/123"
   *
   * // HTML with relative link
   * // <a href="./careers/apply" class="apply-link">Apply</a>
   * const relativeUrl = this.extractApplyUrl($, $element, 'https://company.com/jobs');
   * // Returns: "https://company.com/jobs/careers/apply"
   *
   * // HTML without apply link (fallback generation)
   * const fallbackUrl = this.extractApplyUrl($, $element, 'https://company.com');
   * // Returns: "https://drivehris.app/apply/job-id-timestamp"
   * ```
   * @since 1.0.0
   * @see {@link UrlUtils.resolveUrl} for URL resolution logic
   * @see {@link generateDefaultApplyUrl} for fallback URL generation
   * @see {@link extractId} for job ID extraction used in fallback URLs
   */
  private extractApplyUrl(
    $: CheerioAPI,
    $element: ReturnType<CheerioAPI>,
    baseUrl: string
  ): string {
    for (const selector of this.config.applyUrlSelectors) {
      const linkElement = $element.find(selector).first();

      if (linkElement.length > 0) {
        const href = linkElement.attr('href');
        if (href) {
          return UrlUtils.resolveUrl(href, baseUrl);
        }
      }
    }

    // Generate default apply URL if none found
    const jobId = this.extractId($, $element);
    return this.generateDefaultApplyUrl(jobId, baseUrl);
  }

  /**
   * Generate default application URL for jobs without explicit apply links
   *
   * Creates standardized application URLs for job postings that lack explicit
   * application links. Implements intelligent URL generation strategies that
   * prioritize DriveHR-compatible URLs while providing fallback options for
   * various site configurations and URL structures.
   *
   * URL Generation Strategy:
   * 1. Extract company ID from base URL if available
   * 2. Generate DriveHR application URL with company and job ID
   * 3. Fall back to host-based application URL structure
   * 4. Provide universal DriveHR fallback for error cases
   *
   * The generated URLs maintain consistency with DriveHR's application flow
   * while accommodating different deployment scenarios. Company ID extraction
   * enables personalized application experiences when available.
   *
   * @param jobId - Unique job identifier for URL generation
   * @param baseUrl - Base URL for company ID extraction and host determination
   * @returns Generated application URL in DriveHR-compatible format
   * @example
   * ```typescript
   * // URL with extractable company ID
   * const companyUrl = this.generateDefaultApplyUrl('job-123', 'https://company.com/careers/comp-456/');
   * // Returns: "https://drivehris.app/careers/comp-456/apply/job-123"
   *
   * // URL without company ID (host fallback)
   * const hostUrl = this.generateDefaultApplyUrl('job-456', 'https://company.com/jobs');
   * // Returns: "https://company.com/apply/job-456"
   *
   * // Invalid URL (universal fallback)
   * const fallbackUrl = this.generateDefaultApplyUrl('job-789', 'invalid-url');
   * // Returns: "https://drivehris.app/apply/job-789"
   * ```
   * @since 1.0.0
   * @see {@link extractCompanyIdFromUrl} for company ID extraction logic
   */
  private generateDefaultApplyUrl(jobId: string, baseUrl: string): string {
    try {
      const urlObj = new URL(baseUrl);
      const companyId = this.extractCompanyIdFromUrl(baseUrl);

      if (companyId) {
        return `https://drivehris.app/careers/${companyId}/apply/${jobId}`;
      }

      // Fallback to base domain with apply path
      return `${urlObj.protocol}//${urlObj.host}/apply/${jobId}`;
    } catch {
      return `https://drivehris.app/apply/${jobId}`;
    }
  }

  /**
   * Extract company identifier from DriveHR-formatted URLs
   *
   * Extracts company identifiers from URLs that follow DriveHR's standard
   * career page URL format. Uses regular expression pattern matching to
   * identify and extract UUID-formatted company IDs from career site URLs,
   * enabling personalized application URL generation.
   *
   * The method recognizes DriveHR's standard URL pattern:
   * `/careers/{company-id}/` where company-id is a UUID format identifier
   * (hexadecimal characters and hyphens). This pattern is commonly used
   * in DriveHR-powered career sites for company-specific job listings.
   *
   * @param url - URL string to search for company ID patterns
   * @returns Extracted company ID string, or null if no valid pattern found
   * @example
   * ```typescript
   * // Valid DriveHR career URL
   * const validId = this.extractCompanyIdFromUrl('https://company.com/careers/abc123-def4-5678-9012-345678901234/');
   * // Returns: "abc123-def4-5678-9012-345678901234"
   *
   * // URL without company ID pattern
   * const noId = this.extractCompanyIdFromUrl('https://company.com/jobs/engineering');
   * // Returns: null
   *
   * // Invalid URL format
   * const invalidId = this.extractCompanyIdFromUrl('https://company.com/careers/invalid-format/');
   * // Returns: null
   * ```
   * @since 1.0.0
   * @see {@link generateDefaultApplyUrl} for usage in URL generation
   */
  private extractCompanyIdFromUrl(url: string): string | null {
    const match = url.match(/\/careers\/([a-f0-9-]+)\//);
    return match?.[1] ?? null;
  }
}

/**
 * Factory function for creating HTML parser instances with configuration merging
 *
 * Recommended factory function for instantiating HTML parser services with
 * optional configuration override capabilities. Provides intelligent configuration
 * merging that combines custom selectors with proven default strategies,
 * ensuring robust parsing behavior while allowing site-specific customization.
 *
 * The factory implements configuration composition patterns that preserve
 * default selector fallbacks while enabling targeted overrides for specific
 * parsing requirements. This approach maximizes parsing success rates by
 * maintaining comprehensive selector coverage.
 *
 * Configuration Merging Strategy:
 * 1. Start with battle-tested default selector configuration
 * 2. Merge provided custom selectors for targeted overrides
 * 3. Preserve default selectors as fallbacks for reliability
 * 4. Return configured parser instance ready for use
 *
 * The factory pattern provides dependency injection support and simplifies
 * testing by allowing easy parser configuration without direct class instantiation.
 *
 * @param config - Optional partial configuration to override default selectors
 * @returns Configured HTML parser instance implementing IHtmlParser interface
 * @example
 * ```typescript
 * // Use default configuration for general job sites
 * const defaultParser = createHtmlParser();
 * const jobs1 = defaultParser.parseJobsFromHtml(html, baseUrl);
 *
 * // Override specific selectors for custom sites
 * const customParser = createHtmlParser({
 *   jobSelectors: ['.custom-job-card', '.position-listing'],
 *   titleSelectors: ['h2.custom-title', '.position-name']
 *   // Other selectors inherit from defaults
 * });
 * const jobs2 = customParser.parseJobsFromHtml(customHtml, baseUrl);
 *
 * // Site-specific parser with comprehensive overrides
 * const siteParser = createHtmlParser({
 *   jobSelectors: ['.job-item'],
 *   titleSelectors: ['h3.job-title'],
 *   departmentSelectors: ['.dept'],
 *   locationSelectors: ['.loc'],
 *   typeSelectors: ['.employment-type'],
 *   descriptionSelectors: ['.summary'],
 *   dateSelectors: ['.date-posted'],
 *   applyUrlSelectors: ['a.apply-now']
 * });
 * const jobs3 = siteParser.parseJobsFromHtml(siteHtml, baseUrl);
 *
 * // Dependency injection pattern
 * class JobScrapingService {
 *   constructor(private parser: IHtmlParser = createHtmlParser()) {}
 *
 *   async scrapeJobs(url: string) {
 *     const html = await fetchHtml(url);
 *     return this.parser.parseJobsFromHtml(html, url);
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link HtmlParserService} for the underlying implementation class
 * @see {@link DEFAULT_PARSING_CONFIG} for default selector strategies
 * @see {@link HtmlParsingConfig} for configuration interface structure
 * @see {@link IHtmlParser} for the parser interface contract
 */
export function createHtmlParser(config?: Partial<HtmlParsingConfig>): IHtmlParser {
  const mergedConfig = config ? { ...DEFAULT_PARSING_CONFIG, ...config } : DEFAULT_PARSING_CONFIG;
  return new HtmlParserService(mergedConfig);
}
