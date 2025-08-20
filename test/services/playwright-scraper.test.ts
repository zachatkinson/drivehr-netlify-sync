/**
 * @fileoverview Test suite for PlaywrightScraper class
 *
 * Comprehensive tests for the Playwright-based job scraper that handles
 * Single Page Applications. Tests browser automation, job extraction,
 * error handling, and normalization functionality.
 *
 * @since 2.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PlaywrightScraper,
  type PlaywrightScraperConfig,
} from '../../src/services/playwright-scraper.js';
import type { DriveHrApiConfig } from '../../src/types/api.js';
import type { RawJobData } from '../../src/types/job.js';
import type { Logger } from '../../src/types/common.js';
import type { Browser } from 'playwright';
import * as logger from '../../src/lib/logger.js';
import * as utils from '../../src/lib/utils.js';

// Mock Playwright module - all mocks must be defined inline
vi.mock('playwright', () => {
  return {
    chromium: {
      launch: vi.fn(),
    },
  };
});

// Mock other dependencies
vi.mock('../../src/lib/logger.js', () => ({
  getLogger: vi.fn(),
}));

vi.mock('../../src/lib/utils.js', () => ({
  DateUtils: {
    getCurrentIsoTimestamp: vi.fn(),
    toIsoString: vi.fn(),
  },
  StringUtils: {
    generateIdFromTitle: vi.fn(),
  },
}));

vi.mock('../../src/lib/job-fetch-utils.js', () => ({
  DriveHrUrlBuilder: {
    buildCareersPageUrl: vi.fn(),
  },
}));

/**
 * Test utilities for PlaywrightScraper
 */
class PlaywrightScraperTestUtils {
  static readonly SAMPLE_CONFIG: DriveHrApiConfig = {
    companyId: 'test-company',
    careersUrl: 'https://drivehris.app/careers/test-company/list',
    apiBaseUrl: 'https://drivehris.app/careers/test-company',
    timeout: 30000,
    retries: 3,
  };

  static readonly SAMPLE_RAW_JOBS: RawJobData[] = [
    {
      id: 'job-1',
      title: 'Senior Software Engineer',
      description: 'Build amazing software',
      location: 'San Francisco, CA',
      department: 'Engineering',
      type: 'Full-time',
      posted_date: '2024-01-01',
      apply_url: 'https://example.com/apply/1',
    },
    {
      id: 'job-2',
      title: 'Product Manager',
      description: 'Lead product development',
      location: 'Remote',
      department: 'Product',
      type: 'Full-time',
      posted_date: '2024-01-02',
      apply_url: 'https://example.com/apply/2',
    },
  ];

  static createMockPage() {
    return {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue({
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
        }),
      }),
      evaluate: vi.fn().mockResolvedValue(this.SAMPLE_RAW_JOBS),
      screenshot: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      route: vi.fn().mockImplementation((_pattern, handler) => {
        // Mock route handler
        const mockRoute = {
          request: () => ({ resourceType: () => 'document' }),
          continue: vi.fn(),
          abort: vi.fn(),
        };
        handler(mockRoute);
      }),
      on: vi.fn(),
      setDefaultTimeout: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
    };
  }

  static createMockContext(mockPage: ReturnType<typeof PlaywrightScraperTestUtils.createMockPage>) {
    return {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }

  static createMockBrowser(
    mockContext: ReturnType<typeof PlaywrightScraperTestUtils.createMockContext>
  ) {
    return {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }

  static async setupMocks() {
    const mockPage = this.createMockPage();
    const mockContext = this.createMockContext(mockPage);
    const mockBrowser = this.createMockBrowser(mockContext);

    // Setup chromium.launch mock
    const { chromium } = await import('playwright');
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as unknown as Browser);

    // Setup logger mock
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
    };
    vi.mocked(logger.getLogger).mockReturnValue(mockLogger as Logger);

    // Setup utils mocks
    vi.mocked(utils.DateUtils.getCurrentIsoTimestamp).mockReturnValue('2024-01-01T12:00:00.000Z');
    vi.mocked(utils.DateUtils.toIsoString).mockImplementation((date: string | Date) =>
      typeof date === 'string' ? date : date.toISOString()
    );
    vi.mocked(utils.StringUtils.generateIdFromTitle).mockImplementation(
      title => `generated-${title.toLowerCase().replace(/\\s+/g, '-')}`
    );

    // Setup URL builder mock
    const { DriveHrUrlBuilder } = await import('../../src/lib/job-fetch-utils.js');
    vi.mocked(DriveHrUrlBuilder.buildCareersPageUrl).mockReturnValue(this.SAMPLE_CONFIG.careersUrl);

    return { mockPage, mockContext, mockBrowser, mockLogger };
  }

  static restoreMocks() {
    vi.clearAllMocks();
  }
}

