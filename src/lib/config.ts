/**
 * Application Configuration Service
 *
 * Enterprise-grade configuration management system providing secure, validated
 * access to environment variables and application settings. Implements singleton
 * pattern with comprehensive validation, type safety, and error handling.
 *
 * This service ensures all configuration is loaded once, validated against schemas,
 * and cached for optimal performance. It provides both imperative and declarative
 * access patterns, supporting various deployment environments with environment-
 * specific defaults and security policies.
 *
 * @example
 * ```typescript
 * import { loadAppConfig, getAppConfig } from './config.js';
 *
 * // Application startup - load and validate configuration
 * const result = loadAppConfig();
 * if (!result.isValid) {
 *   console.error('Configuration errors:', result.errors);
 *   process.exit(1);
 * }
 *
 * // Anywhere in application - access validated configuration
 * const config = getAppConfig();
 * console.log(`Environment: ${config.environment}`);
 * console.log(`DriveHR Company: ${config.driveHr.companyId}`);
 * console.log(`WordPress URL: ${config.wordPress.baseUrl}`);
 * ```
 *
 * @module config-service
 * @since 1.0.0
 */

import { getEnvVar } from './env.js';
import {
  AppConfigSchema,
  type AppConfig,
  type ConfigValidationResult,
  type EnvironmentVariable,
} from '../types/config.js';

const ENV_VARIABLES: readonly EnvironmentVariable[] = [
  {
    name: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    description: 'Application environment',
  },
  {
    name: 'LOG_LEVEL',
    required: false,
    defaultValue: 'info',
    description: 'Logging level',
  },
  {
    name: 'DRIVEHR_COMPANY_ID',
    required: true,
    description: 'DriveHR company ID',
  },
  {
    name: 'WP_API_URL',
    required: true,
    description: 'WordPress API base URL',
  },
  {
    name: 'WEBHOOK_SECRET',
    required: true,
    description: 'Webhook signature verification secret',
  },
  {
    name: 'HTTP_TIMEOUT',
    required: false,
    defaultValue: '30000',
    description: 'HTTP request timeout in milliseconds',
  },
  {
    name: 'MAX_RETRIES',
    required: false,
    defaultValue: '3',
    description: 'Maximum number of HTTP retries',
  },
  {
    name: 'CORS_ORIGINS',
    required: false,
    defaultValue: '',
    description: 'Comma-separated list of allowed CORS origins',
  },
  {
    name: 'RATE_LIMIT_MAX',
    required: false,
    defaultValue: '100',
    description: 'Maximum requests per minute per client',
  },
] as const;

/**
 * Configuration service for managing application settings
 *
 * Enterprise-grade configuration management with comprehensive validation,
 * type safety, and singleton pattern implementation. Provides secure access
 * to environment variables with proper error handling and validation.
 * Implements lazy loading and caching for optimal performance.
 *
 * The service follows a strict validation process:
 * 1. Environment variable presence validation
 * 2. Schema-based type validation using Zod
 * 3. Business logic validation (URL formats, UUIDs, etc.)
 * 4. Environment-specific defaults and security policies
 *
 * @example
 * ```typescript
 * const configService = ConfigService.getInstance();
 * const result = configService.loadConfig();
 *
 * if (result.isValid) {
 *   const config = configService.getConfig();
 *   console.log(`Environment: ${config.environment}`);
 * } else {
 *   console.error('Configuration errors:', result.errors);
 * }
 * ```
 * @since 1.0.0
 * @see {@link AppConfig} for configuration schema
 * @see {@link getAppConfig} for convenient access helper
 */
export class ConfigService {
  private static instance: ConfigService | null = null;
  private config: AppConfig | null = null;

  private constructor() {}

  /**
   * Get singleton instance of ConfigService
   *
   * Implements the singleton pattern to ensure only one configuration
   * service instance exists throughout the application lifecycle.
   * Thread-safe implementation using nullish coalescing assignment.
   *
   * @returns The singleton ConfigService instance
   * @example
   * ```typescript
   * const configService = ConfigService.getInstance();
   * // Always returns the same instance
   * const sameInstance = ConfigService.getInstance();
   * console.log(configService === sameInstance); // true
   * ```
   * @since 1.0.0
   * @see {@link resetInstance} for testing utilities
   */
  public static getInstance(): ConfigService {
    ConfigService.instance ??= new ConfigService();
    return ConfigService.instance;
  }

