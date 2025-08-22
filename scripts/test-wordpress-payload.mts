#!/usr/bin/env tsx
/**
 * WordPress Payload Testing Tool
 *
 * Enterprise-grade utility for testing WordPress webhook payloads without
 * sending them to production. Supports flexible company ID testing, payload
 * inspection, HMAC signature generation, and mock endpoint validation.
 *
 * This tool enables developers to review exact payload structures, validate
 * field mappings, and test integration flows before connecting to WordPress.
 *
 * Features:
 * - Company ID override for testing different DriveHR installations
 * - Dry-run mode for payload generation without transmission
 * - Detailed payload inspection with headers and signatures
 * - File export for payload review and debugging
 * - Mock WordPress endpoint for response testing
 * - Multiple output formats for different use cases
 *
 * @example
 * ```bash
 * # Test with a company that has active jobs
 * pnpm test-wordpress-payload --company-id "abc123" --inspect
 *
 * # Save payload to file for review
 * pnpm test-wordpress-payload --save payload.json --format json
 *
 * # Test with mock WordPress endpoint
 * pnpm test-wordpress-payload --mock-wordpress --use-test-data
 * ```
 *
 * @module test-wordpress-payload
 * @since 1.0.0
 * @see {@link ../../CLAUDE.md} for development standards and practices
 * @see {@link ../src/services/wordpress-client.ts} for the production client
 */

import { writeFile } from 'fs/promises';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { getEnvironmentConfig } from '../src/lib/env.js';
import { createLogger, setLogger } from '../src/lib/logger.js';
import { StringUtils, SecurityUtils } from '../src/lib/utils.js';
import { PlaywrightScraper } from '../src/services/playwright-scraper.js';
import { JobNormalizer } from '../src/services/job-fetcher/job-normalizer.js';
import type { NormalizedJob, JobSyncRequest, JobSource } from '../src/types/job.js';
import type { DriveHrApiConfig } from '../src/types/api.js';

/**
 * CLI arguments interface for WordPress payload testing
 *
 * Defines all available command-line options for controlling payload
 * generation, testing, and output formatting.
 *
 * @since 1.0.0
 */
interface CliArgs {
  /** Company ID to override .env DRIVEHR_COMPANY_ID */
  companyId?: string;
  /** Generate payload without sending (default: true) */
  dryRun: boolean;
  /** File path to save generated payload */
  save?: string;
  /** Show detailed payload structure and headers */
  inspect: boolean;
  /** Test against mock WordPress endpoint */
  mockWordpress: boolean;
  /** Use mock test data instead of live scraping */
  useTestData: boolean;
  /** Output format for payload display */
  format: 'json' | 'table' | 'detailed';
  /** Show help information */
  help: boolean;
}

/**
 * WordPress payload testing result with comprehensive debugging information
 *
 * Contains the generated payload, authentication headers, and metadata
 * for testing and validation purposes.
 *
 * @since 1.0.0
 */
interface PayloadTestResult {
  /** The WordPress webhook payload */
  readonly payload: JobSyncRequest;
  /** HMAC signature for authentication */
  readonly signature: string;
  /** Request headers that would be sent */
  readonly headers: Record<string, string>;
  /** Payload metadata */
  readonly metadata: {
    readonly jobCount: number;
    readonly payloadSize: number;
    readonly companyId: string;
    readonly source: JobSource;
    readonly generatedAt: string;
  };
  /** Job data used in payload */
  readonly jobs: readonly NormalizedJob[];
}

/**
 * Mock WordPress server response structure
 *
 * Simulates WordPress webhook responses for testing purposes.
 *
 * @since 1.0.0
 */
interface MockWordPressResponse {
  readonly success: boolean;
  readonly processed: number;
  readonly updated: number;
  readonly removed: number;
  readonly total: number;
  readonly errors: readonly string[];
  readonly timestamp: string;
  readonly source: string;
}

