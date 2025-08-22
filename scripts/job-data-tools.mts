#!/usr/bin/env tsx
/**
 * Job Data Tools - Master Utility Script
 *
 * Unified interface for all job data inspection, analysis, and validation tools.
 * Provides easy access to test data, production artifacts, live scraping,
 * comparison, and validation utilities.
 *
 * Usage:
 *   pnpm tsx scripts/job-data-tools.mts
 *   pnpm tsx scripts/job-data-tools.mts inspect-test
 *   pnpm tsx scripts/job-data-tools.mts browse --latest
 *   pnpm tsx scripts/job-data-tools.mts scrape --debug
 *   pnpm tsx scripts/job-data-tools.mts compare --latest 2
 *   pnpm tsx scripts/job-data-tools.mts validate --strict
 *
 * @since 1.0.0
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

/**
 * Available tools and their descriptions
 */
const TOOLS = {
  'inspect-test': {
    script: './scripts/inspect-test-data.mts',
    name: '🧪 Test Data Inspector',
    description: 'Inspect mock job data used in tests',
    examples: [
      'pnpm tsx scripts/job-data-tools.mts inspect-test',
      'pnpm tsx scripts/job-data-tools.mts inspect-test --format json',
      'pnpm tsx scripts/job-data-tools.mts inspect-test --validate',
    ],
  },
  'browse': {
    script: './scripts/browse-job-data.mts',
    name: '🗂️  Production Data Browser',
    description: 'Browse and analyze job artifacts from scraping runs',
    examples: [
      'pnpm tsx scripts/job-data-tools.mts browse --latest',
      'pnpm tsx scripts/job-data-tools.mts browse --run-id 17103740786',
      'pnpm tsx scripts/job-data-tools.mts browse --stats --filter department=Engineering',
    ],
  },
  'scrape': {
    script: './scripts/live-scraper.mts',
    name: '🔍 Live Scraping Inspector',
    description: 'Run job scraper locally with debugging and immediate results',
    examples: [
      'pnpm tsx scripts/job-data-tools.mts scrape --debug',
      'pnpm tsx scripts/job-data-tools.mts scrape --company-id abc123 --screenshots',
      'pnpm tsx scripts/job-data-tools.mts scrape --no-headless --debug',
    ],
  },
  'compare': {
    script: './scripts/compare-job-data.mts',
    name: '🔄 Data Comparison Tool',
    description: 'Compare job data between different runs to identify changes',
    examples: [
      'pnpm tsx scripts/job-data-tools.mts compare --latest 2',
      'pnpm tsx scripts/job-data-tools.mts compare --run1 abc --run2 def',
      'pnpm tsx scripts/job-data-tools.mts compare --diff-only --format summary',
    ],
  },
  'validate': {
    script: './scripts/validate-job-data.mts',
    name: '✅ Data Validator',
    description: 'Validate job data structure, quality, and business rules',
    examples: [
      'pnpm tsx scripts/job-data-tools.mts validate --latest',
      'pnpm tsx scripts/job-data-tools.mts validate --strict --export-errors',
      'pnpm tsx scripts/job-data-tools.mts validate --run-id 17103740786',
    ],
  },
  'test-wordpress': {
    script: './scripts/test-wordpress-payload.mts',
    name: '🧪 WordPress Payload Tester',
    description: 'Generate and test WordPress webhook payloads without sending',
    examples: [
      'pnpm tsx scripts/job-data-tools.mts test-wordpress --company-id abc123 --inspect',
      'pnpm tsx scripts/job-data-tools.mts test-wordpress --use-test-data --save payload.json',
      'pnpm tsx scripts/job-data-tools.mts test-wordpress --mock-wordpress --format table',
    ],
  },
} as const;

type ToolName = keyof typeof TOOLS;

/**
 * Display main help menu
 */
function showHelp(): void {
  console.log(`
🛠️  Job Data Tools - Master Utility

Unified interface for all job data inspection, analysis, and validation tools.

Usage:
  pnpm tsx scripts/job-data-tools.mts <tool> [options]
  pnpm tsx scripts/job-data-tools.mts --help

Available Tools:
`);

  Object.entries(TOOLS).forEach(([key, tool]) => {
    console.log(`  ${tool.name}`);
    console.log(`    Command: ${key}`);
    console.log(`    ${tool.description}`);
    console.log();
  });

  console.log(`Quick Examples:
  pnpm tsx scripts/job-data-tools.mts inspect-test --validate
  pnpm tsx scripts/job-data-tools.mts browse --latest --stats
  pnpm tsx scripts/job-data-tools.mts scrape --debug --screenshots
  pnpm tsx scripts/job-data-tools.mts compare --latest 2 --diff-only
  pnpm tsx scripts/job-data-tools.mts validate --strict

For tool-specific help:
  pnpm tsx scripts/job-data-tools.mts <tool> --help
`);
}

/**
 * Display tool-specific help
 */
function showToolHelp(toolName: ToolName): void {
  const tool = TOOLS[toolName];
  
  console.log(`${tool.name}`);
  console.log('='.repeat(tool.name.length));
  console.log();
  console.log(tool.description);
  console.log();
  console.log('Examples:');
  tool.examples.forEach(example => {
    console.log(`  ${example}`);
  });
  console.log();
  console.log('For detailed options, run:');
  console.log(`  pnpm tsx ${tool.script} --help`);
}

