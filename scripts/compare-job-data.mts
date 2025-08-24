#!/usr/bin/env tsx
/**
 * Job Data Comparison Tool
 *
 * Compares job data between different scraping runs to identify changes,
 * additions, and removals. Supports multiple output formats and filtering
 * options for comprehensive job lifecycle tracking and analysis.
 *
 * @module compare-job-data
 * @since 1.0.0
 * @see {@link ../CLAUDE.md} for development standards
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import type { NormalizedJob } from '../src/types/job.js';

/**
 * Job artifact file structure representing a complete scraping run result
 *
 * @since 1.0.0
 */
interface JobArtifact {
  /** ISO timestamp when the scraping run was executed */
  timestamp: string;
  /** Unique identifier for the scraping run */
  runId: string;
  /** Total number of jobs found during the scraping run */
  totalJobs: number;
  /** Array of normalized job data extracted during the run */
  jobs: NormalizedJob[];
}

/**
 * Comparison result for a single job between two scraping runs
 *
 * @since 1.0.0
 */
interface JobComparison {
  /** Unique job identifier */
  id: string;
  /** Comparison status indicating what happened to this job */
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  /** Job data from the earlier run (undefined for added jobs) */
  before?: NormalizedJob;
  /** Job data from the later run (undefined for removed jobs) */
  after?: NormalizedJob;
  /** Detailed field-level changes (only present for modified jobs) */
  changes?: Array<{
    /** Name of the field that changed */
    field: string;
    /** Previous value of the field */
    before: string;
    /** New value of the field */
    after: string;
  }>;
}

/**
 * Complete comparison result containing metadata, summary, and detailed job comparisons
 *
 * @since 1.0.0
 */
interface ComparisonResult {
  /** Metadata about the compared runs and comparison process */
  metadata: {
    /** Information about the first (earlier) run */
    run1: {
      /** Unique identifier for the first run */
      runId: string;
      /** ISO timestamp of the first run */
      timestamp: string;
      /** Total jobs in the first run */
      totalJobs: number;
    };
    /** Information about the second (later) run */
    run2: {
      /** Unique identifier for the second run */
      runId: string;
      /** ISO timestamp of the second run */
      timestamp: string;
      /** Total jobs in the second run */
      totalJobs: number;
    };
    /** ISO timestamp when the comparison was performed */
    comparedAt: string;
  };
  /** Statistical summary of the comparison results */
  summary: {
    /** Total number of jobs in the earlier run */
    totalBefore: number;
    /** Total number of jobs in the later run */
    totalAfter: number;
    /** Number of jobs added in the later run */
    added: number;
    /** Number of jobs removed from the earlier run */
    removed: number;
    /** Number of jobs that were modified between runs */
    modified: number;
    /** Number of jobs that remained unchanged */
    unchanged: number;
  };
  /** Detailed comparison results for each job */
  jobs: JobComparison[];
}

/**
 * Command line arguments interface for the comparison tool
 *
 * @since 1.0.0
 */
interface CliArgs {
  /** First run ID for direct comparison */
  run1?: string;
  /** Second run ID for direct comparison */
  run2?: string;
  /** Number of latest runs to compare (default: 2) */
  latest?: number;
  /** Compare runs before this date (YYYY-MM-DD format) */
  before?: string;
  /** Compare runs after this date (YYYY-MM-DD format) */
  after?: string;
  /** Whether to show only changed jobs (excludes unchanged) */
  diffOnly: boolean;
  /** Output file path for saving comparison results */
  output?: string;
  /** Output format for displaying results */
  format: 'table' | 'json' | 'summary';
  /** Whether to display help information */
  help: boolean;
}

/**
 * Parse command line arguments into structured configuration
 *
 * @returns Parsed command line arguments with defaults applied
 * @example
 * ```typescript
 * const args = parseArgs();
 * if (args.help) {
 *   showHelp();
 *   return;
 * }
 * ```
 * @since 1.0.0
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    diffOnly: false,
    format: 'table',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--run1':
        parsed.run1 = args[i + 1];
        i++;
        break;
      case '--run2':
        parsed.run2 = args[i + 1];
        i++;
        break;
      case '--latest':
        parsed.latest = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--before':
        parsed.before = args[i + 1];
        i++;
        break;
      case '--after':
        parsed.after = args[i + 1];
        i++;
        break;
      case '--diff-only':
        parsed.diffOnly = true;
        break;
      case '--output':
        parsed.output = args[i + 1];
        i++;
        break;
      case '--format':
        parsed.format = args[i + 1] as 'table' | 'json' | 'summary';
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
 * Display comprehensive help information for the comparison tool
 *
 * @returns No return value, outputs help text to console
 * @example
 * ```typescript
 * if (args.help) {
 *   showHelp();
 *   return;
 * }
 * ```
 * @since 1.0.0
 */
