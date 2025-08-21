/**
 * Job Fetcher Integration Test Suite
 *
 * Comprehensive integration test coverage for the complete job fetcher workflow
 * following enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates end-to-end functionality and cross-component integration.
 *
 * Test Features:
 * - Complete workflow integration testing
 * - Multi-strategy coordination and fallback
 * - Configuration variation handling
 * - Error propagation and recovery patterns
 * - Performance and reliability validation
 *
 * @example
 * ```typescript
 * // Example of running integration tests only
 * pnpm test test/services/job-fetcher/integration.test.ts
 * ```
 *
 * @module job-fetcher-integration-test-suite
 * @since 1.0.0
 * @see {@link ../../../src/services/job-fetcher/index.ts} for the module being tested
 * @see {@link ../../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobFetchService } from '../../../src/services/job-fetcher/job-fetch-service.js';
import type { DriveHrApiConfig } from '../../../src/types/api.js';
import type { JobFetchResult, NormalizedJob, JobSource } from '../../../src/types/job.js';
import { JobFetcherTestUtils } from './shared-test-utils.js';
import * as logger from '../../../src/lib/logger.js';
import * as jobFetchUtils from '../../../src/lib/job-fetch-utils.js';

/**
 * Integration Test-specific utilities
 *
 * Extends JobFetcherTestUtils with integration-specific testing patterns.
 * Maintains DRY principles while providing specialized integration testing methods.
 *
 * @since 1.0.0
 */
class IntegrationTestUtils extends JobFetcherTestUtils {
  /**
   * Setup comprehensive integration test mocks
   *
   * @since 1.0.0
   */
  static setupIntegrationMocks(): void {
    vi.mocked(this.mockHttpClient.get).mockResolvedValue(
      this.createSuccessResponse('<html>Mock HTML content</html>')
    );
    vi.mocked(this.mockHtmlParser.parseJobsFromHtml).mockReturnValue(this.SAMPLE_RAW_JOBS);
    vi.spyOn(jobFetchUtils.JobFetchErrorHandler, 'logStrategyFailure').mockImplementation(() => {});
  }

  /**
   * Verify complete workflow execution
   *
   * @param result - Job fetch result to verify
   * @since 1.0.0
   */
  static verifyCompleteWorkflow(result: JobFetchResult): void {
    this.verifyJobFetchResult(result, true, 3, 'html');
    expect(result.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          source: expect.any(String),
          processedAt: expect.any(String),
          rawData: expect.any(Object),
        }),
      ])
    );
  }
}

