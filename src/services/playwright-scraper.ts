/**
 * Playwright-based Web Scraper for DriveHR Job Listings
 *
 * Enterprise-grade browser automation system using Playwright for dynamic job data extraction
 * from DriveHR Single Page Applications. Built specifically for Element UI components with
 * comprehensive fallback strategies, retry mechanisms, and detailed diagnostic logging.
 *
 * This scraper handles complex SPA interactions, JavaScript-heavy content, and provides
 * multiple extraction strategies (Element UI, JSON-LD) with extensive error recovery.
 * Designed for reliability in CI/CD environments and production job synchronization workflows.
 *
 * Key Features:
 * - Element UI collapse component interaction and expansion
 * - JSON-LD structured data extraction for fallback scenarios
 * - Configurable retry logic with exponential backoff
 * - Debug screenshot capture for troubleshooting
 * - Browser resource optimization for faster scraping
 * - Comprehensive job data normalization
 *
 * @example
 * ```typescript
 * import { PlaywrightScraper } from './playwright-scraper.js';
 *
 * const scraper = new PlaywrightScraper({
 *   headless: true,
 *   timeout: 30000,
 *   retries: 3,
 *   debug: false
 * });
 *
 * const result = await scraper.scrapeJobs(apiConfig, 'github-actions');
 * if (result.success) {
 *   console.log(`Scraped ${result.jobs.length} jobs`);
 * }
 *
 * await scraper.dispose();
 * ```
 *
 * @module playwright-scraper
 * @since 1.0.0
 * @see {@link ../lib/job-fetch-utils.js} for URL building utilities
 * @see {@link ../types/job.js} for job data type definitions
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { getLogger } from '../lib/logger.js';
import { DateUtils, StringUtils } from '../lib/utils.js';
import { DriveHrUrlBuilder } from '../lib/job-fetch-utils.js';
import type { DriveHrApiConfig } from '../types/api.js';
import type { RawJobData, NormalizedJob, JobSource } from '../types/job.js';

/**
 * Configuration interface for Playwright browser automation
 *
 * Defines all configurable options for browser behavior, scraping strategy,
 * and debugging capabilities. Provides sensible defaults optimized for
 * DriveHR job scraping while allowing customization for different environments.
 *
 * @since 1.0.0
 */
export interface PlaywrightScraperConfig {
  /**
   * Whether to run browser in headless mode
   *
   * @default true
   * @since 1.0.0
   */
  headless?: boolean;

  /**
   * Timeout in milliseconds for page operations
   *
   * @default 30000
   * @since 1.0.0
   */
  timeout?: number;

  /**
   * CSS selector to wait for indicating page load completion
   *
   * @default '.el-collapse-item'
   * @since 1.0.0
   */
  waitForSelector?: string;

  /**
   * Number of retry attempts for failed scraping operations
   *
   * @default 3
   * @since 1.0.0
   */
  retries?: number;

  /**
   * Enable debug mode with verbose logging and screenshots
   *
   * @default false
   * @since 1.0.0
   */
  debug?: boolean;

  /**
   * Custom user agent string for HTTP requests
   *
   * @default 'DriveHR-Scraper/2.0 (GitHub Actions)'
   * @since 1.0.0
   */
  userAgent?: string;

  /**
   * Additional command line arguments for Chromium browser
   *
   * @default ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
   * @since 1.0.0
   */
  browserArgs?: string[];
}

/**
 * Result interface for Playwright scraping operations
 *
 * Contains the complete results of a job scraping operation including
 * extracted job data, success status, error information, and metadata.
 * Used for comprehensive reporting and debugging of scraping operations.
 *
 * @since 1.0.0
 */
export interface PlaywrightScrapeResult {
  /**
   * Array of successfully extracted and normalized jobs
   *
   * @since 1.0.0
   */
  jobs: NormalizedJob[];

  /**
   * Total number of jobs found during scraping
   *
   * @since 1.0.0
   */
  totalCount: number;

  /**
   * Whether the scraping operation was successful
   *
   * @since 1.0.0
   */
  success: boolean;

  /**
   * Error message if the operation failed
   *
   * @since 1.0.0
   */
  error?: string;

  /**
   * URL that was scraped
   *
   * @since 1.0.0
   */
  url: string;

