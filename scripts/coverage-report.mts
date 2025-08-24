#!/usr/bin/env tsx
/**
 * Coverage Report CLI Tool
 *
 * Enterprise-grade coverage reporting tool that generates clean, focused
 * coverage reports from LCOV data. Filters out build artifacts and Netlify
 * functions, focusing on source code coverage with color-coded output and
 * multiple format support.
 *
 * Features:
 * - Clean LCOV parsing with artifact filtering
 * - Summary and detailed coverage views
 * - Color-coded output with coverage thresholds
 * - JSON export for CI/CD integration
 * - File pattern filtering for targeted reporting
 * - Enterprise-grade error handling and validation
 *
 * @example
 * ```typescript
 * // Generate summary report
 * pnpm tsx scripts/coverage-report.mts
 * 
 * // Detailed view with threshold
 * pnpm tsx scripts/coverage-report.mts --detailed --threshold 85
 * 
 * // JSON output for CI
 * pnpm tsx scripts/coverage-report.mts --format json > coverage.json
 * ```
 *
 * @module coverage-report
 * @since 1.0.0
 * @see {@link ../CLAUDE.md} for development standards and testing requirements
 * @see {@link ../vitest.config.ts} for test configuration
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';

/**
 * Command-line interface arguments for coverage reporting
 *
 * Defines all available CLI options for controlling coverage report
 * generation, output formatting, and filtering behavior.
 *
 * @since 1.0.0
 */
interface CliArgs {
  detailed: boolean;
  format: 'table' | 'json' | 'summary';
  threshold: number;
  help: boolean;
  filter?: string;
}

/**
 * Coverage metrics for a single source file
 *
 * Comprehensive coverage data including line, function, and branch
 * coverage with calculated percentages and overall coverage score.
 *
 * @since 1.0.0
 */
interface FileCoverage {
  file: string;
  lines: {
    found: number;
    hit: number;
    percentage: number;
  };
  functions: {
    found: number;
    hit: number;
    percentage: number;
  };
  branches: {
    found: number;
    hit: number;
    percentage: number;
  };
  overall: number;
}

/**
 * Overall coverage summary with aggregated metrics
 *
 * Contains aggregated coverage data across all files with totals,
 * threshold validation, and file-level coverage details.
 *
 * @since 1.0.0
 */
interface CoverageSummary {
  files: FileCoverage[];
  totals: {
    lines: { found: number; hit: number; percentage: number };
    functions: { found: number; hit: number; percentage: number };
    branches: { found: number; hit: number; percentage: number };
    overall: number;
  };
  thresholds: {
    passed: boolean;
    threshold: number;
    actual: number;
  };
}

/**
 * Parse command line arguments with validation
 *
 * Parses process.argv to extract coverage report configuration options
 * including output format, threshold settings, and filtering criteria.
 *
 * @returns Parsed CLI arguments with defaults applied
 * @example
 * ```typescript
 * const args = parseArgs();
 * console.log(args.detailed); // boolean
 * console.log(args.threshold); // number (default: 90)
 * ```
 * @since 1.0.0
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    detailed: false,
    format: 'summary',
    threshold: 90,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--detailed':
      case '-d':
        parsed.detailed = true;
        break;
      case '--format':
      case '-f':
        parsed.format = args[i + 1] as 'table' | 'json' | 'summary';
        i++;
        break;
      case '--threshold':
      case '-t':
        parsed.threshold = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--filter':
        parsed.filter = args[i + 1];
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
 * Display comprehensive help information
 *
 * Outputs detailed usage instructions, available options, examples,
 * and coverage threshold guidelines to assist users with the CLI tool.
 *
 * @example
 * ```typescript
 * showHelp();
 * // Displays formatted help text to console
 * ```
 * @since 1.0.0
 */
function showHelp(): void {
  console.log(`
📊 Coverage Report CLI Tool

Generate clean, focused coverage reports from LCOV data.

Usage:
  pnpm tsx scripts/coverage-report.mts [options]

Options:
  --detailed, -d           Show detailed file-by-file coverage
  --format <type>          Output format: table, json, summary (default: summary)
  --threshold <n>          Coverage threshold percentage (default: 90)
  --filter <pattern>       Filter files by pattern (regex supported)
  --help, -h               Show this help message

Examples:
  pnpm tsx scripts/coverage-report.mts --detailed
  pnpm tsx scripts/coverage-report.mts --format table --threshold 85
  pnpm tsx scripts/coverage-report.mts --filter "src/services"
  pnpm tsx scripts/coverage-report.mts --format json > coverage-report.json

Coverage Thresholds:
  🟢 Excellent: 90%+
  🟡 Good: 80-89%
  🟠 Fair: 70-79%
  🔴 Poor: <70%
`);
}

