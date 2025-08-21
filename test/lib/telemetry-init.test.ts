/**
 * Telemetry Initialization Test Suite
 *
 * Comprehensive test coverage for telemetry initialization module following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates environment-specific configuration, initialization
 * patterns, graceful shutdown handling, and error recovery mechanisms.
 *
 * Test Features:
 * - Environment-specific configuration validation (production, development, test)
 * - Initialization lifecycle management and idempotent behavior
 * - Error handling and graceful degradation in production environments
 * - Shutdown handlers and signal processing validation
 * - Configuration override and forced configuration testing
 * - Telemetry enablement logic and environment variable handling
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/telemetry-init.test.ts -- --grep "initialization"
 * ```
 *
 * @module telemetry-init-test-suite
 * @since 1.0.0
 * @see {@link ../../src/lib/telemetry-init.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as telemetry from '../../src/lib/telemetry.js';
import * as logger from '../../src/lib/logger.js';
import * as env from '../../src/lib/env.js';

// Import after setting up mocks
import {
  initializeApplicationTelemetry,
  shutdownApplicationTelemetry,
  setupTelemetryShutdownHandlers,
  shouldEnableTelemetry,
  getTelemetryConfigSummary,
} from '../../src/lib/telemetry-init.js';

/**
 * Telemetry initialization test utilities
 *
 * Extends BaseTestUtils with telemetry-specific testing patterns.
 * Maintains DRY principles while providing specialized testing methods
 * for telemetry configuration, environment mocking, and process simulation.
 *
 * @since 1.0.0
 */
class TelemetryInitTestUtils extends BaseTestUtils {
  /**
   * Mock logger instance for telemetry testing
   *
   * Provides comprehensive logging mock with all required methods
   * for testing telemetry operations and error scenarios.
   *
   * @since 1.0.0
   */
  static mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  };

  /**
   * Setup environment variable mocks for telemetry testing
   *
   * Configures environment variables using vitest stubbing to ensure
   * proper isolation and predictable test behavior.
   *
   * @param envVars - Environment variables to mock
   * @example
   * ```typescript
   * TelemetryInitTestUtils.mockEnvironmentVars({
   *   NODE_ENV: 'production',
   *   OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://traces.example.com'
   * });
   * ```
   * @since 1.0.0
   */
  static mockEnvironmentVars(envVars: Record<string, string>): void {
    // Mock the getEnvVar function with proper overload handling
    vi.spyOn(env, 'getEnvVar').mockImplementation(((
      key: string,
      defaultValueOrRequired?: string | boolean
    ) => {
      const value = envVars[key];

      if (defaultValueOrRequired === true) {
        // Required parameter case
        if (!value) {
          throw new Error(`Environment variable ${key} is required but not set`);
        }
        return value;
      }

      if (typeof defaultValueOrRequired === 'string') {
        // Default value case
        return value ?? defaultValueOrRequired;
      }

      // Optional case
      return value;
    }) as typeof env.getEnvVar);
  }

  /**
   * Reset all telemetry mocks and state
   *
   * Ensures clean state between tests for reliable test execution
   * and proper isolation of test scenarios.
   *
   * @example
   * ```typescript
   * TelemetryInitTestUtils.resetTelemetryMocks();
   * ```
   * @since 1.0.0
   */
  static resetTelemetryMocks(): void {
    vi.clearAllMocks();
    // Reset default environment
    this.mockEnvironmentVars({
      NODE_ENV: 'test',
    });
  }

  /**
   * Create test error for initialization scenarios
   *
   * Generates standardized errors for testing initialization
   * error handling and recovery mechanisms.
   *
   * @param message - Error message
   * @param name - Error name/type
   * @returns Test error instance
   * @example
   * ```typescript
   * const error = TelemetryInitTestUtils.createInitError('Config invalid', 'ConfigError');
   * ```
   * @since 1.0.0
   */
  static createInitError(message: string, name = 'InitializationError'): Error {
    const error = new Error(message);
    error.name = name;
    return error;
  }
}

