/**
 * Test function to debug import issues
 */

// eslint-disable-next-line no-console
console.log('DEBUG: Test import function starting');

// Test the first import that might be failing  
// eslint-disable-next-line no-console
console.log('DEBUG: About to import getEnvVar');

import { getEnvVar } from '../lib/env.js';

// eslint-disable-next-line no-console
console.log('DEBUG: Import successful');

export default async (req: Request, context: any) => {
  // eslint-disable-next-line no-console
  console.log('DEBUG: Test import handler called');
  
  try {
    const testVar = getEnvVar('ENVIRONMENT', 'test');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Import test works',
      testVar,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Test import handler error', { error });
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};