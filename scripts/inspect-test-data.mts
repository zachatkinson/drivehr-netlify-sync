#!/usr/bin/env tsx
/**
 * Test Data Inspector
 *
 * Utility script to inspect and display mock job data used in tests.
 * Provides formatted output of sample jobs, validation, and comparison
 * between test data structures and expected production data formats.
 *
 * Usage:
 *   pnpm tsx scripts/inspect-test-data.mts
 *   pnpm tsx scripts/inspect-test-data.mts --format json
 *   pnpm tsx scripts/inspect-test-data.mts --validate
 *
 * @since 1.0.0
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { NormalizedJob } from '../src/types/job.js';

/**
 * Sample normalized job data from tests
 * Extracted from test/services/wordpress-client.test.ts
 */
const SAMPLE_JOBS = {
  single: [
    {
      id: 'job-001',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'Build scalable applications using modern technologies.',
      postedDate: '2024-01-01T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-001',
      source: 'webhook' as const,
    },
  ] as NormalizedJob[],

  multiple: [
    {
      id: 'job-001',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'Build scalable applications using modern technologies.',
      postedDate: '2024-01-01T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-001',
      source: 'webhook' as const,
    },
    {
      id: 'job-002',
      title: 'Product Manager',
      department: 'Product',
      location: 'New York, NY',
      type: 'Full-time',
      description: 'Lead product development and strategy initiatives.',
      postedDate: '2024-01-02T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-002',
      source: 'webhook' as const,
    },
    {
      id: 'job-003',
      title: 'UX Designer',
      department: 'Design',
      location: 'Remote',
      type: 'Contract',
      description: 'Design user experiences for web and mobile applications.',
      postedDate: '2024-01-03T00:00:00.000Z',
      applyUrl: 'https://example.com/apply/job-003',
      source: 'webhook' as const,
    },
  ] as NormalizedJob[],

  empty: [] as NormalizedJob[],
} as const;

/**
 * Command line arguments interface
 */
interface CliArgs {
  format: 'table' | 'json' | 'yaml';
  validate: boolean;
  dataset: 'single' | 'multiple' | 'empty' | 'all';
  help: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    format: 'table',
    validate: false,
    dataset: 'all',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--format':
        parsed.format = args[i + 1] as 'table' | 'json' | 'yaml';
        i++;
        break;
      case '--validate':
        parsed.validate = true;
        break;
      case '--dataset':
        parsed.dataset = args[i + 1] as 'single' | 'multiple' | 'empty' | 'all';
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
📊 Test Data Inspector

Inspect and display mock job data used in tests.

Usage:
  pnpm tsx scripts/inspect-test-data.mts [options]

Options:
  --format <type>    Output format: table, json, yaml (default: table)
  --validate         Validate job data structure
  --dataset <name>   Dataset to show: single, multiple, empty, all (default: all)
  --help, -h         Show this help message

Examples:
  pnpm tsx scripts/inspect-test-data.mts
  pnpm tsx scripts/inspect-test-data.mts --format json
  pnpm tsx scripts/inspect-test-data.mts --dataset multiple --validate
  pnpm tsx scripts/inspect-test-data.mts --format json --dataset single
`);
}

/**
 * Validate job data structure
 */
function validateJob(job: NormalizedJob, index: number): string[] {
  const errors: string[] = [];

  // Required fields validation
  if (!job.id) errors.push(`Job ${index}: Missing required field 'id'`);
  if (!job.title) errors.push(`Job ${index}: Missing required field 'title'`);
  if (!job.source) errors.push(`Job ${index}: Missing required field 'source'`);

  // Data type validation
  if (job.id && typeof job.id !== 'string') {
    errors.push(`Job ${index}: Field 'id' must be a string`);
  }
  if (job.title && typeof job.title !== 'string') {
    errors.push(`Job ${index}: Field 'title' must be a string`);
  }
  if (job.postedDate && isNaN(Date.parse(job.postedDate))) {
    errors.push(`Job ${index}: Field 'postedDate' must be a valid ISO date`);
  }
  if (job.applyUrl && !job.applyUrl.startsWith('http')) {
    errors.push(`Job ${index}: Field 'applyUrl' must be a valid URL`);
  }

  // Business logic validation
  const validSources = ['webhook', 'github-actions', 'manual'] as const;
  if (job.source && !validSources.includes(job.source)) {
    errors.push(`Job ${index}: Field 'source' must be one of: ${validSources.join(', ')}`);
  }

  const validTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'] as const;
  if (job.type && !validTypes.includes(job.type as any)) {
    errors.push(`Job ${index}: Field 'type' should be one of: ${validTypes.join(', ')}`);
  }

  return errors;
}

/**
 * Validate an array of jobs
 */
function validateJobs(jobs: NormalizedJob[], datasetName: string): void {
  console.log(`🔍 Validating ${datasetName} dataset (${jobs.length} jobs)...\n`);

  let totalErrors = 0;

  jobs.forEach((job, index) => {
    const errors = validateJob(job, index + 1);
    totalErrors += errors.length;

    if (errors.length > 0) {
      console.log(`❌ Job ${index + 1} (${job.title || 'No Title'}):`);
      errors.forEach(error => console.log(`   ${error}`));
      console.log();
    }
  });

  if (totalErrors === 0) {
    console.log(`✅ All ${jobs.length} jobs in ${datasetName} dataset are valid!`);
  } else {
    console.log(`❌ Found ${totalErrors} validation errors in ${datasetName} dataset`);
  }
  console.log();
}

/**
 * Display jobs in table format
 */
function displayTable(jobs: NormalizedJob[], title: string): void {
  console.log(`📋 ${title}`);
  console.log('='.repeat(title.length + 4));
  console.log();

  if (jobs.length === 0) {
    console.log('No jobs in this dataset.\n');
    return;
  }

  // Calculate column widths
  const widths = {
    id: Math.max(3, Math.max(...jobs.map(j => j.id.length))),
    title: Math.max(5, Math.max(...jobs.map(j => j.title.length))),
    department: Math.max(10, Math.max(...jobs.map(j => (j.department || '').length))),
    location: Math.max(8, Math.max(...jobs.map(j => (j.location || '').length))),
    type: Math.max(4, Math.max(...jobs.map(j => (j.type || '').length))),
    source: Math.max(6, Math.max(...jobs.map(j => j.source.length))),
  };

  // Header
  const header = [
    'ID'.padEnd(widths.id),
    'TITLE'.padEnd(widths.title),
    'DEPARTMENT'.padEnd(widths.department),
    'LOCATION'.padEnd(widths.location),
    'TYPE'.padEnd(widths.type),
    'SOURCE'.padEnd(widths.source),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(header.length));

  // Rows
  jobs.forEach(job => {
    const row = [
      job.id.padEnd(widths.id),
      job.title.padEnd(widths.title),
      (job.department || '').padEnd(widths.department),
      (job.location || '').padEnd(widths.location),
      (job.type || '').padEnd(widths.type),
      job.source.padEnd(widths.source),
    ].join(' | ');
    console.log(row);
  });

  console.log();
  
  // Summary
  const departments = [...new Set(jobs.map(j => j.department).filter(Boolean))];
  const locations = [...new Set(jobs.map(j => j.location).filter(Boolean))];
  const types = [...new Set(jobs.map(j => j.type).filter(Boolean))];
  const sources = [...new Set(jobs.map(j => j.source))];

  console.log(`📊 Summary: ${jobs.length} jobs`);
  console.log(`   Departments: ${departments.join(', ')}`);
  console.log(`   Locations: ${locations.join(', ')}`);
  console.log(`   Types: ${types.join(', ')}`);
  console.log(`   Sources: ${sources.join(', ')}`);
  console.log();
}

/**
 * Display jobs in JSON format
 */
function displayJson(jobs: NormalizedJob[], title: string): void {
  console.log(`// ${title}`);
  console.log(JSON.stringify(jobs, null, 2));
  console.log();
}