describe('PlaywrightScraper', () => {
  let mocks: Awaited<ReturnType<typeof PlaywrightScraperTestUtils.setupMocks>>;

  beforeEach(async () => {
    mocks = await PlaywrightScraperTestUtils.setupMocks();
  });

  afterEach(() => {
    PlaywrightScraperTestUtils.restoreMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const scraper = new PlaywrightScraper();
      expect(scraper).toBeInstanceOf(PlaywrightScraper);
    });

    it('should initialize with custom configuration', () => {
      const config: PlaywrightScraperConfig = {
        headless: false,
        timeout: 60000,
        debug: true,
        retries: 5,
      };

      const scraper = new PlaywrightScraper(config);
      expect(scraper).toBeInstanceOf(PlaywrightScraper);
    });
  });

  describe('scrapeJobs', () => {
    it('should successfully scrape jobs from a careers page', async () => {
      const scraper = new PlaywrightScraper();
      const result = await scraper.scrapeJobs(
        PlaywrightScraperTestUtils.SAMPLE_CONFIG,
        'github-actions'
      );

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.url).toBe(PlaywrightScraperTestUtils.SAMPLE_CONFIG.careersUrl);
      expect(result.scrapedAt).toBeDefined();

      const firstJob = result.jobs[0];
      expect(firstJob).toBeDefined();
      if (firstJob) {
        expect(firstJob.title).toBe('Senior Software Engineer');
        expect(firstJob.source).toBe('github-actions');
        expect(firstJob.processedAt).toBe('2024-01-01T12:00:00.000Z');
      }

      // Verify browser interaction
      expect(mocks.mockPage.goto).toHaveBeenCalledWith(
        PlaywrightScraperTestUtils.SAMPLE_CONFIG.careersUrl,
        expect.objectContaining({
          waitUntil: 'networkidle',
          timeout: 30000,
        })
      );
    });

    it('should handle empty job results gracefully', async () => {
      // Mock empty results
      mocks.mockPage.evaluate.mockResolvedValue([]);

      const scraper = new PlaywrightScraper();
      const result = await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should retry on failure and eventually succeed', async () => {
      // Mock first attempt to fail, second to succeed
      mocks.mockPage.goto
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(undefined);

      const scraper = new PlaywrightScraper({ retries: 2 });
      const result = await scraper.scrapeJobs(
        PlaywrightScraperTestUtils.SAMPLE_CONFIG,
        'github-actions'
      );

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(2);
      expect(mocks.mockPage.goto).toHaveBeenCalledTimes(2); // First failed, second succeeded
    });

    it('should fail after exhausting all retry attempts', async () => {
      const error = new Error('Persistent browser error');
      mocks.mockPage.goto.mockRejectedValue(error);

      const scraper = new PlaywrightScraper({ retries: 2 });
      const result = await scraper.scrapeJobs(
        PlaywrightScraperTestUtils.SAMPLE_CONFIG,
        'github-actions'
      );

      expect(result.success).toBe(false);
      expect(result.jobs).toHaveLength(0);
      expect(result.error).toBe(error.message);
      expect(mocks.mockPage.goto).toHaveBeenCalledTimes(2); // All retries exhausted
    });

    it('should handle page navigation timeout', async () => {
      const timeoutError = new Error('Navigation timeout');
      mocks.mockPage.goto.mockRejectedValue(timeoutError);

      const scraper = new PlaywrightScraper({ retries: 1 });
      const result = await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toBe(timeoutError.message);
    });

    it('should take debug screenshot when debug mode is enabled', async () => {
      const scraper = new PlaywrightScraper({ debug: true });
      const result = await scraper.scrapeJobs(
        PlaywrightScraperTestUtils.SAMPLE_CONFIG,
        'github-actions'
      );

      expect(result.success).toBe(true);
      expect(result.screenshotPath).toBeDefined();
      expect(mocks.mockPage.screenshot).toHaveBeenCalledWith({
        path: expect.stringContaining('./temp/scrape-debug-test-company-'),
        fullPage: true,
      });
    });

    it('should not take screenshot when debug mode is disabled', async () => {
      const scraper = new PlaywrightScraper({ debug: false });
      const result = await scraper.scrapeJobs(
        PlaywrightScraperTestUtils.SAMPLE_CONFIG,
        'github-actions'
      );

      expect(result.success).toBe(true);
      expect(result.screenshotPath).toBeUndefined();
      expect(mocks.mockPage.screenshot).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should clean up browser resources', async () => {
      const scraper = new PlaywrightScraper();

      // Initialize browser by running scrapeJobs
      await scraper.scrapeJobs(PlaywrightScraperTestUtils.SAMPLE_CONFIG, 'manual');

      // Dispose should clean up
      await scraper.dispose();

      // Browser close should have been called
      expect(mocks.mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const scraper = new PlaywrightScraper();

      // Mock browser close to throw error
      mocks.mockBrowser.close.mockRejectedValue(new Error('Cleanup error'));

      // Should not throw
      await expect(scraper.dispose()).resolves.toBeUndefined();
    });
  });
});
