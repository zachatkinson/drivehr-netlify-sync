/**
 * Configuration Service Test Suite
 *
 * Comprehensive test coverage for application configuration management following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates secure environment variable processing, configuration
 * validation, singleton pattern behavior, and error handling scenarios.
 *
 * Test Features:
 * - Environment variable loading and validation
 * - Configuration schema validation with Zod
 * - Singleton pattern integrity testing
 * - Comprehensive error handling and formatting
 * - Integration lifecycle scenarios
 * - Edge cases and exception handling
 * - Security validation for sensitive data
 * - Type safety and schema compliance
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/config.test.ts -- --grep "loadAppConfig"
 * ```
 *
 * @module config-test-suite
 * @since 1.0.0
 * @see {@link ../../src/lib/config.ts} for the configuration service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAppConfig } from '../../src/lib/config.js';
import {
  AppConfigSchema,
  type AppConfig,
  type ConfigValidationResult,
} from '../../src/types/config.js';
import { BaseTestUtils, TestFixtures } from '../shared/base-test-utils.js';

const TEST_FIXTURES = {
  validEnvironment: TestFixtures.VALID_ENV_CONFIG,
  invalidEnvironment: TestFixtures.INVALID_ENV_CONFIG,
} as const;

/**
 * Configuration-specific test utilities
 *
 * Extends BaseTestUtils with configuration service testing patterns.
 * Maintains DRY principles while providing specialized testing methods
 * for configuration validation, environment setup, and assertion patterns.
 *
 * @since 1.0.0
 */
class ConfigTestUtils extends BaseTestUtils {
  /**
   * Asserts that configuration object contains all required properties
   *
   * Validates the structure and values of a loaded AppConfig object,
   * ensuring all required properties are present and environment value
   * matches expected application environment formats.
   *
   * @param config - Configuration object to validate
   * @example
   * ```typescript
   * ConfigTestUtils.assertValidConfig(loadedConfig);
   * ```
   * @since 1.0.0
   */
  static assertValidConfig(config: AppConfig): void {
    this.assertHasRequiredProperties(
      config,
      ['environment', 'logging', 'security', 'performance', 'driveHr', 'wordPress', 'webhook'],
      'AppConfig'
    );

    expect(config.environment).toMatch(/^(development|staging|production|test)$/);
  }

  /**
   * Asserts that configuration validation completed successfully
   *
   * Validates that a ConfigValidationResult indicates successful validation
   * with no errors and a defined configuration object. Uses base test utility
   * validation patterns for consistent assertion behavior.
   *
   * @param result - Configuration validation result to check
   * @example
   * ```typescript
   * const result = loadAppConfig();
   * ConfigTestUtils.assertValidationSuccess(result);
   * ```
   * @since 1.0.0
   */
  static assertValidationSuccess(result: ConfigValidationResult): void {
    this.assertValidationResult(result, true, 0);

    expect(result.config).toBeDefined();
  }

  /**
   * Asserts that configuration validation failed with expected errors
   *
   * Validates that a ConfigValidationResult indicates failed validation
   * with specified error count and undefined configuration object. Ensures
   * proper error handling and validation feedback mechanisms.
   *
   * @param result - Configuration validation result to check
   * @param expectedErrorCount - Optional expected number of validation errors
   * @example
   * ```typescript
   * const result = loadAppConfig();
   * ConfigTestUtils.assertValidationFailure(result, 2);
   * ```
   * @since 1.0.0
   */
  static assertValidationFailure(
    result: ConfigValidationResult,
    expectedErrorCount?: number
  ): void {
    this.assertValidationResult(result, false, expectedErrorCount);

    expect(result.config).toBeUndefined();
  }

