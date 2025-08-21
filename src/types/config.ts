/**
 * Application Configuration Types
 *
 * Comprehensive type definitions for application configuration with runtime validation
 * using Zod schemas. Ensures type safety and proper configuration management across
 * all application components including logging, security, performance, and API settings.
 *
 * Features include:
 * - Type-safe configuration interfaces
 * - Runtime validation with Zod schemas
 * - Environment-specific configuration
 * - Security and performance tuning options
 * - Comprehensive validation error handling
 *
 * @module config-types
 * @since 1.0.0
 * @see {@link https://zod.dev/} for Zod validation library documentation
 */

import { z } from 'zod';
import type { WordPressApiConfig, DriveHrApiConfig, WebhookConfig } from './api.js';

/**
 * Main application configuration interface
 *
 * Root configuration object that aggregates all application settings
 * including environment, logging, API configurations, security, and
 * performance tuning parameters.
 *
 * @example
 * ```typescript
 * const appConfig: AppConfig = {
 *   environment: 'production',
 *   logging: {
 *     level: 'info',
 *     enableConsole: true,
 *     enableStructured: true,
 *     redactSensitive: true
 *   },
 *   driveHr: {
 *     careersUrl: 'https://drivehris.app/careers/company/list',
 *     companyId: 'company-uuid',
 *     apiBaseUrl: 'https://drivehris.app/careers/company'
 *   },
 *   // ... other configurations
 * };
 * ```
 * @since 1.0.0
 * @see {@link AppConfigSchema} for runtime validation
 */
export interface AppConfig {
  /** Application environment (development, staging, production, test) */
  readonly environment: Environment;
  /** Logging configuration and settings */
  readonly logging: LoggingConfig;
  /** DriveHR API integration configuration */
  readonly driveHr: DriveHrApiConfig;
  /** WordPress API integration configuration */
  readonly wordPress: WordPressApiConfig;
  /** Webhook security configuration */
  readonly webhook: WebhookConfig;
  /** Security policies and settings */
  readonly security: SecurityConfig;
  /** Performance tuning parameters */
  readonly performance: PerformanceConfig;
}

/**
 * Logging configuration interface
 *
 * Controls application logging behavior including log levels,
 * output formats, and security considerations.
 *
 * @example
 * ```typescript
 * // Development logging
 * const devLogging: LoggingConfig = {
 *   level: 'debug',
 *   enableConsole: true,
 *   enableStructured: false, // Human-readable logs
 *   redactSensitive: false // Show all data for debugging
 * };
 *
 * // Production logging
 * const prodLogging: LoggingConfig = {
 *   level: 'info',
 *   enableConsole: true,
 *   enableStructured: true, // JSON format for log aggregation
 *   redactSensitive: true // Hide sensitive data
 * };
 * ```
 * @since 1.0.0
 * @see {@link LogLevel} for available log levels
 */
export interface LoggingConfig {
  /** Minimum log level to output */
  readonly level: LogLevel;
  /** Whether to enable console output */
  readonly enableConsole: boolean;
  /** Whether to use structured JSON logging */
  readonly enableStructured: boolean;
  /** Whether to redact sensitive information from logs */
  readonly redactSensitive: boolean;
}

/**
 * Security configuration interface
 *
 * Comprehensive security settings for request handling, data validation,
 * and protection against common web vulnerabilities. Includes CORS policies,
 * rate limiting, and input/output sanitization controls.
 *
 * @example
 * ```typescript
 * // Production security configuration
 * const prodSecurity: SecurityConfig = {
 *   enableCors: true,
 *   corsOrigins: ['https://myapp.com', 'https://admin.myapp.com'],
 *   enableRateLimit: true,
 *   maxRequestsPerMinute: 60,
 *   rateLimitMaxRequests: 100,
 *   rateLimitWindowMs: 60000, // 1 minute
 *   enableInputValidation: true,
 *   enableRequestValidation: true,
 *   enableOutputSanitization: true
 * };
 *
 * // Development security configuration (more permissive)
 * const devSecurity: SecurityConfig = {
 *   enableCors: true,
 *   corsOrigins: ['http://localhost:3000', 'http://localhost:8080'],
 *   enableRateLimit: false, // Disabled for development
 *   maxRequestsPerMinute: 1000,
 *   rateLimitMaxRequests: 1000,
 *   rateLimitWindowMs: 60000,
 *   enableInputValidation: true,
 *   enableRequestValidation: false, // Relaxed for testing
 *   enableOutputSanitization: true
 * };
 * ```
 * @since 1.0.0
 * @see {@link SecurityConfigSchema} for runtime validation
 * @see {@link CorsConfig} for detailed CORS configuration options
 */
