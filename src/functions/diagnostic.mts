/**
 * Diagnostic function to check environment configuration
 */

// eslint-disable-next-line no-console
console.log('DEBUG: Diagnostic function starting');

import { getEnvVar } from '../lib/env.js';
import { loadAppConfig } from '../lib/config.js';

export default async (req: Request, context: any) => {
  // eslint-disable-next-line no-console
  console.log('DEBUG: Diagnostic handler called');
  
  try {
    // Check environment variables
    const webhookSecret = getEnvVar('WEBHOOK_SECRET', '');
    const environment = getEnvVar('ENVIRONMENT', 'unknown');
    const wpApiUrl = getEnvVar('WP_API_URL', '');
    const companyId = getEnvVar('DRIVEHR_COMPANY_ID', '');
    
    // eslint-disable-next-line no-console
    console.log('DEBUG: Environment variables', {
      webhookSecretLength: webhookSecret.length,
      environment,
      wpApiUrlLength: wpApiUrl.length,
      companyIdLength: companyId.length
    });
    
    // Try config loading
    // eslint-disable-next-line no-console
    console.log('DEBUG: Attempting config load');
    const configResult = loadAppConfig();
    
    // eslint-disable-next-line no-console
    console.log('DEBUG: Config result', { 
      isValid: configResult.isValid,
      errorCount: configResult.errors.length,
      errors: configResult.errors
    });
    
    return new Response(JSON.stringify({
      success: true,
      environment: {
        ENVIRONMENT: environment,
        WEBHOOK_SECRET_LENGTH: webhookSecret.length,
        WP_API_URL_LENGTH: wpApiUrl.length,
        DRIVEHR_COMPANY_ID_LENGTH: companyId.length
      },
      config: {
        isValid: configResult.isValid,
        errors: configResult.errors
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('DEBUG: Diagnostic error', { 
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};