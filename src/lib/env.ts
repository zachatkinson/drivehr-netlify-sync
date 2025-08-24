/**
 * Environment Variable Management System
 *
 * Enterprise-grade environment variable access utilities providing type-safe,
 * validated access to environment variables with comprehensive error handling.
 * This module ensures consistent environment variable processing across the
 * entire application with support for required variables, optional defaults,
 * and runtime validation.
 *
 * The module implements three distinct access patterns:
 * 1. Required variables with validation and error throwing
 * 2. Optional variables with default value fallbacks
 * 3. Optional variables that may return undefined
 *
 * All environment variable access should go through these utilities to ensure
 * consistency, proper validation, and clear error reporting when configuration
 * is missing or invalid.
 *
 * @example
 * ```typescript
 * import { getEnvVar, getEnvironmentConfig } from './env.js';
 *
 * // Required variable (throws if missing)
 * const apiKey = getEnvVar('API_KEY', true);
 *
 * // With default value
 * const port = getEnvVar('PORT', '3000');
 *
 * // Optional variable
 * const debugMode = getEnvVar('DEBUG_MODE');
 *
 * // Complete validated configuration
 * const config = getEnvironmentConfig();
 * ```
 *
 * @module env-management-system
 * @since 1.0.0
 * @see {@link ../types/common.ts} for EnvironmentConfig interface
 * @see {@link config.ts} for full application configuration
 */

import type { EnvironmentConfig } from '../types/common';

/**
 * Get environment variable with default value
 *
 * Retrieves an environment variable and returns the provided default value
 * if the variable is not set. This overload ensures a string is always
 * returned, making it safe for configuration values that must have a value.
 *
 * @param key - The environment variable name to retrieve
 * @param defaultValue - Default value to return if variable is not set
 * @returns The environment variable value or the provided default
 * @example
 * ```typescript
 * const port = getEnvVar('PORT', '3000');
 * const logLevel = getEnvVar('LOG_LEVEL', 'info');
 * ```
 * @since 1.0.0
 * @see {@link getEnvVar} for other overloads
 */
export function getEnvVar(key: string, defaultValue: string): string;
/**
 * Get required environment variable
 *
 * Retrieves an environment variable that is required for application operation.
 * Throws an error if the variable is not set, ensuring early failure for
 * missing critical configuration.
 *
 * @param key - The environment variable name to retrieve
 * @param required - Must be true to indicate this variable is required
 * @returns The environment variable value
 * @throws {Error} When the required variable is not set or empty
 * @example
 * ```typescript
 * const apiKey = getEnvVar('API_KEY', true);
 * const databaseUrl = getEnvVar('DATABASE_URL', true);
 * ```
 * @since 1.0.0
 * @see {@link getEnvVar} for other overloads
 */
export function getEnvVar(key: string, required: true): string;
/**
 * Get optional environment variable
 *
 * Retrieves an environment variable that may or may not be set.
 * Returns undefined if the variable is not present, allowing for
 * conditional configuration and feature flags.
 *
 * @param key - The environment variable name to retrieve
 * @param required - Optional false flag (default behavior)
 * @returns The environment variable value or undefined if not set
 * @example
 * ```typescript
 * const debugMode = getEnvVar('DEBUG_MODE');
 * if (debugMode === 'true') {
 *   console.log('Debug mode enabled');
 * }
 *
 * const optionalFeature = getEnvVar('FEATURE_FLAG', false);
 * ```
 * @since 1.0.0
 * @see {@link getEnvVar} for other overloads
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
 * Get required environment variable with additional validation
 *
 * Internal utility function that enforces required environment variables
 * with additional empty string validation. Provides consistent error messages
 * and ensures non-empty values for critical configuration.
 *
 * @param key - The environment variable name to retrieve
 * @returns The validated environment variable value
 * @throws {Error} When the required variable is not set or is empty
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
 * Get complete validated environment configuration
 *
 * Retrieves and validates all required environment variables for the
 * DriveHR application. This function ensures all critical configuration
 * is present at startup and provides type-safe access to environment values.
 * Validates required variables and provides sensible defaults for optional ones.
 *
 * This is the primary entry point for environment configuration and should
 * be called during application startup to fail fast if required configuration
 * is missing.
 *
 * @returns Complete environment configuration with validated values
 * @throws {Error} When any required environment variable is missing or invalid
 * @example
 * ```typescript
 * try {
 *   const config = getEnvironmentConfig();
 *   console.log(`DriveHR Company: ${config.driveHrCompanyId}`);
 *   console.log(`WordPress URL: ${config.wpApiUrl}`);
 *   console.log(`Environment: ${config.environment}`);
 * } catch (error) {
 *   console.error('Missing required configuration:', error.message);
 *   process.exit(1);
 * }
 * ```
 * @since 1.0.0
 * @see {@link EnvironmentConfig} for the configuration structure
 * @see {@link ../lib/config.ts} for full application configuration with validation
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    driveHrCompanyId: getRequiredEnvVar('DRIVEHR_COMPANY_ID'),
    wpApiUrl: getRequiredEnvVar('WP_API_URL'),
    webhookSecret: getRequiredEnvVar('WEBHOOK_SECRET'),
    environment: (getEnvVar('ENVIRONMENT') as EnvironmentConfig['environment']) || 'production',
    logLevel: (getEnvVar('LOG_LEVEL') as EnvironmentConfig['logLevel']) || 'info',
  };
};
