/**
 * Test function to debug config import issues
 */

// eslint-disable-next-line no-console
console.log('DEBUG: Test config function starting');

// Test the config imports that might be failing  
// eslint-disable-next-line no-console
console.log('DEBUG: About to import config');

import { loadAppConfig, getAppConfig } from '../lib/config.js';

// eslint-disable-next-line no-console
console.log('DEBUG: Config import successful');

export default async (req: Request, context: any) => {
  // eslint-disable-next-line no-console
  console.log('DEBUG: Test config handler called');
  
  try {
    // eslint-disable-next-line no-console
    console.log('DEBUG: About to load app config');
    const configResult = loadAppConfig();
    
    // eslint-disable-next-line no-console
    console.log('DEBUG: Config load result', { isValid: configResult.isValid });
    
    if (!configResult.isValid) {
      throw new Error(`Config validation failed: ${configResult.errors.join(', ')}`);
    }
    
    const config = getAppConfig();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Config test works',
      configValid: configResult.isValid,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Test config handler error', { error });
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};