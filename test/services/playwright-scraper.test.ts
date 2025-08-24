/**
 * Playwright Scraper Test Suite
 *
 * Comprehensive test coverage for the Playwright-based web scraper service following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates browser automation, job extraction, and error handling.
 *
 * Test Features:
 * - Browser initialization and configuration testing
 * - Job extraction from multiple strategies (Element UI, JSON-LD, text patterns)
 * - Error handling and resilience testing
 * - Resource management and cleanup testing
 * - Mock management with proper sequential call handling
 *
 * @example
 * ```typescript
 * // Run specific test group
 * pnpm test test/services/playwright-scraper.test.ts -- --grep "extraction"
 * ```
 *
 * @module playwright-scraper-test-suite
 * @since 1.0.0
 * @see {@link ../../src/services/playwright-scraper.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlaywrightScraper } from '../../src/services/playwright-scraper.js';
import type { Browser, Page, BrowserContext } from 'playwright';

// Mock playwright module
vi.mock('playwright', async () => {
  const mockPage = {
    goto: vi.fn(),
    url: vi.fn().mockReturnValue('https://example.com/careers'),
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
    route: vi.fn(),
    on: vi.fn(),
    waitForSelector: vi.fn(),
    waitForLoadState: vi.fn(),
    waitForTimeout: vi.fn(),
    locator: vi.fn(),
    evaluate: vi.fn(),
    screenshot: vi.fn(),
    close: vi.fn(),
  };

  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    addInitScript: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn(),
  };

  const mockChromium = {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  };

  return {
    chromium: mockChromium,
  };
});

// Mock logger
vi.mock('../../src/lib/logger.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock job fetch utils
vi.mock('../../src/lib/job-fetch-utils.js', () => ({
  DriveHrUrlBuilder: {
    buildCareersPageUrl: vi.fn().mockReturnValue('https://example.com/careers'),
  },
}));

// Mock utils
vi.mock('../../src/lib/utils.js', () => ({
  DateUtils: {
    toIsoString: vi.fn().mockReturnValue('2024-01-01T00:00:00.000Z'),
    getCurrentIsoTimestamp: vi.fn().mockReturnValue('2024-01-01T00:00:00.000Z'),
  },
}));

/**
 * Playwright scraper test utilities
 *
 * Extends testing capabilities with Playwright-specific mock management
 * and test data factories. Maintains DRY principles while providing
 * specialized testing methods for browser automation scenarios.
 *
 * @since 1.0.0
 */
class PlaywrightScraperTestUtils {
  /**
   * Sample configuration for testing
   *
   * Standard test configuration used across multiple test cases
   * to ensure consistency and avoid duplication.
   *
   * @since 1.0.0
   */
  static readonly SAMPLE_CONFIG = {
    companyId: 'test-company',
    careersUrl: 'https://example.com/careers',
    apiBaseUrl: 'https://example.com/api',
  };

  /**
   * Sample raw job data for testing
   *
   * Realistic job data structure used in mock responses to ensure
   * tests validate actual expected data formats.
   *
   * @since 1.0.0
   */
  static readonly SAMPLE_RAW_JOBS = [
    {
      id: 'job-1',
      title: 'Senior Software Engineer',
      description: 'Build amazing software products',
      location: 'San Francisco, CA',
      department: 'Engineering',
      type: 'Full-time',
      posted_date: '2024-01-15',
      apply_url: 'https://example.com/apply/1',
    },
    {
      id: 'job-2',
      title: 'Product Manager',
      description: 'Lead product development initiatives',
      location: 'Remote',
      department: 'Product',
      type: 'Full-time',
      posted_date: '2024-01-20',
      apply_url: 'https://example.com/apply/2',
    },
  ];

  /**
   * Set up all required mocks for Playwright scraper testing
   *
   * Creates and configures all necessary mock objects including browser,
   * context, page, and logger mocks. Returns organized mock references
   * for use in individual tests.
   *
   * @returns Object containing all mock references
   * @example
   * ```typescript
   * const mocks = await PlaywrightScraperTestUtils.setupMocks();
   * // Use mocks.mockPage.evaluate.mockResolvedValue(testData);
   * ```
   * @since 1.0.0
   */
  static async setupMocks() {
    const { chromium } = await import('playwright');
    const mockChromium = vi.mocked(chromium);
    const mockBrowser = vi.mocked(await mockChromium.launch()) as unknown as Browser;
    const mockContext = vi.mocked(await mockBrowser.newContext()) as unknown as BrowserContext;
    const mockPage = vi.mocked(await mockContext.newPage()) as unknown as Page;

    // Import and mock logger
    const { getLogger } = await import('../../src/lib/logger.js');
    const mockGetLogger = vi.mocked(getLogger);
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
    };
    mockGetLogger.mockReturnValue(mockLogger);

