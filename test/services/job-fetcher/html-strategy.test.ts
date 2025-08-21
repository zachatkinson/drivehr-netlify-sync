/**
 * HTML Job Fetch Strategy Test Suite
 *
 * Comprehensive test coverage for HtmlJobFetchStrategy following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates HTML scraping functionality and error handling.
 *
 * Test Features:
 * - Strategy interface compliance verification
 * - Configuration handling and validation
 * - HTML scraping and parsing integration
 * - Error handling and edge cases
 * - Mock integration patterns
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/services/job-fetcher/html-strategy.test.ts -- --grep "canHandle"
 * ```
 *
 * @module html-strategy-test-suite
 * @since 1.0.0
 * @see {@link ../../../src/services/job-fetcher/html-strategy.ts} for the strategy being tested
 * @see {@link ../../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HtmlJobFetchStrategy } from '../../../src/services/job-fetcher/html-strategy.js';
import type { DriveHrApiConfig } from '../../../src/types/api.js';
import { JobFetcherTestUtils } from './shared-test-utils.js';
import * as logger from '../../../src/lib/logger.js';
import * as jobFetchUtils from '../../../src/lib/job-fetch-utils.js';

/**
 * HTML Strategy-specific test utilities
 *
 * Extends JobFetcherTestUtils with HTML strategy-specific testing patterns.
 * Maintains DRY principles while providing specialized testing methods.
 *
 * @since 1.0.0
 */
class HtmlStrategyTestUtils extends JobFetcherTestUtils {
  /**
   * Create minimal config without careersUrl for testing canHandle rejection
   *
   * @returns Configuration that cannot be handled by HTML strategy
   * @since 1.0.0
   */
  static createInvalidConfig(): DriveHrApiConfig {
    return {
      companyId: 'test-company',
      apiBaseUrl: 'https://api.example.com',
    } as DriveHrApiConfig;
  }

  /**
   * Setup HTML strategy test mocks with realistic responses
   *
   * @since 1.0.0
   */
  static setupHtmlStrategyMocks(): void {
    vi.mocked(this.mockHttpClient.get).mockResolvedValue(
      this.createSuccessResponse('<div class="job">Test Job HTML</div>')
    );
    vi.mocked(this.mockHtmlParser.parseJobsFromHtml).mockReturnValue(this.SAMPLE_RAW_JOBS);
  }
}

