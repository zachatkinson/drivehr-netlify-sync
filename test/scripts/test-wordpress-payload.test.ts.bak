/**
 * WordPress Payload Testing Tool Test Suite
 *
 * Comprehensive test coverage for the WordPress payload testing tool following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * Tests business logic directly instead of CLI execution for better reliability.
 *
 * Test Features:
 * - Business logic testing for payload generation
 * - Mock job data creation and validation
 * - Payload structure and signature validation
 * - Error handling and edge cases
 * - Utility function testing
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/scripts/test-wordpress-payload.test.ts -- --grep "payload generation"
 * ```
 *
 * @module test-wordpress-payload-test-suite
 * @since 1.0.0
 * @see {@link ../../scripts/test-wordpress-payload.mts} for the tool being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import type { NormalizedJob, JobSyncRequest } from '../../src/types/job.js';

// Mock the script's dependencies
vi.mock('../../src/lib/env.js', () => ({
  getEnvironmentConfig: vi.fn(() => ({
    driveHrCompanyId: 'test-company-123',
    wpApiUrl: 'https://mock-wordpress-site.example.com',
    webhookSecret: 'mock-webhook-secret-for-ci-testing-12345',
    environment: 'test' as const,
    logLevel: 'info' as const,
  })),
}));

vi.mock('../../src/lib/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  setLogger: vi.fn(),
}));

vi.mock('../../src/services/playwright-scraper.js', () => ({
  PlaywrightScraper: vi.fn().mockImplementation(() => ({
    scrapeJobs: vi.fn().mockResolvedValue({
      success: true,
      jobs: [],
      method: 'api' as const,
      fetchedAt: new Date().toISOString(),
      totalCount: 0,
    }),
    dispose: vi.fn(),
  })),
}));

/**
 * WordPress payload testing utilities
 *
 * Extends BaseTestUtils with WordPress payload testing specific methods.
 * Maintains DRY principles while providing specialized testing functionality.
 *
 * @since 1.0.0
 */
