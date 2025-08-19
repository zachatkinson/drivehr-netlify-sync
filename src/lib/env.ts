/**
 * Environment variable utilities with validation and type safety
 *
 * Provides safe, type-checked access to environment variables with
 * support for required variables, default values, and comprehensive
 * error handling. All environment access should go through these
 * utilities to ensure consistency and proper validation.
 *
 * @module env
 * @since 1.0.0
 * @see {@link getAppConfig} for application configuration
 */

import type { EnvironmentConfig } from '../types/common';

/**
 * Safely get an environment variable with validation
 *
 * Provides flexible environment variable access with three overloaded signatures:
 * 1. With default value - Returns env var or default if not set
 * 2. Required flag - Throws if variable is not set
 * 3. Optional access - Returns undefined if not set
 *
 * @param key - The environment variable name to retrieve
 * @param defaultValue - Default value to return if variable is not set
 * @returns The environment variable value or default
 * @example
 * ```typescript
 * // With default value
 * const port = getEnvVar('PORT', '3000');
 * ```
 * @since 1.0.0
 */
export function getEnvVar(key: string, defaultValue: string): string;
/**
 * Get required environment variable
 *
 * @param key - The environment variable name to retrieve
 * @param required - Must be true to require the variable
 * @returns The environment variable value
 * @throws {Error} When the required variable is not set
 * @example
 * ```typescript
 * // Required variable
 * const apiKey = getEnvVar('API_KEY', true);
 * ```
 * @since 1.0.0
 */
export function getEnvVar(key: string, required: true): string;
/**
 * Get optional environment variable
 *
 * @param key - The environment variable name to retrieve
 * @param required - Optional false flag (default behavior)
 * @returns The environment variable value or undefined
 * @example
 * ```typescript
 * // Optional variable
 * const debugMode = getEnvVar('DEBUG');
 * if (debugMode) {
 *   console.log('Debug mode enabled');
 * }
 * ```
 * @since 1.0.0
 */
export function getEnvVar(key: string, required?: false): string | undefined;
export function getEnvVar(
  key: string,
  defaultValueOrRequired?: string | boolean
): string | undefined {
  const value = process.env[key];

  if (typeof defaultValueOrRequired === 'string') {
    return value ?? defaultValueOrRequired;
  }

  if (defaultValueOrRequired === true && !value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value;
}

/**
 * Get required environment variable or throw error
 *
 * Internal utility function that enforces required environment variables.
 * Provides clear error messages when required configuration is missing.
 *
 * @param key - The environment variable name to retrieve
 * @returns The environment variable value
 * @throws {Error} When the required variable is not set or empty
 * @since 1.0.0
 * @internal
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
 *
 * Retrieves and validates all required environment variables for the
 * application. Ensures all critical configuration is present at startup
 * and provides type-safe access to environment values.
 *
 * @returns Complete environment configuration with validated values
 * @throws {Error} When any required environment variable is missing
 * @example
 * ```typescript
 * try {
 *   const config = getEnvironmentConfig();
 *   console.log(`DriveHR Company: ${config.driveHrisCompanyId}`);
 *   console.log(`WordPress URL: ${config.wpApiUrl}`);
 * } catch (error) {
 *   console.error('Missing required configuration:', error);
 *   process.exit(1);
 * }
 * ```
 * @since 1.0.0
 * @see {@link EnvironmentConfig} for the configuration structure
 * @see {@link getAppConfig} for full application configuration
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    driveHrisCompanyId: getRequiredEnvVar('DRIVEHR_COMPANY_ID'),
    wpApiUrl: getRequiredEnvVar('WP_API_URL'),
    wpAuthToken: getRequiredEnvVar('WP_AUTH_TOKEN'),
    webhookSecret: getRequiredEnvVar('WEBHOOK_SECRET'),
    environment: (getEnvVar('ENVIRONMENT') as EnvironmentConfig['environment']) || 'production',
    logLevel: (getEnvVar('LOG_LEVEL') as EnvironmentConfig['logLevel']) || 'info',
  };
};