describe('HtmlJobFetchStrategy', () => {
  let strategy: HtmlJobFetchStrategy;

  beforeEach(() => {
    HtmlStrategyTestUtils.resetMocks();
    vi.spyOn(logger, 'getLogger').mockReturnValue(HtmlStrategyTestUtils.mockLogger);
    vi.spyOn(jobFetchUtils.DriveHrUrlBuilder, 'buildCareersPageUrl').mockImplementation(
      (config: DriveHrApiConfig) => config.careersUrl || 'https://default.com/careers'
    );

    strategy = new HtmlJobFetchStrategy(HtmlStrategyTestUtils.mockHtmlParser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should implement IJobFetchStrategy interface correctly', () => {
    HtmlStrategyTestUtils.verifyStrategyInterface(strategy, 'html');
  });

  describe('canHandle', () => {
    it('should return true when careersUrl is provided', () => {
      expect(strategy.canHandle(HtmlStrategyTestUtils.STANDARD_CONFIG)).toBe(true);
    });

    it('should return false when careersUrl is missing', () => {
      const config = HtmlStrategyTestUtils.createInvalidConfig();
      expect(strategy.canHandle(config)).toBe(false);
    });

    it('should return false when careersUrl is empty string', () => {
      const config = {
        ...HtmlStrategyTestUtils.STANDARD_CONFIG,
        careersUrl: '',
      };
      expect(strategy.canHandle(config)).toBe(false);
    });

    it('should return false when careersUrl is null', () => {
      const config = {
        ...HtmlStrategyTestUtils.STANDARD_CONFIG,
        careersUrl: null as unknown as string,
      };
      expect(strategy.canHandle(config)).toBe(false);
    });
  });

  describe('fetchJobs', () => {
    beforeEach(() => {
      HtmlStrategyTestUtils.setupHtmlStrategyMocks();
    });

    it('should fetch jobs by parsing HTML from careers page', async () => {
      const htmlContent = '<div class="job">Test Job HTML</div>';
      vi.mocked(HtmlStrategyTestUtils.mockHttpClient.get).mockResolvedValue(
        HtmlStrategyTestUtils.createSuccessResponse(htmlContent)
      );

      const result = await strategy.fetchJobs(
        HtmlStrategyTestUtils.STANDARD_CONFIG,
        HtmlStrategyTestUtils.mockHttpClient
      );

      expect(result).toEqual(HtmlStrategyTestUtils.SAMPLE_RAW_JOBS);
      expect(vi.mocked(HtmlStrategyTestUtils.mockHttpClient.get)).toHaveBeenCalledWith(
        HtmlStrategyTestUtils.STANDARD_CONFIG.careersUrl,
        { Accept: 'text/html,application/xhtml+xml' }
      );
      expect(HtmlStrategyTestUtils.mockHtmlParser.parseJobsFromHtml).toHaveBeenCalledWith(
        htmlContent,
        HtmlStrategyTestUtils.STANDARD_CONFIG.careersUrl
      );
    });

    it('should throw error when HTML page is not accessible', async () => {
      vi.mocked(HtmlStrategyTestUtils.mockHttpClient.get).mockResolvedValue(
        HtmlStrategyTestUtils.createFailureResponse(404, 'Not Found')
      );

      await expect(
        strategy.fetchJobs(
          HtmlStrategyTestUtils.STANDARD_CONFIG,
          HtmlStrategyTestUtils.mockHttpClient
        )
      ).rejects.toThrow('HTML page not accessible');
    });

    it('should throw error when HTML parsing fails', async () => {
      vi.mocked(HtmlStrategyTestUtils.mockHttpClient.get).mockResolvedValue(
        HtmlStrategyTestUtils.createSuccessResponse('<html></html>')
      );
      vi.mocked(HtmlStrategyTestUtils.mockHtmlParser.parseJobsFromHtml).mockImplementation(() => {
        throw new Error('HTML parsing failed');
      });

      await expect(
        strategy.fetchJobs(
          HtmlStrategyTestUtils.STANDARD_CONFIG,
          HtmlStrategyTestUtils.mockHttpClient
        )
      ).rejects.toThrow('HTML parsing failed');
    });

    it('should handle network timeout errors gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      vi.mocked(HtmlStrategyTestUtils.mockHttpClient.get).mockRejectedValue(timeoutError);

      await expect(
        strategy.fetchJobs(
          HtmlStrategyTestUtils.STANDARD_CONFIG,
          HtmlStrategyTestUtils.mockHttpClient
        )
      ).rejects.toThrow('Request timeout');
    });

    it('should detect "no jobs available" indicators in HTML content', async () => {
      const htmlWithNoJobsIndicator = '<html><body><p>No positions available</p></body></html>';
      vi.mocked(HtmlStrategyTestUtils.mockHttpClient.get).mockResolvedValue(
        HtmlStrategyTestUtils.createSuccessResponse(htmlWithNoJobsIndicator)
      );
      // Parser should still be called but we expect empty result due to indicator
      vi.mocked(HtmlStrategyTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue([
        HtmlStrategyTestUtils.createMockRawJob(),
      ]);

      const result = await strategy.fetchJobs(
        HtmlStrategyTestUtils.STANDARD_CONFIG,
        HtmlStrategyTestUtils.mockHttpClient
      );

      expect(result).toEqual([]);
    });

    it('should handle various "no jobs" text variations', async () => {
      const noJobsVariations = ['no current openings', 'no job availabilities', 'no opportunities'];

      for (const indicator of noJobsVariations) {
        const htmlContent = `<html><body><p>${indicator}</p></body></html>`;
        vi.mocked(HtmlStrategyTestUtils.mockHttpClient.get).mockResolvedValue(
          HtmlStrategyTestUtils.createSuccessResponse(htmlContent)
        );

        const result = await strategy.fetchJobs(
          HtmlStrategyTestUtils.STANDARD_CONFIG,
          HtmlStrategyTestUtils.mockHttpClient
        );

        expect(result).toEqual([]);
      }
    });
  });
});
