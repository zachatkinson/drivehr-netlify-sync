#!/usr/bin/env tsx
/**
 * Job Data Validator
 *
 * Comprehensive validation utility for scraped job data. Validates data structure,
 * required fields, data types, business rules, and data quality. Generates
 * detailed validation reports with actionable recommendations.
 *
 * Usage:
 *   pnpm tsx scripts/validate-job-data.mts
 *   pnpm tsx scripts/validate-job-data.mts --run-id 17103740786
 *   pnpm tsx scripts/validate-job-data.mts --latest
 *   pnpm tsx scripts/validate-job-data.mts --strict
 *   pnpm tsx scripts/validate-job-data.mts --export-errors
 *
 * @since 1.0.0
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
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
 * Validation error levels
 */
type ValidationLevel = 'error' | 'warning' | 'info';

/**
 * Single validation issue
 */
interface ValidationIssue {
  jobId: string;
  jobIndex: number;
  level: ValidationLevel;
  field: string;
  rule: string;
  message: string;
  value?: any;
  suggestion?: string;
}

/**
 * Validation rule definition
 */
interface ValidationRule {
  field: keyof NormalizedJob | 'general';
  name: string;
  level: ValidationLevel;
  required: boolean;
  validate: (job: NormalizedJob, index: number) => ValidationIssue | null;
}

/**
 * Validation report
 */
interface ValidationReport {
  metadata: {
    runId: string;
    timestamp: string;
    totalJobs: number;
    validatedAt: string;
    strictMode: boolean;
  };
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    infos: number;
    validJobs: number;
    invalidJobs: number;
    validationRate: number;
  };
  ruleResults: Array<{
    rule: string;
    field: string;
    level: ValidationLevel;
    issueCount: number;
    affectedJobs: number;
  }>;
  issues: ValidationIssue[];
  recommendations: string[];
}

/**
 * CLI arguments interface
 */
