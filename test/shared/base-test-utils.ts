/**
 * Base Test Utilities
 *
 * Core testing utilities that provide DRY patterns for all test suites.
 * Centralizes common testing patterns, mock management, and assertion helpers
 * to maintain single source of truth principles across the entire test environment.
 *
 * Key Features:
 * - Environment variable mocking with isolation
 * - Standardized mock cleanup and reset patterns
 * - Common assertion helpers for validation results
 * - Test fixture generation and management
 * - Error scenario simulation utilities
 * - Test data normalization patterns
 *
 * Usage Philosophy:
 * - Every test pattern used in 2+ files should be extracted here
 * - Maintain strict DRY principles to prevent test code bloat
 * - Ensure single source of truth for all testing patterns
 * - Make debugging easier with centralized utilities
 *
 * @module base-test-utils
 * @since 1.0.0
 */

import { vi, expect } from 'vitest';
import type { EnvironmentConfig } from '../../src/types/common.js';

/**
 * Core Test Utilities
 *
 * Base class that provides fundamental testing utilities used across
 * all test suites. Implements enterprise testing patterns with proper
 * isolation, cleanup, and error handling.
 *
 * @since 1.0.0
 */
export class BaseTestUtils {
  /**
   * Standard environment variable mapping
   *
   * Centralized mapping between application configuration properties
   * and their corresponding environment variable names. Used across
   * all tests that need environment variable mocking.
   *
   * @since 1.0.0
   */
  static readonly ENV_MAPPING = {
    driveHrCompanyId: 'DRIVEHR_COMPANY_ID',
    wpApiUrl: 'WP_API_URL',
    wpAuthToken: 'WP_AUTH_TOKEN',
    webhookSecret: 'WEBHOOK_SECRET',
    environment: 'NODE_ENV',
    logLevel: 'LOG_LEVEL',
  } as const;

  /**
   * Standard environment variable list for cleanup
   *
   * Complete list of environment variables used across the application.
   * Used for comprehensive cleanup between tests to ensure isolation.
   *
   * @since 1.0.0
   */
  static readonly ENV_VARIABLES = Object.values(BaseTestUtils.ENV_MAPPING);