  /**
   * Reset singleton instance (for testing only)
   *
   * Clears the singleton instance to allow fresh configuration
   * loading in test environments. Should NEVER be used in
   * production code as it can lead to configuration inconsistencies.
   *
   * @example
   * ```typescript
   * // In test setup
   * beforeEach(() => {
   *   ConfigService.resetInstance();
   * });
   * ```
   * @since 1.0.0
   * @see {@link getInstance} for getting the singleton instance
   */
  public static resetInstance(): void {
    ConfigService.instance = null;
  }

  /**
   * Load and validate application configuration
   *
   * Loads configuration from environment variables, validates against
   * the schema, and caches the result. Performs comprehensive validation
   * including required variable checks and format validation.
   * This method is idempotent - calling it multiple times is safe.
   *
   * @returns Configuration validation result containing either valid config or errors
   * @throws {Error} When environment parsing fails unexpectedly
   * @example
   * ```typescript
   * const configService = ConfigService.getInstance();
   * const result = configService.loadConfig();
   *
   * if (result.isValid) {
   *   console.log('Configuration loaded successfully');
   *   const config = configService.getConfig();
   * } else {
   *   console.error('Configuration errors:', result.errors);
   * }
   * ```
   * @since 1.0.0
   * @see {@link getConfig} for accessing loaded configuration
   * @see {@link validateEnvironmentVariables} for environment validation
   */
  public loadConfig(): ConfigValidationResult {
    try {
      // First check for missing required environment variables
      const envErrors = this.validateEnvironmentVariables();
      if (envErrors.length > 0) {
        return {
          isValid: false,
          errors: envErrors,
        };
      }

      const rawConfig = this.buildRawConfig();
      const validationResult = AppConfigSchema.safeParse(rawConfig);

      if (!validationResult.success) {
        return {
          isValid: false,
          errors: validationResult.error.issues.map((err: unknown) => {
            if (
              typeof err === 'object' &&
              err !== null &&
              'path' in err &&
              'message' in err &&
              'code' in err
            ) {
              const issueErr = err as { path: (string | number)[]; message: string; code: string };
              return this.formatValidationError(issueErr.path, issueErr.message, issueErr.code);
            }
            return 'Invalid configuration error';
          }),
        };
      }

      this.config = validationResult.data;

      return {
        isValid: true,
        config: this.config,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown configuration error'],
      };
    }
  }

