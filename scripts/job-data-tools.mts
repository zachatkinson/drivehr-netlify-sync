#!/usr/bin/env tsx
/**
 * Job Data Tools - Master Utility Script
 *
 * Enterprise-grade unified command-line interface for all job data inspection,
 * analysis, and validation tools. This master orchestrator provides streamlined
 * access to test data inspection, production artifact browsing, live scraping,
 * data comparison, validation utilities, and WordPress payload testing.
 *
 * Features:
 * - Centralized tool registry with metadata and routing
 * - Interactive mode for tool discovery and selection
 * - System requirements checking and status overview
 * - Secure child process execution with proper isolation
 * - Comprehensive help system with examples
 * - Command routing with argument forwarding
 *
 * @example
 * ```typescript
 * // Show available tools
 * pnpm tsx scripts/job-data-tools.mts
 *
 * // Run specific tool with arguments
 * pnpm tsx scripts/job-data-tools.mts browse --latest --stats
 * pnpm tsx scripts/job-data-tools.mts scrape --debug --screenshots
 *
 * // Interactive tool selection
 * pnpm tsx scripts/job-data-tools.mts --interactive
 *
 * // System status check
 * pnpm tsx scripts/job-data-tools.mts --status
 * ```
 *
 * @module job-data-tools-master
 * @since 1.0.0
 * @see {@link ./browse-job-data.mts} for production data browsing
 * @see {@link ./inspect-test-data.mts} for test data inspection
 * @see {@link ../CLAUDE.md} for development standards
 */

import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';

/**
 * Registry of available job data tools with configurations
 *
 * Central configuration mapping tool names to their script paths, display
 * names, descriptions, and usage examples. This registry enables consistent
 * help generation, command routing, and tool discovery across the utility.
 *
 * @since 1.0.0
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

/**
 * Union type of all available tool command names
 *
 * Type-safe representation of tool registry keys for command validation
 * and IntelliSense support throughout the application.
 *
 * @since 1.0.0
 */
type ToolName = keyof typeof TOOLS;

/**
 * Display main help menu with available tools overview
 *
 * Shows comprehensive overview of all available tools, their descriptions,
 * and common usage patterns. Provides primary entry point for users to
 * discover functionality and learn basic usage patterns.
 *
 * @example
 * ```typescript
 * showHelp();
 * // Outputs tool list with descriptions and examples
 * ```
 * @since 1.0.0
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
 * Display detailed help information for specific tool
 *
 * Shows focused information about a single tool including name, description,
 * usage examples, and instructions for accessing detailed help. Provides
 * targeted assistance for specific tool capabilities.
 *
 * @param toolName - Name of tool to show help for
 * @example
 * ```typescript
 * showToolHelp('browse');
 * // Shows browse tool help with examples
 * ```
 * @since 1.0.0
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
 * Execute specific tool with provided arguments
 *
 * Validates tool exists, checks script availability, then spawns child process
 * to execute tool with arguments. Implements proper error handling, process
 * management, and secure execution with stdio inheritance.
 *
 * @param toolName - Name of tool to execute
 * @param args - Command-line arguments to pass to tool
 * @throws {Error} When script file doesn't exist or execution fails
 * @example
 * ```typescript
 * runTool('browse', ['--latest', '--stats']);
 * runTool('validate', ['--strict']);
 * ```
 * @since 1.0.0
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
 * Check and display system requirements status
 *
 * Validates necessary dependencies and directories for job data tools to
 * function properly. Provides actionable feedback when requirements are
 * missing, helping users resolve configuration issues.
 *
 * @example
 * ```typescript
 * checkRequirements();
 * // ✅ Node.js: v20.10.0
 * // ✅ Job artifacts: Available
 * // ❌ Test fixtures: Missing
 * ```
 * @since 1.0.0
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
 * Display quick status overview of job data and system state
 *
 * Provides summary of available job artifacts, log files, and test data
 * to give users understanding of current system state and available data
 * for analysis. Handles file system errors gracefully.
 *
 * @example
 * ```typescript
 * showStatus();
 * // 📄 Job Artifacts: 15 files available
 * //    Latest: jobs-20240115-143022.json
 * // 📋 Log Files: 12 files available
 * ```
 * @since 1.0.0
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
      const files: string[] = readdirSync(jobsDir);
      const jobFiles: string[] = files.filter((f: string): f is string => f.endsWith('.json'));
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
      const files: string[] = readdirSync(logsDir);
      const logFiles: string[] = files.filter((f: string): f is string => f.endsWith('.json'));
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
 * Enter interactive mode for tool selection
 *
 * Presents numbered list of available tools and waits for user input to
 * select tool. Provides user-friendly interface for discovering and launching
 * tools without remembering command names. Sets raw input mode for immediate
 * response.
 *
 * @example
 * ```typescript
 * interactiveMode();
 * // 1. 🧪 Test Data Inspector
 * //    Inspect mock job data used in tests
 * // 2. 🗂️  Production Data Browser
 * //    Browse and analyze job artifacts
 * ```
 * @since 1.0.0
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
 * Main execution function and command router
 *
 * Parses command-line arguments and routes to appropriate functions based on
 * command provided. Handles all top-level command logic including help display,
 * special commands, and tool execution with proper error handling.
 *
 * @example
 * ```typescript
 * main();
 * // Routes based on process.argv:
 * // [] -> showHelp()
 * // ['browse', '--latest'] -> runTool('browse', ['--latest'])
 * // ['--status'] -> checkRequirements() + showStatus()
 * ```
 * @since 1.0.0
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