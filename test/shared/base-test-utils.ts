/**
 * Base Test Utilities
 *
 * Core testing utilities that provide DRY patterns for all test suites.
 * Centralizes common testing patterns, mock management, and assertion helpers
 * to maintain single source of truth principles across the entire test environment.
 *
 * Test Features:
 * - Environment variable mocking with isolation
 * - Standardized mock cleanup and reset patterns
 * - Common assertion helpers for validation results
 * - Test fixture generation and management
 * - Error scenario simulation utilities
 * - Test data normalization patterns
 *
 * @example
 * ```typescript
 * // Setup test environment
 * BaseTestUtils.setupMockEnvironment({
 *   driveHrCompanyId: '123e4567-e89b-12d3-a456-426614174000',
 *   environment: 'test'
 * });
 * ```
 *
 * @module base-test-utils
 * @since 1.0.0
 * @see {@link ../../src/types/common.ts} for type definitions
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { randomInt } from 'node:crypto';
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
   * @since 1.0.0
   */
  static readonly ENV_VARIABLES = Object.values(BaseTestUtils.ENV_MAPPING);

  /**
   * Setup mock environment variables with type safety
   *
   * @param envConfig - Partial environment configuration to mock
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
   * @since 1.0.0
   */
  static clearEnvironment(): void {
    vi.unstubAllEnvs();
  }

  /**
   * Clear all mocks and reset state
   *
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
   * @returns Valid UUID string for testing
   * @since 1.0.0
   */
  static generateTestUuid(): string {
    return '123e4567-e89b-12d3-a456-426614174000';
  }

  /**
   * Generate test URL
   *
   * @param domain - Domain name for the URL (default: 'example.com')
   * @param path - Optional path to append
   * @param protocol - Protocol to use (default: 'https')
   * @returns Formatted test URL
   * @since 1.0.0
   */
  static generateTestUrl(domain = 'example.com', path = '', protocol = 'https'): string {
    const baseUrl = `${protocol}://${domain}`;
    return path ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : baseUrl;
  }

  /**
   * Generate test token
   *
   * @param prefix - Token prefix (default: 'test_token')
   * @param length - Token length (default: 32)
   * @returns Formatted test token
   * @since 1.0.0
   */
  static generateTestToken(prefix = 'test_token', length = 32): string {
    const chars = 'abcdef1234567890';
    const randomPart = Array.from({ length }, () => chars[randomInt(chars.length)]).join('');
    return `${prefix}_${randomPart}`;
  }

  /**
   * Generate test secret
   *
   * @param minLength - Minimum secret length (default: 32)
   * @returns Test secret string
   * @since 1.0.0
   */
  static generateTestSecret(minLength = 32): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    return Array.from({ length: minLength }, () => chars[randomInt(chars.length)]).join('');
  }

  /**
   * Assert object has required properties
   *
   * @param obj - Object to validate
   * @param requiredProps - Array of required property names
   * @param objectName - Name of object for error messages
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
   * @param result - Validation result to check
   * @param expectedValid - Expected validation status
   * @param expectedErrorCount - Expected number of errors (optional)
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
   * @param message - Error message
   * @param code - Optional error code
   * @param cause - Optional underlying cause
   * @returns Formatted test error
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
   * @param ms - Milliseconds to wait
   * @since 1.0.0
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create test timeout error
   *
   * @param operation - Operation that timed out
   * @param timeout - Timeout duration in milliseconds
   * @returns Timeout error
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
   * @param details - Error details
   * @returns Network error
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
   * @param error - Error to validate
   * @param expectedMessage - Expected error message (or pattern)
   * @param expectedName - Expected error name (optional)
   * @param expectedCode - Expected error code (optional)
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
   * @since 1.0.0
   */
  static readonly VALID_ENV_CONFIG: EnvironmentConfig = {
    driveHrCompanyId: BaseTestUtils.generateTestUuid(),
    wpApiUrl: BaseTestUtils.generateTestUrl('example.com', '/webhook/drivehr-sync'),
    webhookSecret: BaseTestUtils.generateTestSecret(32),
    environment: 'development',
    logLevel: 'debug',
  };

  /**
   * Standard invalid environment configuration for error testing
   * @since 1.0.0
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
   * @since 1.0.0
   */
  static readonly TEST_URLS = {
    api: BaseTestUtils.generateTestUrl('api.example.com'),
    wordpress: BaseTestUtils.generateTestUrl('example.com', '/webhook/drivehr-sync'),
    careers: BaseTestUtils.generateTestUrl('drivehris.app', '/careers/company/list'),
    external: BaseTestUtils.generateTestUrl('external.api.com', '/data'),
  };

  /**
   * Common test tokens and secrets
   * @since 1.0.0
   */
  static readonly TEST_CREDENTIALS = {
    validToken: BaseTestUtils.generateTestToken('valid_token', 32),
    validSecret: BaseTestUtils.generateTestSecret(32),
    invalidToken: 'invalid',
    invalidSecret: 'short',
  };

  /**
   * Standard HTTP status codes for testing
   * @since 1.0.0
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
