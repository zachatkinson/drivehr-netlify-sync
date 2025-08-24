/**
 * Environment Utilities Test Suite
 *
 * Comprehensive test coverage for environment variable utilities following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates environment variable retrieval, validation, error
 * handling, and configuration building across all supported scenarios.
 *
 * Test Features:
 * - Environment variable access with different modes (required, optional, default)
 * - Type safety and validation for environment configuration
 * - Error handling for missing required variables
 * - Overloaded function signature testing (3 getEnvVar signatures)
 * - Environment configuration building and validation
 * - DRY test utilities for consistent testing patterns
 *
 * Test organization mirrors the source structure and follows AAA pattern
 * (Arrange, Act, Assert) with proper setup/teardown for isolated tests.
 * Each test is atomic and can run independently without affecting others.
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/env.test.ts -- --grep "getEnvVar"
 *
 * // Example of running with coverage
 * pnpm test test/lib/env.test.ts --coverage
 * ```
 *
 * @module env-test-suite
 * @since 1.0.0
 * @see {@link ../../src/lib/env.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getEnvVar, getEnvironmentConfig } from '../../src/lib/env.js';
import type { EnvironmentConfig } from '../../src/types/common.js';
import { BaseTestUtils, TestFixtures } from '../shared/base-test-utils.js';

/**
 * Environment-specific test utilities
 *
 * Extends BaseTestUtils with environment-specific testing patterns.
 * Maintains DRY principles while providing specialized environment testing methods
 * for variable retrieval, configuration validation, and error testing scenarios.
 *
 * @since 1.0.0
 */
class EnvTestUtils extends BaseTestUtils {
  /**
   * Assert environment variable retrieval behavior
   *
   * Validates that environment variable retrieval functions correctly
   * with different parameter combinations and returns expected values.
   * Includes type checking and length validation for comprehensive testing.
   *
   * @param key - Environment variable key to test
   * @param value - Expected value to be returned (or undefined)
   * @param _testDescription - Description for error messages (unused but maintained for consistency)
   * @example
   * ```typescript
   * EnvTestUtils.assertEnvVarRetrieval('TEST_VAR', 'expected-value', 'TEST_VAR retrieval');
   * ```
   * @since 1.0.0
   */
  static assertEnvVarRetrieval(
    key: string,
    value: string | undefined,
    _testDescription: string
  ): void {
    const result = getEnvVar(key);
    expect(result).toBe(value);

    if (value !== undefined) {
      expect(result).toBeTypeOf('string');
      expect(result).toHaveLength(value.length);
    } else {
      expect(result).toBeUndefined();
    }
  }

  /**
   * Assert required environment variable throws when missing
   *
   * Validates that attempting to access a required environment variable
   * that is not set throws an appropriate error with clear messaging.
   * Essential for testing error handling scenarios.
   *
   * @param key - Environment variable key to test
   * @param expectedErrorPattern - Expected error message pattern (string or regex)
   * @example
   * ```typescript
   * EnvTestUtils.assertRequiredEnvVarThrows('MISSING_VAR', /Required.*MISSING_VAR.*not set/);
   * ```
   * @since 1.0.0
   */
  static assertRequiredEnvVarThrows(key: string, expectedErrorPattern: string | RegExp): void {
    expect(() => getEnvVar(key, true)).toThrow(expectedErrorPattern);
  }

  /**
   * Assert environment configuration structure and validity
   *
   * Validates that the environment configuration object contains all required
   * properties and follows the expected EnvironmentConfig interface structure.
   * Performs type checking and value validation for comprehensive configuration testing.
   *
   * @param config - Environment configuration object to validate
   * @param expectedValues - Expected values for validation (partial match)
   * @example
   * ```typescript
   * const config = getEnvironmentConfig();
   * EnvTestUtils.assertEnvironmentConfig(config, TestFixtures.VALID_ENV_CONFIG);
   * ```
   * @since 1.0.0
   */
  static assertEnvironmentConfig(
    config: EnvironmentConfig,
    expectedValues: Partial<EnvironmentConfig>
  ): void {
    // Use base utility for common property validation
    this.assertHasRequiredProperties(
      config,
      ['driveHrCompanyId', 'wpApiUrl', 'webhookSecret', 'environment', 'logLevel'],
      'EnvironmentConfig'
    );

    // Validate specific values if provided
    if (expectedValues.driveHrCompanyId) {
      expect(config.driveHrCompanyId).toBe(expectedValues.driveHrCompanyId);
    }
    if (expectedValues.wpApiUrl) {
      expect(config.wpApiUrl).toBe(expectedValues.wpApiUrl);
    }
    if (expectedValues.webhookSecret) {
      expect(config.webhookSecret).toBe(expectedValues.webhookSecret);
    }
    if (expectedValues.environment) {
      expect(config.environment).toBe(expectedValues.environment);
    }
    if (expectedValues.logLevel) {
      expect(config.logLevel).toBe(expectedValues.logLevel);
    }
  }