/**
 * Get schema information for NormalizedJob
 */
function displaySchema(): void {
  console.log(`📋 NormalizedJob Schema`);
  console.log('='.repeat(22));
  console.log();
  
  const schema = {
    id: { type: 'string', required: true, description: 'Unique job identifier' },
    title: { type: 'string', required: true, description: 'Job title' },
    department: { type: 'string', required: false, description: 'Department name' },
    location: { type: 'string', required: false, description: 'Job location' },
    type: { 
      type: 'string', 
      required: false, 
      description: 'Employment type',
      values: ['Full-time', 'Part-time', 'Contract', 'Internship']
    },
    description: { type: 'string', required: false, description: 'Job description' },
    postedDate: { type: 'string (ISO)', required: false, description: 'When the job was posted' },
    applyUrl: { type: 'string (URL)', required: false, description: 'Application URL' },
    source: { 
      type: 'string', 
      required: true, 
      description: 'Data source',
      values: ['webhook', 'github-actions', 'manual']
    },
  };

  Object.entries(schema).forEach(([field, info]) => {
    const required = info.required ? '(required)' : '(optional)';
    const values = info.values ? ` [${info.values.join(', ')}]` : '';
    console.log(`  ${field.padEnd(12)} ${info.type.padEnd(15)} ${required.padEnd(12)} ${info.description}${values}`);
  });

  console.log();
}

/**
 * Main execution function
 */
function main(): void {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  console.log('🔍 Test Data Inspector\n');

  // Show schema if validation is requested
  if (args.validate) {
    displaySchema();
  }

  // Determine which datasets to process
  const datasets: Array<keyof typeof SAMPLE_JOBS> = 
    args.dataset === 'all' ? ['single', 'multiple', 'empty'] : [args.dataset];

  // Process each dataset
  datasets.forEach(datasetName => {
    const jobs = SAMPLE_JOBS[datasetName];
    const title = `${datasetName.toUpperCase()} Dataset (${jobs.length} jobs)`;

    if (args.validate) {
      validateJobs(jobs, datasetName);
    }

    if (args.format === 'json') {
      displayJson(jobs, title);
    } else {
      displayTable(jobs, title);
    }
  });

  // Overall summary
  const totalJobs = Object.values(SAMPLE_JOBS).reduce((sum, jobs) => sum + jobs.length, 0);
  console.log(`🎯 Total test data: ${totalJobs} jobs across ${Object.keys(SAMPLE_JOBS).length} datasets`);
  console.log(`💡 Use --help to see all available options`);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SAMPLE_JOBS, validateJob, validateJobs };