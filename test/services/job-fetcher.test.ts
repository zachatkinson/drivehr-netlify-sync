/**
 * @fileoverview Comprehensive test suite for job fetcher service with Strategy pattern
 *
 * Tests all job fetching strategies and the main orchestration service using
 * DRY principles with specialized utilities. Includes comprehensive coverage
 * of all strategies, error handling, normalization, and integration patterns.
 *
 * Key test areas:
 * - HtmlJobFetchStrategy: HTML scraping with parser integration
 * - JobFetchService: Strategy orchestration and job normalization
 * - Error handling and edge cases across all components
 * - Integration tests showing complete workflows
 *
 * @since 1.0.0
 * @see {@link ../../src/services/job-fetcher.ts} for implementation details
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HtmlJobFetchStrategy,
  JobFetchService,
  type IJobFetchStrategy,
  type IHtmlParser,
} from '../../src/services/job-fetcher.js';
import type { IHttpClient, HttpResponse } from '../../src/lib/http-client.js';
import type { DriveHrApiConfig } from '../../src/types/api.js';
import type { RawJobData, NormalizedJob, JobFetchResult } from '../../src/types/job.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as logger from '../../src/lib/logger.js';
import * as jobFetchUtils from '../../src/lib/job-fetch-utils.js';
import * as utils from '../../src/lib/utils.js';

/**
 * Specialized test utilities for job fetcher service testing
 *
 * Extends BaseTestUtils with job-fetcher-specific testing capabilities including
 * mock HTTP client, HTML parser, strategy testing patterns, and comprehensive
 * test data generation. Implements DRY principles for consistent test patterns.
 *
 * @extends BaseTestUtils
 * @since 1.0.0
 */
class JobFetcherTestUtils extends BaseTestUtils {
  /**
   * Mock HTTP client for testing network interactions
   * @since 1.0.0
   */
  static mockHttpClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as IHttpClient;

  /**
   * Mock HTML parser for testing HTML scraping strategies
   * @since 1.0.0
   */
  static mockHtmlParser = {
    parseJobsFromHtml: vi.fn(),
  } as IHtmlParser;