/**
 * WordPress payload testing service
 *
 * Main service class that handles payload generation, testing, and output
 * formatting. Implements enterprise patterns for maintainable and extensible
 * testing functionality.
 *
 * @since 1.0.0
 */
class WordPressPayloadTester {
  private readonly logger = createLogger('info', true);

  /**
   * Create WordPress payload tester
   *
   * @since 1.0.0
   */
  constructor() {
    setLogger(this.logger);
  }

  /**
   * Generate WordPress webhook payload for testing
   *
   * Creates a complete webhook payload with authentication headers and metadata
   * for testing WordPress integration without sending actual requests.
   *
   * @param jobs - Array of normalized job data
   * @param companyId - Company identifier for metadata
   * @param webhookSecret - Secret key for HMAC signature generation
   * @returns Complete payload test result with headers and metadata
   * @throws {Error} When payload generation fails
   * @example
   * ```typescript
   * const jobs = await this.fetchJobData(companyId);
   * const result = await tester.generatePayload(jobs, companyId, secret);
   * console.log(`Generated payload with ${result.metadata.jobCount} jobs`);
   * ```
   * @since 1.0.0
   */
  public async generatePayload(
    jobs: readonly NormalizedJob[],
    companyId: string,
    webhookSecret: string
  ): Promise<PayloadTestResult> {
    const requestId = `req_${StringUtils.generateRequestId()}`;
    const timestamp = new Date().toISOString();
    const source: JobSource = 'webhook';

    const payload: JobSyncRequest = {
      source,
      jobs,
      timestamp,
      requestId,
    };

    const payloadJson = JSON.stringify(payload);
    const signature = SecurityUtils.generateHmacSignature(payloadJson, webhookSecret);

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Request-ID': requestId,
      'User-Agent': 'DriveHR-Sync-PayloadTester/1.0',
    };

