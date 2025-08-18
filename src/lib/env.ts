/**
 * Environment variable utilities with validation and type safety
 */

import type { EnvironmentConfig } from '../types/common';

/**
 * Safely get an environment variable with validation
 */
export const getEnvVar = (key: string, required = false): string | undefined => {
  // eslint-disable-next-line no-undef -- process.env is safe for server-side Node.js
  const value = process.env[key];

  if (required && !value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value;
};

/**
 * Get required environment variable or throw error
 */
const getRequiredEnvVar = (key: string): string => {
  const value = getEnvVar(key, true);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
};

/**
 * Get validated environment configuration
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    driveHrisCompanyId: getRequiredEnvVar('DRIVEHRIS_COMPANY_ID'),
    wpApiUrl: getRequiredEnvVar('WP_API_URL'),
    wpAuthToken: getRequiredEnvVar('WP_AUTH_TOKEN'),
    webhookSecret: getRequiredEnvVar('WEBHOOK_SECRET'),
    environment: (getEnvVar('ENVIRONMENT') as EnvironmentConfig['environment']) || 'production',
    logLevel: (getEnvVar('LOG_LEVEL') as EnvironmentConfig['logLevel']) || 'info',
  };
};
