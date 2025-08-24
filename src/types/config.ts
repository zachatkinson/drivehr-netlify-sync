/**
 * Application Configuration Types
 *
 * Comprehensive type definitions for application configuration with runtime validation
 * using Zod schemas. Ensures type safety and proper configuration management across
 * all application components including logging, security, performance, and API settings.
 *
 * Features:
 * - Type-safe configuration interfaces with readonly properties
 * - Runtime validation using Zod schemas with detailed error reporting
 * - Environment-specific configuration support (development, staging, production, test)
 * - Security configuration with CORS, rate limiting, and validation controls
 * - Performance tuning parameters for HTTP timeouts, retries, and concurrency
 * - Comprehensive validation error handling with structured error messages
 *
 * @example
 * ```typescript
 * import { AppConfigSchema, type AppConfig } from './config.js';
 *
 * const rawConfig = {
 *   environment: 'production',
 *   logging: { level: 'info', enableConsole: true, enableStructured: true, redactSensitive: true },
 *   driveHr: { careersUrl: 'https://example.com', companyId: 'uuid', apiBaseUrl: 'https://api.example.com' },
 *   // ... other configurations
 * };
 *
 * const result = AppConfigSchema.safeParse(rawConfig);
 * if (result.success) {
 *   const config: AppConfig = result.data;
 *   console.log(`Environment: ${config.environment}`);
 * }
 * ```
 * @module config-types
 * @since 1.0.0
 * @see {@link https://zod.dev/} for Zod validation library documentation
 * @see {@link ../lib/config.ts} for configuration loading implementation
 */

import { z } from 'zod';
import type { WordPressApiConfig, DriveHrApiConfig, WebhookConfig } from './api.js';

/**
 * Main application configuration interface
 *
 * Root configuration object that aggregates all application settings including
 * environment, logging, API configurations, security, and performance tuning parameters.
 * All properties are readonly to prevent accidental modification after initialization.
 *
 * This interface represents the complete application configuration structure that is
 * validated against the AppConfigSchema during application startup. It ensures type
 * safety across all application components that consume configuration data.
 *
 * @example
 * ```typescript
 * import { getAppConfig } from '../lib/config.js';
 *
 * const config: AppConfig = getAppConfig();
 * console.log(`Running in ${config.environment} mode`);
 * console.log(`Log level: ${config.logging.level}`);
 * console.log(`DriveHR Company ID: ${config.driveHr.companyId}`);
 * ```
 * @since 1.0.0
 * @see {@link AppConfigSchema} for runtime validation schema
 * @see {@link ../lib/config.ts} for configuration loading implementation
 */
export interface AppConfig {
  /** Application deployment environment (development, staging, production, test) */
  readonly environment: Environment;
  /** Logging configuration including level, format, and security settings */
  readonly logging: LoggingConfig;
  /** DriveHR API integration configuration with URLs and authentication */
  readonly driveHr: DriveHrApiConfig;
  /** WordPress API integration configuration with webhook endpoints */
  readonly wordPress: WordPressApiConfig;
  /** Webhook security configuration with HMAC signature validation */
  readonly webhook: WebhookConfig;
  /** Security policies including CORS, rate limiting, and input validation */
  readonly security: SecurityConfig;
  /** Performance tuning parameters for HTTP timeouts, retries, and concurrency */
  readonly performance: ApplicationPerformanceConfig;
}

/**
 * Logging configuration interface
 *
 * Controls application logging behavior including log levels, output formats,
 * and security considerations. Supports both human-readable text format for
 * development and structured JSON format for production log aggregation.
 *
 * Log levels follow standard severity hierarchy: error (highest) > warn > info >
 * debug > trace (lowest). Setting a minimum level filters out less severe messages.
 *
 * @example
 * ```typescript
 * // Development logging configuration
 * const devLogging: LoggingConfig = {
 *   level: 'debug',
 *   enableConsole: true,
 *   enableStructured: false, // Human-readable format
 *   redactSensitive: false   // Show all data for debugging
 * };
 *
 * // Production logging configuration
 * const prodLogging: LoggingConfig = {
 *   level: 'info',
 *   enableConsole: true,
 *   enableStructured: true,  // JSON format for log aggregation
 *   redactSensitive: true    // Hide sensitive data
 * };
 * ```
 * @since 1.0.0
 * @see {@link LogLevel} for available log levels
 * @see {@link LoggingConfigSchema} for runtime validation
 */
export interface LoggingConfig {
  /** Minimum log level to output (error, warn, info, debug, trace) */
  readonly level: LogLevel;
  /** Whether to enable console output for log messages */
  readonly enableConsole: boolean;
  /** Whether to use structured JSON logging format */
  readonly enableStructured: boolean;
  /** Whether to redact sensitive information from log output */
  readonly redactSensitive: boolean;
}

