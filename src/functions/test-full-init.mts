/**
 * Test function to debug full service instantiation
 */

// eslint-disable-next-line no-console
console.log('DEBUG: Test full init function starting');

// Import everything like sync-jobs does
import { getEnvVar } from '../lib/env.js';
import { loadAppConfig, getAppConfig } from '../lib/config.js';
import { createHttpClient } from '../lib/http-client.js';
import { createLogger, setLogger, getLogger } from '../lib/logger.js';
import { StringUtils, SecurityUtils } from '../lib/utils.js';
import { JobFetchService } from '../services/job-fetcher.js';
import { createHtmlParser } from '../services/html-parser.js';
import { createWordPressClient } from '../services/wordpress-client.js';

// eslint-disable-next-line no-console
console.log('DEBUG: All imports successful');

// Copy the EXACT initializeDependencies logic from sync-jobs
function initializeDependencies() {
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Starting');
  
  // Load and validate configuration
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Loading config');
  const configResult = loadAppConfig();
  
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Config loaded', { isValid: configResult.isValid });
  if (!configResult.isValid) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: initializeDependencies - Config validation failed', { errors: configResult.errors });
    throw new Error(`Configuration validation failed: ${configResult.errors.join(', ')}`);
  }

  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Getting app config');
  const config = getAppConfig();
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - App config retrieved');

  // Initialize logger
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating logger');
  const logger = createLogger(config.logging.level, config.logging.enableStructured);
  setLogger(logger);
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Logger created and set');

  // Create HTTP client
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating HTTP client');
  const httpClient = createHttpClient({
    timeout: config.performance.httpTimeout,
    retries: config.performance.maxRetries,
    userAgent: 'DriveHR-Sync/1.0 (Netlify Function)',
  });
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - HTTP client created');

  // Create HTML parser
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating HTML parser');
  const htmlParser = createHtmlParser();
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - HTML parser created');

  // Create job fetch service
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating job fetch service');
  const jobFetchService = new JobFetchService(httpClient, htmlParser);
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Job fetch service created');

  // Create WordPress client
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Creating WordPress client');
  const wordPressClient = createWordPressClient(
    config.wordPress,
    httpClient,
    config.webhook.secret
  );
  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - WordPress client created');

  // Configure security headers
  const securityHeaders = {
    'Content-Type': 'application/json',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' https:; script-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  };

  // Configure CORS
  const corsConfig = {
    origin: config.security.corsOrigins.length > 0 ? config.security.corsOrigins : ['*'],
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  };

  // eslint-disable-next-line no-console
  console.log('DEBUG: initializeDependencies - Returning dependencies');
  return {
    jobFetchService,
    wordPressClient,
    securityHeaders,
    corsConfig,
  };
}

export default async (req: Request, context: any) => {
  // eslint-disable-next-line no-console
  console.log('DEBUG: Test full init handler called');
  
  try {
    // eslint-disable-next-line no-console
    console.log('DEBUG: About to call full initializeDependencies');
    const deps = initializeDependencies();
    
    // eslint-disable-next-line no-console
    console.log('DEBUG: Full initializeDependencies completed successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Full init test works',
      hasJobFetchService: !!deps.jobFetchService,
      hasWordPressClient: !!deps.wordPressClient,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Test full init handler error', { 
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};