    return {
      mockChromium,
      mockBrowser,
      mockBrowserContext: mockContext,
      mockContext,
      mockPage,
      mockLogger,
    };
  }

  /**
   * Configure standard successful mock responses for page.evaluate calls
   *
   * Sets up the 4 standard sequential page.evaluate calls that the PlaywrightScraper
   * makes during normal operation. This prevents mock setup duplication across tests
   * and ensures consistent mock behavior.
   *
   * @param mockPage - The mocked Playwright page object
   * @example
   * ```typescript
   * PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
   * const result = await scraper.scrapeJobs(config, 'manual');
   * ```
   * @since 1.0.0
   */
  static setupStandardSuccessfulMocks(mockPage: Page) {
    // Setup successful page navigation and waiting
    vi.mocked(mockPage.waitForSelector).mockResolvedValue(null);
    vi.mocked(mockPage.waitForLoadState).mockResolvedValue();
    vi.mocked(mockPage.waitForTimeout).mockResolvedValue();
    vi.mocked(mockPage.close).mockResolvedValue();

    // Mock locator for no jobs indicator check
    const mockLocator = {
      first: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(false),
      }),
    } as unknown as import('playwright').Locator;
    vi.mocked(mockPage.locator).mockReturnValue(mockLocator);

    // Setup the 4 standard calls that most successful tests need:
    // Call 1: Page diagnostic (first call in extractFromElementUICollapse)
    // Call 2: Button expansion (returns expand result)
    // Call 3: Job extraction (returns sample jobs)
    // Call 4: JSON-LD fallback (returns empty or jobs)
    vi.mocked(mockPage.evaluate)
      .mockResolvedValueOnce({
        url: 'https://example.com/careers',
        title: 'Test Careers Page',
        readyState: 'complete',
        collapseItems: 2,
        collapseButtons: 2,
        titleLinks: 0,
        bodyTextLength: 1000,
        hasElementUI: true,
        firstJobText: 'Senior Engineer',
      })
      .mockResolvedValueOnce({ totalButtons: 5, clickedCount: 5 })
      .mockResolvedValue(this.SAMPLE_RAW_JOBS);
  }
}