export interface SecurityConfig {
  /** Whether to enable Cross-Origin Resource Sharing (CORS) */
  readonly enableCors: boolean;
  /** List of allowed origins for CORS requests */
  readonly corsOrigins: string[];
  /** Whether to enable rate limiting protection */
  readonly enableRateLimit: boolean;
  /** Maximum requests allowed per minute (legacy field) */
  readonly maxRequestsPerMinute: number;
  /** Maximum requests allowed within the rate limit window */
  readonly rateLimitMaxRequests: number;
  /** Rate limit time window in milliseconds */
  readonly rateLimitWindowMs: number;
  /** Whether to enable input data validation */
  readonly enableInputValidation: boolean;
  /** Whether to enable request structure validation */
  readonly enableRequestValidation: boolean;
  /** Whether to enable output data sanitization */
  readonly enableOutputSanitization: boolean;
}

/**
 * Performance tuning configuration interface
 *
 * Configuration settings for optimizing application performance including
 * HTTP timeouts, retry logic, caching, and concurrency controls. These
 * settings can significantly impact application responsiveness and reliability.
 *
 * @example
 * ```typescript
 * // High-performance configuration for production
 * const perfConfig: PerformanceConfig = {
 *   httpTimeout: 30000, // 30 seconds
 *   maxRetries: 3,
 *   retryDelay: 1000, // 1 second base delay
 *   batchSize: 50, // Process 50 jobs at a time
 *   cacheEnabled: true,
 *   cacheTtl: 300000, // 5 minutes cache
 *   maxConcurrentRequests: 10
 * };
 *
 * // Conservative configuration for limited resources
 * const conservativeConfig: PerformanceConfig = {
 *   httpTimeout: 60000, // Longer timeout for slow networks
 *   maxRetries: 5, // More retries for reliability
 *   retryDelay: 2000, // Longer delay between retries
 *   batchSize: 10, // Smaller batches to reduce memory usage
 *   cacheEnabled: false, // Disable caching to save memory
 *   cacheTtl: 60000, // 1 minute cache if enabled
 *   maxConcurrentRequests: 3 // Limit concurrency
 * };
 * ```
 * @since 1.0.0
 * @see {@link PerformanceConfigSchema} for runtime validation
 * @see {@link RetryConfig} for detailed retry configuration options
 */
export interface PerformanceConfig {
  /** HTTP request timeout in milliseconds */
  readonly httpTimeout: number;
  /** Maximum number of retry attempts for failed operations */
  readonly maxRetries: number;
  /** Base delay between retry attempts in milliseconds */
  readonly retryDelay: number;
  /** Number of items to process in each batch operation */
  readonly batchSize: number;
  /** Whether to enable response caching */
  readonly cacheEnabled: boolean;
  /** Cache time-to-live in milliseconds */
  readonly cacheTtl: number;
  /** Maximum number of concurrent HTTP requests */
  readonly maxConcurrentRequests: number;
}

/**
 * Application environment type
 *
 * Defines the allowed environment values for application deployment.
 * Each environment has specific configuration defaults and behaviors.
 *
 * @example
 * ```typescript
 * const env: Environment = 'production';
 * if (env === 'production') {
 *   enableStructuredLogging();
 * }
 * ```
 * @since 1.0.0
 * @see {@link EnvironmentSchema} for runtime validation
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Logging level type
 *
 * Defines the allowed log levels in order of severity from error (highest)
 * to trace (lowest). Controls which log messages are output based on
 * the configured minimum level.
 *
 * @example
 * ```typescript
 * const level: LogLevel = 'debug';
 * logger.setLevel(level); // Shows debug, info, warn, error logs
 * ```
 * @since 1.0.0
 * @see {@link LogLevelSchema} for runtime validation
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Runtime validation schemas using Zod
 *
 * These schemas provide runtime type checking and validation for configuration
 * objects, ensuring data integrity and proper error handling during application
 * startup and configuration loading.
 *
 * @since 1.0.0
 * @see {@link https://zod.dev/} for Zod validation library documentation
 */

/**
 * Environment validation schema
 *
 * Validates that the application environment is one of the supported values.
 * Used during configuration loading to ensure proper environment setup.
 *
 * @example
 * ```typescript
 * const result = EnvironmentSchema.safeParse('production');
 * if (result.success) {
 *   console.log('Valid environment:', result.data);
 * } else {
 *   console.error('Invalid environment:', result.error.message);
 * }
 * ```
 * @since 1.0.0
 */
export const EnvironmentSchema = z.enum(['development', 'staging', 'production', 'test']);

/**
 * Log level validation schema
 *
 * Validates that the log level is one of the supported logging levels.
 * Ensures proper logging configuration and prevents invalid log levels.
 *
 * @example
 * ```typescript
 * const result = LogLevelSchema.safeParse('debug');
 * if (result.success) {
 *   logger.setLevel(result.data);
 * }
 * ```
 * @since 1.0.0
 */
