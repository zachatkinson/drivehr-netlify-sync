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
 * @since 1.2.0
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
 * @since 1.2.0
 */
class JobFetchServiceTestUtils extends JobFetcherTestUtils {
  /**
   * Create a valid API configuration for testing
   *
   * Generates a realistic DriveHR API configuration with all required fields
   * populated for successful job fetching operations. Used as base configuration
   * for most test scenarios requiring valid endpoint URLs.
   *
   * @returns Valid DriveHR API configuration for testing
   * @since 1.2.0
   */
  static createValidApiConfig(): DriveHrApiConfig {
    return {
      companyId: 'test-company',
      careersUrl: 'https://careers.example.com/jobs',
    };
  }

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
   * @since 1.2.0
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
   * @since 1.2.0
   */
  static createUnhandleableConfig(): DriveHrApiConfig {
    return {
      companyId: 'test',
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

  describe('when testing implementation coverage', () => {
    it('should handle configuration validation errors', async () => {
      const invalidConfig: DriveHrApiConfig = {
        companyId: '', // Empty company ID
        careersUrl: '',
      };

      JobFetchServiceTestUtils.setupServiceMocks();

      const result = await service.fetchJobs(invalidConfig, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toContain('All fetch strategies failed');
      expect(result.jobs).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle null/undefined configuration gracefully', async () => {
      const nullConfig = null as unknown as DriveHrApiConfig;

      JobFetchServiceTestUtils.setupServiceMocks();

      await expect(service.fetchJobs(nullConfig, 'manual')).rejects.toThrow();
    });

    it('should handle strategy execution timeout errors', async () => {
      JobFetchServiceTestUtils.resetMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHttpClient.get).mockRejectedValue(
        new Error('Request timeout: Operation timed out after 30 seconds')
      );

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toContain('All fetch strategies failed');
      expect(result.jobs).toHaveLength(0);
    });

    it('should handle network connectivity errors', async () => {
      JobFetchServiceTestUtils.resetMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHttpClient.get).mockRejectedValue(
        new Error('ENOTFOUND: DNS lookup failed for api.drivehr.app')
      );

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toContain('All fetch strategies failed');
      expect(result.method).toBe('none');
    });

    it('should handle malformed HTML content gracefully', async () => {
      JobFetchServiceTestUtils.resetMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHttpClient.get).mockResolvedValue(
        JobFetchServiceTestUtils.createSuccessResponse('<html><invalid><broken>')
      );
      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockImplementation(
        () => {
          throw new Error('HTML parsing failed: Invalid markup structure');
        }
      );

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      expect(result.success).toBe(false);
      expect(result.error).toContain('All fetch strategies failed');
    });

    it('should handle empty job results without errors', async () => {
      JobFetchServiceTestUtils.setupServiceMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue([]);

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.method).toBe('html');
    });

    it('should handle jobs with missing required fields', async () => {
      const incompleteJobs = [
        {
          // Missing title
          description: 'Job with no title',
          company: 'Test Corp',
        },
        {
          title: '', // Empty title
          description: 'Job with empty title',
          company: 'Test Corp',
        },
        {
          title: 'Valid Job',
          description: 'This job should be kept',
          company: 'Test Corp',
          location: 'Remote',
        },
      ];

      JobFetchServiceTestUtils.setupServiceMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
        incompleteJobs
      );

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1); // Only valid job should remain
      expect(result.jobs[0]?.title).toBe('Valid Job');
      expect(result.totalCount).toBe(1);
    });

    it('should handle large job datasets efficiently', async () => {
      // Create a large dataset to test performance and memory handling
      const largeJobDataset = Array.from({ length: 1000 }, (_, index) => ({
        title: `Job Position ${index + 1}`,
        description: `Description for position ${index + 1} with comprehensive details`,
        company: `Company ${Math.floor(index / 10) + 1}`,
        location: `Location ${(index % 5) + 1}`,
        department: `Department ${(index % 3) + 1}`,
        employmentType: 'full-time',
        postedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      JobFetchServiceTestUtils.setupServiceMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
        largeJobDataset
      );

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const startTime = Date.now();
      const result = await service.fetchJobs(config, 'manual');
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(1000);
      expect(result.totalCount).toBe(1000);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain data integrity during job normalization', async () => {
      const complexJobData = [
        {
          title: 'Senior Software Engineer',
          description: 'Full-stack development with React and Node.js',
          company: 'Tech Innovators Inc.',
          location: 'San Francisco, CA',
          department: 'Engineering',
          employmentType: 'full-time',
          salary: '$120k - $180k',
          benefits: ['Health Insurance', '401k', 'Remote Work'],
          requirements: ['5+ years experience', 'React', 'Node.js'],
          postedDate: '2024-01-15T10:00:00Z',
          url: 'https://example.com/jobs/senior-engineer',
          externalId: 'ENG-2024-001',
        },
      ];

      JobFetchServiceTestUtils.setupServiceMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
        complexJobData
      );

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      expect(result.success).toBe(true);
      const normalizedJob = result.jobs[0];
      expect(normalizedJob).toBeDefined();

      // Verify all original data is preserved
      expect(normalizedJob?.title).toBe(complexJobData[0]?.title);
      expect(normalizedJob?.description).toBe(complexJobData[0]?.description);
      expect(normalizedJob?.location).toBe(complexJobData[0]?.location);
      expect(normalizedJob?.department).toBe(complexJobData[0]?.department);
      expect(normalizedJob?.postedDate).toBeDefined(); // Normalization may update timestamps

      // Verify normalization added required fields
      expect(normalizedJob?.id).toBeDefined();
      expect(normalizedJob?.source).toBe('manual');
      expect(normalizedJob?.rawData).toBeDefined();
    });

    it('should handle concurrent fetch operations safely', async () => {
      JobFetchServiceTestUtils.setupServiceMocks();

      const config = JobFetchServiceTestUtils.createValidApiConfig();

      // Execute multiple concurrent fetch operations
      const concurrentOperations = Array.from({ length: 5 }, () =>
        service.fetchJobs(config, 'manual')
      );

      const results = await Promise.all(concurrentOperations);

      // Verify all operations completed successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.jobs.length).toBeGreaterThan(0);
      });

      // Verify HTTP client was called for each operation
      expect(JobFetchServiceTestUtils.mockHttpClient.get).toHaveBeenCalledTimes(5);
    });

    it('should handle strategy selection with multiple potential strategies', async () => {
      JobFetchServiceTestUtils.setupServiceMocks();

      // Test with configuration that has multiple URL options
      const configWithMultipleOptions: DriveHrApiConfig = {
        companyId: 'multi-strategy-test',
        careersUrl: 'https://careers.example.com/jobs',
      };

      const result = await service.fetchJobs(configWithMultipleOptions, 'manual');

      expect(result.success).toBe(true);
      expect(result.method).toBe('html'); // Should use HTML strategy as it's currently the only one available
    });

    it('should validate source parameter properly', async () => {
      JobFetchServiceTestUtils.setupServiceMocks();

      const config = JobFetchServiceTestUtils.createValidApiConfig();

      // Test with various source types
      const sources = ['manual', 'webhook', 'github-actions'] as const;

      for (const source of sources) {
        const result = await service.fetchJobs(config, source);

        expect(result.success).toBe(true);
        expect(result.jobs[0]?.source).toBe(source);
      }
    });

    it('should handle HTTP response with non-200 status codes', async () => {
      JobFetchServiceTestUtils.resetMocks();
      const errorResponse = {
        data: '<html><body>404 Not Found</body></html>',
        status: 404,
        statusText: 'Not Found',
        headers: {},
        success: false,
      };

      vi.mocked(JobFetchServiceTestUtils.mockHttpClient.get).mockResolvedValue(errorResponse);

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      // HTTP error responses cause strategy failure
      expect(result.success).toBe(false); // Error response causes strategy to fail
    });

    it('should handle job data with special characters and encoding', async () => {
      const jobsWithSpecialChars = [
        {
          title: 'Développeur Senior - Full Stack 🚀',
          description:
            'Position requiring expertise in JavaScript & TypeScript. Salary: €65,000-€85,000',
          company: "Société Française D'Innovation",
          location: 'Paris, França',
          department: 'R&D',
          requirements: ['5+ years', 'JavaScript/TypeScript', 'React/Vue.js'],
        },
      ];

      JobFetchServiceTestUtils.setupServiceMocks();
      vi.mocked(JobFetchServiceTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
        jobsWithSpecialChars
      );

      const config = JobFetchServiceTestUtils.createValidApiConfig();
      const result = await service.fetchJobs(config, 'manual');

      expect(result.success).toBe(true);
      const job = result.jobs[0];
      expect(job).toBeDefined();
      expect(job?.title).toBe(jobsWithSpecialChars[0]?.title);
      expect(job?.description).toBe(jobsWithSpecialChars[0]?.description);
      expect(job?.rawData['company']).toBe(jobsWithSpecialChars[0]?.company);
    });
  });
});