/**
 * Parse LCOV file and extract coverage data
 *
 * Reads and parses LCOV format coverage data, extracting line, function,
 * and branch coverage metrics for each file. Filters out build artifacts
 * and focuses on source code coverage only.
 *
 * @param filePath - Absolute path to the LCOV info file
 * @returns Sorted array of file coverage data (highest coverage first)
 * @throws {Error} When LCOV file cannot be read or parsed
 * @example
 * ```typescript
 * const coverage = await parseLcovFile('/path/to/lcov.info');
 * coverage.forEach(file => {
 *   console.log(`${file.file}: ${file.overall.toFixed(1)}%`);
 * });
 * ```
 * @since 1.0.0
 */
async function parseLcovFile(filePath: string): Promise<FileCoverage[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const records = content.split('end_of_record\n');
    const files: FileCoverage[] = [];

    for (const record of records) {
      if (!record.trim()) continue;

      const lines = record.trim().split('\n');
      let currentFile = '';
      let linesFound = 0, linesHit = 0;
      let functionsFound = 0, functionsHit = 0;
      let branchesFound = 0, branchesHit = 0;

      for (const line of lines) {
        if (line.startsWith('SF:')) {
          currentFile = line.substring(3);
        } else if (line.startsWith('LF:')) {
          linesFound = parseInt(line.substring(3), 10);
        } else if (line.startsWith('LH:')) {
          linesHit = parseInt(line.substring(3), 10);
        } else if (line.startsWith('FNF:')) {
          functionsFound = parseInt(line.substring(4), 10);
        } else if (line.startsWith('FNH:')) {
          functionsHit = parseInt(line.substring(4), 10);
        } else if (line.startsWith('BRF:')) {
          branchesFound = parseInt(line.substring(4), 10);
        } else if (line.startsWith('BRH:')) {
          branchesHit = parseInt(line.substring(4), 10);
        }
      }

      if (currentFile && shouldIncludeFile(currentFile)) {
        const linesPercentage = linesFound > 0 ? (linesHit / linesFound) * 100 : 0;
        const functionsPercentage = functionsFound > 0 ? (functionsHit / functionsFound) * 100 : 0;
        const branchesPercentage = branchesFound > 0 ? (branchesHit / branchesFound) * 100 : 0;
        
        // Overall coverage is weighted average
        const overall = linesFound > 0 ? linesPercentage : 0;

        files.push({
          file: currentFile,
          lines: {
            found: linesFound,
            hit: linesHit,
            percentage: linesPercentage,
          },
          functions: {
            found: functionsFound,
            hit: functionsHit,
            percentage: functionsPercentage,
          },
          branches: {
            found: branchesFound,
            hit: branchesHit,
            percentage: branchesPercentage,
          },
          overall,
        });
      }
    }

    return files.sort((a, b) => b.overall - a.overall);
  } catch (error) {
    throw new Error(`Failed to parse LCOV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Filter out build artifacts and focus on source files
 *
 * Determines whether a file should be included in coverage reporting
 * by filtering out Netlify functions, node_modules, build artifacts,
 * and other non-source files.
 *
 * @param filePath - File path to evaluate for inclusion
 * @returns True if file should be included in coverage report
 * @example
 * ```typescript
 * shouldIncludeFile('src/lib/config.ts'); // true
 * shouldIncludeFile('.netlify/functions/sync.js'); // false
 * shouldIncludeFile('node_modules/lodash/index.js'); // false
 * ```
 * @since 1.0.0
 */
function shouldIncludeFile(filePath: string): boolean {
  // Exclude Netlify artifacts, build files, and node_modules
  const excludePatterns = [
    /\.netlify\//,
    /node_modules\//,
    /dist\//,
    /coverage\//,
    /__netlify/,
    /___netlify/,
    /\.d\./,
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  // Only include source files and scripts
  return filePath.startsWith('src/') || filePath.startsWith('scripts/');
}

/**
 * Calculate overall coverage summary with threshold validation
 *
 * Aggregates individual file coverage metrics into overall totals,
 * calculates percentages, and validates against the specified threshold
 * for pass/fail determination.
 *
 * @param files - Array of individual file coverage data
 * @param threshold - Minimum coverage percentage required for passing
 * @returns Complete coverage summary with totals and threshold validation
 * @example
 * ```typescript
 * const summary = calculateSummary(files, 90);
 * console.log(`Overall: ${summary.totals.overall.toFixed(1)}%`);
 * console.log(`Passed: ${summary.thresholds.passed}`);
 * ```
 * @since 1.0.0
 */
function calculateSummary(files: FileCoverage[], threshold: number): CoverageSummary {
  const totals = {
    lines: { found: 0, hit: 0, percentage: 0 },
    functions: { found: 0, hit: 0, percentage: 0 },
    branches: { found: 0, hit: 0, percentage: 0 },
    overall: 0,
  };

  for (const file of files) {
    totals.lines.found += file.lines.found;
    totals.lines.hit += file.lines.hit;
    totals.functions.found += file.functions.found;
    totals.functions.hit += file.functions.hit;
    totals.branches.found += file.branches.found;
    totals.branches.hit += file.branches.hit;
  }

  totals.lines.percentage = totals.lines.found > 0 ? (totals.lines.hit / totals.lines.found) * 100 : 0;
  totals.functions.percentage = totals.functions.found > 0 ? (totals.functions.hit / totals.functions.found) * 100 : 0;
  totals.branches.percentage = totals.branches.found > 0 ? (totals.branches.hit / totals.branches.found) * 100 : 0;
  totals.overall = totals.lines.percentage;

  return {
    files,
    totals,
    thresholds: {
      passed: totals.overall >= threshold,
      threshold,
      actual: totals.overall,
    },
  };
}

/**
 * Get coverage status icon and ANSI color code
 *
 * Returns appropriate emoji icon and ANSI color code based on
 * coverage percentage thresholds for console output formatting.
 *
 * @param percentage - Coverage percentage to evaluate
 * @returns Object with emoji icon and ANSI color code
 * @example
 * ```typescript
 * const status = getCoverageStatus(95.2);
 * console.log(status.icon); // '🟢'
 * console.log(status.color); // '\\033[32m' (green)
 * ```
 * @since 1.0.0
 */
function getCoverageStatus(percentage: number): { icon: string; color: string } {
  if (percentage >= 90) return { icon: '🟢', color: '\\033[32m' }; // Green
  if (percentage >= 80) return { icon: '🟡', color: '\\033[33m' }; // Yellow
  if (percentage >= 70) return { icon: '🟠', color: '\\033[93m' }; // Orange
  return { icon: '🔴', color: '\\033[31m' }; // Red
}

/**
 * Format percentage with color coding and padding
 *
 * Formats coverage percentage with appropriate ANSI color coding
 * and consistent padding for tabular display. Handles zero-coverage
 * cases gracefully.
 *
 * @param percentage - Coverage percentage to format
 * @param found - Number of items found (0 = no coverage data)
 * @returns Formatted percentage string with color codes and padding
 * @example
 * ```typescript
 * formatPercentage(87.5); // '\\033[33m 87.5%\\033[0m'
 * formatPercentage(0, 0);  // '     -'
 * ```
 * @since 1.0.0
 */
function formatPercentage(percentage: number, found: number = 1): string {
  if (found === 0) return '     -';
  
  const { color } = getCoverageStatus(percentage);
  const resetColor = '\\033[0m';
  return `${color}${percentage.toFixed(1).padStart(5)}%${resetColor}`;
}

/**
 * Display formatted coverage summary report
 *
 * Outputs comprehensive coverage summary including overall status,
 * threshold validation, coverage breakdown by type, and file
 * distribution statistics with color-coded formatting.
 *
 * @param summary - Coverage summary data to display
 * @example
 * ```typescript
 * const summary = calculateSummary(files, 90);
 * displaySummary(summary);
 * // Outputs formatted summary to console
 * ```
 * @since 1.0.0
 */
function displaySummary(summary: CoverageSummary): void {
  const { totals, thresholds } = summary;
  const statusIcon = thresholds.passed ? '✅' : '❌';
  
  console.log('\\n📊 Coverage Summary Report');
  console.log('='.repeat(28));
  console.log();

  console.log(`${statusIcon} Overall Status: ${thresholds.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`🎯 Threshold: ${thresholds.threshold}% | Actual: ${formatPercentage(thresholds.actual)}`);
  console.log();

  console.log('📈 Coverage Breakdown:');
  console.log(`   Lines:     ${formatPercentage(totals.lines.percentage)} (${totals.lines.hit}/${totals.lines.found})`);
  console.log(`   Functions: ${formatPercentage(totals.functions.percentage)} (${totals.functions.hit}/${totals.functions.found})`);
  console.log(`   Branches:  ${formatPercentage(totals.branches.percentage)} (${totals.branches.hit}/${totals.branches.found})`);
  console.log();

  // Show file count by category
  const excellent = summary.files.filter(f => f.overall >= 90).length;
  const good = summary.files.filter(f => f.overall >= 80 && f.overall < 90).length;
  const fair = summary.files.filter(f => f.overall >= 70 && f.overall < 80).length;
  const poor = summary.files.filter(f => f.overall < 70 && f.lines.found > 0).length;
  const untested = summary.files.filter(f => f.lines.found === 0).length;

  console.log('📁 File Coverage Distribution:');
  if (excellent > 0) console.log(`   🟢 Excellent (90%+): ${excellent} files`);
  if (good > 0) console.log(`   🟡 Good (80-89%): ${good} files`);
  if (fair > 0) console.log(`   🟠 Fair (70-79%): ${fair} files`);
  if (poor > 0) console.log(`   🔴 Poor (<70%): ${poor} files`);
  if (untested > 0) console.log(`   ⚫ Untested: ${untested} files`);
  console.log();
}

/**
 * Display detailed file-by-file coverage report
 *
 * Outputs tabular coverage report showing individual file metrics
 * including line, function, and branch coverage percentages with
 * status indicators. Supports optional regex filtering.
 *
 * @param summary - Coverage summary containing file details
 * @param filter - Optional regex pattern to filter displayed files
 * @example
 * ```typescript
 * displayDetailed(summary); // Show all files
 * displayDetailed(summary, 'services'); // Show only services files
 * ```
 * @since 1.0.0
 */
function displayDetailed(summary: CoverageSummary, filter?: string): void {
  let files = summary.files;
  
  if (filter) {
    const filterRegex = new RegExp(filter, 'i');
    files = files.filter(f => filterRegex.test(f.file));
  }

  console.log('\\n📋 Detailed Coverage Report');
  console.log('='.repeat(29));
  console.log();

  // Header
  const header = [
    'FILE'.padEnd(50),
    'LINES'.padStart(8),
    'FUNCS'.padStart(8),
    'BRANCH'.padStart(8),
    'TOTAL'.padStart(8),
    'STATUS',
  ].join(' | ');
  
  console.log(header);
  console.log('-'.repeat(header.length + 10));

  // Files
  for (const file of files) {
    if (file.lines.found === 0) continue; // Skip untested files
    
    const { icon } = getCoverageStatus(file.overall);
    const fileName = file.file.length > 50 
      ? '...' + file.file.substring(file.file.length - 47)
      : file.file;

    const row = [
      fileName.padEnd(50),
      formatPercentage(file.lines.percentage, file.lines.found).padStart(8),
      formatPercentage(file.functions.percentage, file.functions.found).padStart(8),
      formatPercentage(file.branches.percentage, file.branches.found).padStart(8),
      formatPercentage(file.overall).padStart(8),
      icon,
    ].join(' | ');

    console.log(row);
  }

  console.log();
}

/**
 * Main execution function for coverage report generation
 *
 * Orchestrates the complete coverage reporting workflow including
 * argument parsing, LCOV file processing, coverage calculation,
 * and formatted output generation. Handles errors gracefully
 * and exits with appropriate status codes.
 *
 * @throws {Error} When coverage file is missing or parsing fails
 * @example
 * ```typescript
 * await main();
 * // Generates coverage report based on CLI arguments
 * ```
 * @since 1.0.0
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  console.log('📊 Coverage Report Generator\\n');

  // Check if coverage file exists
  const lcovPath = join(process.cwd(), 'coverage', 'lcov.info');
  try {
    await access(lcovPath);
  } catch {
    console.error('❌ Coverage file not found: coverage/lcov.info');
    console.error('💡 Run "pnpm test:coverage" first to generate coverage data');
    process.exit(1);
  }

  try {
    // Parse coverage data
    console.log('🔍 Parsing coverage data...');
    const files = await parseLcovFile(lcovPath);
    const summary = calculateSummary(files, args.threshold);

    if (files.length === 0) {
      console.log('⚠️  No source files found in coverage report');
      console.log('💡 Make sure your tests are running against source files');
      return;
    }

    // Display results based on format
    if (args.format === 'json') {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      displaySummary(summary);
      
      if (args.detailed || args.format === 'table') {
        displayDetailed(summary, args.filter);
      }

      // Show improvement suggestions
      const poorFiles = summary.files.filter(f => f.overall < args.threshold && f.lines.found > 0);
      if (poorFiles.length > 0) {
        console.log('🚨 Files Below Threshold:');
        poorFiles.slice(0, 5).forEach(file => {
          const shortName = file.file.replace(/^src\//, '');
          console.log(`   • ${shortName}: ${formatPercentage(file.overall)}`);
        });
        
        if (poorFiles.length > 5) {
          console.log(`   ... and ${poorFiles.length - 5} more files`);
        }
        console.log();
      }

      // Exit with error if below threshold
      if (!summary.thresholds.passed) {
        console.log('❌ Coverage below threshold. Consider adding more tests.');
        process.exit(1);
      } else {
        console.log('✅ Coverage threshold met!');
      }
    }

  } catch (error) {
    console.error(`❌ Error generating coverage report: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

export { parseLcovFile, calculateSummary, displaySummary, displayDetailed };