    return {
      payload,
      signature,
      headers,
      metadata: {
        jobCount: jobs.length,
        payloadSize: payloadJson.length,
        companyId,
        source,
        generatedAt: timestamp,
      },
      jobs,
    };
  }

  /**
   * Fetch job data for payload testing
   *
   * Retrieves job data either from live scraping or test fixtures
   * based on configuration options.
   *
   * @param companyId - DriveHR company identifier
   * @param useTestData - Whether to use mock data instead of live scraping
   * @returns Array of normalized job data
   * @throws {Error} When job fetching fails
   * @since 1.0.0
   */
  public async fetchJobData(
    companyId: string,
    useTestData: boolean = false
  ): Promise<readonly NormalizedJob[]> {
    if (useTestData) {
      return this.generateTestJobs();
    }

    const config: DriveHrApiConfig = {
      companyId,
      baseUrl: 'https://drivehris.app',
      maxRetries: 2,
      timeout: 30000,
    };

    const scraper = new PlaywrightScraper({
      headless: true,
      timeout: 30000,
      waitForSelector: '[data-testid="job-card"], .job-listing, .position',
      screenshotOnError: false,
      retries: 1,
    });

    const normalizer = new JobNormalizer();

    try {
      this.logger.info(`Fetching jobs for company: ${companyId}`);
      const result = await scraper.scrapeJobs(config);

      if (!result.success) {
        throw new Error(`Scraping failed: ${result.error || 'Unknown error'}`);
      }

      const normalizedJobs = await normalizer.normalizeJobs(result.rawJobs, 'webhook');
      this.logger.info(`Successfully fetched ${normalizedJobs.length} jobs`);

      return normalizedJobs;
    } finally {
      await scraper.cleanup();
    }
  }

  /**
   * Generate mock test job data
   *
   * Creates realistic test job data for payload testing when live
   * scraping is not desired or available.
   *
   * @returns Array of mock normalized job data
   * @since 1.0.0
   */
  private generateTestJobs(): readonly NormalizedJob[] {
    const jobs: NormalizedJob[] = [
      {
        id: 'test-job-001',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        type: 'Full-time',
        description: 'Join our engineering team to build scalable software solutions...',
        postedDate: '2024-01-15T10:00:00.000Z',
        applyUrl: 'https://drivehris.app/careers/test-company/apply/test-job-001',
        source: 'webhook',
        rawData: {},
        processedAt: new Date().toISOString(),
      },
      {
        id: 'test-job-002',
        title: 'Product Manager',
        department: 'Product',
        location: 'Remote',
        type: 'Full-time',
        description: 'Lead product strategy and roadmap development...',
        postedDate: '2024-01-14T14:30:00.000Z',
        applyUrl: 'https://drivehris.app/careers/test-company/apply/test-job-002',
        source: 'webhook',
        rawData: {},
        processedAt: new Date().toISOString(),
      },
      {
        id: 'test-job-003',
        title: 'UX Designer',
        department: 'Design',
        location: 'New York, NY',
        type: 'Contract',
        description: 'Create intuitive user experiences for our platform...',
        postedDate: '2024-01-13T09:15:00.000Z',
        applyUrl: 'https://drivehris.app/careers/test-company/apply/test-job-003',
        source: 'webhook',
        rawData: {},
        processedAt: new Date().toISOString(),
      },
    ];

    return jobs;
  }

  /**
   * Start mock WordPress server for testing
   *
   * Creates a local HTTP server that simulates WordPress webhook responses
   * for testing payload delivery and response handling.
   *
   * @param port - Port number for the mock server
   * @returns Promise that resolves when server is ready
   * @since 1.0.0
   */
  public async startMockWordPressServer(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });

          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const response: MockWordPressResponse = {
                success: true,
                processed: payload.jobs?.length || 0,
                updated: Math.floor((payload.jobs?.length || 0) * 0.3),
                removed: Math.floor((payload.jobs?.length || 0) * 0.1),
                total: payload.jobs?.length || 0,
                errors: [],
                timestamp: new Date().toISOString(),
                source: 'mock-wordpress-server',
              };

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response, null, 2));
            } catch (error) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
          });
        } else {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
      });

      server.listen(port, () => {
        console.log(`🚀 Mock WordPress server running on http://localhost:${port}`);
        resolve();
      });

      server.on('error', reject);
    });
  }

  /**
   * Save payload to JSON file
   *
   * Exports the generated payload and metadata to a JSON file for
   * review and debugging purposes.
   *
   * @param result - Payload test result to save
   * @param filePath - Target file path for export
   * @throws {Error} When file writing fails
   * @since 1.0.0
   */
  public async savePayloadToFile(result: PayloadTestResult, filePath: string): Promise<void> {
    const exportData = {
      payload: result.payload,
      headers: result.headers,
      metadata: result.metadata,
      generatedAt: new Date().toISOString(),
      note: 'Generated by DriveHR WordPress Payload Tester',
    };

    await writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log(`✅ Payload saved to: ${filePath}`);
  }

  /**
   * Format and display payload result
   *
   * Outputs payload information in the specified format for review
   * and debugging.
   *
   * @param result - Payload test result to display
   * @param format - Output format (json, table, or detailed)
   * @since 1.0.0
   */
  public displayResult(result: PayloadTestResult, format: 'json' | 'table' | 'detailed'): void {
    switch (format) {
      case 'json':
        console.log(JSON.stringify(result.payload, null, 2));
        break;

      case 'table':
        console.log('\n📊 Payload Summary:');
        console.table({
          'Job Count': result.metadata.jobCount,
          'Payload Size': `${result.metadata.payloadSize} bytes`,
          'Company ID': result.metadata.companyId,
          'Source': result.metadata.source,
          'Generated At': result.metadata.generatedAt,
        });

        if (result.jobs.length > 0) {
          console.log('\n💼 Jobs Overview:');
          console.table(
            result.jobs.map(job => ({
              ID: job.id,
              Title: job.title,
              Department: job.department,
              Location: job.location,
              Type: job.type,
            }))
          );
        }
        break;

      case 'detailed':
        console.log('\n🔍 Detailed Payload Analysis:');
        console.log('\n📋 Metadata:');
        Object.entries(result.metadata).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });

        console.log('\n🔐 Headers:');
        Object.entries(result.headers).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });

        console.log('\n💼 Jobs:');
        result.jobs.forEach((job, index) => {
          console.log(`  [${index + 1}] ${job.title}`);
          console.log(`      ID: ${job.id}`);
          console.log(`      Department: ${job.department}`);
          console.log(`      Location: ${job.location}`);
          console.log(`      Type: ${job.type}`);
          console.log(`      Apply URL: ${job.applyUrl}`);
          console.log('');
        });

        console.log('\n📦 Raw Payload:');
        console.log(JSON.stringify(result.payload, null, 2));
        break;
    }
  }
}