/**
 * Run a specific tool with arguments
 */
function runTool(toolName: ToolName, args: string[]): void {
  const tool = TOOLS[toolName];
  
  if (!existsSync(tool.script)) {
    console.error(`❌ Script not found: ${tool.script}`);
    process.exit(1);
  }

  console.log(`🚀 Running ${tool.name}...`);
  console.log();

  const child = spawn('pnpm', ['tsx', tool.script, ...args], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  child.on('error', (error) => {
    console.error(`❌ Error running tool: ${error.message}`);
    process.exit(1);
  });
}

/**
 * Check system requirements
 */
function checkRequirements(): void {
  const checks = [
    {
      name: 'Node.js',
      check: () => process.version,
      requirement: 'v18.0.0+',
    },
    {
      name: 'Job artifacts',
      check: () => existsSync('./jobs') ? 'Available' : null,
      requirement: 'Run scrape-and-sync first',
    },
    {
      name: 'Test fixtures',
      check: () => existsSync('./test') ? 'Available' : null,
      requirement: 'Part of project structure',
    },
  ];

  console.log('🔍 System Requirements Check:');
  console.log();

  let allGood = true;

  checks.forEach(check => {
    const result = check.check();
    if (result) {
      console.log(`✅ ${check.name}: ${result}`);
    } else {
      console.log(`❌ ${check.name}: Missing (${check.requirement})`);
      allGood = false;
    }
  });

  console.log();

  if (!allGood) {
    console.log('⚠️  Some requirements are missing. Tools may not work correctly.');
    console.log();
  }
}

/**
 * Display quick status overview
 */
function showStatus(): void {
  console.log('📊 Quick Status Overview');
  console.log('='.repeat(25));
  console.log();

  // Check for recent artifacts
  const jobsDir = './jobs';
  const logsDir = './logs';
  
  if (existsSync(jobsDir)) {
    try {
      const files = require('fs').readdirSync(jobsDir);
      const jobFiles = files.filter((f: string) => f.endsWith('.json'));
      console.log(`📄 Job Artifacts: ${jobFiles.length} files available`);
      
      if (jobFiles.length > 0) {
        const latest = jobFiles[jobFiles.length - 1];
        console.log(`   Latest: ${latest}`);
      }
    } catch {
      console.log(`📄 Job Artifacts: Directory exists but cannot read`);
    }
  } else {
    console.log(`📄 Job Artifacts: No artifacts found`);
    console.log(`   💡 Run 'pnpm tsx src/scripts/scrape-and-sync.ts' to generate data`);
  }

  if (existsSync(logsDir)) {
    try {
      const files = require('fs').readdirSync(logsDir);
      const logFiles = files.filter((f: string) => f.endsWith('.json'));
      console.log(`📋 Log Files: ${logFiles.length} files available`);
    } catch {
      console.log(`📋 Log Files: Directory exists but cannot read`);
    }
  } else {
    console.log(`📋 Log Files: No logs found`);
  }

  console.log();
  console.log(`🧪 Test Data: Always available (built-in mock data)`);
  console.log();
}

/**
 * Interactive mode - let user select a tool
 */
function interactiveMode(): void {
  console.log('🛠️  Interactive Mode - Select a Tool:');
  console.log();

  const toolEntries = Object.entries(TOOLS);
  toolEntries.forEach(([key, tool], index) => {
    console.log(`  ${index + 1}. ${tool.name}`);
    console.log(`     ${tool.description}`);
    console.log();
  });

  console.log('Type the number of the tool you want to use:');
  
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (key) => {
    const num = parseInt(key.toString(), 10);
    
    if (num >= 1 && num <= toolEntries.length) {
      const [toolName] = toolEntries[num - 1];
      console.log(`\nSelected: ${TOOLS[toolName as ToolName].name}`);
      console.log();
      showToolHelp(toolName as ToolName);
    } else {
      console.log('\nInvalid selection. Please try again.');
    }
    
    process.exit(0);
  });
}

/**
 * Main execution function
 */
function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  const command = args[0];

  // Special commands
  if (command === '--status') {
    checkRequirements();
    showStatus();
    return;
  }

  if (command === '--interactive' || command === '-i') {
    interactiveMode();
    return;
  }

  // Tool commands
  if (command in TOOLS) {
    const toolName = command as ToolName;
    const toolArgs = args.slice(1);
    
    // Show tool help if requested
    if (toolArgs.includes('--help') || toolArgs.includes('-h')) {
      showToolHelp(toolName);
      return;
    }
    
    runTool(toolName, toolArgs);
    return;
  }

  // Unknown command
  console.error(`❌ Unknown command: ${command}`);
  console.log();
  console.log('Available commands:');
  Object.keys(TOOLS).forEach(tool => {
    console.log(`  ${tool}`);
  });
  console.log();
  console.log('Use --help for more information');
  process.exit(1);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TOOLS, runTool, showHelp, checkRequirements };