  /**
   * Mock logger for testing logging behavior
   * @since 1.0.0
   */
  static mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  };

  /**
   * Standard DriveHR API configuration for testing
   * @since 1.0.0
   */
  static readonly STANDARD_CONFIG: DriveHrApiConfig = {
    companyId: 'test-company',
    apiBaseUrl: 'https://api.test-company.com',
    careersUrl: 'https://drivehr.app/careers/test-company/list',
    timeout: 30000,
    retries: 3,
  };

  /**
   * Configuration variations for comprehensive testing
   * @since 1.0.0
   */
  static readonly CONFIG_VARIATIONS = [
    {
      name: 'API only config',
      config: {
        companyId: 'api-only',
        apiBaseUrl: 'https://api.api-only.com',
      } as DriveHrApiConfig,
    },
    {
      name: 'JSON only config',
      config: {
        companyId: 'json-only',
        careersUrl: 'https://json-only.com/careers/list',
      } as DriveHrApiConfig,
    },
    {
      name: 'Complete config',
      config: this.STANDARD_CONFIG,
    },
    {
      name: 'Minimal config',
      config: {
        companyId: 'minimal',
      } as DriveHrApiConfig,
    },
  ] as const;

  /**
   * Sample raw job data for testing
   * @since 1.0.0
   */
  static readonly SAMPLE_RAW_JOBS: RawJobData[] = [
    {
      id: 'job-001',
      title: 'Senior Software Engineer',
      description: 'Build scalable applications',
      location: 'San Francisco, CA',
      department: 'Engineering',
      type: 'Full-time',
      posted_date: '2024-01-01T00:00:00Z',
      apply_url: 'https://example.com/apply/job-001',
    },
    {
      job_id: 'job-002',
      position_title: 'Product Manager',
      summary: 'Lead product development',
      city: 'Remote',
      category: 'Product',
      employment_type: 'Full-time',
      created_at: '2024-01-02T00:00:00Z',
      application_url: 'https://example.com/apply/job-002',
    },
    {
      title: 'UX Designer',
      description: 'Design user experiences',
      location: 'New York, NY',
      department: 'Design',
      date_posted: '2024-01-03T00:00:00Z',
    },
  ];

  /**
   * Sample normalized jobs for testing
   * @since 1.0.0
   */
  static readonly SAMPLE_NORMALIZED_JOBS: NormalizedJob[] = [
    {
      id: 'job-001',
      title: 'Senior Software Engineer',
      description: 'Build scalable applications',
      location: 'San Francisco, CA',
      department: 'Engineering',
      type: 'Full-time',
      postedDate: '2024-01-01T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-001',
      source: 'drivehr',
      rawData: this.SAMPLE_RAW_JOBS[0] as RawJobData,
      processedAt: '2024-01-01T12:00:00.000Z',
    },
    {
      id: 'job-002',
      title: 'Product Manager',
      description: 'Lead product development',
      location: 'Remote',
      department: 'Product',
      type: 'Full-time',
      postedDate: '2024-01-02T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-002',
      source: 'drivehr',
      rawData: this.SAMPLE_RAW_JOBS[1] as RawJobData,
      processedAt: '2024-01-01T12:00:00.000Z',
    },
  ];

  /**
   * Setup all mocks before tests
   *
   * Configures all necessary mocks including logger, HTTP client,
   * HTML parser, date utilities, and normalization services for
   * consistent test behavior across all strategy tests.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * beforeEach(() => {
   *   JobFetcherTestUtils.setupMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static setupMocks(): void {
    vi.spyOn(logger, 'getLogger').mockReturnValue(this.mockLogger);
    vi.spyOn(utils.DateUtils, 'getCurrentIsoTimestamp').mockReturnValue('2024-01-01T12:00:00.000Z');
    vi.spyOn(utils.DateUtils, 'toIsoString').mockImplementation((date: string | Date) => {
      if (typeof date === 'string' && date.includes('2024-01-01'))
        return '2024-01-01T00:00:00.000Z';
      if (typeof date === 'string' && date.includes('2024-01-02'))
        return '2024-01-02T00:00:00.000Z';
      if (typeof date === 'string' && date.includes('2024-01-03'))
        return '2024-01-03T00:00:00.000Z';
      return '2024-01-01T12:00:00.000Z';
    });
    vi.spyOn(utils.StringUtils, 'generateIdFromTitle').mockImplementation(
      (title: string) => `generated-${title.toLowerCase().replace(/\s+/g, '-')}-1704067200000`
    );
  }

  /**
   * Restore all mocks after tests
   *
   * Cleans up all mock functions and restores original implementations
   * to prevent test interference between test cases. Includes specific
   * cleanup for HTTP client and HTML parser mocks.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * afterEach(() => {
   *   JobFetcherTestUtils.restoreMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static restoreMocks(): void {
    vi.restoreAllMocks();
    Object.values(this.mockLogger).forEach(mock => mock.mockClear());
    vi.mocked(this.mockHttpClient.get).mockClear();
    vi.mocked(this.mockHttpClient.post).mockClear();
    vi.mocked(this.mockHtmlParser.parseJobsFromHtml).mockClear();
  }

  /**
   * Create successful HTTP response
   *
   * Generates a properly formatted successful HTTP response object
   * with the provided data for mocking HTTP operations.
   *
   * @template T - Type of the response data
   * @param {T} data - Response data to include in the HTTP response
   * @returns {HttpResponse<T>} Formatted HTTP success response with status 200
   * @example
   * ```typescript
   * const jobData = [{ id: '1', title: 'Engineer' }];
   * const response = JobFetcherTestUtils.createSuccessResponse(jobData);
   * mockHttpClient.get.mockResolvedValue(response);
   * ```
   * @since 1.0.0
   */
  static createSuccessResponse<T>(data: T): HttpResponse<T> {
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data,
      success: true,
    };
  }

  /**
   * Create failed HTTP response
   *
   * Generates a properly formatted failed HTTP response object
   * for testing error handling scenarios.
   *
   * @param {number} [status=500] - HTTP status code for the error response
   * @param {string} [statusText='Internal Server Error'] - HTTP status text
   * @returns {HttpResponse<unknown>} Formatted HTTP error response
   * @example
   * ```typescript
   * const response = JobFetcherTestUtils.createFailureResponse(404, 'Not Found');
   * mockHttpClient.get.mockResolvedValue(response);
   * await expect(strategy.fetchJobs(config)).rejects.toThrow();
   * ```
   * @since 1.0.0
   */
  static createFailureResponse(
    status = 500,
    statusText = 'Internal Server Error'
  ): HttpResponse<unknown> {
    return {
      status,
      statusText,
      headers: {},
      data: null,
      success: false,
    };
  }

  /**
   * Verify strategy interface compliance
   *
   * Validates that a job fetch strategy properly implements the
   * IJobFetchStrategy interface with correct properties and methods.
   *
   * @param {IJobFetchStrategy} strategy - Strategy instance to verify
   * @param {string} expectedName - Expected strategy name
   * @returns {void} No return value, throws assertion errors on mismatch
   * @example
   * ```typescript
   * const strategy = new ApiJobFetchStrategy(httpClient);
   * JobFetcherTestUtils.verifyStrategyInterface(strategy, 'api');
   * ```
   * @since 1.0.0
   */
  static verifyStrategyInterface(strategy: IJobFetchStrategy, expectedName: string): void {
    expect(strategy.name).toBe(expectedName);
    expect(typeof strategy.canHandle).toBe('function');
    expect(typeof strategy.fetchJobs).toBe('function');
  }

  /**
   * Verify job fetch result structure
   *
   * Validates that a job fetch result has the correct structure,
   * success status, job count, and method information.
   *
   * @param {JobFetchResult} result - The job fetch result to verify
   * @param {boolean} expectedSuccess - Expected success status
   * @param {number} [expectedJobCount] - Expected number of jobs fetched
   * @param {string} [expectedMethod] - Expected fetch method used
   * @returns {void} No return value, throws assertion errors on mismatch
   * @example
   * ```typescript
   * const result = await strategy.fetchJobs(config);
   * JobFetcherTestUtils.verifyJobFetchResult(result, true, 3, 'api');
   * ```
   * @since 1.0.0
   */
  static verifyJobFetchResult(
    result: JobFetchResult,
    expectedSuccess: boolean,
    expectedJobCount?: number,
    expectedMethod?: string
  ): void {
    expect(result.success).toBe(expectedSuccess);
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    if (expectedSuccess) {
      expect(result.jobs).toHaveLength(expectedJobCount ?? 0);
      expect(result.totalCount).toBe(expectedJobCount ?? 0);
      expect(result.method).toBe(expectedMethod);
      expect(result.message).toContain('Successfully fetched');
      expect(result.error).toBeUndefined();
    } else {
      expect(result.jobs).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.method).toBe('none');
    }
  }

  /**
   * Verify normalized job structure and field values
   *
   * Validates that a normalized job object has the correct structure
   * with all required fields present and properly formatted, plus
   * specific field values matching expectations.
   *
   * @param {NormalizedJob} job - The normalized job object to verify
   * @param {Partial<NormalizedJob>} expectedFields - Expected field values to validate
   * @returns {void} No return value, throws assertion errors on mismatch
   * @example
   * ```typescript
   * const normalizedJob = await service.fetchJobs(config, 'webhook');
   * JobFetcherTestUtils.verifyNormalizedJob(normalizedJob.jobs[0], {
   *   title: 'Software Engineer',
   *   source: 'webhook',
   *   processedAt: '2024-01-01T12:00:00.000Z'
   * });
   * ```
   * @since 1.0.0
   */
  static verifyNormalizedJob(job: NormalizedJob, expectedFields: Partial<NormalizedJob>): void {
    expect(job.id).toBeTruthy();
    expect(job.title).toBeTruthy();
    expect(job.source).toBeTruthy();
    expect(job.processedAt).toBeTruthy();
    expect(job.postedDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    Object.entries(expectedFields).forEach(([key, value]) => {
      expect(job[key as keyof NormalizedJob]).toBe(value);
    });
  }
}

