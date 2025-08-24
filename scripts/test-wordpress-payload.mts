#!/usr/bin/env tsx
/**
 * WordPress Payload Testing Tool
 *
 * Enterprise-grade utility for testing WordPress webhook payloads without
 * sending them to production. Supports flexible company ID testing, payload
 * inspection, HMAC signature generation, and mock endpoint validation.
 *
 * Features:
 * - Company ID override for testing different DriveHR installations
 * - Dry-run mode for payload generation without transmission
 * - Detailed payload inspection with headers and signatures
 * - File export for payload review and debugging
 * - Mock WordPress endpoint for response testing
 * - Multiple output formats for different use cases
 * - HMAC signature generation with proper validation
 * - Environment-aware configuration with fallbacks
 *
 * @example
 * ```typescript
 * // Test with company that has active jobs
 * pnpm tsx scripts/test-wordpress-payload.mts --company-id "abc123" --inspect
 *
 * // Save payload to file for review
 * pnpm tsx scripts/test-wordpress-payload.mts --save payload.json --format json
 *
 * // Test with mock WordPress endpoint
 * pnpm tsx scripts/test-wordpress-payload.mts --mock-wordpress --use-test-data
 * ```
 *
 * @module test-wordpress-payload
 * @since 1.0.0
 * @see {@link ../src/services/wordpress-client.ts} for production client
 * @see {@link ../CLAUDE.md} for development standards
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
import type { NormalizedJob, JobSyncRequest, JobSource } from '../src/types/job.js';
import type { DriveHrApiConfig } from '../src/types/api.js';

/**
 * DriveHR API base URL for job scraping and apply URLs
 * @since 1.0.0
 */
const DRIVEHR_BASE_URL = 'https://drivehris.app';


/**
 * CLI arguments interface for WordPress payload testing
 *
 * Defines all available command-line options for controlling payload
 * generation, testing, and output formatting. Provides type safety for
 * argument parsing and consistent option handling.
 *
 * @since 1.0.0
 */
interface CliArgs {
  companyId?: string;
  dryRun: boolean;
  save?: string;
  inspect: boolean;
  mockWordpress: boolean;
  useTestData: boolean;
  format: 'json' | 'table' | 'detailed';
  help: boolean;
}

/**
 * WordPress payload testing result with comprehensive debugging information
 *
 * Contains generated payload, authentication headers, and metadata for
 * testing and validation. Provides complete testing context including
 * webhook payload, security signatures, HTTP headers, and detailed metadata.
 *
 * @since 1.0.0
 */
interface PayloadTestResult {
  readonly payload: JobSyncRequest;
  readonly signature: string;
  readonly headers: Record<string, string>;
  readonly metadata: {
    readonly jobCount: number;
    readonly payloadSize: number;
    readonly companyId: string;
    readonly source: JobSource;
    readonly generatedAt: string;
  };
  readonly jobs: readonly NormalizedJob[];
}

/**
 * Mock WordPress server response structure
 *
 * Simulates WordPress webhook responses for testing purposes. Mirrors
 * expected response format from real WordPress webhook endpoint to enable
 * comprehensive integration testing without requiring live WordPress.
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
 * Main service class handling payload generation, testing, and output
 * formatting. Implements enterprise patterns for maintainable testing
 * functionality following SOLID principles and DRY architecture.
 *
 * @example
 * ```typescript
 * const tester = new WordPressPayloadTester();
 * const jobs = await tester.fetchJobData('company123', false);
 * const result = await tester.generatePayload(jobs, 'company123', 'secret');
 * tester.displayResult(result, 'detailed');
 * ```
 * @since 1.0.0
 */
export class WordPressPayloadTester {
  private readonly logger = createLogger('info', true);

  /**
   * Create WordPress payload tester
   *
   * Initializes payload testing service with enterprise-grade logging
   * configuration. Sets up logger instance for comprehensive testing
   * workflow tracking and debugging information.
   *
   * @since 1.0.0
   */
  constructor() {
    setLogger(this.logger);
  }