  /**
   * Create test environment with missing required variables
   *
   * Sets up test environment where specific required variables are missing
   * to test error handling scenarios. Starts with a valid base environment
   * and selectively removes specified variables for targeted testing.
   *
   * @param missingVars - Array of environment variable names to leave unset
   * @example
   * ```typescript
   * EnvTestUtils.createEnvironmentWithMissingVars(['DRIVEHR_COMPANY_ID', 'WP_API_URL']);
   * ```
   * @since 1.0.0
   */
  static createEnvironmentWithMissingVars(missingVars: string[]): void {
    // Set up a minimal valid environment first
    this.setupMockEnvironment(TestFixtures.VALID_ENV_CONFIG);

    // Then remove the specified variables
    missingVars.forEach(varName => {
      vi.stubEnv(varName, '');
    });
  }
}

describe('Environment Utilities', () => {
  // Clean setup and teardown for isolated tests using DRY utilities
  beforeEach(() => {
    BaseTestUtils.clearEnvironment();
  });

  afterEach(() => {
    BaseTestUtils.resetAllMocks();
  });

  describe('getEnvVar function', () => {
    describe('with default value (overload 1)', () => {
      it('should return environment variable when set', () => {
        // Arrange
        const testKey = 'TEST_ENV_VAR';
        const testValue = 'test-value-123';
        const defaultValue = 'default-value';
        vi.stubEnv(testKey, testValue);

        // Act
        const result = getEnvVar(testKey, defaultValue);

        // Assert
        expect(result).toBe(testValue);
        expect(result).not.toBe(defaultValue);
      });

      it('should return default value when environment variable is not set', () => {
        // Arrange
        const testKey = 'NONEXISTENT_VAR';
        const defaultValue = 'fallback-value';

        // Act
        const result = getEnvVar(testKey, defaultValue);

        // Assert
        expect(result).toBe(defaultValue);
      });

      it('should return empty string when environment variable is empty', () => {
        // Arrange - getEnvVar returns empty strings as-is, doesn't use defaults for them
        const testKey = 'EMPTY_VAR';
        const defaultValue = 'fallback-for-empty';
        vi.stubEnv(testKey, '');

        // Act
        const result = getEnvVar(testKey, defaultValue);

        // Assert
        expect(result).toBe(''); // Empty string is returned, not the default
      });

      it('should handle complex default values', () => {
        // Arrange
        const testKey = 'COMPLEX_VAR';
        const complexDefault = 'https://api.example.com/v1/endpoint?param=value&token=abc123';

        // Act
        const result = getEnvVar(testKey, complexDefault);

        // Assert
        expect(result).toBe(complexDefault);
      });
    });

    describe('with required flag (overload 2)', () => {
      it('should return environment variable when set and required', () => {
        // Arrange
        const testKey = 'REQUIRED_VAR';
        const testValue = 'required-value-456';
        vi.stubEnv(testKey, testValue);

        // Act
        const result = getEnvVar(testKey, true);

        // Assert
        expect(result).toBe(testValue);
      });

      it('should throw error when required variable is not set', () => {
        // Arrange
        const testKey = 'MISSING_REQUIRED_VAR';

        // Act & Assert
        EnvTestUtils.assertRequiredEnvVarThrows(
          testKey,
          `Required environment variable ${testKey} is not set`
        );
      });

      it('should throw error when required variable is empty', () => {
        // Arrange
        const testKey = 'EMPTY_REQUIRED_VAR';
        vi.stubEnv(testKey, '');

        // Act & Assert
        EnvTestUtils.assertRequiredEnvVarThrows(
          testKey,
          `Required environment variable ${testKey} is not set`
        );
      });

      it('should provide clear error messages for missing required variables', () => {
        // Arrange
        const testKeys = ['API_KEY', 'DATABASE_URL', 'SECRET_TOKEN'];

        testKeys.forEach(key => {
          // Act & Assert
          expect(() => getEnvVar(key, true)).toThrow(
            new RegExp(`Required environment variable ${key} is not set`)
          );
        });
      });
    });

    describe('with optional flag (overload 3)', () => {
      it('should return environment variable when set and optional', () => {
        // Arrange
        const testKey = 'OPTIONAL_VAR';
        const testValue = 'optional-value-789';
        vi.stubEnv(testKey, testValue);

        // Act
        const result = getEnvVar(testKey, false);

        // Assert
        expect(result).toBe(testValue);
      });

      it('should return undefined when optional variable is not set', () => {
        // Arrange
        const testKey = 'MISSING_OPTIONAL_VAR';

        // Act
        const result = getEnvVar(testKey, false);

        // Assert
        expect(result).toBeUndefined();
      });

      it('should return undefined when optional variable is not set (default behavior)', () => {
        // Arrange
        const testKey = 'MISSING_DEFAULT_OPTIONAL';

        // Act
        const result = getEnvVar(testKey);

        // Assert
        expect(result).toBeUndefined();
      });

      it('should return empty string when optional variable is explicitly empty', () => {
        // Arrange
        const testKey = 'EMPTY_OPTIONAL_VAR';
        vi.stubEnv(testKey, '');

        // Act
        const result = getEnvVar(testKey, false);

        // Assert
        expect(result).toBe('');
        expect(result).not.toBeUndefined();
      });
    });

    describe('edge cases and type safety', () => {
      it('should handle special characters in variable names', () => {
        // Arrange
        const testKey = 'VAR_WITH_UNDERSCORES_123';
        const testValue = 'special-chars-!@#$%^&*()';
        vi.stubEnv(testKey, testValue);

        // Act
        const result = getEnvVar(testKey);

        // Assert
        expect(result).toBe(testValue);
      });

      it('should handle unicode values', () => {
        // Arrange
        const testKey = 'UNICODE_VAR';
        const unicodeValue = '🚀 Unicode test value with émojis and ñ characters';
        vi.stubEnv(testKey, unicodeValue);

        // Act
        const result = getEnvVar(testKey, 'default');

        // Assert
        expect(result).toBe(unicodeValue);
      });

      it('should handle very long values', () => {
        // Arrange
        const testKey = 'LONG_VALUE_VAR';
        const longValue = 'a'.repeat(1000);
        vi.stubEnv(testKey, longValue);

        // Act
        const result = getEnvVar(testKey);

        // Assert
        expect(result).toBe(longValue);
        expect(result).toHaveLength(1000);
      });
    });
  });

  describe('getEnvironmentConfig function', () => {
    describe('when all required variables are present', () => {
      it('should return complete environment configuration', () => {
        // Arrange
        BaseTestUtils.setupMockEnvironment(TestFixtures.VALID_ENV_CONFIG);
        // Explicitly set ENVIRONMENT variable since getEnvironmentConfig looks for 'ENVIRONMENT', not 'NODE_ENV'
        vi.stubEnv('ENVIRONMENT', TestFixtures.VALID_ENV_CONFIG.environment);
        vi.stubEnv('LOG_LEVEL', TestFixtures.VALID_ENV_CONFIG.logLevel);

        // Act
        const config = getEnvironmentConfig();

        // Assert
        EnvTestUtils.assertEnvironmentConfig(config, TestFixtures.VALID_ENV_CONFIG);
      });

      it('should use environment values over defaults', () => {
        // Arrange
        const customConfig = {
          ...TestFixtures.VALID_ENV_CONFIG,
          environment: 'development' as const,
          logLevel: 'debug' as const,
        };
        BaseTestUtils.setupMockEnvironment(customConfig);
        vi.stubEnv('ENVIRONMENT', 'development');
        vi.stubEnv('LOG_LEVEL', 'debug');

        // Act
        const config = getEnvironmentConfig();

        // Assert
        expect(config.environment).toBe('development');
        expect(config.logLevel).toBe('debug');
      });

      it('should apply default values for optional variables', () => {
        // Arrange - Set only required variables
        BaseTestUtils.setupMockEnvironment({
          driveHrCompanyId: TestFixtures.VALID_ENV_CONFIG.driveHrCompanyId,
          wpApiUrl: TestFixtures.VALID_ENV_CONFIG.wpApiUrl,
          webhookSecret: TestFixtures.VALID_ENV_CONFIG.webhookSecret,
        });

        // Act
        const config = getEnvironmentConfig();

        // Assert
        expect(config.environment).toBe('production'); // Default value
        expect(config.logLevel).toBe('info'); // Default value
      });
    });

    describe('when required variables are missing', () => {
      it('should throw error for missing DRIVEHR_COMPANY_ID', () => {
        // Arrange
        EnvTestUtils.createEnvironmentWithMissingVars(['DRIVEHR_COMPANY_ID']);

        // Act & Assert
        expect(() => getEnvironmentConfig()).toThrow(
          /Required environment variable DRIVEHR_COMPANY_ID is not set/
        );
      });

      it('should throw error for missing WP_API_URL', () => {
        // Arrange
        EnvTestUtils.createEnvironmentWithMissingVars(['WP_API_URL']);

        // Act & Assert
        expect(() => getEnvironmentConfig()).toThrow(
          /Required environment variable WP_API_URL is not set/
        );
      });

      it('should throw error for missing WEBHOOK_SECRET', () => {
        // Arrange
        EnvTestUtils.createEnvironmentWithMissingVars(['WEBHOOK_SECRET']);

        // Act & Assert
        expect(() => getEnvironmentConfig()).toThrow(
          /Required environment variable WEBHOOK_SECRET is not set/
        );
      });

      it('should throw error for multiple missing variables (first one encountered)', () => {
        // Arrange
        EnvTestUtils.createEnvironmentWithMissingVars([
          'DRIVEHR_COMPANY_ID',
          'WP_API_URL',
          'WEBHOOK_SECRET',
        ]);

        // Act & Assert
        expect(() => getEnvironmentConfig()).toThrow(
          /Required environment variable DRIVEHR_COMPANY_ID is not set/
        );
      });
    });

    describe('environment validation and type safety', () => {
      it('should maintain type safety for environment values', () => {
        // Arrange
        BaseTestUtils.setupMockEnvironment(TestFixtures.VALID_ENV_CONFIG);

        // Act
        const config = getEnvironmentConfig();

        // Assert
        expect(typeof config.driveHrCompanyId).toBe('string');
        expect(typeof config.wpApiUrl).toBe('string');
        expect(typeof config.webhookSecret).toBe('string');
        expect(typeof config.environment).toBe('string');
        expect(typeof config.logLevel).toBe('string');
      });

      it('should handle all supported environment values', () => {
        const environments = ['development', 'staging', 'production'] as const;
        const logLevels = ['debug', 'info', 'warn', 'error'] as const;

        environments.forEach(env => {
          logLevels.forEach(level => {
            // Arrange
            BaseTestUtils.clearEnvironment();
            BaseTestUtils.setupMockEnvironment({
              ...TestFixtures.VALID_ENV_CONFIG,
              environment: env,
              logLevel: level,
            });
            vi.stubEnv('ENVIRONMENT', env);
            vi.stubEnv('LOG_LEVEL', level);

            // Act
            const config = getEnvironmentConfig();

            // Assert
            expect(config.environment).toBe(env);
            expect(config.logLevel).toBe(level);
          });
        });
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete environment lifecycle', () => {
        // Arrange - Full configuration setup
        BaseTestUtils.setupMockEnvironment(TestFixtures.VALID_ENV_CONFIG);
        // Explicitly set ENVIRONMENT variable since getEnvironmentConfig looks for 'ENVIRONMENT', not 'NODE_ENV'
        vi.stubEnv('ENVIRONMENT', TestFixtures.VALID_ENV_CONFIG.environment);
        vi.stubEnv('LOG_LEVEL', TestFixtures.VALID_ENV_CONFIG.logLevel);

        // Act - Multiple calls should be consistent
        const config1 = getEnvironmentConfig();
        const config2 = getEnvironmentConfig();

        // Assert - Results should be identical
        expect(config1).toEqual(config2);
        EnvTestUtils.assertEnvironmentConfig(config1, TestFixtures.VALID_ENV_CONFIG);
        EnvTestUtils.assertEnvironmentConfig(config2, TestFixtures.VALID_ENV_CONFIG);
      });

      it('should work correctly with real environment variable patterns', () => {
        // Arrange - Realistic environment variable values
        const realisticConfig = {
          driveHrCompanyId: BaseTestUtils.generateTestUuid(),
          wpApiUrl: BaseTestUtils.generateTestUrl('mycompany.com', '/webhook/drivehr-sync'),
          webhookSecret: BaseTestUtils.generateTestSecret(32),
          environment: 'production' as const,
          logLevel: 'info' as const,
        };
        BaseTestUtils.setupMockEnvironment(realisticConfig);

        // Act
        const config = getEnvironmentConfig();

        // Assert
        EnvTestUtils.assertEnvironmentConfig(config, realisticConfig);

        // Validate realistic patterns
        expect(config.driveHrCompanyId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
        expect(config.wpApiUrl).toMatch(/^https:\/\/.*\/webhook\/drivehr-sync$/);
        expect(config.webhookSecret.length).toBeGreaterThanOrEqual(32);
      });
    });
  });
});
