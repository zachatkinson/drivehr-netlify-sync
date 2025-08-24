/**
 * Job Fetch Service Test Suite
 *
 * Comprehensive test coverage for JobFetchService following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates service orchestration, strategy execution,
 * job normalization, and error handling with telemetry integration.
 *
 * Test Features:
 * - Service initialization and dependency injection validation
 * - HTML strategy execution with proper URL building
 * - Job data normalization from raw to structured format
 * - Error handling for network failures and parsing errors
 * - Source tracking and metadata enrichment
 * - Strategy fallback behavior when configuration is invalid
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/services/job-fetcher/job-fetch-service.test.ts -- --grep "fetchJobs"
 * ```
 *
 * @module job-fetch-service-test-suite
 * @since 1.0.0
 * @see {@link ../../../src/services/job-fetcher/job-fetch-service.ts} for the service being tested
 * @see {@link ../../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobFetchService } from '../../../src/services/job-fetcher/job-fetch-service.js';
import type { DriveHrApiConfig } from '../../../src/types/api.js';
import type { NormalizedJob } from '../../../src/types/job.js';
import { JobFetcherTestUtils } from './shared-test-utils.js';
import * as logger from '../../../src/lib/logger.js';
import * as jobFetchUtils from '../../../src/lib/job-fetch-utils.js';

/**
 * Job Fetch Service-specific test utilities
 *
 * Extends JobFetcherTestUtils with service-specific testing patterns for
 * JobFetchService operations. Provides specialized mock setup for HTML parsing,
 * HTTP client responses, and error handler utilities required for comprehensive
 * service testing scenarios.
 *
 * @since 1.0.0
 */
class JobFetchServiceTestUtils extends JobFetcherTestUtils {
  /**
   * Setup comprehensive mocks for JobFetchService testing
   *
   * Configures all required mocks for testing JobFetchService operations including
   * HTTP client responses, HTML parser behavior, and error handling utilities.
   * This setup ensures proper isolation and predictable behavior during test execution.
   *
   * @example
   * ```typescript
   * beforeEach(() => {
   *   JobFetchServiceTestUtils.setupServiceMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static setupServiceMocks(): void {
    vi.mocked(this.mockHttpClient.get).mockResolvedValue(
      this.createSuccessResponse('<html lang="en">Mock HTML content</html>')
    );
    vi.mocked(this.mockHtmlParser.parseJobsFromHtml).mockReturnValue(this.SAMPLE_RAW_JOBS);
    vi.spyOn(jobFetchUtils.JobFetchErrorHandler, 'logStrategyFailure').mockImplementation(() => {});
  }

  /**
   * Create configuration that cannot be handled by any strategy
   *
   * Generates a minimal configuration that will cause all job fetch strategies
   * to reject handling, used for testing fallback behavior when no suitable
   * strategy is available for the provided configuration.
   *
   * @returns Configuration with empty URLs that HTML strategy cannot handle
   * @example
   * ```typescript
   * const invalidConfig = JobFetchServiceTestUtils.createUnhandleableConfig();
   * const result = await service.fetchJobs(invalidConfig, 'test');
   * expect(result.success).toBe(false);
   * ```
   * @since 1.0.0
   */
  static createUnhandleableConfig(): DriveHrApiConfig {
    return {
      companyId: 'test',
      apiBaseUrl: '',
      careersUrl: '',
    };
  }
}

