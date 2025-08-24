/**
 * DriveHR Netlify Sync - Common Shared Types
 *
 * Essential type definitions providing the foundation for consistent
 * data structures throughout the DriveHR Netlify Sync application.
 * Contains core interfaces for environment configuration and application
 * initialization with comprehensive validation and type safety.
 *
 * Core Features:
 * - Environment configuration validation from process.env
 * - Standardized environment variable type definitions
 * - Application initialization configuration structure
 * - Cross-module type consistency and safety
 *
 * @example
 * ```typescript
 * import type { EnvironmentConfig } from './common.js';
 * import { getEnvironmentConfig } from '../lib/env.js';
 *
 * // Load and validate environment configuration
 * const config: EnvironmentConfig = getEnvironmentConfig();
 * console.log(`Environment: ${config.environment}`);
 * console.log(`Log Level: ${config.logLevel}`);
 * ```
 *
 * @module common-types
 * @since 1.0.0
 * @see {@link ../lib/env.ts} for environment configuration loading
 * @see {@link ./config.ts} for complete application configuration
 * @see {@link ../CLAUDE.md} for development standards and type requirements
 */

/**
 * Environment configuration interface for application initialization
 *
 * Defines the structure for environment-specific configuration loaded from
 * process environment variables. Ensures all required settings are present
 * and properly typed for secure application initialization and operation.
 * Used throughout the application for configuration validation and access.
 *
 * Security Requirements:
 * - webhookSecret must be minimum 32 characters for HMAC security
 * - driveHrCompanyId must be valid UUID format from DriveHR
 * - wpApiUrl must use HTTPS protocol for secure webhook delivery
 * - All values are readonly to prevent accidental modification
 *
 * @example
 * ```typescript
 * import { getEnvironmentConfig } from '../lib/env.js';
 *
 * // Load configuration with validation
 * const config: EnvironmentConfig = getEnvironmentConfig();
 *
 * // Access configuration safely
 * if (config.environment === 'production') {
 *   console.log('Running in production mode');
 * }
 *
 * // Use in application initialization
 * const logger = createLogger(config.logLevel);
 * const webhookClient = createWebhookClient({
 *   baseUrl: config.wpApiUrl,
 *   secret: config.webhookSecret
 * });
 * ```
 *
 * @since 1.0.0
 * @see {@link ../lib/env.ts} for configuration loading implementation
 * @see {@link ../types/config.ts} for complete application configuration
 */
export interface EnvironmentConfig {
  /** DriveHR company UUID identifier from DRIVEHR_COMPANY_ID environment variable */
  readonly driveHrCompanyId: string;
  /** WordPress webhook endpoint URL for job synchronization from WP_API_URL */
  readonly wpApiUrl: string;
  /** Secret key for webhook signature verification from WEBHOOK_SECRET (minimum 32 characters) */
  readonly webhookSecret: string;
  /** Current application environment from NODE_ENV or ENVIRONMENT */
  readonly environment: 'development' | 'staging' | 'production';
  /** Minimum log level for application logging from LOG_LEVEL */
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
}