function showHelp(): void {
  console.log(`
🔄 Job Data Comparison Tool

Compare job data between different scraping runs to identify changes.

Usage:
  pnpm tsx scripts/compare-job-data.mts [options]

Options:
  --run1 <id>          First run ID to compare
  --run2 <id>          Second run ID to compare
  --latest <n>         Compare the latest N runs (default: 2)
  --before <date>      Compare runs before this date (YYYY-MM-DD)
  --after <date>       Compare runs after this date (YYYY-MM-DD)
  --diff-only          Show only changed/added/removed jobs
  --output <path>      Save comparison results to file
  --format <type>      Output format: table, json, summary (default: table)
  --help, -h           Show this help message

Examples:
  pnpm tsx scripts/compare-job-data.mts --latest 2
  pnpm tsx scripts/compare-job-data.mts --run1 17103740786 --run2 17105094273
  pnpm tsx scripts/compare-job-data.mts --before 2024-01-01 --after 2024-01-15
  pnpm tsx scripts/compare-job-data.mts --latest 2 --diff-only --format summary
  pnpm tsx scripts/compare-job-data.mts --run1 abc --run2 def --output comparison.json
`);
}

/**
 * Find and load all job artifacts from the jobs directory
 *
 * @returns Array of job artifacts sorted by timestamp (newest first)
 * @throws {Error} When jobs directory doesn't exist or is inaccessible
 * @example
 * ```typescript
 * const artifacts = loadArtifacts();
 * console.log(`Found ${artifacts.length} job artifacts`);
 * ```
 * @since 1.0.0
 */