describe('JobFetchService', () => {
  let service: JobFetchService;

  beforeEach(() => {
    JobFetchServiceTestUtils.resetMocks();
    vi.spyOn(logger, 'getLogger').mockReturnValue(JobFetchServiceTestUtils.mockLogger);
    vi.spyOn(jobFetchUtils.DriveHrUrlBuilder, 'buildCareersPageUrl').mockImplementation(
      (config: DriveHrApiConfig) => config.careersUrl || 'https://default.com/careers'
    );

    service = new JobFetchService(
      JobFetchServiceTestUtils.mockHttpClient,
      JobFetchServiceTestUtils.mockHtmlParser
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with HTML strategy only', () => {
      expect(service).toBeInstanceOf(JobFetchService);
    });

    it('should accept HTTP client and HTML parser dependencies', () => {
      const newService = new JobFetchService(
        JobFetchServiceTestUtils.mockHttpClient,
        JobFetchServiceTestUtils.mockHtmlParser
      );
      expect(newService).toBeInstanceOf(JobFetchService);
    });
  });

  describe('fetchJobs', () => {
    beforeEach(() => {
      JobFetchServiceTestUtils.setupServiceMocks();
    });

    it('should fetch jobs using HTML strategy', async () => {
      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'webhook');

      JobFetchServiceTestUtils.verifyJobFetchResult(result, true, 3, 'html');
      expect(JobFetchServiceTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Attempting to fetch jobs using strategy: html'
      );
      expect(JobFetchServiceTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Successfully fetched 3 jobs using html'
      );
    });

    it('should fail when HTML strategy cannot handle configuration', async () => {
      const minimalConfig = JobFetchServiceTestUtils.createUnhandleableConfig();
      const result = await service.fetchJobs(minimalConfig, 'drivehr');

      JobFetchServiceTestUtils.verifyJobFetchResult(result, false);
      expect(result.error).toBe('All fetch strategies failed');
    });

    it('should return failure result when HTML strategy fails', async () => {
      vi.mocked(JobFetchServiceTestUtils.mockHttpClient.get).mockRejectedValue(
        new Error('HTML strategy failed')
      );

      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'drivehr');

      JobFetchServiceTestUtils.verifyJobFetchResult(result, false);
      expect(result.error).toBe('All fetch strategies failed');
      expect(result.method).toBe('none');
    });

    it('should properly normalize jobs from raw data', async () => {
      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'webhook');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(3);

      const firstJob = result.jobs[0] as NormalizedJob;
      expect(firstJob).toHaveProperty('id');
      expect(firstJob).toHaveProperty('title');
      expect(firstJob).toHaveProperty('source');
      expect(firstJob).toHaveProperty('processedAt');
    });

    it('should filter out jobs without titles during normalization', async () => {
      const rawJobsWithoutTitles = [
        JobFetchServiceTestUtils.createMockRawJob({ title: '' }),
        JobFetchServiceTestUtils.createMockRawJob({ title: undefined }),
        JobFetchServiceTestUtils.createMockRawJob({ title: 'Valid Job' }),
      ];

      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
        rawJobsWithoutTitles
      );

      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'webhook');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect((result.jobs[0] as NormalizedJob).title).toBe('Valid Job');
    });

    it('should use default source when not provided', async () => {
      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG);

      expect(result.success).toBe(true);
      expect((result.jobs[0] as NormalizedJob).source).toBe('drivehr');
    });

    it('should handle HTTP client errors gracefully', async () => {
      const networkError = new Error('Network connection failed');
      vi.mocked(JobFetchServiceTestUtils.mockHttpClient.get).mockRejectedValue(networkError);

      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'manual');

      JobFetchServiceTestUtils.verifyJobFetchResult(result, false);
      expect(result.error).toBe('All fetch strategies failed');
    });

    it('should handle HTML parser errors gracefully', async () => {
      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockImplementation(
        () => {
          throw new Error('Parser crashed');
        }
      );

      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'webhook');

      JobFetchServiceTestUtils.verifyJobFetchResult(result, false);
      expect(result.error).toBe('All fetch strategies failed');
    });
  });

  describe('job normalization', () => {
    beforeEach(() => {
      JobFetchServiceTestUtils.setupServiceMocks();
    });

    it('should handle various raw job data field variations', async () => {
      const variedRawJobs = [
        {
          id: 'job-1',
          title: 'Engineer',
          department: 'Tech',
          location: 'SF',
          type: 'Full-time',
          posted_date: '2024-01-01T00:00:00Z',
          apply_url: 'https://example.com/apply/1',
        },
        {
          job_id: 'job-2',
          position_title: 'Designer',
          category: 'Design',
          city: 'NY',
          employment_type: 'Part-time',
          created_at: '2024-01-02T00:00:00Z',
          application_url: 'https://example.com/apply/2',
        },
      ];

      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
        variedRawJobs
      );

      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'webhook');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(2);

      expect((result.jobs[0] as NormalizedJob).title).toBe('Engineer');
      expect((result.jobs[1] as NormalizedJob).title).toBe('Designer');
    });

    it('should generate IDs for jobs without explicit IDs', async () => {
      const jobWithoutId = {
        title: 'Software Engineer',
        department: 'Engineering',
        location: 'Remote',
      };

      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue([
        jobWithoutId,
      ]);

      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'webhook');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect((result.jobs[0] as NormalizedJob).id).toBeDefined();
      expect((result.jobs[0] as NormalizedJob).id).toMatch(/^software-engineer-/);
    });

    it('should use current timestamp for jobs without posted dates', async () => {
      const jobWithoutDate = {
        id: 'test-job',
        title: 'Test Position',
        department: 'Testing',
      };

      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue([
        jobWithoutDate,
      ]);

      const result = await service.fetchJobs(JobFetchServiceTestUtils.STANDARD_CONFIG, 'webhook');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect((result.jobs[0] as NormalizedJob).postedDate).toBeDefined();
      expect((result.jobs[0] as NormalizedJob).postedDate).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });
  });
});