  /**
   * ISO timestamp when scraping was performed
   *
   * @since 1.0.0
   */
  scrapedAt: string;

  /**
   * Path to debug screenshot if debug mode was enabled
   *
   * @since 1.0.0
   */
  screenshotPath?: string;
}

/**
 * Advanced web scraper using Playwright browser automation
 *
 * High-performance browser automation system designed specifically for DriveHR
 * Single Page Applications with Element UI components. Provides comprehensive
 * job data extraction with multiple fallback strategies, retry mechanisms,
 * and extensive error handling.
 *
 * The scraper handles complex JavaScript interactions, dynamic content loading,
 * and provides detailed diagnostic information for troubleshooting extraction
 * issues in production environments.
 *
 * @example
 * ```typescript
 * const scraper = new PlaywrightScraper({
 *   headless: true,
 *   timeout: 30000,
 *   retries: 3,
 *   debug: process.env.NODE_ENV !== 'production'
 * });
 *
 * try {
 *   const result = await scraper.scrapeJobs(config, 'github-actions');
 *
 *   if (result.success) {
 *     console.log(`Successfully scraped ${result.jobs.length} jobs`);
 *     return result.jobs;
 *   } else {
 *     console.error(`Scraping failed: ${result.error}`);
 *   }
 * } finally {
 *   await scraper.dispose();
 * }
 * ```
 *
 * @since 1.0.0
 * @see {@link PlaywrightScraperConfig} for configuration options
 * @see {@link PlaywrightScrapeResult} for result structure
 */
export class PlaywrightScraper {
  private readonly config: Required<PlaywrightScraperConfig>;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  /**
   * Creates a new Playwright scraper instance
   *
   * Initializes the scraper with configuration options and sets up
   * browser arguments optimized for job scraping performance and
   * reliability in CI/CD environments.
   *
   * @param config - Configuration options for browser automation
   * @example
   * ```typescript
   * const scraper = new PlaywrightScraper({
   *   headless: false,  // For debugging
   *   debug: true,      // Enable screenshots
   *   timeout: 45000,   // Longer timeout for slow networks
   *   retries: 5        // More retries for unstable environments
   * });
   * ```
   * @since 1.0.0
   */
  constructor(config: PlaywrightScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      waitForSelector: config.waitForSelector ?? '.el-collapse-item',
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
   * Main job scraping method using browser automation
   *
   * Performs comprehensive job data extraction from DriveHR career pages
   * using Playwright browser automation. Implements retry logic, multiple
   * extraction strategies, and extensive error handling for production reliability.
   *
   * The method handles SPA loading, Element UI interactions, and provides
   * detailed diagnostic information for troubleshooting extraction issues.
   *
   * @param apiConfig - DriveHR API configuration including company ID
   * @param source - Source identifier for tracking and analytics
   * @returns Promise resolving to scraping results with jobs and metadata
   * @throws {Error} When browser initialization fails repeatedly
   * @example
   * ```typescript
   * const config = {
   *   companyId: 'example-company',
   *   baseUrl: 'https://careers.example.com'
   * };
   *
   * const result = await scraper.scrapeJobs(config, 'manual');
   *
   * if (result.success) {
   *   console.log(`Found ${result.jobs.length} jobs:`);
   *   result.jobs.forEach(job => {
   *     console.log(`- ${job.title} in ${job.department}`);
   *   });
   * } else {
   *   console.error(`Scraping failed: ${result.error}`);
   * }
   * ```
   * @since 1.0.0
   * @see {@link PlaywrightScrapeResult} for result structure details
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
   * Initializes Playwright browser and context
   *
   * Sets up Chromium browser with optimized settings for job scraping,
   * including custom headers, viewport settings, and TSX compatibility.
   * Only initializes once per scraper instance for performance optimization.
   *
   * @throws {Error} When browser launch fails
   * @example
   * ```typescript
   * // Called automatically by scrapeJobs, but can be called manually:
   * await scraper.initializeBrowser();
   * ```
   * @since 1.0.0
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

    // Add __name helper to fix TSX browser evaluation errors
    // TSX >=4.15.0 injects __name calls for functions, but this helper doesn't exist in browser context
    await this.context.addInitScript(() => {
      /* eslint-disable no-undef */
      if (typeof window !== 'undefined') {
        (
          window as unknown as Window & { __name: (func: Function, _name: string) => Function }
        ).__name = (func: Function, _name: string): Function => {
          return func;
        };
      }
      /* eslint-enable no-undef */
    });
  }

