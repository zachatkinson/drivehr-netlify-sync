/**
 * Playwright-based job scraper for DriveHR Single Page Applications
 *
 * Enterprise-grade web scraper that uses Playwright browser automation to handle
 * JavaScript-heavy Single Page Applications that require dynamic content rendering.
 * This scraper addresses the limitation of traditional HTTP-based scrapers that
 * cannot access content rendered by client-side JavaScript.
 *
 * The scraper follows the same patterns as the existing job fetching strategies
 * but uses browser automation instead of HTTP requests to handle SPAs properly.
 * It includes comprehensive error handling, retry logic, and debugging capabilities.
 *
 * @module playwright-scraper
 * @since 2.0.0
 * @see {@link IJobFetchStrategy} for the strategy interface this implements
 * @see {@link DriveHrApiConfig} for configuration structure
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { getLogger } from '../lib/logger.js';
import { DateUtils, StringUtils } from '../lib/utils.js';
import { DriveHrUrlBuilder } from '../lib/job-fetch-utils.js';
import type { DriveHrApiConfig } from '../types/api.js';
import type { RawJobData, NormalizedJob, JobSource } from '../types/job.js';

/**
 * Configuration options for Playwright scraper
 *
 * Provides fine-grained control over browser behavior, timeouts, and
 * scraping parameters for optimal performance in different environments
 * (local development, CI/CD, production).
 *
 * @example
 * ```typescript
 * const config: PlaywrightScraperConfig = {
 *   headless: true,
 *   timeout: 30000,
 *   waitForSelector: '.job-listing',
 *   retries: 3,
 *   debug: false
 * };
 * ```
 * @since 2.0.0
 */
export interface PlaywrightScraperConfig {
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
  /** Navigation timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Selector to wait for before scraping (default: '.job-listing, .job-item, .career-listing') */
  waitForSelector?: string;
  /** Number of retry attempts on failure (default: 3) */
  retries?: number;
  /** Enable debug mode with screenshots and verbose logging (default: false) */
  debug?: boolean;
  /** Custom user agent string */
  userAgent?: string;
  /** Additional browser launch arguments */
  browserArgs?: string[];
}

/**
 * Result from a Playwright scraping operation
 *
 * Contains the scraped job data along with metadata about the scraping
 * process for debugging and monitoring purposes.
 *
 * @since 2.0.0
 */
export interface PlaywrightScrapeResult {
  /** Successfully scraped normalized jobs */
  jobs: NormalizedJob[];
  /** Number of jobs found */
  totalCount: number;
  /** Whether scraping was successful */
  success: boolean;
  /** Error message if scraping failed */
  error?: string;
  /** URL that was scraped */
  url: string;
  /** Timestamp when scraping occurred */
  scrapedAt: string;
  /** Screenshot path if debug mode enabled */
  screenshotPath?: string;
}

/**
 * Playwright-based web scraper for DriveHR job listings
 *
 * Advanced web scraper that uses browser automation to handle JavaScript-heavy
 * Single Page Applications that traditional HTTP scrapers cannot process.
 * Designed specifically for DriveHR's SPA architecture where job listings
 * are dynamically rendered by client-side JavaScript.
 *
 * Features:
 * - Full browser automation with Playwright
 * - Intelligent waiting for dynamic content
 * - Comprehensive error handling and retries
 * - Debug mode with screenshots
 * - Memory and resource management
 * - Consistent job data normalization
 *
 * @example
 * ```typescript
 * const scraper = new PlaywrightScraper({
 *   headless: true,
 *   timeout: 30000,
 *   debug: process.env.NODE_ENV === 'development'
 * });
 *
 * const config = {
 *   companyId: 'acme-corp',
 *   careersUrl: 'https://drivehris.app/careers/acme-corp/list'
 * };
 *
 * const result = await scraper.scrapeJobs(config, 'github-actions');
 * if (result.success) {
 *   console.log(`Scraped ${result.totalCount} jobs`);
 * }
 * ```
 * @since 2.0.0
 * @see {@link PlaywrightScraperConfig} for configuration options
 * @see {@link PlaywrightScrapeResult} for result structure
 */