/**
 * Parse command line arguments for WordPress payload testing
 *
 * Processes command-line arguments and returns a structured configuration
 * object for the payload testing tool.
 *
 * @param args - Command line arguments array
 * @returns Parsed CLI arguments with defaults applied
 * @since 1.0.0
 */
function parseCliArgs(args: string[]): CliArgs {
  const parsedArgs: CliArgs = {
    dryRun: true,
    inspect: false,
    mockWordpress: false,
    useTestData: false,
    format: 'detailed',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--company-id':
        parsedArgs.companyId = args[++i];
        break;
      case '--dry-run':
        parsedArgs.dryRun = true;
        break;
      case '--save':
        parsedArgs.save = args[++i];
        break;
      case '--inspect':
        parsedArgs.inspect = true;
        break;
      case '--mock-wordpress':
        parsedArgs.mockWordpress = true;
        break;
      case '--use-test-data':
        parsedArgs.useTestData = true;
        break;
      case '--format':
        const format = args[++i] as 'json' | 'table' | 'detailed';
        if (['json', 'table', 'detailed'].includes(format)) {
          parsedArgs.format = format;
        }
        break;
      case '--help':
      case '-h':
        parsedArgs.help = true;
        break;
    }
  }

  return parsedArgs;
}

/**
 * Display help information for the WordPress payload testing tool
 *
 * Shows comprehensive usage instructions and examples for all available
 * command-line options.
 *
 * @since 1.0.0
 */
function showHelp(): void {
  console.log(`
🧪 WordPress Payload Testing Tool

Generate and test WordPress webhook payloads without sending them to production.
Perfect for testing different company IDs, inspecting payload structure, and
validating integration flows.

Usage:
  pnpm test-wordpress-payload [options]

Options:
  --company-id <id>         Use specific company ID (overrides .env DRIVEHR_COMPANY_ID)
  --dry-run                 Generate payload without sending (default: true)
  --save <file>             Save payload to JSON file
  --inspect                 Show detailed payload structure and headers
  --mock-wordpress          Test against mock WordPress endpoint
  --use-test-data           Use mock test data instead of live scraping
  --format <type>           Output format: json, table, detailed (default: detailed)
  --help, -h                Show this help message

Examples:
  # Test with a company that has active jobs
  pnpm test-wordpress-payload --company-id "abc123" --inspect

  # Save payload from active company for review
  pnpm test-wordpress-payload --company-id "xyz789" --save payload.json

  # Test your own company (uses .env DRIVEHR_COMPANY_ID)
  pnpm test-wordpress-payload --dry-run --format table

  # Test with mock data and mock WordPress server
  pnpm test-wordpress-payload --use-test-data --mock-wordpress

  # Generate JSON output for API testing tools
  pnpm test-wordpress-payload --format json --save api-test.json

Features:
  ✅ Company ID override for testing different DriveHR installations
  ✅ Dry-run mode for safe payload generation
  ✅ HMAC signature generation and validation
  ✅ Multiple output formats for different use cases
  ✅ Mock WordPress server for response testing
  ✅ File export for payload review and debugging
`);
}