describe('TelemetryInit', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'createLogger').mockReturnValue(TelemetryInitTestUtils.mockLogger);
    vi.spyOn(telemetry, 'initializeTelemetry').mockResolvedValue(undefined);
    vi.spyOn(telemetry, 'shutdownTelemetry').mockResolvedValue(undefined);
    vi.spyOn(telemetry, 'isTelemetryInitialized').mockReturnValue(false);
    TelemetryInitTestUtils.resetTelemetryMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when initializing application telemetry', () => {
    it('should skip initialization if already initialized', async () => {
      vi.spyOn(telemetry, 'isTelemetryInitialized').mockReturnValue(true);

      await initializeApplicationTelemetry();

      expect(telemetry.initializeTelemetry).not.toHaveBeenCalled();
      expect(TelemetryInitTestUtils.mockLogger.debug).toHaveBeenCalledWith(
        'Telemetry already initialized, skipping'
      );
    });

    it('should initialize with production config in production environment', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
        npm_package_version: '1.0.0',
        NETLIFY_DEPLOY_ID: 'deploy-123',
      });

      await initializeApplicationTelemetry();

      expect(telemetry.initializeTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'drivehr-netlify-sync',
          environment: 'production',
          namespace: 'drivehr',
        })
      );
      expect(TelemetryInitTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Initializing application telemetry',
        expect.objectContaining({
          environment: 'production',
          serviceName: 'drivehr-netlify-sync',
        })
      );
    });

    it('should initialize with development config in development environment', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'development',
        USER: 'testuser',
      });

      await initializeApplicationTelemetry();

      expect(telemetry.initializeTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'drivehr-netlify-sync-dev',
          environment: 'development',
          namespace: 'drivehr-dev',
          debug: true,
        })
      );
    });

    it('should initialize with test config in test environment', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'test',
      });

      await initializeApplicationTelemetry();

      expect(telemetry.initializeTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'drivehr-netlify-sync-test',
          environment: 'test',
          namespace: 'drivehr-test',
          debug: false,
        })
      );
    });

    it('should use forced configuration when provided', async () => {
      const forceConfig = {
        serviceName: 'custom-service',
        environment: 'custom',
        debug: true,
      };

      await initializeApplicationTelemetry(forceConfig);

      expect(telemetry.initializeTelemetry).toHaveBeenCalledWith(
        expect.objectContaining(forceConfig)
      );
    });

    it('should handle initialization errors gracefully in production', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
      });
      const error = TelemetryInitTestUtils.createInitError('Connection failed');
      vi.spyOn(telemetry, 'initializeTelemetry').mockRejectedValueOnce(error);

      await expect(initializeApplicationTelemetry()).resolves.toBeUndefined();

      expect(TelemetryInitTestUtils.mockLogger.error).toHaveBeenCalledWith(
        'Telemetry initialization failed, continuing without instrumentation',
        expect.objectContaining({
          error: 'Connection failed',
          environment: 'production',
        })
      );
    });

    it('should throw initialization errors in development environment', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'development',
      });
      const error = TelemetryInitTestUtils.createInitError('Development error');
      vi.spyOn(telemetry, 'initializeTelemetry').mockRejectedValueOnce(error);

      await expect(initializeApplicationTelemetry()).rejects.toThrow('Development error');

      expect(TelemetryInitTestUtils.mockLogger.error).toHaveBeenCalledWith(
        'Telemetry initialization failed',
        { error: 'Development error' }
      );
    });

    it('should include OTLP endpoints when configured', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://traces.example.com',
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'https://metrics.example.com',
        OTEL_API_KEY: 'test-api-key',
      });

      await initializeApplicationTelemetry();

      expect(telemetry.initializeTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          traceEndpoint: 'https://traces.example.com',
          metricsEndpoint: 'https://metrics.example.com',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );
    });
  });

  describe('when shutting down application telemetry', () => {
    it('should shutdown telemetry when initialized', async () => {
      vi.spyOn(telemetry, 'isTelemetryInitialized').mockReturnValue(true);

      await shutdownApplicationTelemetry();

      expect(telemetry.shutdownTelemetry).toHaveBeenCalledTimes(1);
      expect(TelemetryInitTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Shutting down application telemetry'
      );
      expect(TelemetryInitTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Application telemetry shutdown completed'
      );
    });

    it('should skip shutdown when not initialized', async () => {
      vi.spyOn(telemetry, 'isTelemetryInitialized').mockReturnValue(false);

      await shutdownApplicationTelemetry();

      expect(telemetry.shutdownTelemetry).not.toHaveBeenCalled();
      expect(TelemetryInitTestUtils.mockLogger.debug).toHaveBeenCalledWith(
        'Telemetry not initialized, skipping shutdown'
      );
    });

    it('should handle shutdown errors gracefully', async () => {
      vi.spyOn(telemetry, 'isTelemetryInitialized').mockReturnValue(true);
      const error = TelemetryInitTestUtils.createInitError('Shutdown failed');
      vi.spyOn(telemetry, 'shutdownTelemetry').mockRejectedValueOnce(error);

      await expect(shutdownApplicationTelemetry()).resolves.toBeUndefined();

      expect(TelemetryInitTestUtils.mockLogger.error).toHaveBeenCalledWith(
        'Error during telemetry shutdown',
        expect.objectContaining({
          error: 'Shutdown failed',
        })
      );
    });
  });

  describe('when setting up telemetry shutdown handlers', () => {
    it('should register process signal handlers', () => {
      const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);

      setupTelemetryShutdownHandlers();

      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      expect(TelemetryInitTestUtils.mockLogger.debug).toHaveBeenCalledWith(
        'Telemetry shutdown handlers registered'
      );
    });
  });

  describe('when checking if telemetry should be enabled', () => {
    it('should return false when explicitly disabled', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        DISABLE_TELEMETRY: 'true',
      });

      const result = shouldEnableTelemetry();

      expect(result).toBe(false);
    });

    it('should return true in production by default', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
      });

      const result = shouldEnableTelemetry();

      expect(result).toBe(true);
    });

    it('should return true in development when explicitly enabled', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'development',
        ENABLE_TELEMETRY: 'true',
      });

      const result = shouldEnableTelemetry();

      expect(result).toBe(true);
    });

    it('should return false in development by default', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'development',
      });

      const result = shouldEnableTelemetry();

      expect(result).toBe(false);
    });

    it('should return false in test by default', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'test',
      });

      const result = shouldEnableTelemetry();

      expect(result).toBe(false);
    });

    it('should return true in test when explicitly enabled', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'test',
        ENABLE_TELEMETRY: 'true',
      });

      const result = shouldEnableTelemetry();

      expect(result).toBe(true);
    });
  });

  describe('when getting telemetry configuration summary', () => {
    it('should return configuration summary for production', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://traces.example.com',
      });

      const summary = getTelemetryConfigSummary();

      expect(summary).toEqual({
        enabled: false, // Mock returns false by default
        serviceName: 'drivehr-netlify-sync',
        environment: 'production',
        hasTraceEndpoint: true,
        hasMetricsEndpoint: false,
      });
    });

    it('should return configuration summary for development', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'development',
      });

      const summary = getTelemetryConfigSummary();

      expect(summary).toEqual({
        enabled: false,
        serviceName: 'drivehr-netlify-sync-dev',
        environment: 'development',
        hasTraceEndpoint: false,
        hasMetricsEndpoint: false,
      });
    });

    it('should return configuration summary for test', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'test',
      });

      const summary = getTelemetryConfigSummary();

      expect(summary).toEqual({
        enabled: false,
        serviceName: 'drivehr-netlify-sync-test',
        environment: 'test',
        hasTraceEndpoint: false,
        hasMetricsEndpoint: false,
      });
    });

    it('should reflect enabled status when telemetry is initialized', () => {
      vi.spyOn(telemetry, 'isTelemetryInitialized').mockReturnValue(true);
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
      });

      const summary = getTelemetryConfigSummary();

      expect(summary.enabled).toBe(true);
    });
  });

  describe('when handling environment variable edge cases', () => {
    it('should handle missing npm_package_version', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
      });

      expect(() => initializeApplicationTelemetry()).not.toThrow();
    });

    it('should handle empty OTEL_EXPORTER_OTLP_HEADERS', () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_HEADERS: '',
      });

      expect(() => initializeApplicationTelemetry()).not.toThrow();
    });

    it('should parse OTEL_EXPORTER_OTLP_HEADERS correctly', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_HEADERS: 'key1=value1,key2=value2',
      });

      await initializeApplicationTelemetry();

      expect(telemetry.initializeTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            key1: 'value1',
            key2: 'value2',
          }),
        })
      );
    });

    it('should handle multiple API key types', async () => {
      TelemetryInitTestUtils.mockEnvironmentVars({
        NODE_ENV: 'production',
        OTEL_API_KEY: 'otel-key',
        DATADOG_API_KEY: 'dd-key',
        NEW_RELIC_LICENSE_KEY: 'nr-key',
      });

      await initializeApplicationTelemetry();

      expect(telemetry.initializeTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'otel-key',
            'DD-API-KEY': 'dd-key',
            'Api-Key': 'nr-key',
          }),
        })
      );
    });
  });
});
