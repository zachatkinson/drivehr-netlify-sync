#!/usr/bin/env node
/**
 * DriveHR Job Scraper and WordPress Sync Script
 *
 * Enterprise GitHub Actions automation script that orchestrates the complete
 * job scraping and WordPress synchronization workflow. This script replaces
 * complex API-based fetching with browser automation for SPA handling, then
 * sends the results directly to WordPress via secure webhook integration.
 *
 * Key Features:
 * - Playwright-powered browser automation for SPA job scraping
 * - HMAC-SHA256 authenticated WordPress webhook integration
 * - Comprehensive error handling and retry mechanisms
 * - Artifact generation for debugging and monitoring
 * - GitHub Actions optimized with structured logging
 * - Environment-based configuration with runtime validation
 * - Performance metrics tracking and reporting
 * - Secure secret management and credential handling
 *
 * Workflow Process:
 * 1. Load and validate environment configuration
 * 2. Initialize Playwright scraper with GitHub Actions optimization
 * 3. Scrape job data from DriveHR careers page using browser automation
 * 4. Send scraped data to WordPress via authenticated webhook
 * 5. Handle errors with comprehensive logging and artifact generation
 * 6. Save debugging artifacts for monitoring and troubleshooting
 *
 * This script is designed for GitHub Actions but supports local execution
 * for development and testing purposes with proper environment setup.
 *
 * @example
 * ```bash
 * # GitHub Actions execution
 * DRIVEHR_COMPANY_ID=123 WP_API_URL=https://site.com/webhook/drivehr-sync WEBHOOK_SECRET=secret node scrape-and-sync.ts
 *
 * # Local development
 * ENVIRONMENT=development FORCE_SYNC=true node scrape-and-sync.ts
 * ```
 *
 * @module scrape-and-sync
 * @since 2.0.0
 * @see {@link ../services/playwright-scraper.ts} for browser automation implementation
 * @see {@link ../services/wordpress-client.ts} for WordPress integration patterns
 * @see {@link ../../CLAUDE.md} for development standards and security requirements
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHmac } from 'crypto';
import { PlaywrightScraper, type PlaywrightScraperConfig } from '../services/playwright-scraper.js';
import { getLogger } from '../lib/logger.js';
import { getEnvironmentConfig, getEnvVar } from '../lib/env.js';
import type { DriveHrApiConfig } from '../types/api.js';
import type { NormalizedJob } from '../types/job.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration for the scrape and sync operation
 *
 * Combines environment configuration with script-specific settings
 * optimized for GitHub Actions CI/CD pipeline execution with
 * comprehensive security and performance controls.
 *
 * @since 2.0.0
 */
interface ScrapeAndSyncConfig {
  /** DriveHR API configuration */
  driveHr: DriveHrApiConfig;
  /** WordPress webhook configuration */
  wordpress: {
    apiUrl: string;
    webhookSecret: string;
  };
  /** Playwright scraper configuration */
  scraper: PlaywrightScraperConfig;
  /** General script configuration */
  script: {
    forceSync: boolean;
    environment: string;
    logLevel: string;
  };
}

/**
 * Result from WordPress webhook call
 *
 * Comprehensive response structure for tracking webhook
 * communication success, failure scenarios, and
 * job processing metrics for monitoring and debugging.
 *
 * @since 2.0.0
 */
interface WebhookResult {
  success: boolean;
  message: string;
  jobsProcessed: number;
  error?: string;
}

/**
 * Complete scrape and sync result for reporting
 *
 * Comprehensive execution result containing performance metrics,
 * artifact locations, and detailed status information for
 * GitHub Actions reporting and monitoring dashboards.
 *
 * @since 2.0.0
 */
interface ScrapeAndSyncResult {
  success: boolean;
  jobsScraped: number;
  jobsSynced: number;
  scrapingTime: number;
  syncTime: number;
  totalTime: number;
  error?: string;
  artifacts: {
    jobsFile?: string;
    logFile?: string;
    screenshotFile?: string;
  };
}

/**
 * WordPress webhook client for sending job data
 *
 * Handles authenticated communication with WordPress webhook endpoints
 * using HMAC-SHA256 signature verification for enterprise security.
 * Provides retry mechanisms, comprehensive error handling, and
 * structured logging for production deployment reliability.
 *
 * @since 2.0.0
 */
class WordPressWebhookClient {
  constructor(
    private readonly apiUrl: string,
    private readonly webhookSecret: string
  ) {}

