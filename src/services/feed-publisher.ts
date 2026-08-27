/**
 * Signed Job Feed Publisher Service
 *
 * Publishes scraped job data as a static, HMAC-signed JSON feed for the
 * pull-based WordPress synchronization architecture. Instead of pushing
 * job data into WordPress via webhook (which is subject to host-level
 * bot-protection challenges such as Imunify360's splash screen), the
 * GitHub Actions workflow commits the feed produced by this service to a
 * dedicated git branch. WordPress then pulls the feed on a WP-Cron
 * schedule and verifies its authenticity before processing.
 *
 * Security model:
 * - The feed file is signed with HMAC-SHA256 using the shared webhook
 *   secret. The signature covers the exact bytes of the feed file, so
 *   WordPress can verify integrity and authenticity without re-encoding
 *   the payload.
 * - The secret never appears in the published feed; even with write
 *   access to the repository, an attacker cannot forge a valid signature.
 *
 * @module feed-publisher
 * @since 1.10.0
 * @see {@link ../scripts/scrape-and-sync.ts} for the GitHub Actions entry point
 * @see {@link ../../wordpress-connection/drivehr-webhook/includes/class-feed-sync.php} for the WordPress consumer
 * @see {@link ../../CLAUDE.md} for development standards and security requirements
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHmac } from 'crypto';
import type { NormalizedJob } from '../types/job.js';

/**
 * Structure of the published job feed payload
 *
 * Mirrors the webhook payload shape used by the legacy push
 * architecture so the WordPress sync engine can process either
 * source without transformation.
 *
 * @since 1.10.0
 */
export interface JobFeedPayload {
  /** Source identifier for tracking and analytics */
  source: string;
  /** ISO-8601 timestamp of when the feed was generated */
  timestamp: string;
  /** Number of jobs included in the feed */
  total_count: number;
  /** Normalized job listings */
  jobs: NormalizedJob[];
}

/**
 * Result of a feed publish operation
 *
 * Reports where the feed and signature files were written along with
 * job counts for logging and GitHub Actions reporting.
 *
 * @since 1.10.0
 */
export interface FeedPublishResult {
  /** Whether the feed was written successfully */
  success: boolean;
  /** Human-readable status message */
  message: string;
  /** Number of jobs included in the published feed */
  jobsPublished: number;
  /** Absolute or relative path to the written feed file */
  feedPath: string;
  /** Absolute or relative path to the written signature file */
  signaturePath: string;
  /** Error details when success is false */
  error?: string;
}

/**
 * Filename of the published job feed
 *
 * @since 1.10.0
 */
export const FEED_FILENAME = 'jobs.json';

/**
 * Filename of the detached HMAC signature for the job feed
 *
 * @since 1.10.0
 */
export const FEED_SIGNATURE_FILENAME = 'jobs.json.sig';

/**
 * Publishes job data as a static, HMAC-signed JSON feed
 *
 * Writes two files to the configured output directory: the feed itself
 * (pretty-printed JSON for human inspectability) and a detached
 * signature file containing the HMAC-SHA256 of the feed's exact bytes.
 * The GitHub Actions workflow commits both files to the `job-data`
 * branch, from which WordPress pulls and verifies them.
 *
 * @example
 * ```typescript
 * const publisher = new JobFeedPublisher('./feed', webhookSecret);
 * const result = await publisher.publish(jobs, 'github-actions');
 * if (result.success) {
 *   console.log(`Published ${result.jobsPublished} jobs to ${result.feedPath}`);
 * }
 * ```
 * @since 1.10.0
 */
export class JobFeedPublisher {
  /**
   * Create a feed publisher
   *
   * @param outputDir - Directory where feed and signature files are written
   * @param webhookSecret - Shared secret used for HMAC-SHA256 signing
   * @since 1.10.0
   */
  constructor(
    private readonly outputDir: string,
    private readonly webhookSecret: string
  ) {}

  /**
   * Publish job data as a signed feed
   *
   * Serializes the payload, signs its exact byte content, and writes the
   * feed and signature files atomically enough for the subsequent git
   * commit step (both files are written before the function resolves).
   *
   * @param jobs - Normalized job data to publish
   * @param source - Source identifier for tracking and analytics
   * @returns Promise resolving to the publish result with file paths
   * @throws Never throws; failures are reported via the result's error field
   * @example
   * ```typescript
   * const result = await publisher.publish(jobs);
   * if (!result.success) {
   *   throw new Error(`Feed publish failed: ${result.error}`);
   * }
   * ```
   * @since 1.10.0
   */
  async publish(
    jobs: NormalizedJob[],
    source: string = 'github-actions'
  ): Promise<FeedPublishResult> {
    const feedPath = join(this.outputDir, FEED_FILENAME);
    const signaturePath = join(this.outputDir, FEED_SIGNATURE_FILENAME);

    try {
      const payload: JobFeedPayload = {
        source,
        timestamp: new Date().toISOString(),
        total_count: jobs.length,
        jobs,
      };

      const feedJson = JSON.stringify(payload, null, 2);
      const signature = `sha256=${this.generateSignature(feedJson)}`;

      await mkdir(this.outputDir, { recursive: true });
      await writeFile(feedPath, feedJson, 'utf-8');
      await writeFile(signaturePath, signature, 'utf-8');

      return {
        success: true,
        message: `Feed published with ${jobs.length} jobs`,
        jobsPublished: jobs.length,
        feedPath,
        signaturePath,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to publish job feed',
        jobsPublished: 0,
        feedPath,
        signaturePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate HMAC-SHA256 signature for the feed content
   *
   * Signs the exact serialized feed bytes so the WordPress consumer can
   * verify the downloaded file without re-encoding the JSON (which would
   * be fragile across serializer implementations).
   *
   * @param feedContent - Exact feed file content to sign
   * @returns Hex-encoded HMAC-SHA256 signature
   * @since 1.10.0
   */
  private generateSignature(feedContent: string): string {
    return createHmac('sha256', this.webhookSecret).update(feedContent).digest('hex');
  }
}