  /**
   * Get current configuration (throws if not loaded)
   *
   * Returns the cached configuration if it has been successfully loaded
   * and validated. This method provides type-safe access to all
   * application configuration values.
   *
   * @returns The validated application configuration
   * @throws {Error} When configuration has not been loaded or is invalid
   * @example
   * ```typescript
   * const configService = ConfigService.getInstance();
   * const result = configService.loadConfig();
   *
   * if (result.isValid) {
   *   const config = configService.getConfig();
   *   console.log(`DriveHR Company ID: ${config.driveHr.companyId}`);
   *   console.log(`WordPress URL: ${config.wordPress.baseUrl}`);
   * }
   * ```
   * @since 1.0.0
   * @see {@link loadConfig} for loading configuration first
   */
  public getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded or invalid');
    }
    return this.config;
  }

  private formatValidationError(path: (string | number)[], message: string, code: string): string {
    const fieldPath = path.join('.');
    const envVarName = this.getEnvVarName(fieldPath);

    return this.formatErrorByCode(code, message, envVarName, fieldPath);
  }

  private getEnvVarName(fieldPath: string): string {
    const pathToEnvVar: Record<string, string> = {
      'driveHr.companyId': 'DRIVEHR_COMPANY_ID',
      'wordPress.baseUrl': 'WP_API_URL',
      'webhook.secret': 'WEBHOOK_SECRET',
      environment: 'ENVIRONMENT',
      'logging.level': 'LOG_LEVEL',
    };

    return pathToEnvVar[fieldPath] ?? fieldPath.toUpperCase();
  }

  private formatErrorByCode(
    code: string,
    message: string,
    envVarName: string,
    fieldPath: string
  ): string {
    switch (code) {
      case 'invalid_format':
        return this.formatInvalidFormatError(message, envVarName);
      case 'too_small':
        return this.formatTooSmallError(message, envVarName);
      case 'invalid_value':
        return this.formatInvalidValueError(fieldPath, envVarName);
      case 'invalid_type':
        return this.formatInvalidTypeError(message, envVarName);
      default:
        return `${fieldPath}: ${message}`;
    }
  }

  private formatInvalidFormatError(message: string, envVarName: string): string {
    if (message.includes('Invalid UUID')) {
      return `${envVarName} must be a valid UUID`;
    }
    if (message.includes('Invalid URL')) {
      return `${envVarName} must be a valid URL`;
    }
    return `${envVarName} has invalid format`;
  }

  private formatTooSmallError(message: string, envVarName: string): string {
    if (message.includes('expected string to have >=16 characters')) {
      return `${envVarName} must be at least 32 characters`;
    }
    if (message.includes('expected string to have >=1 characters')) {
      return `${envVarName} is required`;
    }
    return `${envVarName} is too small`;
  }

  private formatInvalidValueError(fieldPath: string, envVarName: string): string {
    if (fieldPath === 'environment') {
      return `${envVarName} must be one of: development, staging, production, test`;
    }
    if (fieldPath === 'logging.level') {
      return `${envVarName} must be one of: error, warn, info, debug, trace`;
    }
    return `${envVarName} has invalid value`;
  }

  private formatInvalidTypeError(message: string, envVarName: string): string {
    if (message.includes('Required')) {
      return `${envVarName} is required`;
    }
    return `${envVarName} has invalid type`;
  }

  private validateEnvironmentVariables(): string[] {
    const errors: string[] = [];

    for (const envVar of ENV_VARIABLES) {
      if (envVar.required) {
        const value = getEnvVar(envVar.name);
        if (!value) {
          errors.push(`${envVar.name} is required`);
        }
      }
    }

    return errors;
  }

  public validateEnvironment(): readonly string[] {
    return this.validateEnvironmentVariables();
  }

  private buildCoreEnvironmentConfig(): { environment: string; logging: unknown } {
    const environment = getEnvVar('ENVIRONMENT') ?? getEnvVar('NODE_ENV') ?? 'development';
    const logLevel = getEnvVar('LOG_LEVEL') ?? 'info';

    return {
      environment,
      logging: {
        level: logLevel,
        enableConsole: true,
        enableStructured: environment === 'production',
        redactSensitive: environment === 'production',
      },
    };
  }

  private buildDriveHrConfig(
    companyId: string,
    requestTimeout: number,
    maxRetries: number
  ): unknown {
    const driveHrUrl = companyId ? `https://drivehris.app/careers/${companyId}/list` : '';
    const apiBaseUrl = companyId ? `https://drivehris.app/careers/${companyId}` : '';

    return {
      careersUrl: driveHrUrl,
      companyId,
      apiBaseUrl,
      timeout: requestTimeout,
      retries: maxRetries,
    };
  }

  private buildWordPressConfig(
    wpApiUrl: string,
    webhookSecret: string,
    requestTimeout: number,
    maxRetries: number
  ): { wordPress: unknown; webhook: unknown } {
    return {
      wordPress: {
        baseUrl: wpApiUrl,
        timeout: requestTimeout,
        retries: maxRetries,
      },
      webhook: {
        secret: webhookSecret,
        algorithm: 'sha256' as const,
        headerName: 'x-webhook-signature',
      },
    };
  }

  private buildSecurityConfig(
    corsOrigins: string[],
    environment: string,
    rateLimitMaxRequests: number
  ): unknown {
    return {
      enableCors: corsOrigins.length > 0,
      corsOrigins,
      enableRateLimit: environment === 'production',
      rateLimitMaxRequests: rateLimitMaxRequests,
      rateLimitWindowMs: 60000, // 1 minute
      enableInputValidation: true,
      enableRequestValidation: true,
      enableOutputSanitization: true,
    };
  }

  private buildPerformanceConfig(
    requestTimeout: number,
    maxRetries: number,
    batchSize: number,
    environment: string
  ): unknown {
    return {
      httpTimeout: requestTimeout,
      maxRetries,
      retryDelay: 1000, // 1 second
      batchSize,
      cacheEnabled: environment === 'production',
      cacheTtl: 300, // 5 minutes
      maxConcurrentRequests: 10,
    };
  }

  private buildRawConfig(): unknown {
    // Get core configuration
    const coreConfig = this.buildCoreEnvironmentConfig();

    // Get base environment values
    const companyId = getEnvVar('DRIVEHR_COMPANY_ID') ?? '';
    const wpApiUrl = getEnvVar('WP_API_URL') ?? '';
    const webhookSecret = getEnvVar('WEBHOOK_SECRET') ?? '';

    // Parse optional configuration
    const httpTimeout = this.parseNumber('HTTP_TIMEOUT', 30000);
    const requestTimeout = this.parseNumber('REQUEST_TIMEOUT_MS', httpTimeout);
    const maxRetries = this.parseNumber('MAX_RETRIES', 3);
    const batchSize = this.parseNumber('BATCH_SIZE', 10);
    const corsOrigins = this.parseCorsOrigins();
    const rateLimitMax = this.parseNumber('RATE_LIMIT_MAX', 60);
    const rateLimitMaxRequests = this.parseNumber('RATE_LIMIT_MAX_REQUESTS', rateLimitMax);

    // Build configuration sections
    const driveHrConfig = this.buildDriveHrConfig(companyId, requestTimeout, maxRetries);
    const { wordPress, webhook } = this.buildWordPressConfig(
      wpApiUrl,
      webhookSecret,
      requestTimeout,
      maxRetries
    );
    const securityConfig = this.buildSecurityConfig(
      corsOrigins,
      coreConfig.environment,
      rateLimitMaxRequests
    );
    const performanceConfig = this.buildPerformanceConfig(
      requestTimeout,
      maxRetries,
      batchSize,
      coreConfig.environment
    );

    return {
      ...coreConfig,
      driveHr: driveHrConfig,
      wordPress,
      webhook,
      security: securityConfig,
      performance: performanceConfig,
    };
  }

  private parseNumber(envVar: string, defaultValue: number): number {
    const value = getEnvVar(envVar, String(defaultValue));
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseCorsOrigins(): string[] {
    const origins = getEnvVar('CORS_ORIGINS', '');
    return origins
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
  }
}

