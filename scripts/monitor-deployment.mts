#!/usr/bin/env tsx
/**
 * DriveHR Netlify Sync - Deployment Monitor
 *
 * Enterprise-grade deployment monitoring script that provides comprehensive
 * validation and testing of DriveHR Netlify deployment status. Monitors GitHub
 * Actions workflows, Netlify site status, function endpoints, API redirects,
 * and local test suite execution with detailed reporting.
 *
 * Monitoring Features:
 * - GitHub Actions workflow status validation and recent run history
 * - Netlify site status checking and configuration validation
 * - Serverless function endpoint testing with health check parsing
 * - API redirect validation for netlify.toml redirects configuration
 * - Local test suite execution with lint, typecheck, and test validation
 * - Comprehensive deployment summary with quick access URLs
 *
 * Exit Codes:
 * - 0: Monitoring completed successfully (errors are reported but not fatal)
 * - 1: Monitoring script encountered critical errors preventing execution
 *
 * @example
 * ```bash
 * # Run deployment monitoring
 * pnpm tsx scripts/monitor-deployment.mts
 *
 * # Environment variables for customization
 * export GITHUB_REPOSITORY="your-org/your-repo"
 * export NETLIFY_SITE_URL="https://your-site.netlify.app"
 * ```
 *
 * @module deployment-monitor
 * @since 1.0.0
 * @see {@link ../CLAUDE.md} for development standards and monitoring requirements
 * @see {@link ../README.md} for deployment setup instructions
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GitHub Actions workflow run status data structure
 *
 * Represents a single workflow run from GitHub Actions API with status,
 * conclusion, timing, and access information for deployment monitoring.
 *
 * @since 1.0.0
 */
interface GitHubWorkflowRun {
  /** Workflow run status: 'queued', 'in_progress', 'completed' */
  status: string;
  /** Workflow conclusion: 'success', 'failure', 'cancelled', 'skipped', or null if not completed */
  conclusion: string | null;
  /** Human-readable workflow name from GitHub Actions configuration */
  name: string;
  /** ISO 8601 timestamp when the workflow run was created */
  createdAt: string;
  /** Direct URL to the GitHub Actions workflow run page */
  url: string;
}

/**
 * Netlify site status data structure
 *
 * Represents site configuration and status information from Netlify CLI
 * status command, including site metadata and build configuration.
 *
 * @since 1.0.0
 */
interface NetlifyStatus {
  /** Site information container, may be undefined if not authenticated */
  site?: {
    /** Human-readable site name in Netlify dashboard */
    name?: string;
    /** Primary site URL for accessing deployed site */
    url?: string;
    /** Build configuration settings */
    build_settings?: {
      /** Git repository URL connected to Netlify builds */
      repo_url?: string;
    };
  };
}

/**
 * Netlify serverless function endpoint definition
 *
 * Defines a testable endpoint with metadata for automated endpoint
 * validation during deployment monitoring.
 *
 * @since 1.0.0
 */
interface Endpoint {
  /** Human-readable endpoint name for logging and reporting */
  name: string;
  /** URL path to the Netlify function endpoint */
  path: string;
  /** HTTP method expected by the endpoint */
  method: string;
}

/**
 * API redirect rule definition
 *
 * Represents a URL redirect rule that should be configured in netlify.toml
 * for mapping user-friendly API paths to Netlify function endpoints.
 *
 * @since 1.0.0
 */
interface Redirect {
  /** Source path that users will request */
  from: string;
  /** Target Netlify function path to redirect to */
  to: string;
}

// Configuration - Update these with your actual URLs
const GITHUB_REPO: string = process.env.GITHUB_REPOSITORY || 'zachatkinson/drivehr-netlify-sync';
const NETLIFY_SITE_URL: string = process.env.NETLIFY_SITE_URL || 'https://your-site.netlify.app';

console.log('🔍 DriveHR Netlify Sync - Deployment Monitor\n');