  /**
   * Configures page settings for optimal scraping performance
   *
   * Sets up timeouts, resource blocking, and debug logging for the page.
   * Blocks unnecessary resources (images, fonts, media) to improve loading
   * speed while preserving stylesheets needed for Element UI rendering.
   *
   * @param page - Playwright page instance to configure
   * @throws {Error} When page setup fails
   * @example
   * ```typescript
   * const page = await context.newPage();
   * await scraper.setupPage(page);
   * ```
   * @since 1.0.0
   */
  private async setupPage(page: Page): Promise<void> {
    // Set timeouts
    page.setDefaultTimeout(this.config.timeout);
    page.setDefaultNavigationTimeout(this.config.timeout);

    // Block unnecessary resources to speed up loading (but keep stylesheets for Element UI)
    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
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
   * Waits for job listings to load using multiple strategies
   *
   * Implements a multi-strategy approach to detect when job content is ready:
   * 1. Wait for Element UI collapse components
   * 2. Fallback to network idle state
   * 3. Additional timeout for SPA rendering
   * 4. Check for "no jobs" indicators
   *
   * @param page - Playwright page instance to monitor
   * @throws {Error} When page becomes unresponsive
   * @example
   * ```typescript
   * await page.goto(url);
   * await scraper.waitForJobListings(page);
   * // Jobs are now ready for extraction
   * ```
   * @since 1.0.0
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
   * Orchestrates job data extraction using multiple strategies
   *
   * Implements a hierarchical extraction approach with fallback mechanisms:
   * 1. Primary: Extract from Element UI structured components
   * 2. Fallback: Extract from JSON-LD structured data
   *
   * Returns the first successful extraction method results.
   *
   * @param page - Playwright page instance containing job data
   * @param baseUrl - Base URL for resolving relative links
   * @returns Promise resolving to array of raw job data objects
   * @example
   * ```typescript
   * const jobs = await scraper.extractJobData(page, 'https://careers.example.com');
   * console.log(`Extracted ${jobs.length} jobs`);
   * ```
   * @since 1.0.0
   * @see {@link extractFromStructuredElements} for Element UI extraction
   * @see {@link extractFromJsonLd} for JSON-LD extraction
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

    logger.warn('No job data could be extracted from page');
    return [];
  }

  /**
   * Extracts job data from structured HTML elements
   *
   * Delegates to Element UI specific extraction logic since DriveHR
   * uses Element UI exclusively. This method provides a clear separation
   * between different extraction strategies.
   *
   * @param page - Playwright page instance
   * @param baseUrl - Base URL for link resolution
   * @returns Promise resolving to extracted job data array
   * @since 1.0.0
   * @see {@link extractFromElementUICollapse} for implementation details
   */
  private async extractFromStructuredElements(page: Page, baseUrl: string): Promise<RawJobData[]> {
    // DriveHR uses Element UI exclusively - no fallback needed
    const logger = getLogger();
    logger.debug('DriveHR extraction: Using Element UI collapse extraction');
    return this.extractFromElementUICollapse(page, baseUrl);
  }

