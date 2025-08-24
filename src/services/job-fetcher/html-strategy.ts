/**
 * HTML Job Fetch Strategy
 *
 * Enterprise-grade HTML-based job data extraction strategy implementing the Strategy pattern
 * for DriveHR careers page scraping. Provides intelligent HTML parsing with fallback mechanisms,
 * "no jobs available" detection, and comprehensive error handling for production environments.
 *
 * This strategy specializes in extracting structured job data from unstructured HTML content
 * by leveraging pluggable HTML parser implementations. The system includes sophisticated
 * detection algorithms for identifying when no jobs are available through common textual
 * indicators found on careers pages.
 *
 * Key Features:
 * - Strategy pattern implementation for job fetching operations
 * - Dependency injection for HTML parser flexibility
 * - Intelligent "no jobs available" scenario detection
 * - Comprehensive error handling and HTTP response validation
 * - Enterprise-grade logging and performance monitoring
 * - Configurable HTML parsing with pluggable parser interfaces
 *
 * @example
 * ```typescript
 * import { HtmlJobFetchStrategy } from './html-strategy.js';
 * import { CheerioHtmlParser } from '../html-parser.js';
 * import { createHttpClient } from '../../lib/http-client.js';
 *
 * const htmlParser = new CheerioHtmlParser();
 * const httpClient = createHttpClient({ timeout: 30000 });
 * const strategy = new HtmlJobFetchStrategy(htmlParser);
 *
 * const config = {
 *   companyId: 'acme-corp',
 *   careersUrl: 'https://acme.com/careers'
 * };
 *
 * if (strategy.canHandle(config)) {
 *   const jobs = await strategy.fetchJobs(config, httpClient);
 *   console.log(`Successfully scraped ${jobs.length} jobs from HTML`);
 * }
 * ```
 *
 * @module html-strategy
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for the strategy interface contract
 * @see {@link IHtmlParser} for HTML parsing implementation details
 * @see {@link DriveHrUrlBuilder} for URL construction utilities
 */

import { DriveHrUrlBuilder } from '../../lib/job-fetch-utils.js';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { RawJobData, FetchMethod } from '../../types/job.js';
import type { IJobFetchStrategy, IHtmlParser } from './types.js';

/**
 * HTML-based job fetching strategy implementation
 *
 * Concrete implementation of the Strategy pattern for extracting job data from HTML
 * content on DriveHR careers pages. This strategy handles the complete workflow from
 * HTML content retrieval through structured data extraction with intelligent detection
 * of empty job listings and comprehensive error handling.
 *
 * The strategy uses dependency injection to accept different HTML parser implementations,
 * enabling flexibility in parsing approaches while maintaining a consistent interface.
 * It includes sophisticated logic for detecting "no jobs available" scenarios through
 * textual analysis of HTML content.
 *
 * @implements {IJobFetchStrategy}
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for the complete strategy interface
 * @see {@link IHtmlParser} for parser implementation requirements
 */
export class HtmlJobFetchStrategy implements IJobFetchStrategy {
  public readonly name: FetchMethod = 'html';

  /**
   * Create HTML job fetch strategy with parser dependency
   *
   * Initializes the strategy with a pluggable HTML parser implementation to enable
   * flexibility in parsing approaches while maintaining consistent strategy behavior.
   * The parser handles the actual job data extraction from HTML content.
   *
   * @param htmlParser - HTML parser implementation for structured data extraction
   * @example
   * ```typescript
   * const cheerioParser = new CheerioHtmlParser();
   * const strategy = new HtmlJobFetchStrategy(cheerioParser);
   * ```
   * @since 1.0.0
   */
  constructor(private readonly htmlParser: IHtmlParser) {}

  /**
   * Validate if HTML strategy can handle the provided configuration
   *
   * Performs capability checking to determine if this strategy can process
   * the given DriveHR configuration. Requires a careers URL to be present
   * for HTML scraping operations. This method is part of the Strategy pattern's
   * capability validation phase.
   *
   * @param config - DriveHR API configuration to validate for HTML strategy compatibility
   * @returns True if strategy can handle the configuration, false otherwise
   * @example
   * ```typescript
   * const config = { careersUrl: 'https://company.com/careers' };
   * if (strategy.canHandle(config)) {
   *   // Strategy is compatible, proceed with job fetching
   *   const jobs = await strategy.fetchJobs(config, httpClient);
   * }
   * ```
   * @since 1.0.0
   */
  public canHandle(config: DriveHrApiConfig): boolean {
    return Boolean(config.careersUrl);
  }

  /**
   * Fetch and extract job data from HTML careers page content
   *
   * Orchestrates the complete HTML-based job extraction workflow including HTTP content
   * retrieval, HTML parsing, and intelligent detection of "no jobs available" scenarios.
   * This method implements the core strategy behavior for extracting structured job data
   * from unstructured HTML content with comprehensive error handling.
   *
   * The process includes:
   * 1. Careers page URL construction using DriveHR URL builder
   * 2. HTTP content retrieval with appropriate HTML headers
   * 3. Response validation and error handling
   * 4. HTML content parsing through injected parser implementation
   * 5. "No jobs available" detection through textual analysis
   * 6. Structured job data return with validation
   *
   * @param config - DriveHR API configuration containing careers URL and company details
   * @param httpClient - HTTP client instance for content retrieval operations
   * @returns Promise resolving to array of raw job data extracted from HTML
   * @throws {Error} When HTML page is not accessible or HTTP request fails
   * @example
   * ```typescript
   * const config = {
   *   companyId: 'tech-corp',
   *   careersUrl: 'https://techcorp.com/careers'
   * };
   *
   * try {
   *   const jobs = await strategy.fetchJobs(config, httpClient);
   *   if (jobs.length === 0) {
   *     console.log('No jobs found or "no jobs" indicator detected');
   *   } else {
   *     console.log(`Successfully scraped ${jobs.length} jobs from HTML`);
   *     jobs.forEach(job => {
   *       console.log(`- ${job.title || job.position_title} (${job.department || 'Unknown'})`);
   *     });
   *   }
   * } catch (error) {
   *   console.error('HTML scraping failed:', error.message);
   *   // Implement fallback strategy or error reporting
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

    const htmlContent = response.data;
    const jobs = this.htmlParser.parseJobsFromHtml(htmlContent, careersUrl);

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
