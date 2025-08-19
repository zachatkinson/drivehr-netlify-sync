/**
 * HTML Parser Service
 *
 * Enterprise-grade HTML parsing service that extracts structured job data
 * from unstructured HTML content using Cheerio. Implements robust parsing
 * strategies with configurable CSS selectors and intelligent fallback
 * mechanisms for various job posting formats.
 *
 * Features include:
 * - Configurable CSS selector strategies for different site layouts
 * - Intelligent text extraction with fallback options
 * - URL resolution for relative links
 * - Date parsing with multiple format support
 * - Error handling and graceful degradation
 *
 * @module html-parser
 * @since 1.0.0
 * @see {@link IHtmlParser} for the parser interface
 * @see {@link HtmlParsingConfig} for configuration options
 * @see {@link createHtmlParser} for factory function
 */

import { load as cheerioLoad, type CheerioAPI } from 'cheerio';
import { getLogger } from '../lib/logger.js';
import { StringUtils, DateUtils, UrlUtils } from '../lib/utils.js';
import type { RawJobData } from '../types/job.js';
import type { IHtmlParser } from './job-fetcher.js';

/**
 * Re-export IHtmlParser interface for testing and external use
 *
 * Provides access to the parser interface for dependency injection,
 * testing, and creating custom parser implementations.
 *
 * @since 1.0.0
 */
export type { IHtmlParser };

/**
 * Type alias for DOM nodes that Cheerio can work with
 *
 * Represents the element parameter type that Cheerio's API accepts
 * for DOM manipulation operations.
 *
 * @since 1.0.0
 */
type CheerioNode = Parameters<CheerioAPI>[0];

/**
 * Configuration interface for HTML parsing selectors
 *
 * Defines the CSS selector strategies used to extract different types
 * of job data from HTML content. Each property contains an array of
 * selectors tried in order of preference until a match is found.
 *
 * @example
 * ```typescript
 * const customConfig: HtmlParsingConfig = {
 *   jobSelectors: ['.custom-job-card', '.job-listing'],
 *   titleSelectors: ['h2.job-title', '.title'],
 *   // ... other selectors
 * };
 *
 * const parser = createHtmlParser(customConfig);
 * ```
 * @since 1.0.0
 * @see {@link DEFAULT_PARSING_CONFIG} for default selector configuration
 */
export interface HtmlParsingConfig {
  /** CSS selectors for job container elements */
  readonly jobSelectors: readonly string[];
  /** CSS selectors for job title elements */
  readonly titleSelectors: readonly string[];
  /** CSS selectors for department/category elements */
  readonly departmentSelectors: readonly string[];
  /** CSS selectors for location/workplace elements */
  readonly locationSelectors: readonly string[];
  /** CSS selectors for employment type elements */
  readonly typeSelectors: readonly string[];
  /** CSS selectors for job description elements */
  readonly descriptionSelectors: readonly string[];
  /** CSS selectors for posted date elements */
  readonly dateSelectors: readonly string[];
  /** CSS selectors for apply URL link elements */
  readonly applyUrlSelectors: readonly string[];
}

/**
 * Default parsing configuration with common CSS selectors
 *
 * Comprehensive set of CSS selectors covering common job posting
 * layouts and naming conventions across various career sites.
 * Selectors are ordered by likelihood of success and specificity.
 *
 * @since 1.0.0
 * @see {@link HtmlParsingConfig} for the configuration interface
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
 * HTML parsing service implementation using Cheerio
 *
 * Production-ready implementation of the IHtmlParser interface that
 * provides robust HTML parsing capabilities for extracting job data
 * from various website formats. Uses configurable CSS selectors and
 * implements intelligent fallback strategies.
 *
 * @implements {IHtmlParser}
 * @example
 * ```typescript
 * const parser = new HtmlParserService();
 * const html = '<div class="job-listing"><h2>Software Engineer</h2></div>';
 * const jobs = parser.parseJobsFromHtml(html, 'https://example.com');
 * console.log(`Parsed ${jobs.length} jobs`);
 * ```
 * @since 1.0.0
 * @see {@link createHtmlParser} for the recommended factory function
 */
export class HtmlParserService implements IHtmlParser {
  /**
   * Create HTML parser service with optional configuration
   *
   * @param config - Custom parsing configuration (uses defaults if not provided)
   * @since 1.0.0
   */
  constructor(private readonly config: HtmlParsingConfig = DEFAULT_PARSING_CONFIG) {}