  /**
   * Extracts job data from Element UI collapse components
   *
   * Comprehensive extraction system specifically designed for DriveHR's Element UI
   * implementation. Uses an expand-all-first approach to ensure all job content
   * is available for extraction.
   *
   * Process:
   * 1. Wait for SPA content loading
   * 2. Diagnostic analysis of page state
   * 3. Expand all collapse components
   * 4. Extract job data from expanded content
   * 5. Validate and process results
   *
   * @param page - Playwright page instance
   * @param baseUrl - Base URL for resolving relative links
   * @returns Promise resolving to array of extracted job data
   * @throws {Error} When critical page elements are missing
   * @example
   * ```typescript
   * const jobs = await scraper.extractFromElementUICollapse(page, baseUrl);
   * jobs.forEach(job => {
   *   console.log(`${job.title} - ${job.department} (${job.location})`);
   * });
   * ```
   * @since 1.0.0
   */
  private async extractFromElementUICollapse(page: Page, baseUrl: string): Promise<RawJobData[]> {
    const logger = getLogger();
    logger.info('🔍 Starting Element UI collapse extraction (expand-all-first approach)');
    logger.info(`📄 Page URL: ${page.url()}`);
    logger.info(`🔗 Base URL: ${baseUrl}`);

    // Wait for SPA content to fully load
    logger.info('⏳ Waiting 3000ms for SPA content to load...');
    await page.waitForTimeout(3000);
    logger.info('✅ SPA content wait completed');

    // Step 1: Diagnostic check - what does the page actually contain?
    const pageState = await page.evaluate(() => {
      /* eslint-disable no-undef */
      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        collapseItems: document.querySelectorAll('.el-collapse-item').length,
        collapseButtons: document.querySelectorAll('button.el-collapse-item__header').length,
        titleLinks: document.querySelectorAll('a.list-title-link').length,
        bodyTextLength: document.body.textContent?.length ?? 0,
        hasElementUI: document.querySelectorAll('[class*="el-"]').length > 0,
        firstJobText:
          document
            .querySelector('button.el-collapse-item__header')
            ?.textContent?.substring(0, 100) ?? 'No job found',
      };
      /* eslint-enable no-undef */
    });

    logger.info('🔍 Page State Analysis:');
    logger.info(`  URL: ${pageState.url}`);
    logger.info(`  Title: ${pageState.title}`);
    logger.info(`  Ready State: ${pageState.readyState}`);
    logger.info(`  .el-collapse-item elements: ${pageState.collapseItems}`);
    logger.info(`  button.el-collapse-item__header elements: ${pageState.collapseButtons}`);
    logger.info(`  a.list-title-link elements: ${pageState.titleLinks}`);
    logger.info(`  Body text length: ${pageState.bodyTextLength}`);
    logger.info(`  Has Element UI: ${pageState.hasElementUI}`);
    logger.info(`  First job text: "${pageState.firstJobText}"`);

    if (pageState.collapseButtons === 0) {
      logger.error('❌ CRITICAL: No Element UI job buttons found on page');
      logger.error('❌ This indicates page loading or timing issue');
      return [];
    }

