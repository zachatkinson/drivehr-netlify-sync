/**
 * Test function to debug services import issues
 */

// eslint-disable-next-line no-console
console.log('DEBUG: Test services function starting');

// Test the services imports that might be failing  
// eslint-disable-next-line no-console
console.log('DEBUG: About to import services');

import { JobFetchService } from '../services/job-fetcher.js';
import { createHtmlParser } from '../services/html-parser.js';
import { createWordPressClient } from '../services/wordpress-client.js';

// eslint-disable-next-line no-console
console.log('DEBUG: Services imports successful');

export default async (req: Request, context: any) => {
  // eslint-disable-next-line no-console
  console.log('DEBUG: Test services handler called');
  
  try {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Testing service creation');
    
    // Test HTML parser creation
    const htmlParser = createHtmlParser();
    // eslint-disable-next-line no-console
    console.log('DEBUG: HTML parser created successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Services test works',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Test services handler error', { error });
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};