  /**
   * Setup mock environment variables with type safety
   *
   * Centralized environment variable mocking that ensures proper mapping
   * and type safety. Used across all tests that need environment setup.
   *
   * @param envConfig - Partial environment configuration to mock
   * @example
   * ```typescript
   * BaseTestUtils.setupMockEnvironment({
   *   driveHrCompanyId: '123e4567-e89b-12d3-a456-426614174000',
   *   environment: 'test'
   * });
   * ```
   * @since 1.0.0
   */
  static setupMockEnvironment(envConfig: Partial<EnvironmentConfig>): void {
    Object.entries(envConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        const envKey = this.ENV_MAPPING[key as keyof typeof this.ENV_MAPPING];
        if (envKey) {
          vi.stubEnv(envKey, String(value));
        }
      }
    });
  }

  /**
   * Clear all environment variables for test isolation
   *
   * Removes all environment variable stubs to ensure clean state
   * between tests. Should be used in beforeEach/afterEach hooks.
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   BaseTestUtils.clearEnvironment();
   * });
   * ```
   * @since 1.0.0
   */
  static clearEnvironment(): void {
    vi.unstubAllEnvs();
  }

  /**
   * Clear all mocks and reset state
   *
   * Comprehensive cleanup that resets all mocks, clears timers,
   * and ensures clean state between tests. Standard cleanup pattern.
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   BaseTestUtils.resetAllMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static resetAllMocks(): void {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.unstubAllEnvs();
  }

  /**
   * Generate test UUID
   *
   * Creates a valid UUID for testing purposes. Ensures consistent
   * UUID format across all tests without external dependencies.
   *
   * @returns Valid UUID string for testing
   * @example
   * ```typescript
   * const testId = BaseTestUtils.generateTestUuid();
   * // Returns: '123e4567-e89b-12d3-a456-426614174000'
   * ```
   * @since 1.0.0
   */
  static generateTestUuid(): string {
    return '123e4567-e89b-12d3-a456-426614174000';
  }

  /**
   * Generate test URL
   *
   * Creates a valid test URL with optional path. Ensures consistent
   * URL format across all tests.
   *
   * @param domain - Domain name for the URL (default: 'example.com')
   * @param path - Optional path to append
   * @param protocol - Protocol to use (default: 'https')
   * @returns Formatted test URL
   * @example
   * ```typescript
   * const apiUrl = BaseTestUtils.generateTestUrl('api.example.com', '/v1/sync');
   * // Returns: 'https://api.example.com/v1/sync'
   * ```
   * @since 1.0.0
   */
  static generateTestUrl(domain = 'example.com', path = '', protocol = 'https'): string {
    const baseUrl = `${protocol}://${domain}`;
    return path ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : baseUrl;
  }

  /**
   * Generate test token
   *
   * Creates a test authentication token with consistent format.
   * Ensures realistic but safe token format for testing.
   *
   * @param prefix - Token prefix (default: 'test_token')
   * @param length - Token length (default: 32)
   * @returns Formatted test token
   * @example
   * ```typescript
   * const authToken = BaseTestUtils.generateTestToken('wp_auth');
   * // Returns: 'wp_auth_abcdef1234567890abcdef1234567890'
   * ```
   * @since 1.0.0
   */
  static generateTestToken(prefix = 'test_token', length = 32): string {
    const chars = 'abcdef1234567890';
    const randomPart = Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    return `${prefix}_${randomPart}`;
  }

  /**
   * Generate test secret
   *
   * Creates a test secret with minimum length requirements.
   * Ensures consistent secret format across all tests.
   *
   * @param minLength - Minimum secret length (default: 32)
   * @returns Test secret string
   * @example
   * ```typescript
   * const webhookSecret = BaseTestUtils.generateTestSecret(64);
   * ```
   * @since 1.0.0
   */
  static generateTestSecret(minLength = 32): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    return Array.from(
      { length: minLength },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }

  /**
   * Assert object has required properties
   *
   * Generic assertion helper that verifies an object contains
   * all required properties. Used for structure validation.
   *
   * @param obj - Object to validate
   * @param requiredProps - Array of required property names
   * @param objectName - Name of object for error messages
   * @example
   * ```typescript
   * BaseTestUtils.assertHasRequiredProperties(
   *   config,
   *   ['environment', 'logging', 'security'],
   *   'AppConfig'
   * );
   * ```
   * @since 1.0.0
   */
  static assertHasRequiredProperties(
    obj: unknown,
    requiredProps: string[],
    objectName = 'object'
  ): void {
    expect(obj).toBeDefined();
    expect(obj).toBeTypeOf('object');

    const typedObj = obj as Record<string, unknown>;
    requiredProps.forEach(prop => {
      expect(typedObj[prop], `${objectName} should have property '${prop}'`).toBeDefined();
    });
  }

  /**
   * Assert validation result structure
   *
   * Generic assertion for validation result objects that follow
   * the standard { isValid, errors } pattern used across the app.
   *
   * @param result - Validation result to check
   * @param expectedValid - Expected validation status
   * @param expectedErrorCount - Expected number of errors (optional)
   * @example
   * ```typescript
   * BaseTestUtils.assertValidationResult(result, true, 0);
   * BaseTestUtils.assertValidationResult(errorResult, false, 2);
   * ```
   * @since 1.0.0
   */
  static assertValidationResult(
    result: { isValid: boolean; errors: readonly unknown[] },
    expectedValid: boolean,
    expectedErrorCount?: number
  ): void {
    expect(result.isValid).toBe(expectedValid);

    if (expectedValid) {
      expect(result.errors).toHaveLength(0);
    } else {
      expect(result.errors.length).toBeGreaterThan(0);
      if (expectedErrorCount !== undefined) {
        expect(result.errors).toHaveLength(expectedErrorCount);
      }
    }
  }

  /**
   * Create test error with consistent format
   *
   * Generates standardized test errors for error scenario testing.
   * Ensures consistent error format across all tests.
   *
   * @param message - Error message
   * @param code - Optional error code
   * @param cause - Optional underlying cause
   * @returns Formatted test error
   * @example
   * ```typescript
   * const testError = BaseTestUtils.createTestError(
   *   'Configuration validation failed',
   *   'CONFIG_INVALID'
   * );
   * ```
   * @since 1.0.0
   */
  static createTestError(message: string, code?: string, cause?: unknown): Error {
    const error = new Error(message) as Error & { cause?: unknown; code?: string };
    if (cause) {
      error.cause = cause;
    }
    if (code) {
      error.code = code;
    }
    return error;
  }

  /**
   * Wait for specified time (test helper)
   *
   * Utility for testing time-dependent code. Uses fake timers
   * when available for faster test execution.
   *
   * @param ms - Milliseconds to wait
   * @example
   * ```typescript
   * await BaseTestUtils.wait(1000); // Wait 1 second
   * ```
   * @since 1.0.0
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create test timeout error
   *
   * Generates timeout errors for testing timeout scenarios.
   * Consistent format for timeout testing across the app.
   *
   * @param operation - Operation that timed out
   * @param timeout - Timeout duration in milliseconds
   * @returns Timeout error
   * @example
   * ```typescript
   * const timeoutError = BaseTestUtils.createTimeoutError('HTTP request', 5000);
   * ```
   * @since 1.0.0
   */
  static createTimeoutError(operation: string, timeout: number): Error {
    const error = new Error(`${operation} timed out after ${timeout}ms`);
    error.name = 'TimeoutError';
    return error;
  }

  /**
   * Create test network error
   *
   * Generates network errors for testing connectivity scenarios.
   * Consistent format for network error testing.
   *
   * @param details - Error details
   * @returns Network error
   * @example
   * ```typescript
   * const networkError = BaseTestUtils.createNetworkError('ENOTFOUND api.example.com');
   * ```
   * @since 1.0.0
   */
  static createNetworkError(details = 'Network error'): Error {
    const error = new Error(details);
    error.name = 'NetworkError';
    return error;
  }

  /**
   * Verify error has expected properties
   *
   * Assertion helper for validating error objects have the
   * expected structure and properties.
   *
   * @param error - Error to validate
   * @param expectedMessage - Expected error message (or pattern)
   * @param expectedName - Expected error name (optional)
   * @param expectedCode - Expected error code (optional)
   * @example
   * ```typescript
   * BaseTestUtils.assertError(
   *   error,
   *   /Configuration.*invalid/,
   *   'ValidationError',
   *   'CONFIG_INVALID'
   * );
   * ```
   * @since 1.0.0
   */
  static assertError(
    error: unknown,
    expectedMessage: string | RegExp,
    expectedName?: string,
    expectedCode?: string
  ): void {
    expect(error).toBeInstanceOf(Error);

    const err = error as Error;

    if (typeof expectedMessage === 'string') {
      expect(err.message).toContain(expectedMessage);
    } else {
      expect(err.message).toMatch(expectedMessage);
    }

    if (expectedName) {
      expect(err.name).toBe(expectedName);
    }

    if (expectedCode) {
      expect((err as Error & { code?: string }).code).toBe(expectedCode);
    }
  }
}