    // Step 2: Expand all Element UI jobs by clicking buttons
    logger.info('🖱️ Expanding all Element UI job buttons...');
    const expandResult = await page.evaluate(() => {
      /* eslint-disable no-undef */
      const jobButtons = document.querySelectorAll('button.el-collapse-item__header');
      let clickedCount = 0;

      Array.from(jobButtons).forEach((button, index) => {
        try {
          (button as HTMLButtonElement).click();
          clickedCount++;
        } catch (e) {
          // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Browser context debugging requires console statements for troubleshooting Element UI interactions. This runs in Playwright's page.evaluate() where console is the only debugging mechanism available, and the output is captured by Playwright for diagnostic purposes.
          console.error(
            `Failed to click button ${index}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      });

      return { totalButtons: jobButtons.length, clickedCount };
      /* eslint-enable no-undef */
    });

    logger.info(
      `🖱️ Clicked ${expandResult.clickedCount} of ${expandResult.totalButtons} job buttons`
    );

    // Wait for all expansions to complete (critical for Element UI animations)
    logger.info('⏳ Waiting 3000ms for expansion animations to complete...');
    await page.waitForTimeout(3000);
    logger.info('✅ Job expansion completed');

    // Step 3: Extract job data from expanded content (proven working approach)
    logger.info('🔍 Starting job data extraction...');
    const extractionResult = await page.evaluate(() => {
      /* eslint-disable no-undef */
      const jobs: RawJobData[] = [];

      // Step 1: Find all job buttons (Element UI collapse headers)
      const jobButtons = document.querySelectorAll('button.el-collapse-item__header');
      // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Browser context debugging in Playwright's page.evaluate() requires console statements for diagnostic logging. This provides essential debugging information for Element UI component discovery and is captured by Playwright's debugging infrastructure.
      console.log(`Found ${jobButtons.length} job buttons for extraction`);

      if (jobButtons.length === 0) {
        return [];
      }

      // Step 2: Extract job button information
      const buttonData: Array<{
        index: number;
        buttonId: string;
        title: string;
        fullButtonText: string;
      }> = [];

      Array.from(jobButtons).forEach((button, index) => {
        const text = button.textContent || '';
        // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Browser context debugging in Playwright's page.evaluate() for job extraction diagnostics. Console logging is the only available debugging mechanism in browser context for tracking job processing iterations.
        console.log(`Processing button ${index}: ${text.substring(0, 50)}...`);

        // Extract title from button text - use the link text or first meaningful part
        let title = '';
        const titleLink = button.querySelector('a.list-title-link');
        if (titleLink) {
          title = titleLink.textContent?.trim() || '';
        }

        // Fallback: extract from button text if no link found
        if (!title) {
          const match = text.match(/^([^,]+)/); // Take everything before first comma
          if (match?.[1]) {
            title = match[1].trim();
          }
        }

        if (title) {
          buttonData.push({
            index,
            buttonId: (button as HTMLButtonElement).id,
            title,
            fullButtonText: text.trim(),
          });
          // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Browser context debugging in Playwright's page.evaluate() for tracking successful job data extraction. Console logging provides essential feedback for job discovery validation in browser context.
          console.log(`Added job: ${title}`);
        }
      });

      // Step 3: Extract from each specific .el-collapse-item__content (now expanded)
      const allCollapseContents = document.querySelectorAll('.el-collapse-item__content');
      // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Browser context debugging in Playwright's page.evaluate() for Element UI component expansion validation. Console logging provides critical diagnostic information for verifying collapse animations completed successfully.
      console.log(`Found ${allCollapseContents.length} expanded content areas`);

      // Helper functions for job data extraction (broken down for complexity reduction)
      function validateJobContent(
        buttonIndex: number,
        allCollapseContents: NodeListOf<Element>
      ): Element | null {
        if (buttonIndex >= allCollapseContents.length) {
          return null;
        }
        const specificContent = allCollapseContents[buttonIndex];
        if (!specificContent) {
          return null;
        }
        const elementText = specificContent.textContent ?? '';
        if (elementText.length < 10) {
          return null;
        }
        return specificContent;
      }

      function extractJobMetadata(elementText: string): {
        location: string;
        posted_date: string;
        type: string;
        payType: string;
      } {
        const locationMatch = elementText.match(/([A-Za-z\s]+,\s*[A-Z]{2})/);
        const dateMatch = elementText.match(/\d{2}\/\d{2}\/\d{4}/);
        const workTypeMatch = elementText.match(/Full-Time|Part-Time|Contract/i);
        const payTypeMatch = elementText.match(/Hourly|Salary|Salary yearly/i);

        return {
          location: locationMatch?.[1]?.trim() ?? 'Truro, NS',
          posted_date: dateMatch?.[0] ?? '',
          type: workTypeMatch?.[0] ?? 'Full-Time',
          payType: payTypeMatch?.[0] ?? '',
        };
      }

      function extractDepartment(fullButtonText: string): string {
        const deptMatch = fullButtonText.match(/Pye Chevrolet|[A-Za-z\s]+(?=\s*\||\s*,|\s*-)/);
        return deptMatch?.[0]?.trim() ?? '';
      }

      function extractApplyUrl(specificContent: Element): string {
        try {
          const linkEl = specificContent.querySelector('a[href]') as HTMLAnchorElement;
          return linkEl?.href ?? '';
        } catch {
          return '';
        }
      }

      function createJobDescription(buttonText: string, contentText: string): string {
        const cleanButtonText = buttonText.replace(/\s+/g, ' ').trim();
        const cleanContentText = contentText.replace(/\s+/g, ' ').trim();

        if (cleanButtonText && cleanContentText) {
          return cleanContentText.toLowerCase().includes(cleanButtonText.toLowerCase())
            ? cleanContentText
            : `${cleanButtonText}. ${cleanContentText}`;
        }
        return cleanButtonText || cleanContentText || '';
      }

      function generateJobId(title: string, buttonIndex: number): string {
        const normalizedTitle = title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 30);
        const timestamp = Date.now();
        const fullId = `scraped-${normalizedTitle}-${buttonIndex}-${timestamp}`;
        return fullId.length > 70 ? fullId.substring(0, 67) + '...' : fullId;
      }

      function processButtonDataItem(
        buttonInfo: (typeof buttonData)[0],
        buttonIndex: number,
        allCollapseContents: NodeListOf<Element>
      ): RawJobData | null {
        try {
          const specificContent = validateJobContent(buttonIndex, allCollapseContents);
          if (!specificContent) {
            return null;
          }

          const elementText = specificContent.textContent ?? '';
          const metadata = extractJobMetadata(elementText);
          const department = extractDepartment(buttonInfo.fullButtonText);
          const apply_url = extractApplyUrl(specificContent);
          const description = createJobDescription(buttonInfo.fullButtonText, elementText);
          const jobId = generateJobId(buttonInfo.title, buttonIndex);

          return {
            id: jobId,
            title: buttonInfo.title,
            location: metadata.location,
            department,
            description,
            type: metadata.type,
            posted_date: metadata.posted_date,
            apply_url,
            payType: metadata.payType,
          };
        } catch {
          return null;
        }
      }

      buttonData.forEach((buttonInfo, buttonIndex) => {
        const job = processButtonDataItem(buttonInfo, buttonIndex, allCollapseContents);
        if (job) {
          jobs.push(job);
          // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Browser context debugging in Playwright's page.evaluate() for job creation validation. Console logging provides essential feedback for successful job object construction with extracted data.
          console.log(
            `Created job: ${job.title} (${job.description?.length ?? 0} chars description)`
          );
        }
      });

      // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Browser context debugging in Playwright's page.evaluate() for final extraction summary. Console logging provides critical validation of total job extraction results for debugging and monitoring purposes.
      console.log(`Total jobs extracted: ${jobs.length}`);
      return jobs;
      /* eslint-enable no-undef */
    });

    logger.info(`📊 Extraction completed: ${extractionResult.length} jobs found`);
    if (extractionResult.length === 0) {
      logger.error('❌ CRITICAL: Zero jobs extracted despite finding Element UI components');
      logger.error('❌ This indicates an issue with the extraction logic');
    } else {
      logger.info('✅ SUCCESS: Jobs successfully extracted');
      extractionResult.forEach((job, index) => {
        logger.info(`  Job ${index + 1}: ${job.title} (${job.department})`);
      });
    }

    return extractionResult;
  }

  /**
   * Extracts job data from JSON-LD structured data
   *
   * Fallback extraction method that searches for JSON-LD script tags
   * containing JobPosting schema data. Handles both single job postings
   * and arrays of job postings with comprehensive error handling.
   *
   * @param page - Playwright page instance to search
   * @returns Promise resolving to array of jobs from JSON-LD data
   * @example
   * ```typescript
   * const jsonLdJobs = await scraper.extractFromJsonLd(page);
   * if (jsonLdJobs.length > 0) {
   *   console.log(`Found ${jsonLdJobs.length} jobs in JSON-LD`);
   * }
   * ```
   * @since 1.0.0
   * @see {@link https://schema.org/JobPosting} for JSON-LD JobPosting schema
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
   * Captures debug screenshot for troubleshooting
   *
   * Creates a full-page screenshot with timestamp and company identifier
   * for debugging scraping issues. Screenshots are saved to temp directory
   * with standardized naming convention.
   *
   * @param page - Playwright page instance to capture
   * @param companyId - Company identifier for file naming
   * @returns Promise resolving to screenshot file path
   * @throws {Error} When screenshot capture fails
   * @example
   * ```typescript
   * if (config.debug) {
   *   const path = await scraper.takeDebugScreenshot(page, 'company-123');
   *   console.log(`Debug screenshot saved: ${path}`);
   * }
   * ```
   * @since 1.0.0
   */
  private async takeDebugScreenshot(page: Page, companyId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scrape-debug-${companyId}-${timestamp}.png`;
    const path = `./temp/${filename}`;

    await page.screenshot({ path, fullPage: true });
    return path;
  }

  /**
   * Normalizes raw job data into consistent format
   *
   * Processes array of raw job data objects, filters out invalid entries,
   * and converts them to normalized job format with consistent field names
   * and data types. Adds processing metadata and source tracking.
   *
   * @param rawJobs - Array of raw job data from extraction
   * @param source - Source identifier for tracking purposes
   * @returns Promise resolving to array of normalized jobs
   * @example
   * ```typescript
   * const rawJobs = await extractJobData(page, baseUrl);
   * const normalizedJobs = await scraper.normalizeJobs(rawJobs, 'github-actions');
   * ```
   * @since 1.0.0
   * @see {@link normalizeJobData} for individual job normalization
   */
  private async normalizeJobs(rawJobs: RawJobData[], source: JobSource): Promise<NormalizedJob[]> {
    const processedAt = DateUtils.getCurrentIsoTimestamp();

    return rawJobs
      .filter(job => job.title && job.title.trim().length > 0)
      .map(rawJob => this.normalizeJobData(rawJob, source, processedAt));
  }

  /**
   * Normalizes a single job data object
   *
   * Converts raw job data into standardized NormalizedJob format with
   * consistent field mapping, data validation, and metadata addition.
   * Handles missing fields with appropriate defaults.
   *
   * @param rawJob - Raw job data object to normalize
   * @param source - Source identifier for tracking
   * @param processedAt - Processing timestamp
   * @returns Normalized job object with consistent structure
   * @since 1.0.0
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
   * Normalizes job ID with fallback generation
   *
   * Uses existing job ID or generates one from job title if missing.
   * Ensures every job has a unique identifier.
   *
   * @param rawJob - Raw job data containing potential ID
   * @returns Normalized job ID string
   * @since 1.0.0
   */
  private normalizeJobId(rawJob: RawJobData): string {
    return rawJob.id ?? StringUtils.generateIdFromTitle(rawJob.title ?? 'unknown');
  }

  /**
   * Normalizes job department with field fallbacks
   *
   * Tries multiple field names to find department information,
   * handling variations in data source field naming.
   *
   * @param rawJob - Raw job data with potential department fields
   * @returns Normalized department string
   * @since 1.0.0
   */
  private normalizeJobDepartment(rawJob: RawJobData): string {
    return rawJob.department ?? rawJob.category ?? '';
  }

  /**
   * Normalizes employment type with sensible default
   *
   * Extracts employment type from various field names with
   * fallback to 'Full-time' when not specified.
   *
   * @param rawJob - Raw job data with potential type fields
   * @returns Normalized employment type string
   * @since 1.0.0
   */
  private normalizeJobType(rawJob: RawJobData): string {
    return rawJob.type ?? rawJob.employment_type ?? 'Full-time';
  }

  /**
   * Normalizes job posted date to ISO format
   *
   * Converts posted date to ISO string format or uses current
   * timestamp if no date is provided. Ensures consistent date formatting.
   *
   * @param rawJob - Raw job data with potential date field
   * @returns ISO formatted date string
   * @since 1.0.0
   */
  private normalizeJobPostedDate(rawJob: RawJobData): string {
    return rawJob.posted_date
      ? DateUtils.toIsoString(rawJob.posted_date)
      : DateUtils.getCurrentIsoTimestamp();
  }

  /**
   * Normalizes application URL with field fallbacks
   *
   * Tries multiple field names to find application URL,
   * handling variations in data source field naming.
   *
   * @param rawJob - Raw job data with potential URL fields
   * @returns Normalized application URL string
   * @since 1.0.0
   */
  private normalizeJobApplyUrl(rawJob: RawJobData): string {
    return rawJob.apply_url ?? rawJob.application_url ?? '';
  }

  /**
   * Safely closes browser context and browser instance
   *
   * Performs cleanup of Playwright resources with error handling.
   * Ensures proper resource disposal even when errors occur during cleanup.
   *
   * @throws {Error} Logs but doesn't throw when cleanup fails
   * @since 1.0.0
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
   * Disposes of scraper resources
   *
   * Public cleanup method that ensures proper disposal of browser resources.
   * Should be called when scraper is no longer needed to prevent memory leaks.
   *
   * @example
   * ```typescript
   * const scraper = new PlaywrightScraper();
   * try {
   *   await scraper.scrapeJobs(config);
   * } finally {
   *   await scraper.dispose();
   * }
   * ```
   * @since 1.0.0
   */
  public async dispose(): Promise<void> {
    await this.closeBrowser();
  }
}