/**
 * Get application configuration (convenience function)
 *
 * Convenience wrapper around ConfigService singleton for accessing
 * the application configuration. This function provides a simpler
 * API for components that just need to read configuration values
 * without managing the service instance directly.
 *
 * @returns The validated application configuration
 * @throws {Error} When configuration has not been loaded or is invalid
 * @example
 * ```typescript
 * import { getAppConfig } from './config.js';
 *
 * const config = getAppConfig();
 * console.log(`Environment: ${config.environment}`);
 * console.log(`WordPress URL: ${config.wordPress.baseUrl}`);
 * ```
 * @since 1.0.0
 * @see {@link ConfigService.getConfig} for the underlying implementation
 * @see {@link loadAppConfig} for loading configuration first
 */
export function getAppConfig(): AppConfig {
  return ConfigService.getInstance().getConfig();
}

/**
 * Load and validate application configuration (convenience function)
 *
 * Convenience wrapper around ConfigService singleton for loading
 * and validating the application configuration. This function provides
 * a simpler API for application startup code that needs to initialize
 * configuration without managing the service instance directly.
 *
 * @returns Configuration validation result containing either valid config or errors
 * @example
 * ```typescript
 * import { loadAppConfig, getAppConfig } from './config.js';
 *
 * // Application startup - load and validate configuration
 * const result = loadAppConfig();
 * if (!result.isValid) {
 *   console.error('Configuration errors:', result.errors);
 *   process.exit(1);
 * }
 *
 * // Now safe to use configuration anywhere
 * const config = getAppConfig();
 * ```
 * @since 1.0.0
 * @see {@link ConfigService.loadConfig} for the underlying implementation
 * @see {@link getAppConfig} for accessing loaded configuration
 */
export function loadAppConfig(): ConfigValidationResult {
  return ConfigService.getInstance().loadConfig();
}
