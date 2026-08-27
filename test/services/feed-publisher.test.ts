/**
 * Job Feed Publisher Service Test Suite
 *
 * Comprehensive test coverage for the signed job feed publisher following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates feed file generation, HMAC-SHA256 signature
 * correctness (verified with real cryptography, not mocks), payload
 * structure parity with the WordPress sync engine, and error handling.
 *
 * Test Features:
 * - Real-filesystem feed and signature file generation in isolated temp dirs
 * - Round-trip HMAC-SHA256 signature verification with real crypto
 * - Payload structure validation for WordPress sync engine compatibility
 * - Error handling for unwritable output locations
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/services/feed-publisher.test.ts -- --grep "signature"
 * ```
 *
 * @module feed-publisher-test-suite
 * @since 1.10.0
 * @see {@link ../../src/services/feed-publisher.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHmac } from 'crypto';
import {
  JobFeedPublisher,
  FEED_FILENAME,
  FEED_SIGNATURE_FILENAME,
  type JobFeedPayload,
} from '../../src/services/feed-publisher.js';
import type { NormalizedJob } from '../../src/types/job.js';

/**
 * Feed publisher test utilities
 *
 * Extends enterprise testing patterns with feed-publisher-specific helpers
 * for temp directory management, fixture jobs, and signature verification.
 * Maintains DRY principles while providing specialized testing methods.
 *
 * @since 1.10.0
 */
class FeedPublisherTestUtils {
  /**
   * Shared secret used for signing in tests
   *
   * @since 1.10.0
   */
  static readonly TEST_SECRET = 'test-secret-key-at-least-32-characters-long';

  /**
   * Create realistic normalized job fixtures
   *
   * Produces job data mirroring production DriveHR scrape output so
   * payload assertions exercise realistic field shapes.
   *
   * @returns Array of normalized job fixtures
   * @example
   * ```typescript
   * const jobs = FeedPublisherTestUtils.createJobs();
   * expect(jobs).toHaveLength(2);
   * ```
   * @since 1.10.0
   */
  static createJobs(): NormalizedJob[] {
    return [
      {
        id: 'job-1',
        title: 'Software Engineer',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-time',
        description: 'Build great software.',
        postedDate: '2024-01-15T00:00:00.000Z',
        applyUrl: 'https://example.com/apply/job-1',
        source: 'github-actions',
        processedAt: '2024-01-15T12:00:00.000Z',
        rawData: { id: 'job-1', title: 'Software Engineer' },
      },
      {
        id: 'job-2',
        title: 'Product Manager',
        department: 'Product',
        location: 'San Francisco',
        type: 'Full-time',
        description: 'Manage great products.',
        postedDate: '2024-01-16T00:00:00.000Z',
        applyUrl: 'https://example.com/apply/job-2',
        source: 'github-actions',
        processedAt: '2024-01-15T12:00:00.000Z',
        rawData: { id: 'job-2', title: 'Product Manager' },
      },
    ] as NormalizedJob[];
  }

