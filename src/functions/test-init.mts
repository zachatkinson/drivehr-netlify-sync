/**
 * Test function to debug initialization logic
 */

// eslint-disable-next-line no-console
console.log('DEBUG: Test init function starting');

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

// Copy the exact initializeDependencies logic
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

  return { success: true };
}

export default async (req: Request, context: any) => {
  // eslint-disable-next-line no-console
  console.log('DEBUG: Test init handler called');
  
  try {
    // eslint-disable-next-line no-console
    console.log('DEBUG: About to call initializeDependencies');
    const result = initializeDependencies();
    
    // eslint-disable-next-line no-console
    console.log('DEBUG: initializeDependencies completed successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Init test works',
      result,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Test init handler error', { 
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