/**
 * Common Test Fixtures
 *
 * Standardized test data that can be reused across multiple test suites.
 * Provides consistent, realistic test data while maintaining DRY principles.
 *
 * @since 1.0.0
 */
export class TestFixtures {
  /**
   * Standard valid environment configuration
   */
  static readonly VALID_ENV_CONFIG: EnvironmentConfig = {
    driveHrCompanyId: BaseTestUtils.generateTestUuid(),
    wpApiUrl: BaseTestUtils.generateTestUrl('example.com', '/webhook/drivehr/v1/sync'),
    webhookSecret: BaseTestUtils.generateTestSecret(32),
    environment: 'development',
    logLevel: 'debug',
  };

  /**
   * Standard invalid environment configuration for error testing
   */
  static readonly INVALID_ENV_CONFIG = {
    driveHrCompanyId: 'invalid-uuid',
    wpApiUrl: 'not-a-url',
    webhookSecret: 'short',
    environment: 'invalid' as never,
    logLevel: 'invalid' as never,
  };

  /**
   * Common test URLs for various scenarios
   */
  static readonly TEST_URLS = {
    api: BaseTestUtils.generateTestUrl('api.example.com'),
    wordpress: BaseTestUtils.generateTestUrl('example.com', '/webhook/drivehr/v1/sync'),
    careers: BaseTestUtils.generateTestUrl('drivehris.app', '/careers/company/list'),
    external: BaseTestUtils.generateTestUrl('external.api.com', '/data'),
  };

  /**
   * Common test tokens and secrets
   */
  static readonly TEST_CREDENTIALS = {
    validToken: BaseTestUtils.generateTestToken('valid_token', 32),
    validSecret: BaseTestUtils.generateTestSecret(32),
    invalidToken: 'invalid',
    invalidSecret: 'short',
  };

  /**
   * Standard HTTP status codes for testing
   */
  static readonly HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TIMEOUT: 408,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  } as const;
}