  /**
   * Verify a detached feed signature the way the WordPress consumer does
   *
   * Recomputes the HMAC-SHA256 over the exact feed bytes and compares it
   * with the signature file content, mirroring the verification in
   * class-feed-sync.php.
   *
   * @param feedContent - Exact feed file content
   * @param signature - Content of the signature file
   * @param secret - Shared secret used for signing
   * @returns True when the signature is valid for the content
   * @example
   * ```typescript
   * const valid = FeedPublisherTestUtils.verifySignature(feed, sig, secret);
   * expect(valid).toBe(true);
   * ```
   * @since 1.10.0
   */
  static verifySignature(feedContent: string, signature: string, secret: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(feedContent).digest('hex')}`;
    return expected === signature.trim();
  }
}

describe('JobFeedPublisher', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'feed-publisher-test-'));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  describe('when publishing a feed with jobs', () => {
    it('should write feed and signature files with correct payload structure', async () => {
      const publisher = new JobFeedPublisher(outputDir, FeedPublisherTestUtils.TEST_SECRET);
      const jobs = FeedPublisherTestUtils.createJobs();

      const result = await publisher.publish(jobs, 'github-actions');

      expect(result.success).toBe(true);
      expect(result.jobsPublished).toBe(2);

      const feedContent = await readFile(join(outputDir, FEED_FILENAME), 'utf-8');
      const payload = JSON.parse(feedContent) as JobFeedPayload;

      expect(payload.source).toBe('github-actions');
      expect(payload.total_count).toBe(2);
      expect(payload.jobs).toHaveLength(2);
      expect(payload.jobs[0]?.id).toBe('job-1');
      expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
    });

    it('should produce a signature that verifies against the exact feed bytes', async () => {
      const publisher = new JobFeedPublisher(outputDir, FeedPublisherTestUtils.TEST_SECRET);

      await publisher.publish(FeedPublisherTestUtils.createJobs());

      const feedContent = await readFile(join(outputDir, FEED_FILENAME), 'utf-8');
      const signature = await readFile(join(outputDir, FEED_SIGNATURE_FILENAME), 'utf-8');

      expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(
        FeedPublisherTestUtils.verifySignature(
          feedContent,
          signature,
          FeedPublisherTestUtils.TEST_SECRET
        )
      ).toBe(true);
    });

    it('should produce a signature that fails verification with the wrong secret', async () => {
      const publisher = new JobFeedPublisher(outputDir, FeedPublisherTestUtils.TEST_SECRET);

      await publisher.publish(FeedPublisherTestUtils.createJobs());

      const feedContent = await readFile(join(outputDir, FEED_FILENAME), 'utf-8');
      const signature = await readFile(join(outputDir, FEED_SIGNATURE_FILENAME), 'utf-8');

      expect(FeedPublisherTestUtils.verifySignature(feedContent, signature, 'wrong-secret')).toBe(
        false
      );
    });

    it('should produce a signature that fails verification when the feed is tampered with', async () => {
      const publisher = new JobFeedPublisher(outputDir, FeedPublisherTestUtils.TEST_SECRET);

      await publisher.publish(FeedPublisherTestUtils.createJobs());

      const feedContent = await readFile(join(outputDir, FEED_FILENAME), 'utf-8');
      const signature = await readFile(join(outputDir, FEED_SIGNATURE_FILENAME), 'utf-8');
      const tampered = feedContent.replace('Software Engineer', 'Malicious Job');

      expect(
        FeedPublisherTestUtils.verifySignature(
          tampered,
          signature,
          FeedPublisherTestUtils.TEST_SECRET
        )
      ).toBe(false);
    });

    it('should create the output directory when it does not exist', async () => {
      const nestedDir = join(outputDir, 'nested', 'feed');
      const publisher = new JobFeedPublisher(nestedDir, FeedPublisherTestUtils.TEST_SECRET);

      const result = await publisher.publish(FeedPublisherTestUtils.createJobs());

      expect(result.success).toBe(true);
      const feedContent = await readFile(join(nestedDir, FEED_FILENAME), 'utf-8');
      expect(feedContent).toContain('"total_count": 2');
    });
  });

  describe('when publishing an empty feed', () => {
    it('should publish a valid signed feed with zero jobs', async () => {
      const publisher = new JobFeedPublisher(outputDir, FeedPublisherTestUtils.TEST_SECRET);

      const result = await publisher.publish([]);

      expect(result.success).toBe(true);
      expect(result.jobsPublished).toBe(0);

      const feedContent = await readFile(join(outputDir, FEED_FILENAME), 'utf-8');
      const payload = JSON.parse(feedContent) as JobFeedPayload;
      expect(payload.total_count).toBe(0);
      expect(payload.jobs).toHaveLength(0);
    });
  });

  describe('when the output location is not writable', () => {
    it('should return a failed result instead of throwing', async () => {
      // Use a path whose parent is a file, making directory creation impossible
      const blockingFile = join(outputDir, 'blocking-file');
      await writeFile(blockingFile, 'occupied');
      const publisher = new JobFeedPublisher(
        join(blockingFile, 'feed'),
        FeedPublisherTestUtils.TEST_SECRET
      );

      const result = await publisher.publish(FeedPublisherTestUtils.createJobs());

      expect(result.success).toBe(false);
      expect(result.jobsPublished).toBe(0);
      expect(result.error).toBeDefined();
    });
  });
});
