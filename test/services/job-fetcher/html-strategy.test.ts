/**
 * HTML Job Fetch Strategy Test Suite
 *
 * Comprehensive test coverage for the HTML-based job fetching strategy following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates HTML parsing job extraction, URL capability validation,
 * error handling for network failures, and intelligent "no jobs available" detection.
 *
 * Test Features:
 * - HTML job fetch strategy implementation testing
 * - Configuration capability validation (canHandle method)
 * - HTTP request handling and response processing
 * - HTML parser integration and error scenarios
 * - "No jobs available" indicator detection algorithms
 * - Network timeout and error handling validation
 * - DriveHR URL builder integration testing
 * - Comprehensive mock strategies for external dependencies
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/services/job-fetcher/html-strategy.test.ts -- --grep "fetchJobs"
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
 * Specialized test utilities for HTML job fetch strategy testing
 *
 * Extends JobFetcherTestUtils with HTML strategy-specific testing capabilities
 * including invalid configuration creation, HTML parsing mock setup, and
 * specialized assertion patterns for HTML job fetching scenarios.
 *
 * @since 1.0.0
 */
class HtmlStrategyTestUtils extends JobFetcherTestUtils {
  /**
   * Create invalid DriveHR configuration for testing canHandle scenarios
   *
   * Generates a configuration that lacks the careersUrl property required
   * for HTML strategy compatibility testing. Used to validate strategy
   * capability detection and rejection of incompatible configurations.
   *
   * @returns Invalid configuration missing careersUrl for HTML strategy
   * @example
   * ```typescript
   * const invalidConfig = HtmlStrategyTestUtils.createInvalidConfig();
   * expect(strategy.canHandle(invalidConfig)).toBe(false);
   * ```
   * @since 1.0.0
   */
  static createInvalidConfig(): DriveHrApiConfig {
    return {
      companyId: 'test-company',
    } as DriveHrApiConfig;
  }

  /**
   * Configure comprehensive mocks for HTML strategy testing
   *
   * Sets up HTTP client and HTML parser mocks with realistic responses
   * for testing HTML job fetching workflows. Configures successful HTTP
   * responses and mock job data parsing for consistent test execution.
   *
   * @example
   * ```typescript
   * HtmlStrategyTestUtils.setupHtmlStrategyMocks();
   * const jobs = await strategy.fetchJobs(config, httpClient);
   * expect(jobs).toEqual(HtmlStrategyTestUtils.SAMPLE_RAW_JOBS);
   * ```
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