export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

/**
 * Logging configuration validation schema
 *
 * Validates the structure and values of logging configuration objects.
 * Ensures all required logging settings are present and properly typed.
 *
 * @example
 * ```typescript
 * const config = {
 *   level: 'info',
 *   enableConsole: true,
 *   enableStructured: true,
 *   redactSensitive: true
 * };
 *
 * const result = LoggingConfigSchema.safeParse(config);
 * if (result.success) {
 *   initializeLogger(result.data);
 * }
 * ```
 * @since 1.0.0
 */
export const LoggingConfigSchema = z.object({
  level: LogLevelSchema,
  enableConsole: z.boolean(),
  enableStructured: z.boolean(),
  redactSensitive: z.boolean(),
});

/**
 * Security configuration validation schema
 *
 * Validates security configuration settings including CORS origins,
 * rate limiting parameters, and validation flags. Ensures all security
 * settings are properly configured and within safe limits.
 *
 * @example
 * ```typescript
 * const securityConfig = {
 *   enableCors: true,
 *   corsOrigins: ['https://myapp.com'],
 *   enableRateLimit: true,
 *   maxRequestsPerMinute: 60,
 *   rateLimitMaxRequests: 100,
 *   rateLimitWindowMs: 60000,
 *   enableInputValidation: true,
 *   enableRequestValidation: true,
 *   enableOutputSanitization: true
 * };
 *
 * const result = SecurityConfigSchema.safeParse(securityConfig);
 * if (result.success) {
 *   applySecurity(result.data);
 * }
 * ```
 * @since 1.0.0
 */
export const SecurityConfigSchema = z.object({
  enableCors: z.boolean(),
  corsOrigins: z.array(z.string().url()),
  enableRateLimit: z.boolean(),
  maxRequestsPerMinute: z.number().positive(),
  rateLimitMaxRequests: z.number().positive(),
  rateLimitWindowMs: z.number().positive(),
  enableInputValidation: z.boolean(),
  enableRequestValidation: z.boolean(),
  enableOutputSanitization: z.boolean(),
});

/**
 * Performance configuration validation schema
 *
 * Validates performance tuning parameters including timeouts, retry limits,
 * and concurrency settings. Ensures all performance settings are within
 * reasonable bounds and properly configured.
 *
 * @example
 * ```typescript
 * const perfConfig = {
 *   httpTimeout: 30000,
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   batchSize: 50,
 *   cacheEnabled: true,
 *   cacheTtl: 300000,
 *   maxConcurrentRequests: 10
 * };
 *
 * const result = PerformanceConfigSchema.safeParse(perfConfig);
 * if (result.success) {
 *   applyPerformanceSettings(result.data);
 * }
 * ```
 * @since 1.0.0
 */
export const PerformanceConfigSchema = z.object({
  httpTimeout: z.number().positive(),
  maxRetries: z.number().min(0).max(10),
  retryDelay: z.number().positive(),
  batchSize: z.number().positive(),
  cacheEnabled: z.boolean(),
  cacheTtl: z.number().positive(),
  maxConcurrentRequests: z.number().positive(),
});

/**
 * DriveHR API configuration validation schema
 *
 * Validates DriveHR-specific configuration including URLs, company identifiers,
 * and connection settings. Ensures proper format for UUIDs and URLs.
 *
 * @example
 * ```typescript
 * const driveHrConfig = {
 *   careersUrl: 'https://drivehris.app/careers/company/list',
 *   companyId: '123e4567-e89b-12d3-a456-426614174000',
 *   apiBaseUrl: 'https://drivehris.app/careers/company',
 *   timeout: 30000,
 *   retries: 3
 * };
 *
 * const result = DriveHrConfigSchema.safeParse(driveHrConfig);
 * if (result.success) {
 *   initializeDriveHrClient(result.data);
 * }
 * ```
 * @since 1.0.0
 */
export const DriveHrConfigSchema = z.object({
  careersUrl: z.string().url(),
  companyId: z.string().uuid(),
  apiBaseUrl: z.string().url(),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).max(5).optional(),
});

/**
 * WordPress API configuration validation schema
 *
 * Validates WordPress API configuration including authentication credentials
 * and connection settings. Supports multiple authentication methods.
 *
 * @example
 * ```typescript
 * const wpConfig = {
 *   baseUrl: 'https://mysite.com/webhook/drivehr-sync',
 *   token: 'wp_auth_token_here',
 *   timeout: 30000,
 *   retries: 3
 * };
 *
 * const result = WordPressConfigSchema.safeParse(wpConfig);
 * if (result.success) {
 *   initializeWordPressClient(result.data);
 * }
 * ```
 * @since 1.0.0
 */
export const WordPressConfigSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).max(5).optional(),
});

