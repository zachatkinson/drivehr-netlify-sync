#!/usr/bin/env tsx
/**
 * Job Data Comparison Tool
 *
 * Utility to compare job data between different scraping runs to identify
 * changes, additions, and removals. Useful for monitoring job posting
 * changes over time and validating scraping consistency.
 *
 * Usage:
 *   pnpm tsx scripts/compare-job-data.mts --run1 17103740786 --run2 17105094273
 *   pnpm tsx scripts/compare-job-data.mts --latest 2
 *   pnpm tsx scripts/compare-job-data.mts --before 2024-01-01 --after 2024-01-15
 *   pnpm tsx scripts/compare-job-data.mts --diff-only
 *
 * @since 1.0.0
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import type { NormalizedJob } from '../src/types/job.js';

/**
 * Job artifact file structure
 */
interface JobArtifact {
  timestamp: string;
  runId: string;
  totalJobs: number;
  jobs: NormalizedJob[];
}

/**
 * Comparison result for a single job
 */
interface JobComparison {
  id: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  before?: NormalizedJob;
  after?: NormalizedJob;
  changes?: Array<{
    field: string;
    before: any;
    after: any;
  }>;
}

/**
 * Complete comparison result
 */
interface ComparisonResult {
  metadata: {
    run1: {
      runId: string;
      timestamp: string;
      totalJobs: number;
    };
    run2: {
      runId: string;
      timestamp: string;
      totalJobs: number;
    };
    comparedAt: string;
  };
  summary: {
    totalBefore: number;
    totalAfter: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  jobs: JobComparison[];
}

/**
 * CLI arguments interface
 */
interface CliArgs {
  run1?: string;
  run2?: string;
  latest?: number;
  before?: string;
  after?: string;
  diffOnly: boolean;
  output?: string;
  format: 'table' | 'json' | 'summary';
  help: boolean;
}

/**
 * Parse command line arguments
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
 * Display help information
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
 * Find and load job artifacts
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
      const data = JSON.parse(content) as JobArtifact;
      
      if (data.jobs && Array.isArray(data.jobs)) {
        artifacts.push(data);
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
 * Select artifacts based on criteria
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
 * Compare two job datasets
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
 * Find changes between two jobs
 */
function findJobChanges(before: NormalizedJob, after: NormalizedJob): Array<{ field: string; before: any; after: any }> {
  const changes: Array<{ field: string; before: any; after: any }> = [];
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
 * Create comparison result
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
 * Display comparison summary
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
 * Display detailed comparison table
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
 * Display detailed changes for modified jobs
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
 * Save comparison results to file
 */
async function saveResults(result: ComparisonResult, outputPath: string): Promise<void> {
  await mkdir('./comparisons', { recursive: true });
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`💾 Comparison saved to: ${outputPath}`);
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

export { compareJobs, findJobChanges, createComparisonResult };