function loadArtifacts(): JobArtifact[] {
  const jobsDir = './jobs';
  
  if (!existsSync(jobsDir)) {
    console.error('❌ Jobs directory not found. Run scrape-and-sync to generate data.');
    process.exit(1);
  }

  const files = readdirSync(jobsDir);
  const artifacts: JobArtifact[] = [];

  files.forEach(filename => {
    if (!filename.endsWith('.json')) return;

    const filepath = join(jobsDir, filename);
    try {
      const content = readFileSync(filepath, 'utf8');
      const data = JSON.parse(content);
      
      // Validate that parsed data has the expected JobArtifact structure
      if (data && typeof data === 'object' && 
          typeof data.timestamp === 'string' &&
          typeof data.runId === 'string' &&
          typeof data.totalJobs === 'number' &&
          Array.isArray(data.jobs)) {
        artifacts.push(data as JobArtifact);
      }
    } catch (error) {
      console.warn(`⚠️  Could not parse ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Sort by timestamp, newest first
  return artifacts.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Select two artifacts for comparison based on provided criteria
 *
 * @param artifacts - Array of available job artifacts to select from
 * @param args - Parsed command line arguments specifying selection criteria
 * @returns Tuple containing [earlier_artifact, later_artifact] for comparison
 * @throws {Error} When specified run IDs are not found in available artifacts
 * @throws {Error} When insufficient artifacts are available for comparison
 * @throws {Error} When date range filters result in fewer than 2 artifacts
 * @example
 * ```typescript
 * const artifacts = loadArtifacts();
 * const [run1, run2] = selectArtifacts(artifacts, args);
 * console.log(`Comparing ${run1.runId} with ${run2.runId}`);
 * ```
 * @since 1.0.0
 */
function selectArtifacts(artifacts: JobArtifact[], args: CliArgs): [JobArtifact, JobArtifact] {
  // Direct run ID specification
  if (args.run1 && args.run2) {
    const run1 = artifacts.find(a => a.runId === args.run1);
    const run2 = artifacts.find(a => a.runId === args.run2);

    if (!run1) {
      console.error(`❌ Run ID not found: ${args.run1}`);
      console.log(`Available run IDs: ${artifacts.map(a => a.runId).join(', ')}`);
      process.exit(1);
    }

    if (!run2) {
      console.error(`❌ Run ID not found: ${args.run2}`);
      console.log(`Available run IDs: ${artifacts.map(a => a.runId).join(', ')}`);
      process.exit(1);
    }

    return [run1, run2];
  }

  // Latest N runs
  if (args.latest) {
    if (artifacts.length < args.latest) {
      console.error(`❌ Not enough artifacts. Found ${artifacts.length}, need ${args.latest}`);
      process.exit(1);
    }

    return [artifacts[1], artifacts[0]]; // Compare 2nd newest with newest
  }

  // Date range
  if (args.before || args.after) {
    let filtered = artifacts;

    if (args.before) {
      const beforeDate = new Date(args.before);
      filtered = filtered.filter(a => new Date(a.timestamp) <= beforeDate);
    }

    if (args.after) {
      const afterDate = new Date(args.after);
      filtered = filtered.filter(a => new Date(a.timestamp) >= afterDate);
    }

    if (filtered.length < 2) {
      console.error(`❌ Not enough artifacts in date range. Found ${filtered.length}, need 2`);
      process.exit(1);
    }

    return [filtered[1], filtered[0]]; // Compare 2nd newest with newest in range
  }

  // Default: compare latest 2
  if (artifacts.length < 2) {
    console.error(`❌ Not enough artifacts for comparison. Found ${artifacts.length}, need 2`);
    console.log('💡 Run scrape-and-sync multiple times to generate comparison data');
    process.exit(1);
  }

  return [artifacts[1], artifacts[0]]; // Compare 2nd newest with newest
}

/**
 * Compare two job datasets to identify changes, additions, and removals
 *
 * @param before - Job dataset from the earlier scraping run
 * @param after - Job dataset from the later scraping run
 * @returns Array of comparison results for each job found in either dataset
 * @example
 * ```typescript
 * const comparisons = compareJobs(artifact1.jobs, artifact2.jobs);
 * const addedJobs = comparisons.filter(c => c.status === 'added');
 * console.log(`Found ${addedJobs.length} new jobs`);
 * ```
 * @since 1.0.0
 */
function compareJobs(before: NormalizedJob[], after: NormalizedJob[]): JobComparison[] {
  const comparisons: JobComparison[] = [];
  const afterById = new Map(after.map(job => [job.id, job]));
  const beforeById = new Map(before.map(job => [job.id, job]));

  // Check all jobs from before dataset
  before.forEach(beforeJob => {
    const afterJob = afterById.get(beforeJob.id);

    if (!afterJob) {
      // Job was removed
      comparisons.push({
        id: beforeJob.id,
        status: 'removed',
        before: beforeJob,
      });
    } else {
      // Job exists in both, check for changes
      const changes = findJobChanges(beforeJob, afterJob);
      
      comparisons.push({
        id: beforeJob.id,
        status: changes.length > 0 ? 'modified' : 'unchanged',
        before: beforeJob,
        after: afterJob,
        changes: changes.length > 0 ? changes : undefined,
      });
    }
  });

  // Check for new jobs in after dataset
  after.forEach(afterJob => {
    if (!beforeById.has(afterJob.id)) {
      comparisons.push({
        id: afterJob.id,
        status: 'added',
        after: afterJob,
      });
    }
  });

  return comparisons;
}

/**
 * Find field-level changes between two versions of the same job
 *
 * @param before - Job data from the earlier scraping run
 * @param after - Job data from the later scraping run
 * @returns Array of field changes with before/after values
 * @example
 * ```typescript
 * const changes = findJobChanges(oldJob, newJob);
 * changes.forEach(change => {
 *   console.log(`${change.field}: '${change.before}' → '${change.after}'`);
 * });
 * ```
 * @since 1.0.0
 */
function findJobChanges(before: NormalizedJob, after: NormalizedJob): Array<{ field: string; before: string; after: string }> {
  const changes: Array<{ field: string; before: string; after: string }> = [];
  const fields: (keyof NormalizedJob)[] = [
    'title', 'department', 'location', 'type', 'description', 'postedDate', 'applyUrl'
  ];

  fields.forEach(field => {
    if (before[field] !== after[field]) {
      changes.push({
        field,
        before: before[field],
        after: after[field],
      });
    }
  });

  return changes;
}

/**
 * Create comprehensive comparison result from artifacts and job comparisons
 *
 * @param artifact1 - First (earlier) job artifact being compared
 * @param artifact2 - Second (later) job artifact being compared  
 * @param comparisons - Array of individual job comparison results
 * @returns Complete comparison result with metadata, summary, and details
 * @example
 * ```typescript
 * const comparisons = compareJobs(run1.jobs, run2.jobs);
 * const result = createComparisonResult(run1, run2, comparisons);
 * console.log(`Found ${result.summary.modified} modified jobs`);
 * ```
 * @since 1.0.0
 */
function createComparisonResult(
  artifact1: JobArtifact, 
  artifact2: JobArtifact, 
  comparisons: JobComparison[]
): ComparisonResult {
  const summary = {
    totalBefore: artifact1.jobs.length,
    totalAfter: artifact2.jobs.length,
    added: comparisons.filter(c => c.status === 'added').length,
    removed: comparisons.filter(c => c.status === 'removed').length,
    modified: comparisons.filter(c => c.status === 'modified').length,
    unchanged: comparisons.filter(c => c.status === 'unchanged').length,
  };

  return {
    metadata: {
      run1: {
        runId: artifact1.runId,
        timestamp: artifact1.timestamp,
        totalJobs: artifact1.totalJobs,
      },
      run2: {
        runId: artifact2.runId,
        timestamp: artifact2.timestamp,
        totalJobs: artifact2.totalJobs,
      },
      comparedAt: new Date().toISOString(),
    },
    summary,
    jobs: comparisons,
  };
}

/**
 * Display formatted comparison summary with key statistics and metadata
 *
 * @param result - Complete comparison result to summarize
 * @returns No return value, outputs formatted summary to console
 * @example
 * ```typescript
 * const result = createComparisonResult(run1, run2, comparisons);
 * displaySummary(result);
 * ```
 * @since 1.0.0
 */
function displaySummary(result: ComparisonResult): void {
  const { metadata, summary } = result;
  
  console.log('📊 Job Data Comparison Summary');
  console.log('='.repeat(32));
  console.log();

  // Runs info
  const run1Date = new Date(metadata.run1.timestamp).toLocaleString();
  const run2Date = new Date(metadata.run2.timestamp).toLocaleString();
  
  console.log(`📋 Comparing:`);
  console.log(`   Before: Run ${metadata.run1.runId} (${run1Date}) - ${metadata.run1.totalJobs} jobs`);
  console.log(`   After:  Run ${metadata.run2.runId} (${run2Date}) - ${metadata.run2.totalJobs} jobs`);
  console.log();

  // Summary stats
  const netChange = summary.totalAfter - summary.totalBefore;
  const netChangeIcon = netChange > 0 ? '📈' : netChange < 0 ? '📉' : '➡️';
  
  console.log(`📊 Changes:`);
  console.log(`   ${netChangeIcon} Net Change: ${netChange > 0 ? '+' : ''}${netChange} jobs`);
  console.log(`   ➕ Added: ${summary.added} jobs`);
  console.log(`   ➖ Removed: ${summary.removed} jobs`);
  console.log(`   ✏️  Modified: ${summary.modified} jobs`);
  console.log(`   ✓ Unchanged: ${summary.unchanged} jobs`);
  console.log();

  // Change rate
  const totalBefore = summary.totalBefore || 1; // Avoid division by zero
  const changeRate = ((summary.added + summary.removed + summary.modified) / totalBefore) * 100;
  
  console.log(`📈 Change Rate: ${changeRate.toFixed(1)}%`);
  console.log();
}

/**
 * Display detailed comparison results in formatted table layout
 *
 * @param comparisons - Array of job comparison results to display
 * @param diffOnly - Whether to show only jobs with changes (excludes unchanged)
 * @returns No return value, outputs formatted table to console
 * @example
 * ```typescript
 * const comparisons = compareJobs(run1.jobs, run2.jobs);
 * displayComparisonTable(comparisons, true); // Show only changes
 * ```
 * @since 1.0.0
 */
function displayComparisonTable(comparisons: JobComparison[], diffOnly: boolean): void {
  const filteredComparisons = diffOnly 
    ? comparisons.filter(c => c.status !== 'unchanged')
    : comparisons;

  if (filteredComparisons.length === 0) {
    console.log(diffOnly ? 'No changes found between the datasets.' : 'No jobs to display.');
    return;
  }

  console.log(`📋 Job Changes ${diffOnly ? '(Changes Only)' : '(All Jobs)'}`);
  console.log('='.repeat(diffOnly ? 23 : 13));
  console.log();

  // Calculate column widths
  const widths = {
    status: 8,
    id: Math.max(3, Math.min(15, Math.max(...filteredComparisons.map(c => c.id.length)))),
    title: Math.max(5, Math.min(35, Math.max(...filteredComparisons.map(c => 
      Math.max(
        c.before?.title?.length || 0,
        c.after?.title?.length || 0
      )
    )))),
    changes: 20,
  };

  // Header
  const header = [
    'STATUS'.padEnd(widths.status),
    'ID'.padEnd(widths.id),
    'TITLE'.padEnd(widths.title),
    'CHANGES'.padEnd(widths.changes),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(header.length));

  // Rows
  filteredComparisons.forEach(comparison => {
    const statusIcons = {
      added: '➕ NEW',
      removed: '➖ DEL',
      modified: '✏️  MOD',
      unchanged: '✓ SAME',
    };

    const title = comparison.after?.title || comparison.before?.title || '';
    const truncatedTitle = title.length > widths.title 
      ? title.substring(0, widths.title - 3) + '...'
      : title;

    const changesText = comparison.changes 
      ? comparison.changes.map(c => c.field).join(', ')
      : '';
    const truncatedChanges = changesText.length > widths.changes
      ? changesText.substring(0, widths.changes - 3) + '...'
      : changesText;

    const row = [
      statusIcons[comparison.status].padEnd(widths.status),
      comparison.id.padEnd(widths.id),
      truncatedTitle.padEnd(widths.title),
      truncatedChanges.padEnd(widths.changes),
    ].join(' | ');

    console.log(row);
  });

  console.log();
}

/**
 * Display detailed field-level changes for modified jobs
 *
 * @param comparisons - Array of job comparison results to analyze
 * @returns No return value, outputs detailed changes to console
 * @example
 * ```typescript
 * const comparisons = compareJobs(run1.jobs, run2.jobs);
 * displayDetailedChanges(comparisons);
 * ```
 * @since 1.0.0
 */
function displayDetailedChanges(comparisons: JobComparison[]): void {
  const modifiedJobs = comparisons.filter(c => c.status === 'modified');
  
  if (modifiedJobs.length === 0) {
    console.log('No modified jobs found.');
    return;
  }

  console.log(`🔍 Detailed Changes (${modifiedJobs.length} jobs)`);
  console.log('='.repeat(30));
  console.log();

  modifiedJobs.slice(0, 5).forEach((job, index) => { // Show first 5 detailed changes
    console.log(`${index + 1}. ${job.after?.title || job.before?.title} (${job.id})`);
    
    job.changes?.forEach(change => {
      console.log(`   ${change.field}:`);
      console.log(`     Before: ${change.before || '(empty)'}`);
      console.log(`     After:  ${change.after || '(empty)'}`);
    });
    
    console.log();
  });

  if (modifiedJobs.length > 5) {
    console.log(`... and ${modifiedJobs.length - 5} more modified jobs`);
    console.log();
  }
}

/**
 * Save comparison results to JSON file for further analysis
 *
 * @param result - Complete comparison result to save
 * @param outputPath - File path where the results should be saved
 * @returns Promise that resolves when the file is successfully written
 * @throws {Error} When file system operations fail (permissions, disk space, etc.)
 * @example
 * ```typescript
 * const result = createComparisonResult(run1, run2, comparisons);
 * await saveResults(result, './comparisons/latest-comparison.json');
 * console.log('Results saved successfully');
 * ```
 * @since 1.0.0
 */
async function saveResults(result: ComparisonResult, outputPath: string): Promise<void> {
  await mkdir('./comparisons', { recursive: true });
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`💾 Comparison saved to: ${outputPath}`);
}

/**
 * Main execution function orchestrating the complete comparison workflow
 *
 * @returns Promise that resolves when comparison is complete
 * @throws {Error} When critical errors occur during comparison process
 * @example
 * ```typescript
 * // Called automatically when script is executed directly
 * await main();
 * ```
 * @since 1.0.0
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  console.log('🔄 Job Data Comparison Tool\n');

  // Load artifacts
  const artifacts = loadArtifacts();
  
  if (artifacts.length === 0) {
    console.error('❌ No job artifacts found. Run scrape-and-sync to generate data.');
    process.exit(1);
  }

  console.log(`📁 Found ${artifacts.length} job artifacts`);

  // Select artifacts to compare
  const [artifact1, artifact2] = selectArtifacts(artifacts, args);

  console.log(`🔍 Comparing datasets...`);

  // Perform comparison
  const comparisons = compareJobs(artifact1.jobs, artifact2.jobs);
  const result = createComparisonResult(artifact1, artifact2, comparisons);

  // Display results based on format
  if (args.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displaySummary(result);
    
    if (args.format === 'table') {
      displayComparisonTable(comparisons, args.diffOnly);
      
      if (!args.diffOnly) {
        displayDetailedChanges(comparisons);
      }
    }
  }

  // Save output if requested
  if (args.output) {
    await saveResults(result, args.output);
  }

  // Final summary
  const hasChanges = result.summary.added > 0 || result.summary.removed > 0 || result.summary.modified > 0;
  
  if (hasChanges) {
    console.log(`🎯 Found ${result.summary.added + result.summary.removed + result.summary.modified} changes between runs`);
  } else {
    console.log(`✅ No changes found between the compared datasets`);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

/**
 * Exported comparison utilities for programmatic usage
 *
 * @since 1.0.0
 */
export { compareJobs, findJobChanges, createComparisonResult };