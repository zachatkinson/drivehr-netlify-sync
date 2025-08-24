/**
 * Playwright configuration for DriveHR job scraping automation
 *
 * Optimized for headless browser automation in CI/CD environments with
 * enterprise-grade settings for timeout, retry logic, and reporting.
 *
 * @module playwright-config
 * @since 1.0.0
 * @see {@link ./CLAUDE.md} for development standards
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration export
 *
 * @since 1.0.0
 */
export default defineConfig({
  // Test directory (for any browser tests we might add later)
  testDir: './tests/e2e',
  
  // Global timeout for the entire test run
  globalTimeout: 10 * 60 * 1000, // 10 minutes
  
  // Timeout for each test
  timeout: 2 * 60 * 1000, // 2 minutes per test
  
  // Expect timeout for assertions
  expect: {
    timeout: 30 * 1000, // 30 seconds
  },
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env['CI'],
  
  // Retry on CI only
  retries: process.env['CI'] ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env['CI'] ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL for relative URLs
    baseURL: 'https://drivehris.app',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Capture video on failure
    video: 'retain-on-failure',
    
    // User agent for requests
    userAgent: 'DriveHR-Scraper/1.0 (GitHub Actions)',
    
    // Timeout for navigation and other actions
    actionTimeout: 30 * 1000, // 30 seconds
    navigationTimeout: 30 * 1000, // 30 seconds
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Additional options for job scraping
        headless: true,
        launchOptions: {
          args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],

  // Run your local dev server before starting the tests
  // webServer: undefined, // We don't need a local server for scraping external sites
});