/**
 * Check GitHub Actions workflow status and recent runs
 *
 * Validates GitHub CLI availability and retrieves the latest 5 workflow runs
 * from the configured repository. Provides detailed status reporting with
 * run conclusions, timing, and direct links to GitHub Actions dashboard.
 *
 * @returns Promise resolving to latest workflow run data, or null if GitHub CLI unavailable
 * @throws Never throws - all errors are caught and logged gracefully
 * @example
 * ```typescript
 * const latestRun = await checkGitHubActions();
 * if (latestRun?.conclusion === 'success') {
 *   console.log('Latest deployment succeeded');
 * }
 * ```
 * @since 1.0.0
 * @see {@link https://cli.github.com/} GitHub CLI installation
 */
async function checkGitHubActions(): Promise<GitHubWorkflowRun | null> {
  console.log('📋 Checking GitHub Actions Status...');
  
  try {
    // Check if gh CLI is available
    await execAsync('gh --version');
    
    // Get latest workflow runs
    const { stdout } = await execAsync(`gh run list --repo ${GITHUB_REPO} --limit 5 --json status,conclusion,name,createdAt,url`);
    const runs: GitHubWorkflowRun[] = JSON.parse(stdout);
    
    console.log('🔄 Recent GitHub Actions Runs:');
    runs.forEach((run, index) => {
      const status = run.status === 'completed' 
        ? (run.conclusion === 'success' ? '✅' : '❌')
        : '🔄';
      const time = new Date(run.createdAt).toLocaleString();
      console.log(`   ${status} ${run.name} - ${run.conclusion || run.status} (${time})`);
      if (index === 0) {
        console.log(`      URL: ${run.url}`);
      }
    });
    
    return runs[0]; // Return latest run
  } catch (error) {
    console.log('⚠️  GitHub CLI not available or not authenticated');
    console.log('   To install: https://cli.github.com/');
    console.log('   To authenticate: gh auth login');
    return null;
  }
}

/**
 * Check Netlify site status and configuration
 *
 * Validates Netlify CLI availability and retrieves site status including
 * site name, URL, and build configuration. Requires authenticated Netlify CLI
 * and linked site for full status information.
 *
 * @returns Promise resolving to Netlify site status, or null if CLI unavailable/unauthenticated
 * @throws Never throws - all errors are caught and logged gracefully
 * @example
 * ```typescript
 * const status = await checkNetlifyStatus();
 * if (status?.site?.build_settings?.repo_url) {
 *   console.log('Site connected to Git repository');
 * }
 * ```
 * @since 1.0.0
 * @see {@link https://docs.netlify.com/cli/get-started/} Netlify CLI setup
 */
async function checkNetlifyStatus(): Promise<NetlifyStatus | null> {
  console.log('\n🌐 Checking Netlify Status...');
  
  try {
    // Check if netlify CLI is available
    await execAsync('netlify --version');
    
    // Get site status (requires netlify login and site linking)
    try {
      const { stdout } = await execAsync('netlify status --json');
      const status: NetlifyStatus = JSON.parse(stdout);
      
      console.log('📊 Netlify Site Status:');
      console.log(`   Site: ${status.site?.name || 'Unknown'}`);
      console.log(`   URL: ${status.site?.url || 'Unknown'}`);
      console.log(`   Build Status: ${status.site?.build_settings?.repo_url ? '✅ Connected' : '⚠️  Not connected'}`);
      
      return status;
    } catch (statusError) {
      console.log('⚠️  Not authenticated with Netlify or site not linked');
      console.log('   Run: netlify login && netlify link');
    }
  } catch (error) {
    console.log('⚠️  Netlify CLI not available');
    console.log('   To install: npm install -g netlify-cli');
  }
  
  return null;
}

