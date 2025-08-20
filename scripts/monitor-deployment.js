#!/usr/bin/env node
/**
 * Deployment Monitoring Script
 * 
 * Monitors GitHub Actions CI and Netlify deployment status
 * Tests deployed functions and reports health status
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration - Update these with your actual URLs
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'zachatkinson/drivehr-netlify-sync';
const NETLIFY_SITE_URL = process.env.NETLIFY_SITE_URL || 'https://your-site.netlify.app';

console.log('🔍 DriveHR Netlify Sync - Deployment Monitor\n');

/**
 * Check GitHub Actions workflow status
 */
async function checkGitHubActions() {
  console.log('📋 Checking GitHub Actions Status...');
  
  try {
    // Check if gh CLI is available
    await execAsync('gh --version');
    
    // Get latest workflow runs
    const { stdout } = await execAsync(`gh run list --repo ${GITHUB_REPO} --limit 5 --json status,conclusion,name,createdAt,url`);
    const runs = JSON.parse(stdout);
    
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
 * Check Netlify deployment status
 */
async function checkNetlifyStatus() {
  console.log('\n🌐 Checking Netlify Status...');
  
  try {
    // Check if netlify CLI is available
    await execAsync('netlify --version');
    
    // Get site status (requires netlify login and site linking)
    try {
      const { stdout } = await execAsync('netlify status --json');
      const status = JSON.parse(stdout);
      
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
 * Test deployed Netlify functions
 */
async function testNetlifyFunctions() {
  console.log('\n🧪 Testing Netlify Functions...');
  
  const endpoints = [
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
 * Test API redirects
 */
async function testApiRedirects() {
  console.log('\n🔄 Testing API Redirects...');
  
  const redirects = [
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
 * Run local tests to verify CI/CD pipeline
 */
async function runLocalTests() {
  console.log('\n🧪 Running Local Test Suite...');
  
  try {
    console.log('   Running linting...');
    await execAsync('npm run lint');
    console.log('   ✅ ESLint: All checks passed');
    
    console.log('   Running type checking...');
    await execAsync('npm run typecheck');
    console.log('   ✅ TypeScript: Compilation successful');
    
    console.log('   Running test suite...');
    const { stdout } = await execAsync('npm test -- --run --reporter=json');
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
 * Main monitoring function
 */
async function monitorDeployment() {
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