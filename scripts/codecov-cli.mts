#!/usr/bin/env tsx
/**
 * Codecov CLI wrapper for streamlined coverage reporting
 *
 * @module codecov-cli-wrapper
 * @since 1.0.0
 * @see {@link ./CLAUDE.md} for development standards
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const REPOSITORY_OWNER = 'zachatkinson';
const REPOSITORY_NAME = 'drivehr-netlify-sync';
const REPOSITORY_SLUG = `${REPOSITORY_OWNER}/${REPOSITORY_NAME}`;
const CODECOV_BASE_URL = 'https://app.codecov.io/gh';
const REPOSITORY_URL = `${CODECOV_BASE_URL}/${REPOSITORY_SLUG}`;

interface CliArgs {
  command?: string;
  token?: string;
  help: boolean;
  verbose: boolean;
  dryRun: boolean;
  args: string[];
}

/**
 * Parse command line arguments
 *
 * @returns Parsed command line arguments
 * @since 1.0.0
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    help: false,
    verbose: false,
    dryRun: false,
    args: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--token' || arg === '-t') {
      parsed.token = args[i + 1];
      i++;
    } else if (!parsed.command) {
      parsed.command = arg;
    } else {
      parsed.args.push(arg);
    }
  }

  return parsed;
}

/**
 * Display help information
 *
 * @since 1.0.0
 */
function showHelp(): void {
  console.log(`
🔗 Codecov CLI Wrapper

Convenience wrapper for common Codecov CLI operations.

Usage:
  pnpm tsx scripts/codecov-cli.mts <command> [options]

Commands:
  upload           Upload coverage data to Codecov
  create-report    Create a coverage report
  create-commit    Create commit data
  status           Show repository status on Codecov
  test-auth        Test authentication with Codecov

Options:
  --token, -t <token>    Codecov repository token (or set CODECOV_TOKEN env var)
  --verbose, -v          Enable verbose output
  --dry-run              Show what would be executed without running
  --help, -h             Show this help message

Examples:
  pnpm tsx scripts/codecov-cli.mts upload
  pnpm tsx scripts/codecov-cli.mts create-report --verbose
  pnpm tsx scripts/codecov-cli.mts status
  pnpm tsx scripts/codecov-cli.mts test-auth --token your_token_here

Environment Variables:
  CODECOV_TOKEN    Repository upload token from Codecov
  
Setup:
  1. Visit ${REPOSITORY_URL}
  2. Copy your repository upload token
  3. Set: export CODECOV_TOKEN=your_token_here
  4. Run: pnpm tsx scripts/codecov-cli.mts test-auth
`);
}

/**
 * Get Codecov token from args or environment
 *
 * @param args - Command line arguments
 * @returns Codecov token
 * @since 1.0.0
 */
function getToken(args: CliArgs): string {
  const token = args.token || process.env.CODECOV_TOKEN;
  
  if (!token) {
    console.error('❌ No Codecov token found.');
    console.error('💡 Set CODECOV_TOKEN environment variable or use --token flag');
    console.error('');
    console.error(`Get your token from: ${REPOSITORY_URL}`);
    process.exit(1);
  }
  
  return token;
}

/**
 * Locate Codecov CLI executable
 *
 * @returns Path to Codecov CLI executable
 * @since 1.0.0
 */
function getCodecovCliPath(): string {
  // Try multiple common installation paths for codecov CLI
  const possiblePaths: string[] = [
    join(homedir(), 'Library', 'Python', '3.9', 'bin', 'codecovcli'),
    join(homedir(), 'Library', 'Python', '3.10', 'bin', 'codecovcli'),
    join(homedir(), 'Library', 'Python', '3.11', 'bin', 'codecovcli'),
    join(homedir(), 'Library', 'Python', '3.12', 'bin', 'codecovcli'),
    '/usr/local/bin/codecovcli',
    '/opt/homebrew/bin/codecovcli'
  ];
  
  for (const cliPath of possiblePaths) {
    if (existsSync(cliPath)) {
      return cliPath;
    }
  }
  
  console.error('❌ Codecov CLI not found in any expected locations');
  console.error('💡 Searched paths:', possiblePaths.join('\n  '));
  console.error('💡 Install with: pip3 install codecov-cli');
  process.exit(1);
}

/**
 * Execute Codecov CLI command
 *
 * @param command - Command arguments
 * @param options - Execution options
 * @returns Promise resolving to exit code
 * @since 1.0.0
 */