export class PlaywrightScraper {
  private readonly config: Required<PlaywrightScraperConfig>;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  /**
   * Create Playwright scraper with configuration
   *
   * @param config - Scraper configuration options
   * @since 2.0.0
   */
  constructor(config: PlaywrightScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      waitForSelector: config.waitForSelector ?? '.job-listing, .job-item, .career-listing',
      retries: config.retries ?? 3,
      debug: config.debug ?? false,
      userAgent: config.userAgent ?? 'DriveHR-Scraper/2.0 (GitHub Actions)',
      browserArgs: config.browserArgs ?? [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    };
  }

  /**
   * Scrape jobs from DriveHR careers page using browser automation
   *
   * Main entry point for job scraping that handles the full lifecycle:
   * browser launch, page navigation, content waiting, data extraction,
   * normalization, and cleanup. Includes comprehensive error handling
   * and retry logic for robust operation in production environments.
   *
   * @param apiConfig - DriveHR API configuration with careers URL
   * @param source - Source identifier for job tracking
   * @returns Promise resolving to scrape result with job data
   * @example
   * ```typescript
   * const scraper = new PlaywrightScraper({ debug: true });
   * const config = { companyId: 'tech-startup', careersUrl: 'https://...' };
   *
   * const result = await scraper.scrapeJobs(config, 'manual');
   * if (result.success) {
   *   result.jobs.forEach(job => console.log(`${job.title} - ${job.location}`));
   * } else {
   *   console.error('Scraping failed:', result.error);
   * }
   * ```
   * @since 2.0.0
   */
  public async scrapeJobs(
    apiConfig: DriveHrApiConfig,
    source: JobSource = 'github-actions'
  ): Promise<PlaywrightScrapeResult> {
    const logger = getLogger();
    const url = DriveHrUrlBuilder.buildCareersPageUrl(apiConfig);
    const scrapedAt = new Date().toISOString();

    logger.info(`Starting Playwright scraping for ${url}`);

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        await this.initializeBrowser();

        if (!this.context) {
          throw new Error('Browser context not initialized');
        }
        const page = await this.context.newPage();
        await this.setupPage(page);

        logger.debug(`Attempt ${attempt}: Navigating to ${url}`);
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: this.config.timeout,
        });

        // Wait for dynamic content to load
        await this.waitForJobListings(page);

        // Extract job data from the page
        const rawJobs = await this.extractJobData(page, url);

        // Take debug screenshot if enabled
        let screenshotPath: string | undefined;
        if (this.config.debug) {
          screenshotPath = await this.takeDebugScreenshot(page, apiConfig.companyId);
        }

        await page.close();
        await this.closeBrowser();

        // Normalize job data
        const normalizedJobs = await this.normalizeJobs(rawJobs, source);

        logger.info(`Successfully scraped ${normalizedJobs.length} jobs from ${url}`);

        return {
          jobs: normalizedJobs,
          totalCount: normalizedJobs.length,
          success: true,
          url,
          scrapedAt,
          screenshotPath,
        };
      } catch (error) {
        logger.warn(
          `Scraping attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        await this.closeBrowser();

        if (attempt === this.config.retries) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error';
          return {
            jobs: [],
            totalCount: 0,
            success: false,
            error: errorMessage,
            url,
            scrapedAt,
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    // This should never be reached due to the retry logic above
    return {
      jobs: [],
      totalCount: 0,
      success: false,
      error: 'All retry attempts exhausted',
      url,
      scrapedAt,
    };
  }

  /**
   * Initialize browser and context with optimized settings
   *
   * Sets up the Playwright browser instance with configuration optimized
   * for job scraping including performance settings, user agent, and
   * security considerations for CI/CD environments.
   *
   * @private
   * @returns Promise that resolves when browser is ready
   * @since 2.0.0
   */
  private async initializeBrowser(): Promise<void> {
    if (this.browser) {
      return; // Already initialized
    }

    const logger = getLogger();
    logger.debug('Launching Playwright browser');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: this.config.browserArgs,
    });

    this.context = await this.browser.newContext({
      userAgent: this.config.userAgent,
      viewport: { width: 1280, height: 720 },
      // Optimize for job scraping
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
      },
    });
  }

  /**
   * Setup page with performance and security settings
   *
   * Configures the page instance with settings optimized for job scraping
   * including timeouts, request interception, and error handling.
   *
   * @private
   * @param page - Playwright page instance to configure
   * @returns Promise that resolves when page is configured
   * @since 2.0.0
   */
  private async setupPage(page: Page): Promise<void> {
    // Set timeouts
    page.setDefaultTimeout(this.config.timeout);
    page.setDefaultNavigationTimeout(this.config.timeout);

    // Block unnecessary resources to speed up loading
    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Handle console messages in debug mode
    if (this.config.debug) {
      page.on('console', msg => {
        const logger = getLogger();
        logger.debug(`Page console.${msg.type()}: ${msg.text()}`);
      });
    }
  }

  /**
   * Wait for job listings to load dynamically
   *
   * Implements intelligent waiting logic that handles the dynamic nature
   * of SPA job listings. Uses multiple strategies to detect when job
   * content has finished loading.
   *
   * @private
   * @param page - Playwright page instance
   * @returns Promise that resolves when job listings are ready
   * @since 2.0.0
   */
  private async waitForJobListings(page: Page): Promise<void> {
    const logger = getLogger();
    logger.debug('Waiting for job listings to load');

    try {
      // Strategy 1: Wait for common job listing selectors
      await page.waitForSelector(this.config.waitForSelector, {
        timeout: this.config.timeout,
        state: 'visible',
      });
      logger.debug('Job listing elements found');
    } catch {
      // Strategy 2: Wait for page stability (no network activity)
      logger.debug('Job listing selectors not found, waiting for network idle');
      await page.waitForLoadState('networkidle', { timeout: this.config.timeout });

      // Strategy 3: Additional wait for SPA rendering
      await page.waitForTimeout(2000);
    }

    // Check for "no jobs" indicators
    const noJobsSelectors = [
      'text="No positions available"',
      'text="No current openings"',
      'text="No job opportunities"',
      'text="We don\'t have any open positions"',
    ];

    for (const selector of noJobsSelectors) {
      const noJobsElement = await page.locator(selector).first();
      if (await noJobsElement.isVisible().catch(() => false)) {
        logger.info('No jobs available indicator found');
        return;
      }
    }
  }

  /**
   * Extract job data from the loaded page
   *
   * Implements comprehensive job data extraction that handles various
   * HTML structures and data formats used by DriveHR careers pages.
   * Uses multiple extraction strategies for maximum compatibility.
   *
   * @private
   * @param page - Playwright page instance with loaded content
   * @param baseUrl - Base URL for resolving relative links
   * @returns Promise resolving to array of raw job data
   * @since 2.0.0
   */
  private async extractJobData(page: Page, baseUrl: string): Promise<RawJobData[]> {
    const logger = getLogger();
    logger.debug('Extracting job data from page');

    // Strategy 1: Extract from structured job listing elements
    const structuredJobs = await this.extractFromStructuredElements(page, baseUrl);
    if (structuredJobs.length > 0) {
      logger.debug(`Found ${structuredJobs.length} jobs from structured elements`);
      return structuredJobs;
    }

    // Strategy 2: Extract from JSON-LD structured data
    const jsonLdJobs = await this.extractFromJsonLd(page);
    if (jsonLdJobs.length > 0) {
      logger.debug(`Found ${jsonLdJobs.length} jobs from JSON-LD`);
      return jsonLdJobs;
    }

    // Strategy 3: Extract from page text patterns
    const textJobs = await this.extractFromTextPatterns(page, baseUrl);
    if (textJobs.length > 0) {
      logger.debug(`Found ${textJobs.length} jobs from text patterns`);
      return textJobs;
    }

    logger.warn('No job data could be extracted from page');
    return [];
  }

  /**
   * Extract jobs from structured HTML elements
   *
   * @private
   * @param page - Playwright page instance
   * @param baseUrl - Base URL for resolving relative links
   * @returns Promise resolving to array of raw job data
   * @since 2.0.0
   */
  private async extractFromStructuredElements(page: Page, baseUrl: string): Promise<RawJobData[]> {
    return await page.evaluate(url => {
      /* eslint-disable no-undef */
      // ARCHITECTURAL JUSTIFICATION: Browser context execution requires DOM globals (document, window)
      // that are not available in Node.js TypeScript environment. Playwright's page.evaluate()
      // executes this code in the browser context where these globals are standard and safe.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. External DOM library (jsdom): Would require significant refactoring and lose browser
      //    context benefits like actual rendering, JavaScript execution, and CSS application
      // 2. Type declarations for browser globals: Cannot be used as this code runs in dual
      //    contexts (Node.js compilation + browser execution) with conflicting global types
      // 3. Separate browser-only TypeScript files: Would break the cohesive scraping logic
      //    and complicate the build process with multiple compilation targets
      //
      // CONCLUSION: eslint-disable is architecturally necessary for browser context code
      // execution within Playwright's page.evaluate() method.
      const jobs: RawJobData[] = [];

      // Common selectors for job listings
      const jobSelectors = [
        '.job-listing',
        '.job-item',
        '.career-listing',
        '.position',
        '.opening',
        '[data-job]',
        '.job-card',
      ];

      for (const selector of jobSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) continue;

        elements.forEach((element, index) => {
          const job = extractJobFromElement(element, url, index);
          if (job.title) {
            jobs.push(job);
          }
        });

        if (jobs.length > 0) break; // Found jobs with this selector
      }

      // Helper function to extract job data from a single element
      function extractJobFromElement(element: Element, url: string, index: number): RawJobData {
        const job: RawJobData = {};

        job.title = extractFieldFromElement(element, [
          'h1',
          'h2',
          'h3',
          '.title',
          '.job-title',
          '.position-title',
        ]);
        job.location = extractFieldFromElement(element, [
          '.location',
          '.job-location',
          '.city',
          '[data-location]',
        ]);
        job.department = extractFieldFromElement(element, [
          '.department',
          '.category',
          '.team',
          '[data-department]',
        ]);
        job.description = extractFieldFromElement(element, [
          '.description',
          '.summary',
          '.job-description',
          'p',
        ]);
        job.apply_url = extractApplyUrl(element, url);

        if (job.title) {
          job.id = generateJobId(job.title, index);
        }

        return job;
      }

      // Helper to extract field using multiple selectors
      function extractFieldFromElement(element: Element, selectors: string[]): string {
        for (const selector of selectors) {
          const el = element.querySelector(selector);
          if (el?.textContent?.trim()) {
            return el.textContent.trim();
          }
        }
        return '';
      }

      // Helper to extract apply URL
      function extractApplyUrl(element: Element, url: string): string {
        const linkEl = element.querySelector('a[href]') as HTMLAnchorElement;
        if (linkEl?.href) {
          return linkEl.href.startsWith('http') ? linkEl.href : new URL(linkEl.href, url).href;
        }
        return '';
      }

      // Helper to generate job ID
      function generateJobId(title: string, index: number): string {
        return `scraped-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}-${index}`;
      }

      return jobs;
      /* eslint-enable no-undef */
    }, baseUrl);
  }

  /**
   * Extract jobs from JSON-LD structured data
   *
   * @private
   * @param page - Playwright page instance
   * @returns Promise resolving to array of raw job data
   * @since 2.0.0
   */
  private async extractFromJsonLd(page: Page): Promise<RawJobData[]> {
    return await page.evaluate(() => {
      /* eslint-disable no-undef */
      // ARCHITECTURAL JUSTIFICATION: Browser context execution requires DOM globals (document, window)
      // that are not available in Node.js TypeScript environment. Playwright's page.evaluate()
      // executes this code in the browser context where these globals are standard and safe.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. External DOM library (jsdom): Would require significant refactoring and lose browser
      //    context benefits like actual rendering, JavaScript execution, and CSS application
      // 2. Type declarations for browser globals: Cannot be used as this code runs in dual
      //    contexts (Node.js compilation + browser execution) with conflicting global types
      // 3. Separate browser-only TypeScript files: Would break the cohesive scraping logic
      //    and complicate the build process with multiple compilation targets
      //
      // CONCLUSION: eslint-disable is architecturally necessary for browser context code
      // execution within Playwright's page.evaluate() method.
      const jobs: RawJobData[] = [];
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');

      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');

          // Helper function to convert JSON-LD to RawJobData
          const convertJsonLdToRawJob = (jsonLdData: unknown): RawJobData => {
            const data = jsonLdData as Record<string, unknown>;
            return {
              id: String(data['identifier'] ?? data['id'] ?? ''),
              title: String(data['title'] ?? ''),
              description: String(data['description'] ?? ''),
              location: extractJobLocation(data),
              department: extractJobDepartment(data),
              type: String(data['employmentType'] ?? ''),
              posted_date: String(data['datePosted'] ?? ''),
              apply_url: String(data['url'] ?? data['applicationUrl'] ?? ''),
            };
          };

          // Helper to extract location from JSON-LD
          function extractJobLocation(data: Record<string, unknown>): string {
            const jobLocation = data['jobLocation'] as Record<string, unknown>;
            if (jobLocation?.['address']) {
              const address = jobLocation['address'] as Record<string, unknown>;
              return String(address?.['addressLocality'] ?? '');
            }
            return String(jobLocation ?? '');
          }

          // Helper to extract department from JSON-LD
          function extractJobDepartment(data: Record<string, unknown>): string {
            const hiringOrg = data['hiringOrganization'] as Record<string, unknown>;
            return String(hiringOrg?.['name'] ?? data['department'] ?? '');
          }

          // Handle single JobPosting
          if (data['@type'] === 'JobPosting') {
            jobs.push(convertJsonLdToRawJob(data));
          }

          // Handle array of JobPostings
          if (Array.isArray(data)) {
            data.forEach(item => {
              if (item['@type'] === 'JobPosting') {
                jobs.push(convertJsonLdToRawJob(item));
              }
            });
          }
        } catch {
          // Skip invalid JSON
        }
      });

      return jobs;
      /* eslint-enable no-undef */
    });
  }

  /**
   * Extract jobs from text patterns
   *
   * @private
   * @param page - Playwright page instance
   * @param baseUrl - Base URL for resolving relative links
   * @returns Promise resolving to array of raw job data
   * @since 2.0.0
   */
  private async extractFromTextPatterns(page: Page, _baseUrl: string): Promise<RawJobData[]> {
    return await page.evaluate(() => {
      /* eslint-disable no-undef */
      // ARCHITECTURAL JUSTIFICATION: Browser context execution requires DOM globals (document, window)
      // that are not available in Node.js TypeScript environment. Playwright's page.evaluate()
      // executes this code in the browser context where these globals are standard and safe.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. External DOM library (jsdom): Would require significant refactoring and lose browser
      //    context benefits like actual rendering, JavaScript execution, and CSS application
      // 2. Type declarations for browser globals: Cannot be used as this code runs in dual
      //    contexts (Node.js compilation + browser execution) with conflicting global types
      // 3. Separate browser-only TypeScript files: Would break the cohesive scraping logic
      //    and complicate the build process with multiple compilation targets
      //
      // CONCLUSION: eslint-disable is architecturally necessary for browser context code
      // execution within Playwright's page.evaluate() method.
      const jobs: RawJobData[] = [];
      const text = document.body.textContent || '';

      // Simple pattern matching for job titles
      const jobTitlePatterns = [
        /(?:engineer|developer|manager|analyst|specialist|coordinator|director|lead|senior|junior)\s+[a-z\s]{5,50}/gi,
      ];

      for (const pattern of jobTitlePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach((match, index) => {
            jobs.push({
              id: `pattern-${match.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}-${index}`,
              title: match.trim(),
              description: 'Job details extracted from page content',
            });
          });
        }
      }

      return jobs.slice(0, 20); // Limit to prevent spam
      /* eslint-enable no-undef */
    });
  }

  /**
   * Take debug screenshot for troubleshooting
   *
   * @private
   * @param page - Playwright page instance
   * @param companyId - Company identifier for filename
   * @returns Promise resolving to screenshot file path
   * @since 2.0.0
   */
  private async takeDebugScreenshot(page: Page, companyId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scrape-debug-${companyId}-${timestamp}.png`;
    const path = `./temp/${filename}`;

    await page.screenshot({ path, fullPage: true });
    return path;
  }

  /**
   * Normalize raw job data into consistent format
   *
   * @private
   * @param rawJobs - Array of raw job data from extraction
   * @param source - Source identifier for job tracking
   * @returns Promise resolving to normalized job data
   * @since 2.0.0
   */
  private async normalizeJobs(rawJobs: RawJobData[], source: JobSource): Promise<NormalizedJob[]> {
    const processedAt = DateUtils.getCurrentIsoTimestamp();

    return rawJobs
      .filter(job => job.title && job.title.trim().length > 0)
      .map(rawJob => this.normalizeJobData(rawJob, source, processedAt));
  }

  /**
   * Normalize a single raw job into consistent format
   *
   * @private
   * @param rawJob - Raw job data to normalize
   * @param source - Source identifier for job tracking
   * @param processedAt - Processing timestamp
   * @returns Normalized job data
   * @since 2.0.0
   */
  private normalizeJobData(
    rawJob: RawJobData,
    source: JobSource,
    processedAt: string
  ): NormalizedJob {
    return {
      id: this.normalizeJobId(rawJob),
      title: rawJob.title ?? '',
      description: rawJob.description ?? '',
      location: rawJob.location ?? '',
      department: this.normalizeJobDepartment(rawJob),
      type: this.normalizeJobType(rawJob),
      postedDate: this.normalizeJobPostedDate(rawJob),
      applyUrl: this.normalizeJobApplyUrl(rawJob),
      source,
      rawData: rawJob,
      processedAt,
    };
  }

  /**
   * Normalize job ID
   * @private
   */
  private normalizeJobId(rawJob: RawJobData): string {
    return rawJob.id ?? StringUtils.generateIdFromTitle(rawJob.title ?? 'unknown');
  }

  /**
   * Normalize job department
   * @private
   */
  private normalizeJobDepartment(rawJob: RawJobData): string {
    return rawJob.department ?? rawJob.category ?? '';
  }

  /**
   * Normalize job type
   * @private
   */
  private normalizeJobType(rawJob: RawJobData): string {
    return rawJob.type ?? rawJob.employment_type ?? 'Full-time';
  }

  /**
   * Normalize job posted date
   * @private
   */
  private normalizeJobPostedDate(rawJob: RawJobData): string {
    return rawJob.posted_date
      ? DateUtils.toIsoString(rawJob.posted_date)
      : DateUtils.getCurrentIsoTimestamp();
  }

  /**
   * Normalize job apply URL
   * @private
   */
  private normalizeJobApplyUrl(rawJob: RawJobData): string {
    return rawJob.apply_url ?? rawJob.application_url ?? '';
  }

  /**
   * Close browser and clean up resources
   *
   * @private
   * @returns Promise that resolves when cleanup is complete
   * @since 2.0.0
   */
  private async closeBrowser(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      const logger = getLogger();
      logger.warn(
        'Error closing browser: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Cleanup resources when scraper is no longer needed
   *
   * @returns Promise that resolves when cleanup is complete
   * @since 2.0.0
   */
  public async dispose(): Promise<void> {
    await this.closeBrowser();
  }
}
