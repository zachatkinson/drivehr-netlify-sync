#!/usr/bin/env tsx
/**
 * Live Scraping Inspector
 *
 * Development utility to run the job scraper locally and immediately display
 * results with debug information, screenshots, and detailed logging.
 * Perfect for development, testing, and debugging scraping issues.
 *
 * Usage:
 *   pnpm tsx scripts/live-scraper.mts
 *   pnpm tsx scripts/live-scraper.mts --company-id <id>
 *   pnpm tsx scripts/live-scraper.mts --debug --screenshots
 *   pnpm tsx scripts/live-scraper.mts --no-headless
 *
 * @since 1.0.0
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PlaywrightScraper } from '../src/services/playwright-scraper.js';
import { getEnvironmentConfig } from '../src/lib/env.js';
import { createLogger, setLogger } from '../src/lib/logger.js';
import type { NormalizedJob } from '../src/types/job.js';
import type { PlaywrightScraperConfig, PlaywrightScrapeResult } from '../src/services/playwright-scraper.js';
import type { DriveHrApiConfig } from '../src/types/api.js';

/**
 * CLI arguments interface
 */
interface CliArgs {
  companyId?: string;
  debug: boolean;
  screenshots: boolean;
  headless: boolean;
  timeout: number;
  retries: number;
  output?: string;
  format: 'table' | 'json' | 'detailed';
  help: boolean;
}

/**
 * Live scraping result with enhanced debugging info
 */
interface LiveScrapeResult extends PlaywrightScrapeResult {
  config: {
    scraper: PlaywrightScraperConfig;
    api: DriveHrApiConfig;
  };
  performance: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  debug: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number };
    screenshots: string[];
    logs: string[];
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    debug: false,
    screenshots: false,
    headless: true,
    timeout: 30000,
    retries: 2,
    format: 'detailed',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--company-id':
        parsed.companyId = args[i + 1];
        i++;
        break;
      case '--debug':
        parsed.debug = true;
        break;
      case '--screenshots':
        parsed.screenshots = true;
        break;
      case '--no-headless':
        parsed.headless = false;
        break;
      case '--timeout':
        parsed.timeout = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--retries':
        parsed.retries = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--output':
        parsed.output = args[i + 1];
        i++;
        break;
      case '--format':
        parsed.format = args[i + 1] as 'table' | 'json' | 'detailed';
        i++;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
    }
  }

  return parsed;
}

/**
 * Display help information
 */
function showHelp(): void {
  console.log(`
🔍 Live Scraping Inspector

Run the job scraper locally with debugging and immediate results display.

Usage:
  pnpm tsx scripts/live-scraper.mts [options]

Options:
  --company-id <id>    DriveHR company ID to scrape (overrides env)
  --debug              Enable detailed debug logging
  --screenshots        Take screenshots during scraping
  --no-headless        Run browser in non-headless mode (visible)
  --timeout <ms>       Page timeout in milliseconds (default: 30000)
  --retries <n>        Number of retry attempts (default: 2)
  --output <path>      Save results to file
  --format <type>      Output format: table, json, detailed (default: detailed)
  --help, -h           Show this help message

Examples:
  pnpm tsx scripts/live-scraper.mts --debug
  pnpm tsx scripts/live-scraper.mts --company-id abc123 --screenshots
  pnpm tsx scripts/live-scraper.mts --no-headless --debug
  pnpm tsx scripts/live-scraper.mts --format json --output results.json

Environment Variables:
  DRIVEHR_COMPANY_ID   Company ID to scrape
  LOG_LEVEL           Logging level (debug, info, warn, error)
`);
}

/**
 * Create output directories
 */
async function createOutputDirs(): Promise<void> {
  const dirs = ['./debug', './debug/screenshots', './debug/logs'];
  for (const dir of dirs) {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
    }
  }
}

/**
 * Configure scraper with debug settings
 */
function createScraperConfig(args: CliArgs): PlaywrightScraperConfig {
  return {
    headless: args.headless,
    timeout: args.timeout,
    retries: args.retries,
    debug: args.debug || args.screenshots,
    userAgent: 'DriveHR-Live-Scraper/1.0 (Development)',
    browserArgs: args.headless ? [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ] : [
      '--no-sandbox',
      '--start-maximized',
    ],
    waitForSelector: '.job-listing, .job-item, .career-listing, .position-item',
  };
}

/**
 * Create API configuration
 */