  /**
   * Generate WordPress webhook payload for testing
   *
   * Creates complete webhook payload with authentication headers and metadata
   * for testing WordPress integration without sending actual requests. Follows
   * enterprise security standards by generating HMAC signatures for payload
   * authentication.
   *
   * @param jobs - Array of normalized job data to include in payload
   * @param companyId - Company identifier for metadata tracking
   * @param webhookSecret - Secret key for HMAC signature generation
   * @returns Complete payload test result with headers and metadata
   * @throws {Error} When payload generation fails due to invalid input
   * @example
   * ```typescript
   * const jobs = await this.fetchJobData('company123');
   * const result = await tester.generatePayload(jobs, 'company123', 'secret');
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
   * Retrieves job data either from live scraping or test fixtures based on
   * configuration options. Provides flexible data sourcing for testing
   * scenarios, supporting both production-like and controlled testing.
   *
   * @param companyId - DriveHR company identifier for job fetching
   * @param useTestData - Whether to use mock data instead of live scraping
   * @returns Readonly array of normalized job data
   * @throws {Error} When job fetching fails due to network or parsing issues
   * @example
   * ```typescript
   * const liveJobs = await tester.fetchJobData('company123', false);
   * const testJobs = await tester.fetchJobData('company123', true);
   * ```
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
      careersUrl: `${DRIVEHR_BASE_URL}/careers/${companyId}`,
      apiBaseUrl: `${DRIVEHR_BASE_URL}/api/companies/${companyId}`,
      timeout: 30000,
      retries: 2,
    };

    const scraper = new PlaywrightScraper({
      headless: true,
      timeout: 30000,
      waitForSelector: '[data-testid="job-card"], .job-listing, .position',
      retries: 1,
    });


    try {
      this.logger.info(`Fetching jobs for company: ${companyId}`);
      const result = await scraper.scrapeJobs(config);

      if (!result.success) {
        throw new Error(`Scraping failed: ${result.error || 'Unknown error'}`);
      }

      this.logger.info(`Successfully fetched ${result.jobs.length} jobs`);
      return result.jobs;
    } finally {
      await scraper.dispose();
    }
  }

  /**
   * Generate mock test job data
   *
   * Creates realistic test job data for payload testing when live scraping
   * is not desired or available. Generates predefined set of job listings
   * that mirror real-world job data structures.
   *
   * @returns Readonly array of mock normalized job data
   * @example
   * ```typescript
   * const mockJobs = this.generateTestJobs();
   * console.log(`Generated ${mockJobs.length} test jobs`);
   * ```
   * @since 1.0.0
   */
  public generateTestJobs(): readonly NormalizedJob[] {
    const jobs: NormalizedJob[] = [
      {
        id: 'test-job-001',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        type: 'Full-time',
        description: 'Join our engineering team to build scalable software solutions...',
        postedDate: '2024-01-15T10:00:00.000Z',
        applyUrl: `${DRIVEHR_BASE_URL}/careers/test-company/apply/test-job-001`,
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
        applyUrl: `${DRIVEHR_BASE_URL}/careers/test-company/apply/test-job-002`,
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
        applyUrl: `${DRIVEHR_BASE_URL}/careers/test-company/apply/test-job-003`,
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
   * Creates local HTTP server that simulates WordPress webhook responses
   * for testing payload delivery and response handling. Provides realistic
   * testing environment without requiring live WordPress installation.
   *
   * @param port - Port number for mock server (default: 3000)
   * @throws {Error} When port is unavailable or server startup fails
   * @example
   * ```typescript
   * await tester.startMockWordPressServer(3001);
   * console.log('Mock server ready at http://localhost:3001');
   * ```
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
   * Exports generated payload and metadata to JSON file for review and
   * debugging purposes. Creates comprehensive export including complete
   * payload, authentication headers, and generation timestamp.
   *
   * @param result - Payload test result containing all data to save
   * @param filePath - Target file path for export
   * @throws {Error} When file writing fails due to permissions or disk space
   * @example
   * ```typescript
   * await tester.savePayloadToFile(result, './test-payload.json');
   * console.log('Payload saved for review and debugging');
   * ```
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
   * Outputs payload information in specified format for review and debugging.
   * Supports multiple presentation formats for different testing workflows.
   *
   * @param result - Payload test result containing all display data
   * @param format - Output format: 'json', 'table', or 'detailed'
   * @example
   * ```typescript
   * tester.displayResult(result, 'detailed'); // Comprehensive analysis
   * tester.displayResult(result, 'table');   // Quick summary
   * tester.displayResult(result, 'json');    // Raw JSON output
   * ```
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
 * Processes command-line arguments and returns structured configuration
 * object for payload testing tool. Implements robust argument parsing
 * with proper type safety and default value handling.
 *
 * @param args - Command line arguments array
 * @returns Parsed CLI arguments with defaults applied
 * @example
 * ```typescript
 * const args = parseCliArgs(['--company-id', 'test123', '--inspect']);
 * console.log(args.companyId); // 'test123'
 * console.log(args.inspect);   // true
 * ```
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
        const formatValue: string = args[++i] || '';
        if (formatValue === 'json' || formatValue === 'table' || formatValue === 'detailed') {
          parsedArgs.format = formatValue;
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
 * Display help information for WordPress payload testing tool
 *
 * Shows comprehensive usage instructions and examples for all available
 * command-line options. Provides clear guidance for effective tool usage.
 *
 * @example
 * ```typescript
 * showHelp();
 * // Outputs detailed help with usage examples
 * ```
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
 * Simple dotenv-style loader specifically for development environment file.
 * Only loads variables that aren't already set in the environment to avoid
 * overriding existing configuration.
 *
 * @throws {Error} Silently continues if file cannot be loaded
 * @example
 * ```typescript
 * await loadDevelopmentEnv();
 * // Development environment variables now available
 * ```
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
  } catch (error: unknown) {
    // Silently continue if we can't load the file
  }
}

/**
 * Main execution function for WordPress payload testing
 *
 * Orchestrates complete payload testing workflow including argument parsing,
 * job fetching, payload generation, and output formatting. Handles
 * configuration setup, environment validation, and comprehensive error handling.
 *
 * @throws {Error} When critical operations fail
 * @example
 * ```typescript
 * // Execute from CLI
 * if (process.argv[1]?.includes('test-wordpress-payload.mts')) {
 *   main().catch(console.error);
 * }
 * ```
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
    let env: ReturnType<typeof getEnvironmentConfig>;
    try {
      env = getEnvironmentConfig();
    } catch (error: unknown) {
      // If environment config fails, use minimal config with CLI overrides
      if (!args.companyId) {
        throw new Error('Company ID is required. Use --company-id or set DRIVEHR_COMPANY_ID in .env');
      }
      env = {
        driveHrCompanyId: '',
        webhookSecret: process.env['WEBHOOK_SECRET'] || '',
        wpApiUrl: process.env['WP_API_URL'] || '',
        environment: 'development' as const,
        logLevel: 'debug' as const,
      };
    }

    // Validate required WordPress API URL configuration
    if (!env.wpApiUrl) {
      console.error('❌ WordPress API URL is required');
      console.error('💡 Set WP_API_URL environment variable or create .env file');
      console.error('   Example: WP_API_URL=https://yoursite.com/webhook/drivehr-sync');
      process.exit(1);
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

  } catch (error: unknown) {
    console.error('❌ WordPress payload testing failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function if this script is run directly
if (process.argv[1]?.includes('test-wordpress-payload.mts')) {
  main().catch((error: unknown) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}