/**
 * Security configuration interface
 *
 * Comprehensive security settings for request handling, data validation,
 * and protection against common web vulnerabilities. Includes CORS policies,
 * rate limiting, and input/output sanitization controls.
 *
 * These settings provide multiple layers of security protection including
 * Cross-Origin Resource Sharing (CORS) controls, request rate limiting to
 * prevent abuse, and comprehensive input/output validation and sanitization.
 *
 * @example
 * ```typescript
 * // Production security configuration (strict)
 * const prodSecurity: SecurityConfig = {
 *   enableCors: true,
 *   corsOrigins: ['https://myapp.com', 'https://admin.myapp.com'],
 *   enableRateLimit: true,
 *   rateLimitMaxRequests: 100,
 *   rateLimitWindowMs: 60000, // 1 minute window
 *   enableInputValidation: true,
 *   enableRequestValidation: true,
 *   enableOutputSanitization: true
 * };
 *
 * // Development security configuration (more permissive)
 * const devSecurity: SecurityConfig = {
 *   enableCors: true,
 *   corsOrigins: ['http://localhost:3000', 'http://localhost:8080'],
 *   enableRateLimit: false, // Disabled for development convenience
 *   rateLimitMaxRequests: 1000,
 *   rateLimitWindowMs: 60000,
 *   enableInputValidation: true,
 *   enableRequestValidation: false, // Relaxed for testing
 *   enableOutputSanitization: true
 * };
 * ```
 * @since 1.0.0
 * @see {@link SecurityConfigSchema} for runtime validation
 */
export interface SecurityConfig {
  /** Whether to enable Cross-Origin Resource Sharing (CORS) protection */
  readonly enableCors: boolean;
  /** List of allowed origins for CORS requests (must be valid URLs) */
  readonly corsOrigins: string[];
  /** Whether to enable request rate limiting protection */
  readonly enableRateLimit: boolean;
  /** Maximum requests allowed within the rate limit time window */
  readonly rateLimitMaxRequests: number;
  /** Rate limit time window duration in milliseconds */
  readonly rateLimitWindowMs: number;
  /** Whether to enable comprehensive input data validation */
  readonly enableInputValidation: boolean;
  /** Whether to enable request structure and format validation */
  readonly enableRequestValidation: boolean;
  /** Whether to enable output data sanitization for security */
  readonly enableOutputSanitization: boolean;
}

export interface ApplicationPerformanceConfig {
  readonly httpTimeout: number;
  readonly maxRetries: number;
  readonly retryDelay: number;
  readonly batchSize: number;
  readonly cacheEnabled: boolean;
  readonly cacheTtl: number;
  readonly maxConcurrentRequests: number;
}

export type Environment = 'development' | 'staging' | 'production' | 'test';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export const EnvironmentSchema = z.enum(['development', 'staging', 'production', 'test']);

export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

export const LoggingConfigSchema = z.object({
  level: LogLevelSchema,
  enableConsole: z.boolean(),
  enableStructured: z.boolean(),
  redactSensitive: z.boolean(),
});

export const SecurityConfigSchema = z.object({
  enableCors: z.boolean(),
  corsOrigins: z.array(z.string().url()),
  enableRateLimit: z.boolean(),
  rateLimitMaxRequests: z.number().positive(),
  rateLimitWindowMs: z.number().positive(),
  enableInputValidation: z.boolean(),
  enableRequestValidation: z.boolean(),
  enableOutputSanitization: z.boolean(),
});

export const ApplicationPerformanceConfigSchema = z.object({
  httpTimeout: z.number().positive(),
  maxRetries: z.number().min(0).max(10),
  retryDelay: z.number().positive(),
  batchSize: z.number().positive(),
  cacheEnabled: z.boolean(),
  cacheTtl: z.number().positive(),
  maxConcurrentRequests: z.number().positive(),
});

export const DriveHrConfigSchema = z.object({
  careersUrl: z.string().url(),
  companyId: z.string().uuid(),
  apiBaseUrl: z.string().url(),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).max(5).optional(),
});

export const WordPressConfigSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).max(5).optional(),
});

export const WebhookConfigSchema = z.object({
  secret: z.string().min(16),
  algorithm: z.enum(['sha256', 'sha1']),
  headerName: z.string().min(1),
});

export const AppConfigSchema = z.object({
  environment: EnvironmentSchema,
  logging: LoggingConfigSchema,
  driveHr: DriveHrConfigSchema,
  wordPress: WordPressConfigSchema,
  webhook: WebhookConfigSchema,
  security: SecurityConfigSchema,
  performance: ApplicationPerformanceConfigSchema,
});

export interface ConfigValidationResult {
  readonly isValid: boolean;
  readonly config?: AppConfig;
  readonly errors: readonly string[];
}

export interface EnvironmentVariable {
  readonly name: string;
  readonly value?: string;
  readonly required: boolean;
  readonly defaultValue?: string;
  readonly description: string;
}