/**
 * Webhook configuration validation schema
 *
 * Validates webhook security configuration including secret keys and
 * HMAC algorithm settings. Ensures minimum security requirements are met.
 *
 * @example
 * ```typescript
 * const webhookConfig = {
 *   secret: 'super-secret-webhook-key-min-16-chars',
 *   algorithm: 'sha256',
 *   headerName: 'x-webhook-signature'
 * };
 *
 * const result = WebhookConfigSchema.safeParse(webhookConfig);
 * if (result.success) {
 *   setupWebhookSecurity(result.data);
 * }
 * ```
 * @since 1.0.0
 */
export const WebhookConfigSchema = z.object({
  secret: z.string().min(16),
  algorithm: z.enum(['sha256', 'sha1']),
  headerName: z.string().min(1),
});

/**
 * Complete application configuration validation schema
 *
 * Top-level schema that validates the entire application configuration
 * by combining all individual configuration schemas. This is the main
 * schema used for validating configuration during application startup.
 *
 * @example
 * ```typescript
 * const fullConfig = {
 *   environment: 'production',
 *   logging: { level: 'info', enableConsole: true, enableStructured: true, redactSensitive: true },
 *   driveHr: { careersUrl: '...', companyId: '...', apiBaseUrl: '...' },
 *   wordPress: { baseUrl: '...', token: '...' },
 *   webhook: { secret: '...', algorithm: 'sha256', headerName: 'x-webhook-signature' },
 *   security: { enableCors: true, corsOrigins: ['...'] },
 *   performance: { httpTimeout: 30000, maxRetries: 3 }
 * };
 *
 * const result = AppConfigSchema.safeParse(fullConfig);
 * if (result.success) {
 *   initializeApplication(result.data);
 * } else {
 *   console.error('Configuration validation failed:', result.error.errors);
 * }
 * ```
 * @since 1.0.0
 */
export const AppConfigSchema = z.object({
  environment: EnvironmentSchema,
  logging: LoggingConfigSchema,
  driveHr: DriveHrConfigSchema,
  wordPress: WordPressConfigSchema,
  webhook: WebhookConfigSchema,
  security: SecurityConfigSchema,
  performance: PerformanceConfigSchema,
});

/**
 * Configuration validation result interface
 *
 * Contains the results of configuration validation including the parsed
 * configuration object (if valid) and any validation errors encountered.
 * Used for comprehensive error reporting during configuration loading.
 *
 * @example
 * ```typescript
 * function validateConfig(rawConfig: unknown): ConfigValidationResult {
 *   const result = AppConfigSchema.safeParse(rawConfig);
 *
 *   if (result.success) {
 *     return {
 *       isValid: true,
 *       config: result.data,
 *       errors: []
 *     };
 *   } else {
 *     return {
 *       isValid: false,
 *       config: undefined,
 *       errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
 *     };
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link AppConfigSchema} for the validation schema
 */
export interface ConfigValidationResult {
  /** Whether the configuration passed validation */
  readonly isValid: boolean;
  /** The parsed and validated configuration object (if validation succeeded) */
  readonly config?: AppConfig;
  /** Array of validation error messages (if validation failed) */
  readonly errors: readonly string[];
}

/**
 * Environment variable metadata interface
 *
 * Describes the structure and metadata for environment variables used
 * in configuration. Useful for documentation, validation, and providing
 * helpful error messages when required environment variables are missing.
 *
 * @example
 * ```typescript
 * import { getEnvVar } from '../lib/env.js';
 *
 * const envVars: EnvironmentVariable[] = [
 *   {
 *     name: 'DRIVEHR_COMPANY_ID',
 *     value: getEnvVar('DRIVEHR_COMPANY_ID'),
 *     required: true,
 *     description: 'UUID of the company in DriveHR system'
 *   },
 *   {
 *     name: 'LOG_LEVEL',
 *     value: getEnvVar('LOG_LEVEL'),
 *     required: false,
 *     defaultValue: 'info',
 *     description: 'Minimum log level (error, warn, info, debug, trace)'
 *   }
 * ];
 *
 * // Validate required environment variables
 * const missing = envVars
 *   .filter(env => env.required && !env.value)
 *   .map(env => `${env.name}: ${env.description}`);
 *
 * if (missing.length > 0) {
 *   throw new Error(`Missing required environment variables:\n${missing.join('\n')}`);
 * }
 * ```
 * @since 1.0.0
 */
export interface EnvironmentVariable {
  /** Name of the environment variable */
  readonly name: string;
  /** Current value of the environment variable (if set) */
  readonly value?: string;
  /** Whether this environment variable is required for application startup */
  readonly required: boolean;
  /** Default value to use if the environment variable is not set */
  readonly defaultValue?: string;
  /** Human-readable description of the environment variable's purpose */
  readonly description: string;
}