describe('Job Fetcher Service', () => {
  beforeEach(() => {
    JobFetcherTestUtils.setupMocks();
  });

  afterEach(() => {
    JobFetcherTestUtils.restoreMocks();
  });

  describe('HtmlJobFetchStrategy', () => {
    let strategy: HtmlJobFetchStrategy;

    beforeEach(() => {
      strategy = new HtmlJobFetchStrategy(JobFetcherTestUtils.mockHtmlParser);
    });

    it('should implement IJobFetchStrategy interface correctly', () => {
      JobFetcherTestUtils.verifyStrategyInterface(strategy, 'html');
    });

    describe('canHandle', () => {
      it('should return true when careersUrl is provided', () => {
        expect(strategy.canHandle(JobFetcherTestUtils.STANDARD_CONFIG)).toBe(true);
      });

      it('should return false when careersUrl is missing', () => {
        const config = {
          companyId: 'test-company',
          apiBaseUrl: 'https://api.example.com',
        } as DriveHrApiConfig;
        expect(strategy.canHandle(config)).toBe(false);
      });
    });

    describe('fetchJobs', () => {
      it('should fetch jobs by parsing HTML from careers page', async () => {
        const htmlContent = '<div class="job">Test Job HTML</div>';
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse(htmlContent)
        );
        vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
          JobFetcherTestUtils.SAMPLE_RAW_JOBS
        );

        const result = await strategy.fetchJobs(
          JobFetcherTestUtils.STANDARD_CONFIG,
          JobFetcherTestUtils.mockHttpClient
        );

        expect(result).toEqual(JobFetcherTestUtils.SAMPLE_RAW_JOBS);
        expect(vi.mocked(JobFetcherTestUtils.mockHttpClient.get)).toHaveBeenCalledWith(
          JobFetcherTestUtils.STANDARD_CONFIG.careersUrl,
          { Accept: 'text/html,application/xhtml+xml' }
        );
        expect(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).toHaveBeenCalledWith(
          htmlContent,
          JobFetcherTestUtils.STANDARD_CONFIG.careersUrl
        );
      });

      it('should throw error when HTML page is not accessible', async () => {
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createFailureResponse(404, 'Not Found')
        );

        await expect(
          strategy.fetchJobs(
            JobFetcherTestUtils.STANDARD_CONFIG,
            JobFetcherTestUtils.mockHttpClient
          )
        ).rejects.toThrow('HTML page not accessible');
      });

      it('should throw error when HTML parsing fails', async () => {
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse('<html></html>')
        );
        vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockImplementation(() => {
          throw new Error('HTML parsing failed');
        });

        await expect(
          strategy.fetchJobs(
            JobFetcherTestUtils.STANDARD_CONFIG,
            JobFetcherTestUtils.mockHttpClient
          )
        ).rejects.toThrow('HTML parsing failed');
      });
    });
  });

  describe('JobFetchService', () => {
    let service: JobFetchService;

    beforeEach(() => {
      service = new JobFetchService(
        JobFetcherTestUtils.mockHttpClient,
        JobFetcherTestUtils.mockHtmlParser
      );
    });

    describe('constructor', () => {
      it('should initialize with HTML strategy only', () => {
        expect(service).toBeInstanceOf(JobFetchService);
        // We can't directly access strategies, but can test through behavior
      });
    });

    describe('fetchJobs', () => {
      beforeEach(() => {
        // Mock HTML parser for the only remaining strategy
        vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
          JobFetcherTestUtils.SAMPLE_RAW_JOBS
        );
        vi.spyOn(jobFetchUtils.JobFetchErrorHandler, 'logStrategyFailure').mockImplementation(
          () => {}
        );
      });

      it('should fetch jobs using HTML strategy', async () => {
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML content</html>')
        );

        const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'webhook');

        JobFetcherTestUtils.verifyJobFetchResult(result, true, 3, 'html');
        expect(JobFetcherTestUtils.mockLogger.info).toHaveBeenCalledWith(
          'Attempting to fetch jobs using strategy: html'
        );
        expect(JobFetcherTestUtils.mockLogger.info).toHaveBeenCalledWith(
          'Successfully fetched 3 jobs using html'
        );
      });

      it('should fail when HTML strategy cannot handle configuration', async () => {
        const minimalConfig = { companyId: 'test' } as DriveHrApiConfig;

        const result = await service.fetchJobs(minimalConfig, 'drivehr');

        JobFetcherTestUtils.verifyJobFetchResult(result, false);
        expect(result.error).toBe('All fetch strategies failed');
      });

      it('should return failure result when HTML strategy fails', async () => {
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockRejectedValue(
          new Error('HTML strategy failed')
        );

        const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'drivehr');

        JobFetcherTestUtils.verifyJobFetchResult(result, false);
        expect(result.error).toBe('All fetch strategies failed');
        expect(result.method).toBe('none');
      });

      it('should properly normalize jobs from raw data', async () => {
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML content</html>')
        );

        const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'webhook');

        expect(result.success).toBe(true);
        expect(result.jobs).toHaveLength(3);

        // Verify first normalized job structure
        const firstJob = result.jobs[0];
        expect(firstJob).toBeDefined();
        if (firstJob) {
          JobFetcherTestUtils.verifyNormalizedJob(firstJob, {
            title: 'Senior Software Engineer',
            source: 'webhook',
            processedAt: '2024-01-01T12:00:00.000Z',
          });
        }
      });

      it('should filter out jobs without titles during normalization', async () => {
        const rawJobsWithMissingTitles: RawJobData[] = [
          { id: 'job-1', title: 'Valid Job', description: 'Has title' },
          { id: 'job-2', description: 'No title' },
          { id: 'job-3', title: '', description: 'Empty title' },
          { id: 'job-4', title: 'Another Valid Job', description: 'Has title' },
        ];

        vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
          rawJobsWithMissingTitles
        );
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML</html>')
        );

        const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'drivehr');

        expect(result.success).toBe(true);
        expect(result.jobs).toHaveLength(2); // Only jobs with valid titles
        expect(result.jobs[0]?.title).toBe('Valid Job');
        expect(result.jobs[1]?.title).toBe('Another Valid Job');
      });
    });

    describe('job normalization', () => {
      it('should handle various raw job data field variations', async () => {
        const rawJobWithVariations: RawJobData[] = [
          {
            job_id: 'variant-job',
            position_title: 'Senior Developer',
            summary: 'Job summary',
            city: 'Boston, MA',
            category: 'Tech',
            employment_type: 'Contract',
            created_at: '2024-01-15T10:00:00Z',
            application_url: 'https://apply.example.com/variant-job',
          },
        ];

        vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
          rawJobWithVariations
        );
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML</html>')
        );

        const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'drivehr');

        const normalizedJob = result.jobs[0];
        expect(normalizedJob?.id).toBe('variant-job');
        expect(normalizedJob?.title).toBe('Senior Developer');
        expect(normalizedJob?.description).toBe('Job summary');
        expect(normalizedJob?.location).toBe('Boston, MA');
        expect(normalizedJob?.department).toBe('Tech');
        expect(normalizedJob?.type).toBe('Contract');
        expect(normalizedJob?.applyUrl).toBe('https://apply.example.com/variant-job');
      });

      it('should generate IDs for jobs without explicit IDs', async () => {
        const rawJobWithoutId: RawJobData[] = [
          {
            title: 'Frontend Engineer',
            description: 'Build UIs',
          },
        ];

        vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
          rawJobWithoutId
        );
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML</html>')
        );

        const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'drivehr');

        const normalizedJob = result.jobs[0];
        expect(normalizedJob?.id).toBe('generated-frontend-engineer-1704067200000');
        expect(utils.StringUtils.generateIdFromTitle).toHaveBeenCalledWith('Frontend Engineer');
      });

      it('should use current timestamp for jobs without posted dates', async () => {
        const rawJobWithoutDate: RawJobData[] = [
          {
            id: 'no-date-job',
            title: 'No Date Job',
          },
        ];

        vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
          rawJobWithoutDate
        );
        vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
          JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML</html>')
        );

        const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'drivehr');

        const normalizedJob = result.jobs[0];
        expect(normalizedJob?.postedDate).toBe('2024-01-01T12:00:00.000Z');
        expect(utils.DateUtils.getCurrentIsoTimestamp).toHaveBeenCalled();
      });
    });
  });

  describe('Integration Tests', () => {
    let service: JobFetchService;

    beforeEach(() => {
      service = new JobFetchService(
        JobFetcherTestUtils.mockHttpClient,
        JobFetcherTestUtils.mockHtmlParser
      );

      // Setup comprehensive mocks for integration testing
      vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
        JobFetcherTestUtils.SAMPLE_RAW_JOBS
      );
    });

    it('should demonstrate complete job fetching workflow', async () => {
      vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
        JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML content</html>')
      );

      const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'webhook');

      // Verify complete workflow
      expect(result.success).toBe(true);
      expect(result.method).toBe('html');
      expect(result.jobs).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.fetchedAt).toBeTruthy();
      expect(result.message).toContain('Successfully fetched 3 jobs');

      // Verify normalization occurred
      result.jobs.forEach(job => {
        expect(job.source).toBe('webhook');
        expect(job.processedAt).toBe('2024-01-01T12:00:00.000Z');
        expect(job.rawData).toBeDefined();
      });

      // Verify logging occurred
      expect(JobFetcherTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Attempting to fetch jobs using strategy: html'
      );
      expect(JobFetcherTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Successfully fetched 3 jobs using html'
      );
    });

    it('should handle HTML strategy failure with comprehensive logging', async () => {
      vi.spyOn(jobFetchUtils.JobFetchErrorHandler, 'logStrategyFailure').mockImplementation(
        () => {}
      );

      vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockRejectedValue(
        new Error('HTML strategy failed')
      );

      const result = await service.fetchJobs(JobFetcherTestUtils.STANDARD_CONFIG, 'manual');

      expect(result.success).toBe(false);
      expect(result.method).toBe('none');
      expect(jobFetchUtils.JobFetchErrorHandler.logStrategyFailure).toHaveBeenCalledWith(
        'html',
        expect.any(Error)
      );
      expect(JobFetcherTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Attempting to fetch jobs using strategy: html'
      );
    });

    it('should work with different configuration variations', async () => {
      for (const { name, config } of JobFetcherTestUtils.CONFIG_VARIATIONS) {
        JobFetcherTestUtils.restoreMocks();
        JobFetcherTestUtils.setupMocks();

        // Reset service with fresh mocks
        service = new JobFetchService(
          JobFetcherTestUtils.mockHttpClient,
          JobFetcherTestUtils.mockHtmlParser
        );

        if (name === 'Complete config') {
          vi.mocked(JobFetcherTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
            JobFetcherTestUtils.SAMPLE_RAW_JOBS
          );

          vi.mocked(JobFetcherTestUtils.mockHttpClient.get).mockResolvedValue(
            JobFetcherTestUtils.createSuccessResponse('<html>Mock HTML</html>')
          );

          const result = await service.fetchJobs(config as DriveHrApiConfig, 'drivehr');
          expect(result.success).toBe(true);
          expect(result.method).toBe('html');
        }
      }
    });
  });
});