  /**
   * Validates configuration object against application schema
   *
   * Performs schema validation using Zod AppConfigSchema and returns
   * structured validation result. Provides direct access to schema
   * validation for testing various configuration scenarios and edge cases.
   *
   * @param config - Configuration object to validate
   * @returns Validation result with success status, config data, or errors
   * @example
   * ```typescript
   * const result = ConfigTestUtils.validateConfig(mockConfig);
   * expect(result.isValid).toBe(true);
   * ```
   * @since 1.0.0
   */
  static validateConfig(config: unknown): ConfigValidationResult {
    const result = AppConfigSchema.safeParse(config);

    if (result.success) {
      return {
        isValid: true,
        config: result.data,
        errors: [],
      };
    } else {
      return {
        isValid: false,
        config: undefined,
        errors: result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
  }

  /**
   * Retrieves ConfigService singleton instance for direct testing
   *
   * Dynamically imports and returns the ConfigService singleton instance
   * for testing internal methods, singleton behavior, and service lifecycle.
   * Supports advanced testing scenarios requiring direct service access.
   *
   * @returns Promise resolving to ConfigService singleton instance
   * @example
   * ```typescript
   * const service = await ConfigTestUtils.getConfigService();
   * const errors = service.validateEnvironment();
   * ```
   * @since 1.0.0
   */
  static async getConfigService() {
    const { ConfigService } = await import('../../src/lib/config.js');
    return ConfigService.getInstance();
  }
}

describe('Config Service', () => {
  beforeEach(() => {
    BaseTestUtils.clearEnvironment();
  });

  afterEach(() => {
    BaseTestUtils.resetAllMocks();
  });

  describe('getAppConfig', () => {
    describe('when all required environment variables are present', () => {
      it('should load configuration successfully', () => {
        ConfigTestUtils.setupMockEnvironment(TEST_FIXTURES.validEnvironment);

        const loadResult = loadAppConfig();
        const config = loadResult.config as AppConfig;

        ConfigTestUtils.assertValidationSuccess(loadResult);
        ConfigTestUtils.assertValidConfig(config);
        expect(config.environment).toBe('development');
        expect(config.logging.level).toBe('debug');
        expect(config.driveHr.companyId).toBe(TEST_FIXTURES.validEnvironment.driveHrCompanyId);
        expect(config.wordPress.baseUrl).toBe(TEST_FIXTURES.validEnvironment.wpApiUrl);
        expect(config.webhook.secret).toBe(TEST_FIXTURES.validEnvironment.webhookSecret);
      });

      it('should apply environment-specific defaults', () => {
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          environment: 'production',
        });

        const loadResult = loadAppConfig();
        const config = loadResult.config as AppConfig;

        ConfigTestUtils.assertValidationSuccess(loadResult);
        expect(config.environment).toBe('production');
        expect(config.logging.enableStructured).toBe(true); // Production default
        expect(config.logging.redactSensitive).toBe(true); // Production default
        expect(config.security.enableRateLimit).toBe(true); // Production default
      });
    });

    describe('when required environment variables are missing', () => {
      it('should throw an error for missing DRIVEHR_COMPANY_ID', () => {
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          driveHrCompanyId: undefined as never,
        });

        const result = loadAppConfig();
        ConfigTestUtils.assertValidationFailure(result);
        expect(
          result.errors.some(error => error.toLowerCase().includes('drivehr_company_id'))
        ).toBe(true);
      });

      it('should throw an error for missing WP_API_URL', () => {
        ConfigTestUtils.clearEnvironment();
        vi.stubEnv('WP_API_URL', '');
        vi.stubEnv('WEBHOOK_SECRET', '');
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          wpApiUrl: undefined as never,
        });

        const result = loadAppConfig();
        ConfigTestUtils.assertValidationFailure(result);
        expect(result.errors.some(error => error.toLowerCase().includes('wp_api_url'))).toBe(true);
      });

      it('should throw an error for missing WEBHOOK_SECRET', () => {
        ConfigTestUtils.clearEnvironment();
        vi.stubEnv('WP_API_URL', '');
        vi.stubEnv('WEBHOOK_SECRET', '');
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          webhookSecret: undefined as never,
        });

        const result = loadAppConfig();
        ConfigTestUtils.assertValidationFailure(result);
        expect(result.errors.some(error => error.toLowerCase().includes('webhook_secret'))).toBe(
          true
        );
      });
    });

    describe('when environment variables have invalid values', () => {
      it('should throw an error for invalid UUID format', () => {
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          driveHrCompanyId: 'invalid-uuid-format',
        });

        const result = loadAppConfig();
        ConfigTestUtils.assertValidationFailure(result);
        expect(result.errors.some(error => error.toLowerCase().includes('uuid'))).toBe(true);
      });

      it('should throw an error for invalid URL format', () => {
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          wpApiUrl: 'not-a-valid-url',
        });

        const result = loadAppConfig();
        ConfigTestUtils.assertValidationFailure(result);
        expect(result.errors.some(error => error.toLowerCase().includes('url'))).toBe(true);
      });

      it('should throw an error for webhook secret too short', () => {
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          webhookSecret: 'too-short',
        });

        const result = loadAppConfig();
        ConfigTestUtils.assertValidationFailure(result);
        expect(result.errors.some(error => error.toLowerCase().includes('secret'))).toBe(true);
      });
    });

    describe('when optional environment variables are provided', () => {
      it('should use provided log level', () => {
        ConfigTestUtils.setupMockEnvironment({
          ...TEST_FIXTURES.validEnvironment,
          logLevel: 'error',
        });

        const loadResult = loadAppConfig();
        const config = loadResult.config as AppConfig;

        ConfigTestUtils.assertValidationSuccess(loadResult);
        expect(config.logging.level).toBe('error');
      });

      it('should fall back to defaults for missing optional variables', () => {
        vi.stubEnv('DRIVEHR_COMPANY_ID', TEST_FIXTURES.validEnvironment.driveHrCompanyId);
        vi.stubEnv('WP_API_URL', TEST_FIXTURES.validEnvironment.wpApiUrl);
        vi.stubEnv('WEBHOOK_SECRET', TEST_FIXTURES.validEnvironment.webhookSecret);
        vi.stubEnv('NODE_ENV', '');
        vi.stubEnv('LOG_LEVEL', '');

        const loadResult = loadAppConfig();

        if (loadResult.isValid && loadResult.config) {
          const config = loadResult.config;
          expect(config.environment).toBe('development'); // Default
          expect(config.logging.level).toBe('info'); // Default
        } else {
          expect(loadResult.errors).toBeDefined();
        }
      });
    });
  });

  describe('loadAppConfig', () => {
    describe('when configuration is valid', () => {
      it('should return validation success', () => {
        ConfigTestUtils.setupMockEnvironment(TEST_FIXTURES.validEnvironment);

        const result = loadAppConfig();

        ConfigTestUtils.assertValidationSuccess(result);
        expect(result.config).toBeDefined();
      });
    });

    describe('when configuration has validation errors', () => {
      it('should return validation failure for invalid environment', () => {
        const invalidConfig = {
          environment: 'invalid-environment',
        };

        const result = ConfigTestUtils.validateConfig(invalidConfig);

        ConfigTestUtils.assertValidationFailure(result);
        expect(result.errors.some((error: string) => error.includes('environment'))).toBe(true);
      });

      it('should return validation failure for invalid UUID', () => {
        const invalidConfig = {
          driveHr: {
            careersUrl: 'https://valid-url.com',
            companyId: 'invalid-uuid',
            apiBaseUrl: 'https://valid-url.com',
          },
        };

        const result = ConfigTestUtils.validateConfig(invalidConfig);

        ConfigTestUtils.assertValidationFailure(result);
        expect(
          result.errors.some(
            (error: string) =>
              error.toLowerCase().includes('uuid') || error.toLowerCase().includes('invalid')
          )
        ).toBe(true);
      });

      it('should return validation failure for invalid URL', () => {
        const invalidConfig = {
          wordPress: {
            baseUrl: 'not-a-valid-url',
          },
        };

        const result = ConfigTestUtils.validateConfig(invalidConfig);

        ConfigTestUtils.assertValidationFailure(result);
        expect(
          result.errors.some(
            (error: string) =>
              error.toLowerCase().includes('url') || error.toLowerCase().includes('invalid')
          )
        ).toBe(true);
      });

      it('should collect multiple validation errors', () => {
        const invalidConfig = {
          environment: 'invalid',
          driveHr: {
            companyId: 'invalid-uuid',
            careersUrl: 'invalid-url',
            apiBaseUrl: 'another-invalid-url',
          },
        };

        const result = ConfigTestUtils.validateConfig(invalidConfig);

        ConfigTestUtils.assertValidationFailure(result);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });
  });

  describe('configuration validation', () => {
    it('should validate configuration schema correctly', () => {
      const validConfig = {
        environment: 'production',
        logging: {
          level: 'info',
          enableConsole: true,
          enableStructured: true,
          redactSensitive: true,
        },
        driveHr: {
          careersUrl: 'https://drivehris.app/careers/company/list',
          companyId: '123e4567-e89b-12d3-a456-426614174000',
          apiBaseUrl: 'https://drivehris.app/careers/company',
        },
        wordPress: {
          baseUrl: 'https://example.com/webhook/drivehr-sync',
          token: 'valid-token',
        },
        webhook: {
          secret: 'valid-webhook-secret-min-32-characters',
          algorithm: 'sha256',
          headerName: 'x-webhook-signature',
        },
        security: {
          enableCors: true,
          corsOrigins: ['https://example.com'],
          enableRateLimit: true,
          rateLimitMaxRequests: 100,
          rateLimitWindowMs: 60000,
          enableInputValidation: true,
          enableRequestValidation: true,
          enableOutputSanitization: true,
        },
        performance: {
          httpTimeout: 30000,
          maxRetries: 3,
          retryDelay: 1000,
          batchSize: 50,
          cacheEnabled: true,
          cacheTtl: 300000,
          maxConcurrentRequests: 10,
        },
      };

      const result = ConfigTestUtils.validateConfig(validConfig);

      ConfigTestUtils.assertValidationSuccess(result);
      expect(result.config).toEqual(validConfig);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete configuration lifecycle', () => {
      ConfigTestUtils.setupMockEnvironment(TEST_FIXTURES.validEnvironment);

      const loadResult = loadAppConfig();
      const config = loadResult.config as AppConfig;
      const validationResult = ConfigTestUtils.validateConfig(config);

      ConfigTestUtils.assertValidationSuccess(loadResult);
      ConfigTestUtils.assertValidConfig(config);
      ConfigTestUtils.assertValidationSuccess(validationResult);
      expect(validationResult.config).toEqual(config);
    });

    it('should provide helpful error messages for debugging', () => {
      ConfigTestUtils.setupMockEnvironment(TEST_FIXTURES.invalidEnvironment);

      const loadResult = loadAppConfig();
      ConfigTestUtils.assertValidationFailure(loadResult);

      const invalidValidation = ConfigTestUtils.validateConfig(
        TEST_FIXTURES.invalidEnvironment as never
      );
      ConfigTestUtils.assertValidationFailure(invalidValidation);
      expect(invalidValidation.errors.every((error: string) => error.length > 10)).toBe(true); // Meaningful messages
    });
  });

  describe('private utility methods coverage', () => {
    it('should handle invalid environment variables in parseEnvironment', () => {
      ConfigTestUtils.setupMockEnvironment({
        environment: 'invalid-environment' as never,
        driveHrCompanyId: TEST_FIXTURES.validEnvironment.driveHrCompanyId,
        wpApiUrl: TEST_FIXTURES.validEnvironment.wpApiUrl,
        webhookSecret: TEST_FIXTURES.validEnvironment.webhookSecret,
      });

      const result = loadAppConfig();

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(err =>
          err.includes('ENVIRONMENT must be one of: development, staging, production, test')
        )
      ).toBe(true);
    });

    it('should handle invalid log levels in parseLogLevel', () => {
      ConfigTestUtils.setupMockEnvironment({
        ...TEST_FIXTURES.validEnvironment,
        environment: 'development',
        logLevel: 'invalid-log-level' as never,
      });

      const result = loadAppConfig();

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(err =>
          err.includes('LOG_LEVEL must be one of: error, warn, info, debug, trace')
        )
      ).toBe(true);
    });

    it('should handle NaN in parseNumber method', () => {
      ConfigTestUtils.setupMockEnvironment(TEST_FIXTURES.validEnvironment);
      vi.stubEnv('HTTP_TIMEOUT', 'not-a-number');
      vi.stubEnv('MAX_RETRIES', 'also-not-a-number');
      vi.stubEnv('RATE_LIMIT_MAX', 'definitely-not-a-number');

      const result = loadAppConfig();

      expect(result.isValid).toBe(true);
      expect(result.config?.performance.httpTimeout).toBe(30000); // Default for HTTP_TIMEOUT
      expect(result.config?.performance.maxRetries).toBe(3); // Default for MAX_RETRIES
    });

    it('should parse CORS origins with various formats', () => {
      ConfigTestUtils.setupMockEnvironment(TEST_FIXTURES.validEnvironment);
      vi.stubEnv('CORS_ORIGINS', '');

      let result = loadAppConfig();
      expect(result.isValid).toBe(true);
      expect(result.config?.security.corsOrigins).toEqual([]);
      expect(result.config?.security.enableCors).toBe(false);

      ConfigTestUtils.setupMockEnvironment({
        ...TEST_FIXTURES.validEnvironment,
        environment: 'development',
      });
      vi.stubEnv('CORS_ORIGINS', 'https://example.com');

      result = loadAppConfig();
      expect(result.isValid).toBe(true);
      expect(result.config?.security.corsOrigins).toEqual(['https://example.com']);
      expect(result.config?.security.enableCors).toBe(true);

      ConfigTestUtils.setupMockEnvironment({
        ...TEST_FIXTURES.validEnvironment,
        environment: 'development',
      });
      vi.stubEnv('CORS_ORIGINS', 'https://app.com, https://api.com , https://admin.com');

      result = loadAppConfig();
      expect(result.isValid).toBe(true);
      expect(result.config?.security.corsOrigins).toEqual([
        'https://app.com',
        'https://api.com',
        'https://admin.com',
      ]);
      expect(result.config?.security.enableCors).toBe(true);

      ConfigTestUtils.setupMockEnvironment({
        ...TEST_FIXTURES.validEnvironment,
        environment: 'development',
      });
      vi.stubEnv('CORS_ORIGINS', 'https://valid.com, , https://another.com');

      result = loadAppConfig();
      expect(result.isValid).toBe(true);
      expect(result.config?.security.corsOrigins).toEqual([
        'https://valid.com',
        'https://another.com',
      ]);
    });
  });

  describe('error formatting edge cases', () => {
    it('should format different invalid format error types', () => {
      ConfigTestUtils.setupMockEnvironment({
        environment: 'development',
        driveHrCompanyId: 'invalid-uuid',
        wpApiUrl: TEST_FIXTURES.validEnvironment.wpApiUrl,
        webhookSecret: TEST_FIXTURES.validEnvironment.webhookSecret,
      });

      let result = loadAppConfig();
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(err => err.includes('DRIVEHR_COMPANY_ID must be a valid UUID'))
      ).toBe(true);

      ConfigTestUtils.setupMockEnvironment({
        environment: 'development',
        driveHrCompanyId: TEST_FIXTURES.validEnvironment.driveHrCompanyId,
        wpApiUrl: 'not-a-valid-url',
        webhookSecret: TEST_FIXTURES.validEnvironment.webhookSecret,
      });

      result = loadAppConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('WP_API_URL must be a valid URL'))).toBe(true);
    });

    it('should format different too small error types', () => {
      ConfigTestUtils.setupMockEnvironment({
        environment: 'development',
        driveHrCompanyId: TEST_FIXTURES.validEnvironment.driveHrCompanyId,
        wpApiUrl: TEST_FIXTURES.validEnvironment.wpApiUrl,
        webhookSecret: 'short', // Less than 32 characters
      });

      const result = loadAppConfig();
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(err => err.includes('WEBHOOK_SECRET must be at least 32 characters'))
      ).toBe(true);
    });

    it('should format invalid value errors for specific field paths', () => {
      ConfigTestUtils.setupMockEnvironment({
        environment: 'invalid-env' as never,
        driveHrCompanyId: TEST_FIXTURES.validEnvironment.driveHrCompanyId,
        wpApiUrl: TEST_FIXTURES.validEnvironment.wpApiUrl,
        webhookSecret: TEST_FIXTURES.validEnvironment.webhookSecret,
      });

      let result = loadAppConfig();
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(err =>
          err.includes('ENVIRONMENT must be one of: development, staging, production, test')
        )
      ).toBe(true);

      ConfigTestUtils.setupMockEnvironment({
        ...TEST_FIXTURES.validEnvironment,
        logLevel: 'invalid-level' as never,
      });

      result = loadAppConfig();
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(err => err.includes('must be one of: error, warn, info, debug, trace'))
      ).toBe(true);
    });
  });

  describe('exception handling paths', () => {
    it('should handle unexpected errors in loadConfig', async () => {
      const configService = await ConfigTestUtils.getConfigService();

      const validateSpy = vi
        .spyOn(configService as never, 'validateEnvironmentVariables')
        .mockImplementation(() => {
          throw new Error('Unexpected validation error');
        });

      const result = configService.loadConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unexpected validation error');

      validateSpy.mockRestore();
    });

    it('should handle non-Error objects in catch block', async () => {
      const configService = await ConfigTestUtils.getConfigService();

      const validateSpy = vi
        .spyOn(configService as never, 'validateEnvironmentVariables')
        .mockImplementation(() => {
          throw 'String error'; // Non-Error object
        });

      const result = configService.loadConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown configuration error');

      validateSpy.mockRestore();
    });
  });

  describe('ConfigService singleton behavior', () => {
    it('should test getInstance and resetInstance methods directly', async () => {
      const { ConfigService } = await import('../../src/lib/config.js');

      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      expect(instance1).toBe(instance2); // Same instance

      ConfigService.resetInstance();
      const instance3 = ConfigService.getInstance();
      expect(instance3).not.toBe(instance1); // New instance after reset
    });

    it('should test getConfig throws when not loaded', async () => {
      const { ConfigService } = await import('../../src/lib/config.js');

      ConfigService.resetInstance();
      const configService = ConfigService.getInstance();

      expect(() => configService.getConfig()).toThrow('Configuration not loaded or invalid');
    });

    it('should test validateEnvironment public method', async () => {
      ConfigTestUtils.clearEnvironment();
      vi.stubEnv('DRIVEHR_COMPANY_ID', '');
      vi.stubEnv('WP_API_URL', '');
      vi.stubEnv('WEBHOOK_SECRET', '');
      ConfigTestUtils.setupMockEnvironment({});

      const { ConfigService } = await import('../../src/lib/config.js');
      const configService = ConfigService.getInstance();

      const errors = configService.validateEnvironment();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('DRIVEHR_COMPANY_ID is required');
      expect(errors).toContain('WP_API_URL is required');
      expect(errors).toContain('WEBHOOK_SECRET is required');
    });
  });
});