class WordPressPayloadTestUtils extends BaseTestUtils {
  /**
   * Create mock normalized job for testing
   *
   * Generates a realistic normalized job object for use in payload testing.
   * Includes all required fields with sensible defaults.
   *
   * @param id - Job ID (defaults to generated ID)
   * @param title - Job title (defaults to 'Test Job')
   * @returns Mock normalized job object
   * @example
   * ```typescript
   * const job = WordPressPayloadTestUtils.createMockJob('job-001', 'Senior Engineer');
   * expect(job.id).toBe('job-001');
   * expect(job.title).toBe('Senior Engineer');
   * ```
   * @since 1.0.0
   */
  static createMockJob(
    id: string = `test-job-${Date.now()}`,
    title: string = 'Test Job'
  ): NormalizedJob {
    return {
      id,
      title,
      department: 'Engineering',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'Test job description for testing purposes.',
      postedDate: '2024-01-15T10:00:00.000Z',
      applyUrl: `https://drivehris.app/careers/test-company/apply/${id}`,
      source: 'webhook',
      rawData: {},
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Create multiple mock jobs with unique IDs
   *
   * Generates an array of mock jobs with different titles and unique IDs.
   * Useful for testing scenarios that require multiple job entries.
   *
   * @param count - Number of jobs to create
   * @returns Array of mock normalized jobs
   * @example
   * ```typescript
   * const jobs = WordPressPayloadTestUtils.createMultipleMockJobs(3);
   * expect(jobs).toHaveLength(3);
   * expect(new Set(jobs.map(j => j.id)).size).toBe(3); // All unique IDs
   * ```
   * @since 1.0.0
   */
  static createMultipleMockJobs(count: number): NormalizedJob[] {
    const titles = [
      'Senior Software Engineer',
      'Product Manager',
      'UX Designer',
      'Data Scientist',
      'Marketing Specialist',
    ];

    return Array.from({ length: count }, (_, i) =>
      this.createMockJob(`test-job-${i + 1}`, titles[i % titles.length])
    );
  }

  /**
   * Validate payload structure
   *
   * Validates that a job sync request has the correct structure and required fields.
   * Ensures payload meets WordPress webhook expectations.
   *
   * @param payload - Job sync request to validate
   * @returns True if payload is valid
   * @example
   * ```typescript
   * const payload = { source: 'webhook', jobs: [mockJob], timestamp: '...', requestId: '...' };
   * expect(WordPressPayloadTestUtils.validatePayloadStructure(payload)).toBe(true);
   * ```
   * @since 1.0.0
   */
  static validatePayloadStructure(payload: unknown): payload is JobSyncRequest {
    if (!payload || typeof payload !== 'object') return false;

    const p = payload as Record<string, unknown>;
    return (
      typeof p['source'] === 'string' &&
      Array.isArray(p['jobs']) &&
      typeof p['timestamp'] === 'string' &&
      typeof p['requestId'] === 'string'
    );
  }

  /**
   * Create temporary file path for testing
   *
   * Generates a unique temporary file path for file I/O testing.
   * Files created with this path should be cleaned up after tests.
   *
   * @returns Temporary file path
   * @example
   * ```typescript
   * const tempFile = WordPressPayloadTestUtils.createTempFilePath();
   * // Use tempFile for testing, clean up afterward
   * ```
   * @since 1.0.0
   */
  static createTempFilePath(): string {
    return `temp-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
  }
}

// Import the class we want to test
// We'll import it dynamically to avoid module loading issues with mocks
let WordPressPayloadTester: typeof import('../../scripts/test-wordpress-payload.mts').WordPressPayloadTester;

describe('WordPress Payload Testing Tool', () => {
  let tempFiles: string[] = [];

  beforeEach(async () => {
    tempFiles = [];
    vi.clearAllMocks();

    // Dynamically import the class after mocks are set up
    const module = await import('../../scripts/test-wordpress-payload.mts');
    WordPressPayloadTester = module.WordPressPayloadTester;
  });

  afterEach(async () => {
    // Clean up temporary files
    await Promise.all(
      tempFiles.map(async file => {
        if (existsSync(file)) {
          await unlink(file);
        }
      })
    );
  });

  describe('when generating test data', () => {
    it('should generate consistent mock job data', async () => {
      const tester = new WordPressPayloadTester();

      // Test the generateTestJobs method directly
      const jobs1 = tester.generateTestJobs();
      const jobs2 = tester.generateTestJobs();

      expect(jobs1).toHaveLength(3);
      expect(jobs2).toHaveLength(3);

      // Jobs should have consistent structure but different timestamps
      expect(jobs1[0]?.title).toBe(jobs2[0]?.title);
      expect(jobs1[0]?.id).toBe(jobs2[0]?.id);
      expect(jobs1[0]?.title).toBe('Senior Software Engineer');
      expect(jobs1[1]?.title).toBe('Product Manager');
      expect(jobs1[2]?.title).toBe('UX Designer');
    });

    it('should fetch test data when useTestData is true', async () => {
      const tester = new WordPressPayloadTester();

      const jobs = await tester.fetchJobData('test-company', true);

      expect(jobs).toHaveLength(3);
      expect(jobs[0]?.title).toBe('Senior Software Engineer');
      expect(jobs[1]?.title).toBe('Product Manager');
      expect(jobs[2]?.title).toBe('UX Designer');
    });
  });

  describe('when generating WordPress payloads', () => {
    it('should generate valid payload structure with test data', async () => {
      const tester = new WordPressPayloadTester();
      const jobs = await tester.fetchJobData('test-company', true);

      const result = await tester.generatePayload(jobs, 'test-company', 'test-secret');

      expect(result).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.headers).toBeDefined();
      expect(result.metadata).toBeDefined();

      expect(WordPressPayloadTestUtils.validatePayloadStructure(result.payload)).toBe(true);
      expect(result.payload.jobs).toHaveLength(3);
      expect(result.payload.source).toBe('webhook');
      expect(result.metadata.jobCount).toBe(3);
    });

    it('should include proper HMAC signature in headers', async () => {
      const tester = new WordPressPayloadTester();
      const jobs = await tester.fetchJobData('test-company', true);

      const result = await tester.generatePayload(jobs, 'test-company', 'test-secret');

      expect(result.headers['X-Webhook-Signature']).toMatch(/^sha256=/);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['User-Agent']).toBe('DriveHR-Sync-PayloadTester/1.0');
    });

    it('should generate different request IDs for each execution', async () => {
      const tester = new WordPressPayloadTester();
      const jobs = await tester.fetchJobData('test-company', true);

      const result1 = await tester.generatePayload(jobs, 'test-company', 'test-secret');
      const result2 = await tester.generatePayload(jobs, 'test-company', 'test-secret');

      expect(result1.payload.requestId).not.toBe(result2.payload.requestId);
      expect(result1.headers['X-Request-ID']).not.toBe(result2.headers['X-Request-ID']);
    });
  });

  describe('when saving payloads to files', () => {
    it('should save valid JSON payload to specified file', async () => {
      const tester = new WordPressPayloadTester();
      const jobs = await tester.fetchJobData('test-company', true);
      const result = await tester.generatePayload(jobs, 'test-company', 'test-secret');

      const tempFile = WordPressPayloadTestUtils.createTempFilePath();
      tempFiles.push(tempFile);

      await tester.savePayloadToFile(result, tempFile);

      expect(existsSync(tempFile)).toBe(true);
      const savedContent = await readFile(tempFile, 'utf-8');
      const parsed = JSON.parse(savedContent);

      expect(WordPressPayloadTestUtils.validatePayloadStructure(parsed.payload)).toBe(true);
      expect(parsed.headers).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    it('should include comprehensive metadata in saved files', async () => {
      const tester = new WordPressPayloadTester();
      const jobs = await tester.fetchJobData('test-company', true);
      const result = await tester.generatePayload(jobs, 'test-company', 'test-secret');

      const tempFile = WordPressPayloadTestUtils.createTempFilePath();
      tempFiles.push(tempFile);

      await tester.savePayloadToFile(result, tempFile);

      const savedContent = await readFile(tempFile, 'utf-8');
      const parsed = JSON.parse(savedContent);

      expect(parsed.metadata.jobCount).toBe(3);
      expect(parsed.metadata.companyId).toBe('test-company');
      expect(parsed.metadata.source).toBe('webhook');
      expect(typeof parsed.metadata.payloadSize).toBe('number');
      expect(typeof parsed.metadata.generatedAt).toBe('string');
    });
  });

  describe('utility functions', () => {
    it('should create valid mock jobs with proper structure', () => {
      const job = WordPressPayloadTestUtils.createMockJob('test-001', 'Test Engineer');

      expect(job.id).toBe('test-001');
      expect(job.title).toBe('Test Engineer');
      expect(job.department).toBe('Engineering');
      expect(job.type).toBe('Full-time');
      expect(job.source).toBe('webhook');
      expect(typeof job.processedAt).toBe('string');
    });

    it('should create multiple mock jobs with unique IDs', () => {
      const jobs = WordPressPayloadTestUtils.createMultipleMockJobs(5);

      expect(jobs).toHaveLength(5);
      const ids = jobs.map(job => job.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5); // All IDs should be unique
    });

    it('should validate valid payload structures correctly', () => {
      const validPayload: JobSyncRequest = {
        source: 'webhook',
        jobs: [],
        timestamp: new Date().toISOString(),
        requestId: 'test-request-123',
      };

      expect(WordPressPayloadTestUtils.validatePayloadStructure(validPayload)).toBe(true);
    });

    it('should reject invalid payload structures', () => {
      const invalidPayloads = [
        null,
        undefined,
        {},
        { source: 'webhook' }, // missing required fields
        { source: 123, jobs: [], timestamp: '', requestId: '' }, // wrong types
      ];

      invalidPayloads.forEach(payload => {
        expect(WordPressPayloadTestUtils.validatePayloadStructure(payload)).toBe(false);
      });
    });
  });
});