/**
 * Test Netlify serverless function endpoints
 *
 * Validates all critical Netlify function endpoints by making HTTP requests
 * and checking response status codes. For health check endpoint, parses and
 * displays WordPress and webhook configuration status.
 *
 * @returns Promise resolving when all endpoint tests complete
 * @throws Never throws - all errors are caught and logged per endpoint
 * @example
 * ```typescript
 * await testNetlifyFunctions();
 * // Logs test results for health-check, sync-jobs, manual-trigger endpoints
 * ```
 * @since 1.0.0
 * @see {@link ../src/functions/} for serverless function implementations
 */
async function testNetlifyFunctions(): Promise<void> {
  console.log('\n🧪 Testing Netlify Functions...');
  
  const endpoints: Endpoint[] = [
    { name: 'Health Check', path: '/.netlify/functions/health-check', method: 'GET' },
    { name: 'Sync Jobs', path: '/.netlify/functions/sync-jobs', method: 'GET' },
    { name: 'Manual Trigger', path: '/.netlify/functions/manual-trigger', method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    const url = `${NETLIFY_SITE_URL}${endpoint.path}`;
    
    try {
      console.log(`   Testing ${endpoint.name}...`);
      
      // Use curl to test the endpoint
      const curlCmd = `curl -s -o /dev/null -w "%{http_code}" "${url}"`;
      const { stdout } = await execAsync(curlCmd);
      const statusCode = stdout.trim();
      
      if (statusCode === '200') {
        console.log(`   ✅ ${endpoint.name}: 200 OK`);
        
        // For health check, get the actual response
        if (endpoint.name === 'Health Check') {
          try {
            const { stdout: response } = await execAsync(`curl -s "${url}"`);
            const healthData = JSON.parse(response);
            console.log(`      Status: ${healthData.data?.status || 'unknown'}`);
            console.log(`      WordPress: ${healthData.data?.wordpress_configured ? '✅' : '❌'}`);
            console.log(`      Webhook: ${healthData.data?.webhook_configured ? '✅' : '❌'}`);
          } catch (parseError) {
            console.log(`      ⚠️  Could not parse health check response`);
          }
        }
      } else if (statusCode === '404') {
        console.log(`   ❌ ${endpoint.name}: 404 Not Found (function not deployed)`);
      } else if (statusCode === '500') {
        console.log(`   ❌ ${endpoint.name}: 500 Internal Server Error (function error)`);
      } else {
        console.log(`   ⚠️  ${endpoint.name}: ${statusCode} (unexpected status)`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint.name}: Error testing endpoint`);
      console.log(`      ${error.message}`);
    }
  }
}

/**
 * Test API redirect rules from netlify.toml
 *
 * Validates that user-friendly API paths correctly redirect to Netlify
 * function endpoints according to netlify.toml redirect configuration.
 * Tests redirect functionality without following redirects to verify setup.
 *
 * @returns Promise resolving when all redirect tests complete
 * @throws Never throws - all errors are caught and logged per redirect
 * @example
 * ```typescript
 * await testApiRedirects();
 * // Tests /api/health -> /.netlify/functions/health-check redirects
 * ```
 * @since 1.0.0
 * @see {@link ../netlify.toml} for redirect configuration
 */
async function testApiRedirects(): Promise<void> {
  console.log('\n🔄 Testing API Redirects...');
  
  const redirects: Redirect[] = [
    { from: '/api/health', to: '/.netlify/functions/health-check' },
    { from: '/api/jobs', to: '/.netlify/functions/sync-jobs' },
    { from: '/api/trigger', to: '/.netlify/functions/manual-trigger' }
  ];
  
  for (const redirect of redirects) {
    const url = `${NETLIFY_SITE_URL}${redirect.from}`;
    
    try {
      // Test redirect with follow redirects disabled to see the redirect status
      const curlCmd = `curl -s -o /dev/null -w "%{http_code}" "${url}"`;
      const { stdout } = await execAsync(curlCmd);
      const statusCode = stdout.trim();
      
      if (statusCode === '200') {
        console.log(`   ✅ ${redirect.from} → ${redirect.to}: Working`);
      } else {
        console.log(`   ⚠️  ${redirect.from}: ${statusCode} (check netlify.toml redirects)`);
      }
    } catch (error) {
      console.log(`   ❌ ${redirect.from}: Error testing redirect`);
    }
  }
}

/**
 * Execute local test suite including linting, type checking, and unit tests
 *
 * Runs comprehensive local validation including ESLint code quality checks,
 * TypeScript compilation validation, and full test suite execution with
 * JSON reporting for detailed result parsing.
 *
 * @returns Promise resolving when all local tests complete
 * @throws Never throws - all errors are caught and logged gracefully
 * @example
 * ```typescript
 * await runLocalTests();
 * // Executes: pnpm run lint, pnpm run typecheck, pnpm test
 * ```
 * @since 1.0.0
 * @see {@link ../CLAUDE.md} for code quality standards and testing requirements
 */
async function runLocalTests(): Promise<void> {
  console.log('\n🧪 Running Local Test Suite...');
  
  try {
    console.log('   Running linting...');
    await execAsync('pnpm run lint');
    console.log('   ✅ ESLint: All checks passed');
    
    console.log('   Running type checking...');
    await execAsync('pnpm run typecheck');
    console.log('   ✅ TypeScript: Compilation successful');
    
    console.log('   Running test suite...');
    const { stdout } = await execAsync('pnpm test -- --run --reporter=json');
    const testResults = JSON.parse(stdout);
    
    if (testResults.success) {
      console.log(`   ✅ Tests: ${testResults.numTotalTests} tests passed`);
    } else {
      console.log(`   ❌ Tests: ${testResults.numFailedTests} failed, ${testResults.numPassedTests} passed`);
    }
  } catch (error) {
    console.log('   ❌ Local tests failed:');
    console.log(`      ${error.message}`);
  }
}

/**
 * Main deployment monitoring orchestration function
 *
 * Executes comprehensive deployment validation by running all monitoring
 * checks in sequence and providing a detailed summary report. Coordinates
 * GitHub Actions checking, Netlify status validation, function endpoint
 * testing, redirect validation, and local test execution.
 *
 * @returns Promise resolving when complete monitoring cycle finishes
 * @throws Never throws - all errors are caught and reported in summary
 * @example
 * ```typescript
 * await monitorDeployment();
 * // Runs complete deployment validation suite
 * ```
 * @since 1.0.0
 * @see {@link ../README.md} for deployment setup and monitoring guidelines
 */
async function monitorDeployment(): Promise<void> {
  console.log(`🚀 Monitoring deployment for: ${NETLIFY_SITE_URL}\n`);
  
  // Check GitHub Actions
  const latestRun = await checkGitHubActions();
  
  // Check Netlify status
  const netlifyStatus = await checkNetlifyStatus();
  
  // Test functions
  await testNetlifyFunctions();
  
  // Test redirects
  await testApiRedirects();
  
  // Run local tests
  await runLocalTests();
  
  // Summary
  console.log('\n📊 Deployment Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (latestRun) {
    console.log(`GitHub Actions: ${latestRun.conclusion === 'success' ? '✅ Passed' : '❌ Failed'}`);
  }
  
  console.log(`Netlify Functions: Check results above`);
  console.log(`\n🔗 Quick Access URLs:`);
  console.log(`   Health Check: ${NETLIFY_SITE_URL}/.netlify/functions/health-check`);
  console.log(`   Site Dashboard: https://app.netlify.com/sites/[your-site-name]`);
  console.log(`   GitHub Actions: https://github.com/${GITHUB_REPO}/actions`);
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Check Netlify dashboard for build logs');
  console.log('   2. Test health check endpoint in browser');
  console.log('   3. Configure GitHub Actions secrets if needed');
  console.log('   4. Set up WordPress webhook endpoint');
}

// Run the monitoring
monitorDeployment().catch(console.error);