interface CliArgs {
  runId?: string;
  latest: boolean;
  strict: boolean;
  exportErrors: boolean;
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
    latest: false,
    strict: false,
    exportErrors: false,
    format: 'table',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--run-id':
        parsed.runId = args[i + 1];
        i++;
        break;
      case '--latest':
        parsed.latest = true;
        break;
      case '--strict':
        parsed.strict = true;
        break;
      case '--export-errors':
        parsed.exportErrors = true;
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
✅ Job Data Validator

Validate scraped job data structure, quality, and business rules.

Usage:
  pnpm tsx scripts/validate-job-data.mts [options]

Options:
  --run-id <id>        Validate specific run ID
  --latest             Validate the most recent job data
  --strict             Enable strict validation mode (all warnings as errors)
  --export-errors      Export validation errors to separate file
  --output <path>      Save validation report to file
  --format <type>      Output format: table, json, summary (default: table)
  --help, -h           Show this help message

Examples:
  pnpm tsx scripts/validate-job-data.mts --latest
  pnpm tsx scripts/validate-job-data.mts --run-id 17103740786 --strict
  pnpm tsx scripts/validate-job-data.mts --latest --export-errors
  pnpm tsx scripts/validate-job-data.mts --format json --output report.json

Validation Rules:
  • Required Fields: id, title, source
  • Data Types: Proper types for all fields
  • URLs: Valid format for applyUrl
  • Dates: Valid ISO format for postedDate
  • Business Rules: Valid job types, departments, etc.
  • Data Quality: No empty values, reasonable lengths
`);
}

/**
 * Define validation rules
 */
function createValidationRules(strictMode: boolean): ValidationRule[] {
  const rules: ValidationRule[] = [
    // Required field validations
    {
      field: 'id',
      name: 'required-id',
      level: 'error',
      required: true,
      validate: (job, index) => {
        if (!job.id || job.id.trim() === '') {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'error',
            field: 'id',
            rule: 'required-id',
            message: 'Job ID is required and cannot be empty',
            value: job.id,
            suggestion: 'Ensure the scraper generates unique IDs for all jobs'
          };
        }
        return null;
      }
    },

    {
      field: 'title',
      name: 'required-title',
      level: 'error',
      required: true,
      validate: (job, index) => {
        if (!job.title || job.title.trim() === '') {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'error',
            field: 'title',
            rule: 'required-title',
            message: 'Job title is required and cannot be empty',
            value: job.title,
            suggestion: 'Check if the title selector is correctly identifying job titles'
          };
        }
        return null;
      }
    },

    {
      field: 'source',
      name: 'required-source',
      level: 'error',
      required: true,
      validate: (job, index) => {
        if (!job.source) {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'error',
            field: 'source',
            rule: 'required-source',
            message: 'Job source is required',
            value: job.source,
            suggestion: 'Ensure all jobs have a valid source (webhook, github-actions, manual)'
          };
        }
        return null;
      }
    },

    // Data type validations
    {
      field: 'id',
      name: 'id-type',
      level: 'error',
      required: true,
      validate: (job, index) => {
        if (job.id && typeof job.id !== 'string') {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'error',
            field: 'id',
            rule: 'id-type',
            message: 'Job ID must be a string',
            value: job.id,
            suggestion: 'Convert job ID to string format'
          };
        }
        return null;
      }
    },

    {
      field: 'postedDate',
      name: 'date-format',
      level: 'warning',
      required: false,
      validate: (job, index) => {
        if (job.postedDate && isNaN(Date.parse(job.postedDate))) {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'warning',
            field: 'postedDate',
            rule: 'date-format',
            message: 'Posted date should be in valid ISO format',
            value: job.postedDate,
            suggestion: 'Convert date to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'
          };
        }
        return null;
      }
    },

    {
      field: 'applyUrl',
      name: 'url-format',
      level: 'warning',
      required: false,
      validate: (job, index) => {
        if (job.applyUrl && !job.applyUrl.match(/^https?:\/\/.+/)) {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'warning',
            field: 'applyUrl',
            rule: 'url-format',
            message: 'Apply URL should be a valid HTTP/HTTPS URL',
            value: job.applyUrl,
            suggestion: 'Ensure URLs include protocol (http/https) and are properly formatted'
          };
        }
        return null;
      }
    },

    // Business rule validations
    {
      field: 'source',
      name: 'valid-source',
      level: 'error',
      required: true,
      validate: (job, index) => {
        const validSources = ['webhook', 'github-actions', 'manual'];
        if (job.source && !validSources.includes(job.source)) {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'error',
            field: 'source',
            rule: 'valid-source',
            message: `Invalid job source. Must be one of: ${validSources.join(', ')}`,
            value: job.source,
            suggestion: 'Use a valid source identifier'
          };
        }
        return null;
      }
    },

    {
      field: 'type',
      name: 'valid-job-type',
      level: strictMode ? 'error' : 'warning',
      required: false,
      validate: (job, index) => {
        if (job.type) {
          const validTypes = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'];
          if (!validTypes.includes(job.type)) {
            return {
              jobId: job.id || `job-${index}`,
              jobIndex: index,
              level: strictMode ? 'error' : 'warning',
              field: 'type',
              rule: 'valid-job-type',
              message: `Unusual job type. Common types: ${validTypes.join(', ')}`,
              value: job.type,
              suggestion: 'Consider standardizing job types or add to valid types list'
            };
          }
        }
        return null;
      }
    },

    // Data quality validations
    {
      field: 'title',
      name: 'title-length',
      level: 'warning',
      required: false,
      validate: (job, index) => {
        if (job.title && (job.title.length < 3 || job.title.length > 200)) {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'warning',
            field: 'title',
            rule: 'title-length',
            message: 'Job title length seems unusual (should be 3-200 characters)',
            value: job.title,
            suggestion: 'Verify title extraction is working correctly'
          };
        }
        return null;
      }
    },

    {
      field: 'description',
      name: 'description-length',
      level: 'info',
      required: false,
      validate: (job, index) => {
        if (job.description && job.description.length < 20) {
          return {
            jobId: job.id || `job-${index}`,
            jobIndex: index,
            level: 'info',
            field: 'description',
            rule: 'description-length',
            message: 'Job description seems very short',
            value: job.description,
            suggestion: 'Consider improving description extraction to get more content'
          };
        }
        return null;
      }
    },

    {
      field: 'general',
      name: 'duplicate-id',
      level: 'error',
      required: true,
      validate: (job, index, allJobs) => {
        if (allJobs && job.id) {
          const duplicates = allJobs.filter((otherJob, otherIndex) => 
            otherJob.id === job.id && otherIndex !== index
          );
          
          if (duplicates.length > 0) {
            return {
              jobId: job.id,
              jobIndex: index,
              level: 'error',
              field: 'general',
              rule: 'duplicate-id',
              message: 'Duplicate job ID found',
              value: job.id,
              suggestion: 'Ensure job ID generation creates unique identifiers'
            };
          }
        }
        return null;
      }
    },

    // Missing data validations (strict mode)
    ...(strictMode ? [
      {
        field: 'department' as keyof NormalizedJob,
        name: 'missing-department',
        level: 'error' as ValidationLevel,
        required: false,
        validate: (job: NormalizedJob, index: number) => {
          if (!job.department || job.department.trim() === '') {
            return {
              jobId: job.id || `job-${index}`,
              jobIndex: index,
              level: 'error' as ValidationLevel,
              field: 'department',
              rule: 'missing-department',
              message: 'Department is required in strict mode',
              value: job.department,
              suggestion: 'Improve scraping to capture department information'
            };
          }
          return null;
        }
      },

      {
        field: 'location' as keyof NormalizedJob,
        name: 'missing-location',
        level: 'error' as ValidationLevel,
        required: false,
        validate: (job: NormalizedJob, index: number) => {
          if (!job.location || job.location.trim() === '') {
            return {
              jobId: job.id || `job-${index}`,
              jobIndex: index,
              level: 'error' as ValidationLevel,
              field: 'location',
              rule: 'missing-location',
              message: 'Location is required in strict mode',
              value: job.location,
              suggestion: 'Improve scraping to capture location information'
            };
          }
          return null;
        }
      }
    ] : [])
  ];

  return rules;
}

/**
 * Validate jobs against rules
 */
function validateJobs(jobs: NormalizedJob[], rules: ValidationRule[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  jobs.forEach((job, index) => {
    rules.forEach(rule => {
      // For general rules, pass all jobs for context
      const result = rule.field === 'general' 
        ? rule.validate(job, index, jobs)
        : rule.validate(job, index);

      if (result) {
        issues.push(result);
      }
    });
  });

  return issues;
}

/**
 * Generate validation report
 */
function generateReport(
  artifact: JobArtifact,
  issues: ValidationIssue[],
  rules: ValidationRule[],
  strictMode: boolean
): ValidationReport {
  const summary = {
    totalIssues: issues.length,
    errors: issues.filter(i => i.level === 'error').length,
    warnings: issues.filter(i => i.level === 'warning').length,
    infos: issues.filter(i => i.level === 'info').length,
    validJobs: 0,
    invalidJobs: 0,
    validationRate: 0,
  };

  // Calculate job-level validity
  const jobsWithIssues = new Set(issues.filter(i => i.level === 'error').map(i => i.jobId));
  summary.invalidJobs = jobsWithIssues.size;
  summary.validJobs = artifact.jobs.length - summary.invalidJobs;
  summary.validationRate = (summary.validJobs / artifact.jobs.length) * 100;

  // Rule results
  const ruleResults = rules.map(rule => {
    const ruleIssues = issues.filter(i => i.rule === rule.name);
    return {
      rule: rule.name,
      field: rule.field as string,
      level: rule.level,
      issueCount: ruleIssues.length,
      affectedJobs: new Set(ruleIssues.map(i => i.jobId)).size,
    };
  });

  // Generate recommendations
  const recommendations = generateRecommendations(issues, summary);

  return {
    metadata: {
      runId: artifact.runId,
      timestamp: artifact.timestamp,
      totalJobs: artifact.totalJobs,
      validatedAt: new Date().toISOString(),
      strictMode,
    },
    summary,
    ruleResults,
    issues,
    recommendations,
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(issues: ValidationIssue[], summary: any): string[] {
  const recommendations: string[] = [];

  if (summary.errors > 0) {
    recommendations.push(`🚨 Fix ${summary.errors} critical errors before deploying to production`);
  }

  if (summary.warnings > 0) {
    recommendations.push(`⚠️  Review ${summary.warnings} warnings to improve data quality`);
  }

  // Specific recommendations based on common issues
  const commonIssues = issues.reduce((acc, issue) => {
    acc[issue.rule] = (acc[issue.rule] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (commonIssues['missing-department'] > 5) {
    recommendations.push('📋 Consider improving department extraction - many jobs missing this field');
  }

  if (commonIssues['url-format'] > 3) {
    recommendations.push('🔗 Review URL extraction logic to ensure proper formatting');
  }

  if (commonIssues['date-format'] > 3) {
    recommendations.push('📅 Standardize date formatting to ISO format for consistency');
  }

  if (commonIssues['duplicate-id'] > 0) {
    recommendations.push('🆔 Critical: Fix job ID generation to prevent duplicates');
  }

  if (summary.validationRate < 90) {
    recommendations.push('🎯 Overall data quality needs improvement - consider reviewing scraping selectors');
  } else if (summary.validationRate > 95) {
    recommendations.push('✨ Excellent data quality! Consider automating regular validation checks');
  }

  return recommendations;
}

/**
 * Display validation report
 */
function displayReport(report: ValidationReport, format: 'table' | 'summary'): void {
  const { metadata, summary } = report;

  console.log('✅ Job Data Validation Report');
  console.log('='.repeat(30));
  console.log();

  // Metadata
  const date = new Date(metadata.timestamp).toLocaleString();
  console.log(`📊 Dataset: Run ${metadata.runId} (${date})`);
  console.log(`🎯 Jobs Analyzed: ${metadata.totalJobs}`);
  console.log(`⚙️  Mode: ${metadata.strictMode ? 'Strict' : 'Standard'}`);
  console.log();

  // Summary
  const validationIcon = summary.validationRate > 95 ? '🟢' : summary.validationRate > 80 ? '🟡' : '🔴';
  console.log(`${validationIcon} Overall Score: ${summary.validationRate.toFixed(1)}%`);
  console.log(`✅ Valid Jobs: ${summary.validJobs}/${metadata.totalJobs}`);
  console.log();

  console.log(`📋 Issues Found:`);
  console.log(`   🚨 Errors: ${summary.errors}`);
  console.log(`   ⚠️  Warnings: ${summary.warnings}`);
  console.log(`   ℹ️  Info: ${summary.infos}`);
  console.log(`   📊 Total: ${summary.totalIssues}`);
  console.log();

  if (format === 'table' && report.issues.length > 0) {
    displayIssuesTable(report.issues.slice(0, 20)); // Show first 20 issues
    
    if (report.issues.length > 20) {
      console.log(`... and ${report.issues.length - 20} more issues`);
      console.log();
    }
  }

  // Rule results
  if (format === 'table') {
    displayRuleResults(report.ruleResults);
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`   ${rec}`));
    console.log();
  }
}

/**
 * Display issues in table format
 */
function displayIssuesTable(issues: ValidationIssue[]): void {
  if (issues.length === 0) {
    console.log('No issues found! 🎉');
    return;
  }

  console.log('🐛 Top Issues:');
  console.log();

  const widths = {
    level: 8,
    job: 15,
    field: 12,
    rule: 20,
    message: 40,
  };

  // Header
  const header = [
    'LEVEL'.padEnd(widths.level),
    'JOB ID'.padEnd(widths.job),
    'FIELD'.padEnd(widths.field),
    'RULE'.padEnd(widths.rule),
    'MESSAGE'.padEnd(widths.message),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(header.length));

  // Rows
  issues.forEach(issue => {
    const levelIcons = {
      error: '🚨 ERROR',
      warning: '⚠️  WARN',
      info: 'ℹ️  INFO',
    };

    const jobId = issue.jobId.length > widths.job - 3
      ? issue.jobId.substring(0, widths.job - 3) + '...'
      : issue.jobId;

    const message = issue.message.length > widths.message - 3
      ? issue.message.substring(0, widths.message - 3) + '...'
      : issue.message;

    const row = [
      levelIcons[issue.level].padEnd(widths.level),
      jobId.padEnd(widths.job),
      issue.field.padEnd(widths.field),
      issue.rule.padEnd(widths.rule),
      message.padEnd(widths.message),
    ].join(' | ');

    console.log(row);
  });

  console.log();
}

/**
 * Display rule results
 */
function displayRuleResults(results: ValidationReport['ruleResults']): void {
  const rulesWithIssues = results.filter(r => r.issueCount > 0);
  
  if (rulesWithIssues.length === 0) {
    return;
  }

  console.log('📊 Rule Results:');
  console.log();

  rulesWithIssues
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 10)
    .forEach(result => {
      const levelIcon = {
        error: '🚨',
        warning: '⚠️ ',
        info: 'ℹ️ ',
      }[result.level];

      console.log(`   ${levelIcon} ${result.rule}: ${result.issueCount} issues (${result.affectedJobs} jobs)`);
    });
  
  console.log();
}

/**
 * Load job artifact
 */
function loadArtifact(runId?: string, latest?: boolean): JobArtifact {
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
      console.warn(`⚠️  Could not parse ${filename}`);
    }
  });

  if (artifacts.length === 0) {
    console.error('❌ No valid job artifacts found.');
    process.exit(1);
  }

  // Sort by timestamp, newest first
  artifacts.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (runId) {
    const artifact = artifacts.find(a => a.runId === runId);
    if (!artifact) {
      console.error(`❌ Run ID not found: ${runId}`);
      console.log(`Available run IDs: ${artifacts.map(a => a.runId).join(', ')}`);
      process.exit(1);
    }
    return artifact;
  }

  if (latest) {
    return artifacts[0];
  }

  // Default to latest
  return artifacts[0];
}

/**
 * Save validation report
 */
async function saveReport(report: ValidationReport, outputPath: string): Promise<void> {
  await mkdir('./validation', { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(`💾 Validation report saved to: ${outputPath}`);
}

/**
 * Export validation errors to separate file
 */
async function exportErrors(report: ValidationReport): Promise<void> {
  await mkdir('./validation', { recursive: true });
  
  const errors = report.issues.filter(i => i.level === 'error');
  const filename = `validation-errors-${report.metadata.runId}-${Date.now()}.json`;
  const filepath = join('./validation', filename);
  
  await writeFile(filepath, JSON.stringify(errors, null, 2));
  console.log(`🚨 ${errors.length} validation errors exported to: ${filepath}`);
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

  console.log('✅ Job Data Validator\n');

  // Load artifact
  const artifact = loadArtifact(args.runId, args.latest);
  console.log(`📊 Validating: Run ${artifact.runId} (${artifact.totalJobs} jobs)`);
  console.log(`⚙️  Mode: ${args.strict ? 'Strict' : 'Standard'} validation`);
  console.log();

  // Create validation rules
  const rules = createValidationRules(args.strict);
  console.log(`🔍 Running ${rules.length} validation rules...`);

  // Validate jobs
  const issues = validateJobs(artifact.jobs, rules);

  // Generate report
  const report = generateReport(artifact, issues, rules, args.strict);

  // Display results
  if (args.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    displayReport(report, args.format);
  }

  // Save output if requested
  if (args.output) {
    await saveReport(report, args.output);
  }

  // Export errors if requested
  if (args.exportErrors && report.summary.errors > 0) {
    await exportErrors(report);
  }

  // Exit with appropriate code
  if (report.summary.errors > 0) {
    console.log('❌ Validation failed due to critical errors');
    process.exit(1);
  } else if (report.summary.warnings > 0) {
    console.log('⚠️  Validation passed with warnings');
  } else {
    console.log('✅ Validation passed successfully!');
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateJobs, generateReport, createValidationRules };