function createApiConfig(companyId: string): DriveHrApiConfig {
  return {
    companyId,
    careersUrl: `https://drivehris.app/careers/${companyId}/list`,
    apiBaseUrl: `https://drivehris.app/careers/${companyId}`,
    timeout: 30000,
    retries: 3,
  };
}

/**
 * Display scraping progress
 */
function displayProgress(message: string, step: number, total: number): void {
  const progress = Math.round((step / total) * 100);
  const bar = '█'.repeat(Math.round(progress / 5)) + '░'.repeat(20 - Math.round(progress / 5));
  process.stdout.write(`\r🔄 [${bar}] ${progress}% - ${message}`);
  
  if (step === total) {
    process.stdout.write('\n');
  }
}

/**
 * Display detailed scraping results
 */
function displayDetailedResults(result: LiveScrapeResult): void {
  console.log('\n🎯 Live Scraping Results');
  console.log('='.repeat(25));
  console.log();

  // Overall status
  const statusIcon = result.success ? '✅' : '❌';
  const duration = result.performance.duration;
  
  console.log(`${statusIcon} Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
  console.log(`🌐 URL: ${result.debug.url}`);
  console.log(`📊 Jobs Found: ${result.jobs.length}`);
  console.log();

  // Configuration details
  console.log(`⚙️  Configuration:`);
  console.log(`   Company ID: ${result.config.api.companyId}`);
  console.log(`   Headless: ${result.config.scraper.headless}`);
  console.log(`   Timeout: ${result.config.scraper.timeout}ms`);
  console.log(`   Retries: ${result.config.scraper.retries}`);
  console.log(`   Debug: ${result.config.scraper.debug}`);
  console.log(`   User Agent: ${result.debug.userAgent}`);
  console.log();

  // Debug information
  if (result.debug.screenshots.length > 0) {
    console.log(`📸 Screenshots: ${result.debug.screenshots.length}`);
    result.debug.screenshots.forEach((screenshot, index) => {
      console.log(`   ${index + 1}. ${screenshot}`);
    });
    console.log();
  }

  // Error information
  if (!result.success && result.error) {
    console.log(`❌ Error Details:`);
    console.log(`   ${result.error}`);
    console.log();
  }

  // Job statistics
  if (result.jobs.length > 0) {
    const departments = [...new Set(result.jobs.map(j => j.department).filter(Boolean))];
    const locations = [...new Set(result.jobs.map(j => j.location).filter(Boolean))];
    const types = [...new Set(result.jobs.map(j => j.type).filter(Boolean))];

    console.log(`📋 Job Breakdown:`);
    console.log(`   Departments: ${departments.length} (${departments.slice(0, 3).join(', ')}${departments.length > 3 ? '...' : ''})`);
    console.log(`   Locations: ${locations.length} (${locations.slice(0, 3).join(', ')}${locations.length > 3 ? '...' : ''})`);
    console.log(`   Types: ${types.length} (${types.join(', ')})`);
    console.log();

    // Display job table
    displayJobTable(result.jobs.slice(0, 10)); // Show first 10 jobs
    
    if (result.jobs.length > 10) {
      console.log(`... and ${result.jobs.length - 10} more jobs`);
      console.log();
    }
  }

  // Performance metrics
  console.log(`🚀 Performance:`);
  console.log(`   Jobs/second: ${(result.jobs.length / (duration / 1000)).toFixed(2)}`);
  console.log(`   Scraped at: ${result.scrapedAt}`);
  console.log();
}

/**
 * Display jobs in table format
 */
function displayJobTable(jobs: NormalizedJob[]): void {
  if (jobs.length === 0) {
    console.log('No jobs found.');
    return;
  }

  // Calculate column widths
  const widths = {
    title: Math.min(35, Math.max(5, Math.max(...jobs.map(j => j.title.length)))),
    department: Math.min(15, Math.max(4, Math.max(...jobs.map(j => (j.department || '').length)))),
    location: Math.min(20, Math.max(8, Math.max(...jobs.map(j => (j.location || '').length)))),
    type: Math.max(4, Math.max(...jobs.map(j => (j.type || '').length))),
  };

  // Header
  const header = [
    'TITLE'.padEnd(widths.title),
    'DEPT'.padEnd(widths.department),
    'LOCATION'.padEnd(widths.location),
    'TYPE'.padEnd(widths.type),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(header.length));

  // Rows
  jobs.forEach(job => {
    const title = job.title.length > widths.title 
      ? job.title.substring(0, widths.title - 3) + '...'
      : job.title;
    
    const department = (job.department || '').length > widths.department
      ? (job.department || '').substring(0, widths.department - 3) + '...'
      : (job.department || '');
      
    const location = (job.location || '').length > widths.location
      ? (job.location || '').substring(0, widths.location - 3) + '...'
      : (job.location || '');

    const row = [
      title.padEnd(widths.title),
      department.padEnd(widths.department),
      location.padEnd(widths.location),
      (job.type || '').padEnd(widths.type),
    ].join(' | ');
    
    console.log(row);
  });

  console.log();
}

/**
 * Save results to file
 */
async function saveResults(result: LiveScrapeResult, outputPath: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const data = {
    timestamp,
    runId: `live-${Date.now()}`,
    totalJobs: result.jobs.length,
    jobs: result.jobs,
    metadata: {
      success: result.success,
      error: result.error,
      scrapedAt: result.scrapedAt,
      duration: result.performance.duration,
      config: result.config,
      debug: result.debug,
    },
  };

  await writeFile(outputPath, JSON.stringify(data, null, 2));
  console.log(`💾 Results saved to: ${outputPath}`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  console.log('🔍 Live Scraping Inspector\n');

  // Create output directories
  await createOutputDirs();

  // Get configuration
  const env = getEnvironmentConfig();
  const companyId = args.companyId || env.driveHrCompanyId;

  if (!companyId) {
    console.error('❌ No company ID provided. Set DRIVEHR_COMPANY_ID or use --company-id');
    console.error('💡 Get your company ID from your DriveHR admin dashboard');
    process.exit(1);
  }

  // Setup logger
  const logger = createLogger(args.debug ? 'debug' : 'info', true);
  setLogger(logger);

  // Create configurations
  const scraperConfig = createScraperConfig(args);
  const apiConfig = createApiConfig(companyId);

  console.log(`🎯 Target: ${apiConfig.careersUrl}`);
  console.log(`⚙️  Mode: ${scraperConfig.headless ? 'Headless' : 'Visible Browser'}`);
  console.log(`🔧 Debug: ${scraperConfig.debug ? 'Enabled' : 'Disabled'}`);
  if (args.screenshots) {
    console.log(`📸 Screenshots: Enabled`);
  }
  console.log();

  // Initialize scraper
  const scraper = new PlaywrightScraper(scraperConfig);
  const startTime = new Date();

  try {
    displayProgress('Initializing browser...', 1, 6);
    
    displayProgress('Loading careers page...', 2, 6);
    
    displayProgress('Parsing job listings...', 3, 6);
    
    displayProgress('Extracting job details...', 4, 6);
    
    displayProgress('Normalizing job data...', 5, 6);
    
    const scrapeResult = await scraper.scrapeJobs(apiConfig, 'manual');
    
    displayProgress('Finalizing results...', 6, 6);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Create enhanced result
    const result: LiveScrapeResult = {
      ...scrapeResult,
      config: {
        scraper: scraperConfig,
        api: apiConfig,
      },
      performance: {
        startTime,
        endTime,
        duration,
      },
      debug: {
        url: apiConfig.careersUrl,
        userAgent: scraperConfig.userAgent || 'Unknown',
        viewport: { width: 1920, height: 1080 },
        screenshots: scrapeResult.screenshotPath ? [scrapeResult.screenshotPath] : [],
        logs: [],
      },
    };

    // Display results based on format
    if (args.format === 'json') {
      console.log(JSON.stringify(result.jobs, null, 2));
    } else if (args.format === 'table') {
      displayJobTable(result.jobs);
    } else {
      displayDetailedResults(result);
    }

    // Save output if requested
    if (args.output) {
      await saveResults(result, args.output);
    }

    // Success message
    if (result.success && result.jobs.length > 0) {
      console.log(`🎉 Successfully scraped ${result.jobs.length} jobs!`);
      if (result.screenshotPath) {
        console.log(`📸 Screenshot saved: ${result.screenshotPath}`);
      }
    } else if (result.success && result.jobs.length === 0) {
      console.log(`⚠️  Scraping completed but no jobs found. Check if the company has active job listings.`);
    } else {
      console.log(`❌ Scraping failed: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`💡 Try running with --debug for more detailed error information`);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { createScraperConfig, createApiConfig, displayDetailedResults, displayJobTable };