  /**
   * Parse job data from HTML content
   *
   * Main parsing method that loads HTML content with Cheerio and attempts
   * to extract job data using configured selectors. Tries job selectors
   * in order of preference and stops at the first successful match to
   * avoid duplicate data extraction.
   *
   * @param html - HTML content to parse for job data
   * @param baseUrl - Base URL for resolving relative links
   * @returns Array of raw job data extracted from HTML
   * @example
   * ```typescript
   * const parser = new HtmlParserService();
   * const html = `
   *   <div class="job-listing">
   *     <h2 class="job-title">Software Engineer</h2>
   *     <span class="location">San Francisco, CA</span>
   *     <a href="/apply/123" class="apply-button">Apply Now</a>
   *   </div>
   * `;
   *
   * const jobs = parser.parseJobsFromHtml(html, 'https://example.com');
   * console.log(jobs[0].title); // "Software Engineer"
   * console.log(jobs[0].location); // "San Francisco, CA"
   * ```
   * @since 1.0.0
   * @see {@link extractJobFromElement} for individual job extraction logic
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
   * Extract job data from a single DOM element
   *
   * Processes an individual job listing element and extracts all available
   * job data fields using the configured selectors. Provides comprehensive
   * error handling to prevent individual job parsing failures from affecting
   * the entire parsing operation.
   *
   * @param $ - Cheerio API instance for DOM manipulation
   * @param element - DOM element containing job data
   * @param baseUrl - Base URL for resolving relative links
   * @returns Raw job data object or null if extraction fails
   * @since 1.0.0
   * @see {@link extractText} for text extraction logic
   * @see {@link extractApplyUrl} for URL resolution logic
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
   * Extract or generate job ID from element
   *
   * Attempts to find an explicit job ID from common data attributes,
   * falling back to generating a unique ID from the job title if no
   * explicit ID is found.
   *
   * @param $ - Cheerio API instance
   * @param $element - Job element to extract ID from
   * @returns Unique job identifier
   * @since 1.0.0
   * @see {@link StringUtils.generateIdFromTitle} for ID generation logic
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
   * Tries each selector in order until it finds an element with
   * meaningful text content. This provides robust extraction that
   * works across different HTML structures and naming conventions.
   *
   * @param $ - Cheerio API instance
   * @param $element - Parent element to search within
   * @param selectors - Array of CSS selectors to try in order
   * @returns Extracted and trimmed text content, or empty string if none found
   * @since 1.0.0
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

  private extractDescription($: CheerioAPI, $element: ReturnType<CheerioAPI>): string {
    const description = this.extractText($, $element, this.config.descriptionSelectors);

    // Limit description length to prevent overly long content
    const maxLength = 500;
    if (description.length > maxLength) {
      return description.substring(0, maxLength).trim() + '...';
    }

    return description;
  }

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

  private extractCompanyIdFromUrl(url: string): string | null {
    const match = url.match(/\/careers\/([a-f0-9-]+)\//);
    return match?.[1] ?? null;
  }
}

/**
 * Factory function for creating HTML parser instances
 *
 * Recommended way to create HTML parser instances with optional
 * configuration override. Merges custom configuration with defaults
 * to provide a complete configuration object.
 *
 * @param config - Optional partial configuration to override defaults
 * @returns Configured HTML parser instance
 * @example
 * ```typescript
 * // Use default configuration
 * const defaultParser = createHtmlParser();
 *
 * // Override specific selectors
 * const customParser = createHtmlParser({
 *   jobSelectors: ['.custom-job-card'],
 *   titleSelectors: ['h1.job-title']
 * });
 *
 * // Parse HTML with custom configuration
 * const jobs = customParser.parseJobsFromHtml(html, baseUrl);
 * ```
 * @since 1.0.0
 * @see {@link HtmlParserService} for the implementation class
 * @see {@link DEFAULT_PARSING_CONFIG} for default selectors
 */
export function createHtmlParser(config?: Partial<HtmlParsingConfig>): IHtmlParser {
  const mergedConfig = config ? { ...DEFAULT_PARSING_CONFIG, ...config } : DEFAULT_PARSING_CONFIG;
  return new HtmlParserService(mergedConfig);
}