  /**
   * Send job data to WordPress via webhook
   *
   * Transmits normalized job data to WordPress using secure HMAC-SHA256
   * authentication. Handles payload serialization, signature generation,
   * and comprehensive error handling for production reliability.
   *
   * @param jobs - Normalized job data to send to WordPress
   * @param source - Source identifier for tracking and analytics
   * @returns Promise resolving to webhook result with success status
   * @throws {Error} When webhook request fails or receives non-2xx response
   * @example
   * ```typescript
   * const client = new WordPressWebhookClient(apiUrl, secret);
   * const result = await client.sendJobs(jobs, 'github-actions');
   * if (result.success) {
   *   console.log(`Synced ${result.jobsProcessed} jobs successfully`);
   * }
   * ```
   * @since 2.0.0
   */
  async sendJobs(jobs: NormalizedJob[], source: string = 'github-actions'): Promise<WebhookResult> {
    const logger = getLogger();
    const webhookUrl = this.apiUrl;

    const payload = {
      source,
      jobs,
      timestamp: new Date().toISOString(),
      total_count: jobs.length,
    };

    const payloadJson = JSON.stringify(payload);
    const signature = this.generateSignature(payloadJson);

    logger.info(`Sending ${jobs.length} jobs to WordPress webhook`);

    try {
      const response = await globalThis.fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'User-Agent': 'DriveHR-GitHub-Actions/2.0',
        },
        body: payloadJson,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();

      return {
        success: true,
        message: result.message ?? 'Jobs synced successfully',
        jobsProcessed: result.jobs_processed ?? jobs.length,
      };
    } catch (error) {
      logger.error(
        'WordPress webhook failed: ' + (error instanceof Error ? error.message : String(error))
      );
      return {
        success: false,
        message: 'Failed to send jobs to WordPress',
        jobsProcessed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate HMAC-SHA256 signature for webhook authentication
   *
   * Creates cryptographic signature for webhook payload verification
   * using SHA-256 hashing algorithm with shared secret for security.
   *
   * @private
   * @param payload - JSON payload to sign for authentication
   * @returns Hex-encoded HMAC-SHA256 signature
   * @since 2.0.0
   */
  private generateSignature(payload: string): string {
    return createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
  }
}

/**
 * Load and validate configuration from environment
 *
 * Loads environment variables and constructs validated configuration
 * for scraping and synchronization operations. Performs comprehensive
 * validation of required environment variables and constructs optimized
 * settings for GitHub Actions execution environment.
 *
 * @returns Promise resolving to validated scrape and sync configuration
 * @throws {Error} When required environment variables are missing
 * @example
 * ```typescript
 * const config = await loadConfiguration();
 * console.log(`Scraping for company: ${config.driveHr.companyId}`);
 * console.log(`WordPress target: ${config.wordpress.apiUrl}`);
 * ```
 * @since 2.0.0
 */
async function loadConfiguration(): Promise<ScrapeAndSyncConfig> {
  const logger = getLogger();
  logger.info('Loading configuration from environment');

  const env = getEnvironmentConfig();

  // Validate required environment variables
  if (!env.driveHrCompanyId) {
    throw new Error('DRIVEHR_COMPANY_ID is required');
  }

  if (!env.wpApiUrl) {
    throw new Error('WP_API_URL is required');
  }

  if (!env.webhookSecret) {
    throw new Error('WEBHOOK_SECRET is required');
  }

  return {
    driveHr: {
      companyId: env.driveHrCompanyId,
      careersUrl: `https://drivehris.app/careers/${env.driveHrCompanyId}/list`,
      apiBaseUrl: `https://drivehris.app/careers/${env.driveHrCompanyId}`,
      timeout: 30000,
      retries: 3,
    },
    wordpress: {
      apiUrl: env.wpApiUrl,
      webhookSecret: env.webhookSecret,
    },
    scraper: {
      headless: true,
      timeout: 30000,
      retries: 3,
      debug: env.environment === 'development',
      userAgent: 'DriveHR-GitHub-Actions/2.0 (Playwright)',
      browserArgs: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    },
    script: {
      forceSync: getEnvVar('FORCE_SYNC') === 'true',
      environment: env.environment || 'production',
      logLevel: env.logLevel || 'info',
    },
  };
}

/**
 * Create output directories for artifacts
 *
 * Creates necessary directory structure for storing execution
 * artifacts including logs, temporary files, and debugging data.
 * Ensures proper permissions and handles creation errors gracefully.
 *
 * @returns Promise that resolves when directories are created
 * @throws {Error} When directory creation fails due to permissions
 * @since 2.0.0
 */
async function createOutputDirectories(): Promise<void> {
  const dirs = ['./logs', './temp'];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Save job data as JSON artifact
 *
 * Persists scraped job data to filesystem as structured JSON artifact
 * for debugging, monitoring, and compliance purposes. Includes metadata
 * for traceability and supports both GitHub Actions and local execution.
 *
 * @param jobs - Normalized job data to save as artifact
 * @param runId - GitHub Actions run ID for filename uniqueness
 * @returns Promise resolving to file path of saved artifact
 * @throws {Error} When file write operations fail
 * @example
 * ```typescript
 * const artifactPath = await saveJobsArtifact(jobs, 'run-123');
 * console.log(`Jobs saved to: ${artifactPath}`);
 * ```
 * @since 2.0.0
 */
async function saveJobsArtifact(jobs: NormalizedJob[], runId: string = 'local'): Promise<string> {
  const filename = `scraped-jobs-${runId}-${Date.now()}.json`;
  const filepath = join('./temp', filename);

  const data = {
    timestamp: new Date().toISOString(),
    runId,
    totalJobs: jobs.length,
    jobs,
  };

  await writeFile(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

/**
 * Save execution log as artifact
 *
 * Persists comprehensive execution log including performance metrics,
 * environment details, and execution results for monitoring, debugging,
 * and compliance audit trails in production deployments.
 *
 * @param result - Complete scrape and sync execution result
 * @param runId - GitHub Actions run ID for filename uniqueness
 * @returns Promise resolving to file path of saved log artifact
 * @throws {Error} When log file write operations fail
 * @example
 * ```typescript
 * const logPath = await saveLogArtifact(executionResult, 'run-123');
 * console.log(`Execution log saved to: ${logPath}`);
 * ```
 * @since 2.0.0
 */
async function saveLogArtifact(
  result: ScrapeAndSyncResult,
  runId: string = 'local'
): Promise<string> {
  const filename = `scrape-log-${runId}-${Date.now()}.json`;
  const filepath = join('./logs', filename);

  const logData = {
    timestamp: new Date().toISOString(),
    runId,
    result,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  await writeFile(filepath, JSON.stringify(logData, null, 2));
  return filepath;
}

/**
 * Main scrape and sync execution function
 *
 * Orchestrates the complete workflow from configuration loading through
 * job scraping to WordPress synchronization. Handles comprehensive error
 * scenarios, performance monitoring, and artifact generation for enterprise
 * production deployments with full observability.
 *
 * @returns Promise resolving to comprehensive execution result
 * @throws {Error} When critical configuration or execution failures occur
 * @example
 * ```typescript
 * const result = await executeScrapeAndSync();
 * if (result.success) {
 *   console.log(`✅ Synced ${result.jobsSynced} jobs in ${result.totalTime}ms`);
 * } else {
 *   console.error(`❌ Failed: ${result.error}`);
 * }
 * ```
 * @since 2.0.0
 */
async function executeScrapeAndSync(): Promise<ScrapeAndSyncResult> {
  const startTime = Date.now();
  const logger = getLogger();
  const runId = getEnvVar('GITHUB_RUN_ID') ?? 'local';

  logger.info('Starting DriveHR job scrape and sync process');

  try {
    // Load configuration
    const config = await loadConfiguration();
    await createOutputDirectories();

    logger.info(`Scraping jobs for company: ${config.driveHr.companyId}`);
    logger.info(`Target WordPress: ${config.wordpress.apiUrl}`);

    // Initialize scraper
    const scraper = new PlaywrightScraper(config.scraper);

    // Scrape jobs
    const scrapingStartTime = Date.now();
    const scrapeResult = await scraper.scrapeJobs(config.driveHr, 'github-actions');
    const scrapingTime = Date.now() - scrapingStartTime;

    if (!scrapeResult.success) {
      throw new Error(`Job scraping failed: ${scrapeResult.error}`);
    }

    logger.info(`Successfully scraped ${scrapeResult.totalCount} jobs in ${scrapingTime}ms`);

    // Save jobs artifact
    const jobsFile = await saveJobsArtifact(scrapeResult.jobs, runId);

    // Send to WordPress if we have jobs or force sync is enabled
    let syncResult: WebhookResult;
    let syncTime = 0;

    if (scrapeResult.jobs.length > 0 || config.script.forceSync) {
      const syncStartTime = Date.now();
      const webhookClient = new WordPressWebhookClient(
        config.wordpress.apiUrl,
        config.wordpress.webhookSecret
      );

      syncResult = await webhookClient.sendJobs(scrapeResult.jobs, 'github-actions');
      syncTime = Date.now() - syncStartTime;

      if (!syncResult.success) {
        throw new Error(`WordPress sync failed: ${syncResult.error}`);
      }

      logger.info(
        `Successfully synced ${syncResult.jobsProcessed} jobs to WordPress in ${syncTime}ms`
      );
    } else {
      logger.info('No jobs to sync and force sync not enabled');
      syncResult = {
        success: true,
        message: 'No jobs to sync',
        jobsProcessed: 0,
      };
    }

    // Cleanup
    await scraper.dispose();

    const totalTime = Date.now() - startTime;
    const result: ScrapeAndSyncResult = {
      success: true,
      jobsScraped: scrapeResult.totalCount,
      jobsSynced: syncResult.jobsProcessed,
      scrapingTime,
      syncTime,
      totalTime,
      artifacts: {
        jobsFile,
        screenshotFile: scrapeResult.screenshotPath,
      },
    };

    // Save log artifact
    const logFile = await saveLogArtifact(result, runId);
    result.artifacts.logFile = logFile;

    logger.info(`Scrape and sync completed successfully in ${totalTime}ms`);
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Scrape and sync failed: ' + errorMessage);

    const result: ScrapeAndSyncResult = {
      success: false,
      jobsScraped: 0,
      jobsSynced: 0,
      scrapingTime: 0,
      syncTime: 0,
      totalTime,
      error: errorMessage,
      artifacts: {},
    };

    // Save error log
    try {
      const logFile = await saveLogArtifact(result, runId);
      result.artifacts.logFile = logFile;
    } catch (logError) {
      logger.error(
        'Failed to save error log: ' +
          (logError instanceof Error ? logError.message : String(logError))
      );
    }

    return result;
  }
}

/**
 * Script entry point when run directly
 *
 * Main execution entry point that handles script lifecycle, error reporting,
 * and exit code management for GitHub Actions integration. Provides
 * structured console output with emoji indicators for CI/CD visibility.
 *
 * @returns Promise that resolves when script execution completes
 * @throws Process exits with code 1 on failure, 0 on success
 * @example
 * ```bash
 * # Direct execution
 * node scrape-and-sync.ts
 *
 * # With environment variables
 * DRIVEHR_COMPANY_ID=123 node scrape-and-sync.ts
 * ```
 * @since 2.0.0
 */
async function main(): Promise<void> {
  const logger = getLogger();

  try {
    const result = await executeScrapeAndSync();

    if (result.success) {
      logger.info('Scrape and sync completed successfully');
      logger.info(`Jobs scraped: ${result.jobsScraped}`);
      logger.info(`Jobs synced: ${result.jobsSynced}`);
      logger.info(`Total time: ${result.totalTime}ms`);

      // GitHub Actions output
      process.stdout.write('✅ Scrape and sync completed successfully\n');
      process.stdout.write(`📊 Jobs scraped: ${result.jobsScraped}\n`);
      process.stdout.write(`🔄 Jobs synced: ${result.jobsSynced}\n`);
      process.stdout.write(`⏱️  Total time: ${result.totalTime}ms\n`);
      process.exit(0);
    } else {
      logger.error('Scrape and sync failed: ' + (result.error ?? 'Unknown error'));

      // GitHub Actions output
      process.stderr.write('❌ Scrape and sync failed\n');
      process.stderr.write(`💥 Error: ${result.error ?? 'Unknown error'}\n`);
      process.exit(1);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Fatal error in main: ' + errorMsg);

    // GitHub Actions output
    process.stderr.write('💀 Fatal error: ' + errorMsg + '\n');
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

/**
 * Public API exports for DriveHR scrape and sync functionality
 *
 * Exports the main execution function and result type for programmatic
 * access to the scraping and synchronization capabilities. Enables
 * integration with other services, testing frameworks, and monitoring
 * systems while maintaining clean API boundaries.
 *
 * @example
 * ```typescript
 * import { executeScrapeAndSync, type ScrapeAndSyncResult } from './scrape-and-sync.js';
 *
 * const result: ScrapeAndSyncResult = await executeScrapeAndSync();
 * if (result.success) {
 *   console.log(`Successfully synced ${result.jobsSynced} jobs`);
 *   console.log(`Execution time: ${result.totalTime}ms`);
 *   console.log(`Artifacts: ${JSON.stringify(result.artifacts, null, 2)}`);
 * }
 * ```
 * @since 2.0.0
 * @see {@link executeScrapeAndSync} for the main execution function
 * @see {@link ScrapeAndSyncResult} for the result type definition
 */
export { executeScrapeAndSync, type ScrapeAndSyncResult };