function executeCodecovCommand(command: string[], options: { verbose?: boolean; dryRun?: boolean } = {}): Promise<number> {
  const cliPath = getCodecovCliPath();
  const fullCommand = [cliPath, ...command];
  
  if (options.verbose || options.dryRun) {
    console.log('🚀 Executing:', fullCommand.join(' '));
  }
  
  if (options.dryRun) {
    console.log('🏃‍♂️ Dry run - command not executed');
    return Promise.resolve(0);
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn(fullCommand[0], fullCommand.slice(1), {
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      resolve(code || 0);
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Get current Git commit SHA
 *
 * @returns Current commit SHA or empty string
 * @since 1.0.0
 */
function getCurrentCommitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    console.warn('⚠️  Could not get git commit SHA');
    return '';
  }
}

/**
 * Handle coverage upload to Codecov
 *
 * @param args - Command line arguments
 * @since 1.0.0
 */
async function handleUpload(args: CliArgs): Promise<void> {
  const token = getToken(args);
  const sha = getCurrentCommitSha();
  
  console.log('📤 Uploading coverage to Codecov...');
  if (sha) {
    console.log(`📝 Commit SHA: ${sha}`);
  }
  
  const command = [
    'do-upload',
    '-t', token,
  ];
  
  if (sha) {
    command.push('-C', sha);
  }
  
  // Add coverage file if it exists
  if (existsSync('./coverage/lcov.info')) {
    command.push('-f', './coverage/lcov.info');
    console.log('📊 Found coverage file: ./coverage/lcov.info');
  }
  
  if (args.verbose) {
    command.push('-v');
  }
  
  command.push(...args.args);
  
  const exitCode = await executeCodecovCommand(command, { verbose: args.verbose, dryRun: args.dryRun });
  
  if (exitCode === 0) {
    console.log('✅ Coverage uploaded successfully!');
    console.log(`🔗 View at: ${REPOSITORY_URL}`);
  } else {
    console.error('❌ Upload failed with exit code:', exitCode);
    process.exit(exitCode);
  }
}

/**
 * Handle Codecov report creation
 *
 * @param args - Command line arguments
 * @since 1.0.0
 */
async function handleCreateReport(args: CliArgs): Promise<void> {
  const token = getToken(args);
  const sha = getCurrentCommitSha();
  
  console.log('📊 Creating Codecov report...');
  
  const command = [
    'create-report',
    '-t', token,
  ];
  
  if (sha) {
    command.push('-C', sha);
  }
  
  if (args.verbose) {
    command.push('-v');
  }
  
  command.push(...args.args);
  
  await executeCodecovCommand(command, { verbose: args.verbose, dryRun: args.dryRun });
}

/**
 * Handle commit data creation
 *
 * @param args - Command line arguments
 * @since 1.0.0
 */
async function handleCreateCommit(args: CliArgs): Promise<void> {
  const token = getToken(args);
  const sha = getCurrentCommitSha();
  
  console.log('📝 Creating commit data...');
  
  const command = [
    'create-commit',
    '-t', token,
  ];
  
  if (sha) {
    command.push('-C', sha);
  }
  
  if (args.verbose) {
    command.push('-v');
  }
  
  command.push(...args.args);
  
  await executeCodecovCommand(command, { verbose: args.verbose, dryRun: args.dryRun });
}

/**
 * Test Codecov authentication
 *
 * @param args - Command line arguments
 * @since 1.0.0
 */
async function handleTestAuth(args: CliArgs): Promise<void> {
  const token = getToken(args);
  
  console.log('🔐 Testing Codecov authentication...');
  console.log(`📍 Repository: ${REPOSITORY_SLUG}`);
  console.log(`🎯 Token: ${token.substring(0, 8)}...`);
  
  // Test with a simple create-commit operation
  const sha = getCurrentCommitSha();
  const command = [
    'create-commit',
    '-t', token,
  ];
  
  if (sha) {
    command.push('-C', sha);
  }
  
  if (args.verbose) {
    command.push('-v');
  }
  
  try {
    const exitCode = await executeCodecovCommand(command, { verbose: args.verbose, dryRun: args.dryRun });
    
    if (exitCode === 0) {
      console.log('✅ Authentication successful!');
      console.log(`🔗 Repository: ${REPOSITORY_URL}`);
    } else {
      console.error('❌ Authentication failed');
      process.exit(exitCode);
    }
  } catch (error) {
    console.error('❌ Error testing authentication:', error);
    process.exit(1);
  }
}

/**
 * Display repository status
 *
 * @param args - Command line arguments
 * @since 1.0.0
 */
async function handleStatus(args: CliArgs): Promise<void> {
  console.log('📊 Repository Status:');
  console.log(`🔗 Codecov URL: ${REPOSITORY_URL}`);
  
  // Check if coverage files exist
  if (existsSync('./coverage/lcov.info')) {
    console.log('✅ Local coverage file found: ./coverage/lcov.info');
  } else {
    console.log('❌ No local coverage file found');
    console.log('💡 Run "pnpm test:coverage" to generate coverage');
  }
  
  // Check git status
  const sha = getCurrentCommitSha();
  if (sha) {
    console.log(`📝 Current commit: ${sha}`);
  }
  
  // Check if token is available
  const hasToken = !!(args.token || process.env.CODECOV_TOKEN);
  if (hasToken) {
    console.log('✅ Codecov token configured');
  } else {
    console.log('❌ No Codecov token found');
    console.log('💡 Set CODECOV_TOKEN environment variable');
  }
}

/**
 * Main application entry point
 *
 * @since 1.0.0
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help || !args.command) {
    showHelp();
    return;
  }

  try {
    switch (args.command) {
      case 'upload':
        await handleUpload(args);
        break;
        
      case 'create-report':
        await handleCreateReport(args);
        break;
        
      case 'create-commit':
        await handleCreateCommit(args);
        break;
        
      case 'test-auth':
        await handleTestAuth(args);
        break;
        
      case 'status':
        await handleStatus(args);
        break;
        
      default:
        console.error(`❌ Unknown command: ${args.command}`);
        console.log('💡 Use --help to see available commands');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
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

export { executeCodecovCommand, getToken, handleUpload, handleCreateReport };