describe('PlaywrightScraper', () => {
  let mocks: Awaited<ReturnType<typeof PlaywrightScraperTestUtils.setupMocks>>;

  beforeEach(async () => {
    mocks = await PlaywrightScraperTestUtils.setupMocks();
    // NOTE: No default mock setup - each test must configure its own mocks
    // Use PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage) if needed
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should create instance with default options', () => {
      const scraper = new PlaywrightScraper();
      expect(scraper).toBeInstanceOf(PlaywrightScraper);
    });

    it('should create instance with custom options', () => {
      const options = {
        headless: false,
        timeout: 60000,
        retries: 2,
        debug: true,
      };

      const scraper = new PlaywrightScraper(options);
      expect(scraper).toBeInstanceOf(PlaywrightScraper);
    });
  });

  describe('successful job scraping', () => {
    it('should scrape jobs successfully with Element UI collapse strategy', async () => {
      const scraper = new PlaywrightScraper();

      // Configure standard successful mocks
      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);

      const result = await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      // Debug output to see what's failing
      if (!result.success) {
        // eslint-disable-next-line no-console
        console.log('Test failure details:', {
          success: result.success,
          error: result.error,
          jobCount: result.jobs.length,
        });
      }

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0]?.title).toBe('Senior Software Engineer');
      expect(result.jobs[1]?.title).toBe('Product Manager');
      expect(result.totalCount).toBe(2);
    });

    it('should handle successful scraping with proper browser initialization', async () => {
      const scraper = new PlaywrightScraper({ headless: true });

      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);

      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      const { chromium } = await import('playwright');
      expect(vi.mocked(chromium.launch)).toHaveBeenCalledWith(
        expect.objectContaining({ headless: true })
      );
      expect(mocks.mockBrowser.newContext).toHaveBeenCalled();
      expect(mocks.mockBrowserContext.newPage).toHaveBeenCalled();
    });
  });

  describe('configuration and browser setup', () => {
    it('should launch browser with headless mode when configured', async () => {
      const scraper = new PlaywrightScraper({ headless: true });

      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      const { chromium } = await import('playwright');
      expect(vi.mocked(chromium.launch)).toHaveBeenCalledWith(
        expect.objectContaining({ headless: true })
      );
    });

    it('should launch browser with visible mode when headless is false', async () => {
      const scraper = new PlaywrightScraper({ headless: false });

      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      const { chromium } = await import('playwright');
      expect(vi.mocked(chromium.launch)).toHaveBeenCalledWith(
        expect.objectContaining({ headless: false })
      );
    });

    it('should configure viewport and browser context options', async () => {
      const scraper = new PlaywrightScraper();

      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(mocks.mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          ignoreHTTPSErrors: true,
          viewport: expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        })
      );
    });

    it('should set default timeouts on page', async () => {
      const customTimeout = 25000;
      const scraper = new PlaywrightScraper({ timeout: customTimeout });

      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(mocks.mockPage.setDefaultTimeout).toHaveBeenCalledWith(customTimeout);
      expect(mocks.mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(customTimeout);
    });

    it('should block unnecessary resources for performance', async () => {
      const scraper = new PlaywrightScraper();

      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(mocks.mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    });
  });

  describe('resource blocking optimization', () => {
    it('should abort blocked resource types for performance', async () => {
      // Reset default mocks and configure custom behavior
      vi.mocked(mocks.mockPage.route).mockReset();

      const scraper = new PlaywrightScraper();

      // Mock route handler to capture the callback
      let routeHandler: (route: {
        request: () => { resourceType: () => string };
        abort: () => void;
        continue: () => void;
      }) => void = () => {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ARCHITECTURAL JUSTIFICATION: Playwright route mock requires complex type matching that conflicts with vi.mocked typing. This mock is only used for testing resource blocking behavior and doesn't affect production code safety.
      (vi.mocked(mocks.mockPage.route) as any).mockImplementation(
        (pattern: string, handler: typeof routeHandler) => {
          routeHandler = handler;
          return Promise.resolve();
        }
      );

      // Add standard mocks for page.evaluate calls
      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);

      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      // Test resource blocking for blocked types (stylesheet is NOT blocked per implementation)
      const blockedResourceTypes = ['image', 'font', 'media'];

      for (const resourceType of blockedResourceTypes) {
        const mockRoute = {
          request: () => ({ resourceType: () => resourceType }),
          abort: vi.fn(),
          continue: vi.fn(),
        };

        if (routeHandler) {
          routeHandler(mockRoute);
        }
        expect(mockRoute.abort).toHaveBeenCalled();
        expect(mockRoute.continue).not.toHaveBeenCalled();
      }

      // Test allowing other resource types (including stylesheet per implementation)
      const allowedResourceTypes = ['document', 'script', 'xhr', 'stylesheet'];

      for (const resourceType of allowedResourceTypes) {
        const mockRoute = {
          request: () => ({ resourceType: () => resourceType }),
          abort: vi.fn(),
          continue: vi.fn(),
        };

        if (routeHandler) {
          routeHandler(mockRoute);
        }
        expect(mockRoute.abort).not.toHaveBeenCalled();
        expect(mockRoute.continue).toHaveBeenCalled();
      }
    });
  });

  describe('fallback extraction strategies', () => {
    it('should extract jobs from JSON-LD when Element UI extraction fails', async () => {
      const scraper = new PlaywrightScraper();

      // Set up mocks for the 4 sequential page.evaluate calls
      // Call 1: Page diagnostic
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce({
        url: 'https://example.com/careers',
        title: 'Test Careers Page',
        readyState: 'complete',
        collapseItems: 2,
        collapseButtons: 2,
        titleLinks: 0,
        bodyTextLength: 1000,
        hasElementUI: true,
        firstJobText: 'Senior Engineer',
      });
      // Call 2: Button expansion (returns expansion result)
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce({
        totalButtons: 5,
        clickedCount: 5,
      });
      // Call 3: Element UI extraction (returns empty - should trigger JSON-LD fallback)
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce([]);
      // Call 4: JSON-LD extraction (returns sample jobs)
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce([
        {
          id: 'jsonld-job-1',
          title: 'Software Engineer',
          description: 'Build amazing software',
          location: 'Remote',
          department: 'Engineering Department',
          type: 'Full-time',
          posted_date: '2024-01-15',
          apply_url: 'https://example.com/apply/1',
        },
        {
          id: 'jsonld-job-2',
          title: 'Product Manager',
          description: 'Lead product development',
          location: 'San Francisco',
          department: 'Product Team',
          type: 'Full-time',
          posted_date: '2024-01-20',
          apply_url: 'https://example.com/apply/2',
        },
      ]);

      const result = await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(result.success).toBe(true);
      expect(result.jobs.length).toBe(2);

      const firstJob = result.jobs[0];
      expect(firstJob?.title).toBe('Software Engineer');
      expect(firstJob?.id).toBe('jsonld-job-1');
      expect(firstJob?.location).toBe('Remote');
      expect(firstJob?.department).toBe('Engineering Department');
    });

    it('should handle no jobs found gracefully', async () => {
      const scraper = new PlaywrightScraper();

      // Mock all 4 page.evaluate calls to return empty results
      // Call 1: Page diagnostic
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce({
        url: 'https://example.com/careers',
        title: 'Test Careers Page',
        readyState: 'complete',
        collapseItems: 0,
        collapseButtons: 0,
        titleLinks: 0,
        bodyTextLength: 1000,
        hasElementUI: false,
        firstJobText: '',
      });
      // Call 2: Button expansion (returns expansion result)
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce({
        totalButtons: 0,
        clickedCount: 0,
      });
      // Call 3: Element UI extraction (returns empty array)
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce([]);
      // Call 4: JSON-LD extraction (returns empty array)
      vi.mocked(mocks.mockPage.evaluate).mockResolvedValueOnce([]);

      const result = await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(result.success).toBe(true);
      expect(result.jobs.length).toBe(0);
      expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
        'No job data could be extracted from page'
      );
    });
  });

  describe('error handling and resilience', () => {
    it('should handle page load errors gracefully', async () => {
      const loadError = new Error('Page load failed');
      vi.mocked(mocks.mockPage.goto).mockRejectedValue(loadError);

      const scraper = new PlaywrightScraper({ retries: 0 }); // No retries for this test
      const result = await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle browser context not initialized error', async () => {
      const scraper = new PlaywrightScraper({ retries: 1 });

      // Mock initializeBrowser to not set context
      vi.spyOn(
        scraper as PlaywrightScraper & { initializeBrowser(): Promise<void> },
        'initializeBrowser'
      ).mockImplementation(async () => {
        // Simulate successful browser launch but failed context creation
        (scraper as unknown as Record<string, unknown>)['browser'] = mocks.mockBrowser as Browser;
        (scraper as unknown as Record<string, unknown>)['context'] = null;
      });

      const result = await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser context not initialized');
    });

    it('should handle selector timeouts with fallback to network idle', async () => {
      const scraper = new PlaywrightScraper();

      // Custom mock setup for timeout fallback test (don't use standard mocks)
      // Setup successful page navigation
      vi.mocked(mocks.mockPage.goto).mockResolvedValue(
        null as unknown as import('playwright').Response
      );
      vi.mocked(mocks.mockPage.url).mockReturnValue('https://example.com/careers');
      vi.mocked(mocks.mockPage.setDefaultTimeout).mockResolvedValue();
      vi.mocked(mocks.mockPage.setDefaultNavigationTimeout).mockResolvedValue();
      vi.mocked(mocks.mockPage.route).mockResolvedValue();
      vi.mocked(mocks.mockPage.on).mockReturnValue(mocks.mockPage as unknown as Page);
      vi.mocked(mocks.mockPage.close).mockResolvedValue();

      // Mock locator for no jobs indicator check
      const mockLocator = {
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
        }),
      } as unknown as import('playwright').Locator;
      vi.mocked(mocks.mockPage.locator).mockReturnValue(mockLocator);

      // Setup page.evaluate calls for the 4 sequential calls
      vi.mocked(mocks.mockPage.evaluate)
        .mockResolvedValueOnce({
          url: 'https://example.com/careers',
          title: 'Test Careers Page',
          readyState: 'complete',
          collapseItems: 2,
          collapseButtons: 2,
          titleLinks: 0,
          bodyTextLength: 1000,
          hasElementUI: true,
          firstJobText: 'Senior Engineer',
        })
        .mockResolvedValueOnce({ totalButtons: 5, clickedCount: 5 })
        .mockResolvedValue(PlaywrightScraperTestUtils.SAMPLE_RAW_JOBS);

      // IMPORTANT: Set waitForSelector to throw timeout error to trigger networkidle fallback
      vi.mocked(mocks.mockPage.waitForSelector).mockRejectedValue(
        new Error('Timeout waiting for selector')
      );

      // IMPORTANT: Mock the fallback behavior
      vi.mocked(mocks.mockPage.waitForLoadState).mockResolvedValue();
      vi.mocked(mocks.mockPage.waitForTimeout).mockResolvedValue();

      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      // Should fallback to network idle strategy
      expect(mocks.mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', {
        timeout: 30000,
      });
      expect(mocks.mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });
  });

  describe('cleanup and disposal', () => {
    it('should clean up browser resources when dispose() is called', async () => {
      const scraper = new PlaywrightScraper();

      // Initialize browser by running scrapeJobs
      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      // Interface method dispose() should clean up resources
      await scraper.dispose();

      // Browser close should have been called
      expect(mocks.mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle dispose() cleanup errors gracefully', async () => {
      const scraper = new PlaywrightScraper();

      // Mock browser close to throw error
      vi.mocked(mocks.mockBrowser.close).mockRejectedValue(new Error('Cleanup error'));

      // dispose() method should not throw even on cleanup errors
      await expect(scraper.dispose()).resolves.toBeUndefined();
    });

    it('should handle browser close errors gracefully during cleanup', async () => {
      const scraper = new PlaywrightScraper();

      // Mock browser close to throw error
      vi.mocked(mocks.mockBrowser.close).mockRejectedValue(new Error('Browser close failed'));

      // Should handle error gracefully during cleanup
      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(
        {
          companyId: 'test',
          careersUrl: 'http://example.com',
          apiBaseUrl: 'http://example.com/api',
        },
        'manual'
      );

      expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error closing browser: Browser close failed')
      );
    });
  });

  describe('debug mode functionality', () => {
    it('should capture page console messages in debug mode', async () => {
      const scraper = new PlaywrightScraper({ debug: true });

      // Mock page.on to capture console handler
      let consoleHandler: (msg: { type: () => string; text: () => string }) => void = () => {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ARCHITECTURAL JUSTIFICATION: Playwright page event handler has complex overloaded types that conflict with vi.mocked typing. This mock is only used for testing console message capture in debug mode and doesn't affect production code safety.
      (vi.mocked(mocks.mockPage.on) as any).mockImplementation(
        (event: string, handler: typeof consoleHandler) => {
          if (event === 'console') {
            consoleHandler = handler;
          }
          return mocks.mockPage;
        }
      );

      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      // Verify console handler was registered
      expect(mocks.mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));

      // Simulate console message
      const mockMsg = {
        type: () => 'log',
        text: () => 'Test console message',
      };

      if (consoleHandler) {
        consoleHandler(mockMsg);
      }
      expect(mocks.mockLogger.debug).toHaveBeenCalledWith('Page console.log: Test console message');
    });

    it('should capture debug screenshot with proper filename format', async () => {
      const scraper = new PlaywrightScraper({ debug: true });

      // Setup standard successful mocks
      PlaywrightScraperTestUtils.setupStandardSuccessfulMocks(mocks.mockPage);

      // Ensure screenshot mock is ready to capture calls
      vi.mocked(mocks.mockPage.screenshot).mockResolvedValue(Buffer.from('mock screenshot'));

      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(mocks.mockPage.screenshot).toHaveBeenCalledWith({
        path: expect.stringMatching(
          /^\.\/temp\/scrape-debug-test-company-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png$/
        ),
        fullPage: true,
      });
    });
  });
});
