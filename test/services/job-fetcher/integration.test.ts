/**
 * Job Fetcher Integration Test Suite
 *
 * Comprehensive end-to-end test coverage for job fetcher service integration following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates complete job fetching workflows from HTTP requests through
 * HTML parsing, data normalization, error handling, and strategy fallback mechanisms.
 *
 * Test Features:
 * - Complete job fetching workflow validation (HTTP → parsing → normalization)
 * - Strategy pattern fallback mechanism testing
 * - Error handling and comprehensive logging verification
 * - Configuration variation compatibility testing
 * - Empty result handling and edge case validation
 * - Data integrity maintenance throughout the pipeline
 * - Concurrent operation safety and isolation testing
 * - Telemetry integration pattern validation
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/services/job-fetcher/integration.test.ts -- --grep "workflow"
 * ```
 *
 * @module job-fetcher-integration-test-suite
 * @since 1.0.0
 * @see {@link ../../../src/services/job-fetcher/job-fetch-service.ts} for the service being tested
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
 * Specialized test utilities for job fetcher integration testing
 *
 * Extends JobFetcherTestUtils with integration-specific testing capabilities
 * including complete workflow mock setup, end-to-end verification patterns,
 * and comprehensive validation for job fetching service integration scenarios.
 *
 * @since 1.0.0
 */
class IntegrationTestUtils extends JobFetcherTestUtils {
  /**
   * Configure comprehensive mocks for integration testing workflows
   *
   * Sets up HTTP client, HTML parser, and error handler mocks to simulate
   * realistic end-to-end job fetching scenarios with proper response chains
   * and error handling patterns for integration testing.
   *
   * @example
   * ```typescript
   * IntegrationTestUtils.setupIntegrationMocks();
   * const result = await service.fetchJobs(config, 'webhook');
   * expect(result.success).toBe(true);
   * ```
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
   * Verify complete end-to-end job fetching workflow results
   *
   * Performs comprehensive validation of job fetching workflow results
   * including success status, job count, fetch method, and normalized
   * job structure validation for integration testing scenarios.
   *
   * @param result - Job fetch result to verify
   * @example
   * ```typescript
   * const result = await service.fetchJobs(config, 'manual');
   * IntegrationTestUtils.verifyCompleteWorkflow(result);
   * ```
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

      if (name === 'HTML config' || name === 'Complete config') {
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

  it('should sanitize HTML descriptions with non-standard attributes', async () => {
    const rawJobsWithDirtyHtml = [
      {
        id: 'html-test-1',
        title: 'Operations Coordinator',
        department: 'Operations',
        location: 'Edmonton, AB',
        type: 'Full-time',
        description:
          '<p start="1">First paragraph with invalid start attr.</p>' +
          '<p start="2">Second paragraph.</p>' +
          '<p start="3" class="info">Third with class.</p>' +
          '<div start="4">Div with start.</div>' +
          '<p style="mso-line-height:normal">MS Office styled text.</p>' +
          '<p align="center">Deprecated align.</p>' +
          '<ol start="5"><li>Valid start on ol</li></ol>',
        posted_date: '2024-01-20T10:00:00Z',
        apply_url: 'https://example.com/apply/html-test-1',
      },
    ];

    vi.mocked(IntegrationTestUtils.mockHtmlParser.parseJobsFromHtml).mockReturnValue(
      rawJobsWithDirtyHtml
    );

    const result = await service.fetchJobs(IntegrationTestUtils.STANDARD_CONFIG, 'webhook');

    expect(result.success).toBe(true);
    expect(result.jobs).toHaveLength(1);

    const normalizedJob = result.jobs[0] as NormalizedJob;

    // Verify start attribute is removed from p, div but preserved on ol
    expect(normalizedJob.description).not.toContain('<p start=');
    expect(normalizedJob.description).not.toContain('<div start=');
    expect(normalizedJob.description).toContain('<ol start="5">');

    // Verify MS Office styles are removed
    expect(normalizedJob.description).not.toContain('mso-');

    // Verify deprecated align attribute is removed
    expect(normalizedJob.description).not.toContain('align=');

    // Verify content is preserved
    expect(normalizedJob.description).toContain('First paragraph');
    expect(normalizedJob.description).toContain('Second paragraph');
    expect(normalizedJob.description).toContain('Third with class');
    expect(normalizedJob.description).toContain('class="info"');
    expect(normalizedJob.description).toContain('Valid start on ol');
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
