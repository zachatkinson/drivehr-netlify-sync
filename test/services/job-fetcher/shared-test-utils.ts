/**
 * Shared test utilities for job fetcher module
 *
 * Common test utilities and mocks shared across all job fetcher test files.
 * Implements DRY principles by centralizing mock creation, test data generation,
 * and common assertion patterns used throughout the job fetcher test suite.
 *
 * @module job-fetcher-shared-test-utils
 * @since 1.0.0
 * @see {@link ../../shared/base-test-utils.ts} for base utilities
 */

import { vi, expect } from 'vitest';
import type { IHttpClient, HttpResponse } from '../../../src/lib/http-client.js';
import type { IHtmlParser, IJobFetchStrategy } from '../../../src/services/job-fetcher/types.js';
import type { DriveHrApiConfig } from '../../../src/types/api.js';
import type { RawJobData, NormalizedJob, JobFetchResult } from '../../../src/types/job.js';
import { BaseTestUtils } from '../../shared/base-test-utils.js';

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
export class JobFetcherTestUtils extends BaseTestUtils {
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
        careersUrl: '', // Empty to test HTML strategy rejection
      } as DriveHrApiConfig,
    },
    {
      name: 'JSON only config',
      config: {
        companyId: 'json-only',
        apiBaseUrl: 'https://json-only.com',
        careersUrl: '', // Empty to test HTML strategy rejection
        jsonUrl: 'https://json-only.com/jobs.json',
      } as DriveHrApiConfig,
    },
    {
      name: 'HTML only config',
      config: {
        companyId: 'html-only',
        careersUrl: 'https://html-only.com/careers',
      } as DriveHrApiConfig,
    },
    {
      name: 'Complete config',
      config: {
        companyId: 'complete',
        apiBaseUrl: 'https://api.complete.com',
        jsonUrl: 'https://complete.com/jobs.json',
        careersUrl: 'https://complete.com/careers',
        timeout: 60000,
        retries: 5,
      } as DriveHrApiConfig,
    },
  ] as const;

  /**
   * Generate mock raw job data for testing
   *
   * @param overrides - Optional overrides for specific fields
   * @returns Mock raw job data object
   * @since 1.0.0
   */
  static createMockRawJob(overrides: Partial<RawJobData> = {}): RawJobData {
    return {
      id: 'test-job-1',
      title: 'Software Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'Join our engineering team to build amazing products.',
      posted_date: '2024-01-15T10:00:00Z',
      apply_url: 'https://drivehris.app/careers/test-company/apply/test-job-1',
      ...overrides,
    };
  }

  /**
   * Generate array of mock raw jobs for testing
   *
   * @param count - Number of jobs to generate
   * @param baseOverrides - Base overrides applied to all jobs
   * @returns Array of mock raw job data
   * @since 1.0.0
   */
  static createMockRawJobs(count: number, baseOverrides: Partial<RawJobData> = {}): RawJobData[] {
    return Array.from({ length: count }, (_, index) =>
      this.createMockRawJob({
        ...baseOverrides,
        id: `test-job-${index + 1}`,
        title: `Software Engineer ${index + 1}`,
      })
    );
  }

  /**
   * Generate mock normalized job data for testing
   *
   * @param overrides - Optional overrides for specific fields
   * @returns Mock normalized job data object
   * @since 1.0.0
   */
  static createMockNormalizedJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
    return {
      id: 'test-job-1',
      title: 'Software Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'Join our engineering team to build amazing products.',
      postedDate: '2024-01-15T10:00:00Z',
      applyUrl: 'https://drivehris.app/careers/test-company/apply/test-job-1',
      source: 'drivehr',
      rawData: {} as RawJobData,
      processedAt: '2024-01-15T10:01:00Z',
      ...overrides,
    };
  }

  /**
   * Create successful HTTP response mock
   *
   * @param data - Response data
   * @returns Mock HTTP response
   * @since 1.0.0
   */
  static createSuccessResponse<T>(data: T): HttpResponse<T> {
    return {
      success: true,
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
    };
  }

  /**
   * Create failed HTTP response mock
   *
   * @param error - Error message or object
   * @param status - HTTP status code
   * @returns Mock HTTP response
   * @since 1.0.0
   */
  static createErrorResponse(error: string | Error, status = 500): HttpResponse<unknown> {
    return {
      success: false,
      data: null,
      status,
      statusText: 'Internal Server Error',
      headers: {},
    };
  }

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
      rawData: {} as RawJobData,
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
      rawData: {} as RawJobData,
      processedAt: '2024-01-01T12:00:00.000Z',
    },
  ];

  /**
   * Reset all mocks before each test
   *
   * @since 1.0.0
   */
  static resetMocks(): void {
    vi.clearAllMocks();
  }

  /**
   * Create failed HTTP response mock
   *
   * @param status - HTTP status code
   * @param statusText - Status text message
   * @returns Mock HTTP response
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
   * Verify strategy interface implementation
   *
   * @param strategy - Strategy to verify
   * @param expectedName - Expected strategy name
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
   * @param result - Result to verify
   * @param expectedSuccess - Expected success status
   * @param expectedJobCount - Expected job count
   * @param expectedMethod - Expected fetch method
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
      if (expectedMethod) {
        expect(result.method).toBe(expectedMethod);
      }
    } else {
      expect(result.error).toBeDefined();
    }
  }

  /**
   * Setup common mocks with default behavior
   *
   * @since 1.0.0
   */
  static setupDefaultMocks(): void {
    vi.mocked(this.mockHttpClient.get).mockResolvedValue(
      this.createSuccessResponse('<html><div class="job-listing">Test Job</div></html>')
    );
    vi.mocked(this.mockHtmlParser.parseJobsFromHtml).mockReturnValue([this.createMockRawJob()]);
  }
}
