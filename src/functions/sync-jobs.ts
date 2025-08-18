/**
 * DriveHR to WordPress Job Sync - Netlify Function
 *
 * This is the main serverless function that:
 * 1. Scrapes job postings from DriveHRIS
 * 2. Validates and processes the data
 * 3. Syncs to WordPress via REST API
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import type { ApiResponse } from '../types/common';
import { getEnvVar } from '../lib/env';

// Main Netlify function handler
export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  try {
    // Security headers
    const securityHeaders = {
      'Content-Type': 'application/json',
      'Content-Security-Policy': "default-src 'self'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          ...securityHeaders,
          'Access-Control-Allow-Origin':
            getEnvVar('WP_API_URL')?.replace('/wp-json/drivehris/v1', '') ?? '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
        body: '',
      };
    }

    // Basic health check for now
    const response: ApiResponse<{ message: string; timestamp: Date }> = {
      success: true,
      data: {
        message: 'DriveHR Sync Function - Ready for implementation',
        timestamp: new Date(),
      },
      timestamp: new Date(),
    };

    return {
      statusCode: 200,
      headers: securityHeaders,
      body: JSON.stringify(response),
    };
  } catch {
    // Error handling with no sensitive information exposure
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date(),
    };

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorResponse),
    };
  }
};
