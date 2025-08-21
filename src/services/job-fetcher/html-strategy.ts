import { DriveHrUrlBuilder } from '../../lib/job-fetch-utils.js';
import type { IHttpClient } from '../../lib/http-client.js';
import type { DriveHrApiConfig } from '../../types/api.js';
import type { RawJobData, FetchMethod } from '../../types/job.js';
import type { IJobFetchStrategy, IHtmlParser } from './types.js';

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