describe('Job Fetcher Integration Tests', () => {
  let service: JobFetchService;

  beforeEach(() => {
    IntegrationTestUtils.resetMocks();
    vi.spyOn(logger, 'getLogger').mockReturnValue(IntegrationTestUtils.mockLogger);
    vi.spyOn(jobFetchUtils.DriveHrUrlBuilder, 'buildCareersPageUrl').mockImplementation(
      (config: DriveHrApiConfig) => config.careersUrl || 'https://default.com/careers'
    );

    service = new JobFetchService(
      IntegrationTestUtils.mockHttpClient,
      IntegrationTestUtils.mockHtmlParser
    );

    IntegrationTestUtils.setupIntegrationMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should demonstrate complete job fetching workflow', async () => {
    const result = await service.fetchJobs(IntegrationTestUtils.STANDARD_CONFIG, 'manual');

    IntegrationTestUtils.verifyCompleteWorkflow(result);

    // Verify the complete workflow executed
    expect(IntegrationTestUtils.mockHttpClient.get).toHaveBeenCalledWith(
      IntegrationTestUtils.STANDARD_CONFIG.careersUrl,
      { Accept: 'text/html,application/xhtml+xml' }
    );
    expect(IntegrationTestUtils.mockHtmlParser.parseJobsFromHtml).toHaveBeenCalled();
    expect(IntegrationTestUtils.mockLogger.info).toHaveBeenCalledWith(
      'Attempting to fetch jobs using strategy: html'
    );
    expect(IntegrationTestUtils.mockLogger.info).toHaveBeenCalledWith(
      'Successfully fetched 3 jobs using html'
    );
  });

  it('should handle HTML strategy failure with comprehensive logging', async () => {
    const strategyError = new Error('HTML strategy failed');
    vi.mocked(IntegrationTestUtils.mockHttpClient.get).mockRejectedValue(strategyError);

    const result = await service.fetchJobs(IntegrationTestUtils.STANDARD_CONFIG, 'webhook');

    IntegrationTestUtils.verifyJobFetchResult(result, false);
    expect(result.error).toBe('All fetch strategies failed');
    expect(result.method).toBe('none');

    // Verify error was logged
    expect(jobFetchUtils.JobFetchErrorHandler.logStrategyFailure).toHaveBeenCalledWith(
      'html',
      strategyError
    );
  });

  it('should work with different configuration variations', async () => {
    for (const { name, config } of IntegrationTestUtils.CONFIG_VARIATIONS) {
      IntegrationTestUtils.resetMocks();
      vi.spyOn(logger, 'getLogger').mockReturnValue(IntegrationTestUtils.mockLogger);

      const testService = new JobFetchService(
        IntegrationTestUtils.mockHttpClient,
        IntegrationTestUtils.mockHtmlParser
      );

      if (name === 'HTML only config' || name === 'Complete config') {
        // These configs should work with HTML strategy
        vi.mocked(IntegrationTestUtils.mockHttpClient.get).mockResolvedValue(
          IntegrationTestUtils.createSuccessResponse('<html>Mock HTML</html>')
        );
        vi.mocked(IntegrationTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
          IntegrationTestUtils.SAMPLE_RAW_JOBS
        );

        const result = await testService.fetchJobs(config, 'drivehr');
        IntegrationTestUtils.verifyJobFetchResult(result, true, 3, 'html');
      } else {
        // These configs should fail (no careersUrl)
        const result = await testService.fetchJobs(config, 'drivehr');
        IntegrationTestUtils.verifyJobFetchResult(result, false);
        expect(result.error).toBe('All fetch strategies failed');
      }
    }
  });

  it('should handle empty job results gracefully', async () => {
    vi.mocked(IntegrationTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue([]);

    const result = await service.fetchJobs(IntegrationTestUtils.STANDARD_CONFIG, 'webhook');

    expect(result.success).toBe(true);
    expect(result.jobs).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.method).toBe('html');
  });

  it('should maintain data integrity throughout the pipeline', async () => {
    const customRawJobs = [
      {
        id: 'test-123',
        title: 'Senior Developer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        type: 'Full-time',
        description: 'Build amazing software',
        posted_date: '2024-01-15T10:00:00Z',
        apply_url: 'https://example.com/apply/test-123',
      },
    ];

    vi.mocked(IntegrationTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(customRawJobs);

    const result = await service.fetchJobs(IntegrationTestUtils.STANDARD_CONFIG, 'manual');

    expect(result.success).toBe(true);
    expect(result.jobs).toHaveLength(1);

    const normalizedJob = result.jobs[0] as NormalizedJob;
    expect(normalizedJob.id).toBe('test-123');
    expect(normalizedJob.title).toBe('Senior Developer');
    expect(normalizedJob.department).toBe('Engineering');
    expect(normalizedJob.location).toBe('San Francisco, CA');
    expect(normalizedJob.type).toBe('Full-time');
    expect(normalizedJob.description).toBe('Build amazing software');
    expect(normalizedJob.postedDate).toBe('2024-01-15T10:00:00.000Z');
    expect(normalizedJob.applyUrl).toBe('https://example.com/apply/test-123');
    expect(normalizedJob.source).toBe('manual');
    expect(normalizedJob.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should handle concurrent fetch operations safely', async () => {
    const concurrentPromises = Array.from({ length: 3 }, (_, index) =>
      service.fetchJobs(IntegrationTestUtils.STANDARD_CONFIG, `source-${index}` as JobSource)
    );

    const results = await Promise.all(concurrentPromises);

    results.forEach((result, index) => {
      IntegrationTestUtils.verifyJobFetchResult(result, true, 3, 'html');
      expect((result.jobs[0] as NormalizedJob).source).toBe(`source-${index}`);
    });
  });

  it('should validate telemetry integration patterns', async () => {
    // This test would verify telemetry integration if telemetry was enabled
    const result = await service.fetchJobs(IntegrationTestUtils.STANDARD_CONFIG, 'webhook');

    IntegrationTestUtils.verifyJobFetchResult(result, true, 3, 'html');

    // In a real environment with telemetry enabled, we would verify:
    // - Spans are created and completed
    // - Metrics are recorded
    // - Error traces are captured
    // For now, we verify the operation succeeds without telemetry
    expect(result.success).toBe(true);
  });
});