/**
 * Load environment variables from .env.development file
 *
 * Simple dotenv-style loader specifically for the development environment file.
 * Only loads variables that aren't already set in the environment.
 *
 * @since 1.0.0
 */
async function loadDevelopmentEnv(): Promise<void> {
  const envPath = '.env.development';
  if (!existsSync(envPath)) {
    return; // No development env file, continue with existing env vars
  }

  try {
    const content = await readFile(envPath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Only set if not already in environment
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
    }
  } catch (error) {
    // Silently continue if we can't load the file
  }
}

/**
 * Main execution function for WordPress payload testing
 *
 * Orchestrates the entire payload testing workflow including argument parsing,
 * job fetching, payload generation, and output formatting.
 *
 * @throws {Error} When critical operations fail
 * @since 1.0.0
 */
async function main(): Promise<void> {
  // Load development environment variables first
  await loadDevelopmentEnv();

  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    return;
  }

  const tester = new WordPressPayloadTester();

  try {
    // Get environment configuration with fallback for company ID
    let env;
    try {
      env = getEnvironmentConfig();
    } catch (error) {
      // If environment config fails, use minimal config with CLI overrides
      if (!args.companyId) {
        throw new Error('Company ID is required. Use --company-id or set DRIVEHR_COMPANY_ID in .env');
      }
      env = {
        driveHrCompanyId: '',
        webhookSecret: process.env.WEBHOOK_SECRET || '',
        wpApiUrl: process.env.WP_API_URL || 'https://dev-wordpress.com/wp-json/drivehr-jobs/v1',
        environment: 'development' as const,
        logLevel: 'debug' as const,
      };
    }
    
    const companyId = args.companyId || env.driveHrCompanyId;
    const webhookSecret = env.webhookSecret;

    if (!companyId) {
      throw new Error('Company ID is required. Use --company-id or set DRIVEHR_COMPANY_ID in .env');
    }

    if (!webhookSecret) {
      throw new Error('Webhook secret is required. Set WEBHOOK_SECRET in .env');
    }

    console.log('🚀 Starting WordPress payload testing...');
    console.log(`📋 Company ID: ${companyId}`);
    console.log(`🧪 Test Mode: ${args.useTestData ? 'Mock Data' : 'Live Scraping'}`);

    // Start mock WordPress server if requested
    if (args.mockWordpress) {
      await tester.startMockWordPressServer(3000);
      console.log('✅ Mock WordPress server started');
    }

    // Fetch job data
    const jobs = await tester.fetchJobData(companyId, args.useTestData);

    if (jobs.length === 0) {
      console.log('⚠️  No jobs found for the specified company ID');
      if (!args.useTestData) {
        console.log('💡 Try using --use-test-data to generate mock job data');
      }
      return;
    }

    // Generate payload
    const result = await tester.generatePayload(jobs, companyId, webhookSecret);

    // Save to file if requested
    if (args.save) {
      await tester.savePayloadToFile(result, args.save);
    }

    // Display results
    if (args.inspect || !args.save) {
      tester.displayResult(result, args.format);
    }

    console.log(`\n✅ Payload testing completed successfully!`);
    console.log(`📊 Generated payload for ${result.metadata.jobCount} jobs`);
    console.log(`📏 Payload size: ${result.metadata.payloadSize} bytes`);

    if (args.mockWordpress) {
      console.log('\n🔗 Mock WordPress server is still running at http://localhost:3000');
      console.log('   Send POST requests to test payload delivery');
      console.log('   Press Ctrl+C to stop the server');
    }

  } catch (error) {
    console.error('❌ WordPress payload testing failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function if this script is run directly
if (process.argv[1]?.includes('test-wordpress-payload.mts')) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}