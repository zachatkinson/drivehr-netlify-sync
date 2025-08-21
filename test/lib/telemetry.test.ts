/**
 * Telemetry Test Suite
 *
 * Comprehensive test coverage for OpenTelemetry telemetry module following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates telemetry initialization, distributed tracing,
 * business metrics, instrumentation patterns, and graceful shutdown handling.
 *
 * Test Features:
 * - OpenTelemetry SDK initialization and configuration validation
 * - Business metrics creation and recording with semantic conventions
 * - Distributed tracing with span management and error handling
 * - HTTP and job processing metrics with proper labeling
 * - Webhook delivery tracking and failure monitoring
 * - Graceful shutdown and resource cleanup validation
 * - Error scenarios and exception handling patterns
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/telemetry.test.ts -- --grep "business metrics"
 * ```
 *
 * @module telemetry-test-suite
 * @since 1.0.0
 * @see {@link ../../src/lib/telemetry.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as logger from '../../src/lib/logger.js';

// Only mock external exporters - let OpenTelemetry API work normally
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

// Mock SDK startup to avoid actual initialization
const mockSDK = {
  start: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => mockSDK),
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue([]),
}));

vi.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: vi.fn().mockImplementation(() => ({
    shutdown: vi.fn(),
  })),
}));

// Import telemetry after mocking
import {
  initializeTelemetry,
  shutdownTelemetry,
  isTelemetryInitialized,
  getTracer,
  getBusinessMetrics,
  withSpan,
  recordHttpMetrics,
  recordJobMetrics,
  recordWebhookMetrics,
  type TelemetryConfig,
} from '../../src/lib/telemetry.js';
import { SpanKind } from '@opentelemetry/api';

/**
 * Telemetry test utilities
 *
 * Extends BaseTestUtils with telemetry-specific testing patterns.
 * Maintains DRY principles while providing specialized testing methods
 * for OpenTelemetry testing and validation.
 *
 * @since 1.0.0
 */
class TelemetryTestUtils extends BaseTestUtils {
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
   * Create mock telemetry configuration for testing
   *
   * Generates realistic telemetry configuration objects with proper
   * defaults and optional overrides for comprehensive testing scenarios.
   *
   * @param overrides - Partial configuration to override defaults
   * @returns Complete telemetry configuration object
   * @example
   * ```typescript
   * const config = TelemetryTestUtils.createMockConfig({
   *   environment: 'test',
   *   debug: true
   * });
   * ```
   * @since 1.0.0
   */
  static createMockConfig(overrides: Partial<TelemetryConfig> = {}): TelemetryConfig {
    return {
      serviceName: 'test-service',
      serviceVersion: '1.0.0-test',
      environment: 'test',
      namespace: 'test-namespace',
      debug: false,
      resourceAttributes: {
        'deployment.environment': 'test',
        'service.instance.id': 'test-instance',
      },
      ...overrides,
    };
  }

  /**
   * Reset telemetry state for clean test isolation
   *
   * Ensures each test starts with a clean telemetry state
   * for consistent and reliable test execution.
   *
   * @example
   * ```typescript
   * TelemetryTestUtils.resetTelemetryState();
   * ```
   * @since 1.0.0
   */
  static async resetTelemetryState(): Promise<void> {
    try {
      await shutdownTelemetry();
    } catch {
      // Ignore shutdown errors during cleanup
    }
    vi.clearAllMocks();
    mockSDK.start.mockResolvedValue(undefined);
    mockSDK.shutdown.mockResolvedValue(undefined);
  }

  /**
   * Create test error for telemetry error scenarios
   *
   * Generates standardized errors for testing telemetry
   * error handling and exception recording.
   *
   * @param message - Error message
   * @param name - Error name/type
   * @returns Test error instance
   * @example
   * ```typescript
   * const error = TelemetryTestUtils.createTelemetryError('SDK failed', 'InitError');
   * ```
   * @since 1.0.0
   */
  static createTelemetryError(message: string, name = 'TelemetryError'): Error {
    const error = new Error(message);
    error.name = name;
    return error;
  }
}

describe('Telemetry', () => {
  beforeEach(async () => {
    vi.spyOn(logger, 'createLogger').mockReturnValue(TelemetryTestUtils.mockLogger);
    await TelemetryTestUtils.resetTelemetryState();
  });

  afterEach(async () => {
    await TelemetryTestUtils.resetTelemetryState();
    vi.restoreAllMocks();
  });

  describe('when initializing telemetry', () => {
    it('should initialize OpenTelemetry SDK with basic configuration', async () => {
      const config = TelemetryTestUtils.createMockConfig();

      await initializeTelemetry(config);

      expect(mockSDK.start).toHaveBeenCalledTimes(1);
      expect(TelemetryTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Initializing OpenTelemetry SDK',
        expect.objectContaining({
          config: expect.objectContaining({
            serviceName: 'test-service',
            headers: '[REDACTED]',
          }),
        })
      );
      expect(isTelemetryInitialized()).toBe(true);
    });

    it('should skip initialization if already initialized', async () => {
      const config = TelemetryTestUtils.createMockConfig();

      await initializeTelemetry(config);
      await initializeTelemetry(config);

      expect(mockSDK.start).toHaveBeenCalledTimes(1);
      expect(TelemetryTestUtils.mockLogger.warn).toHaveBeenCalledWith(
        'Telemetry already initialized, skipping'
      );
    });

    it('should initialize with trace endpoint configuration', async () => {
      const config = TelemetryTestUtils.createMockConfig({
        traceEndpoint: 'https://traces.example.com/v1/traces',
        headers: { 'x-api-key': 'test-key' },
      });

      await initializeTelemetry(config);

      expect(mockSDK.start).toHaveBeenCalledTimes(1);
      expect(TelemetryTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'OpenTelemetry SDK initialized successfully',
        expect.objectContaining({
          serviceName: 'test-service',
          hasTraceExporter: true,
        })
      );
    });

    it('should initialize with metrics endpoint configuration', async () => {
      const config = TelemetryTestUtils.createMockConfig({
        metricsEndpoint: 'https://metrics.example.com/v1/metrics',
      });

      await initializeTelemetry(config);

      expect(mockSDK.start).toHaveBeenCalledTimes(1);
      expect(TelemetryTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'OpenTelemetry SDK initialized successfully',
        expect.objectContaining({
          serviceName: 'test-service',
          hasMetricsExporter: true,
        })
      );
    });

    it('should handle initialization errors gracefully', async () => {
      const config = TelemetryTestUtils.createMockConfig();
      const error = TelemetryTestUtils.createTelemetryError('Connection failed');
      mockSDK.start.mockRejectedValueOnce(error);

      await expect(initializeTelemetry(config)).rejects.toThrow(
        'Telemetry initialization failed: Connection failed'
      );

      expect(TelemetryTestUtils.mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize OpenTelemetry SDK',
        { error }
      );
    });
  });

  describe('when getting tracer', () => {
    it('should return tracer when telemetry is initialized', async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);

      const tracer = getTracer();

      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
      expect(typeof tracer.startActiveSpan).toBe('function');
    });

    it('should throw error when not initialized', () => {
      expect(() => getTracer()).toThrow(
        'Telemetry not initialized. Call initializeTelemetry() first.'
      );
    });
  });

  describe('when getting business metrics', () => {
    it('should return business metrics when telemetry is initialized', async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);

      const metrics = getBusinessMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.jobsProcessed).toBeDefined();
      expect(metrics.httpRequests).toBeDefined();
      expect(metrics.webhookDeliveries).toBeDefined();
      expect(typeof metrics.jobsProcessed.add).toBe('function');
      expect(typeof metrics.jobDuration.record).toBe('function');
    });

    it('should throw error when not initialized', () => {
      expect(() => getBusinessMetrics()).toThrow(
        'Telemetry not initialized. Call initializeTelemetry() first.'
      );
    });
  });

  describe('when creating spans with withSpan', () => {
    beforeEach(async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);
    });

    it('should create span and execute operation successfully', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const attributes = { 'operation.type': 'test' };

      const result = await withSpan('test-operation', operation, attributes, SpanKind.INTERNAL);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle operation errors and rethrow', async () => {
      const error = TelemetryTestUtils.createTelemetryError('Operation failed');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(withSpan('failing-operation', operation)).rejects.toThrow('Operation failed');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('when recording HTTP metrics', () => {
    beforeEach(async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);
    });

    it('should record HTTP request metrics', () => {
      // This tests the function doesn't throw - actual metrics recording
      // is handled by OpenTelemetry API which we're letting work normally
      expect(() => {
        recordHttpMetrics('POST', 'https://api.example.com/data', 200, 150, {
          'http.user_agent': 'test-client',
        });
      }).not.toThrow();
    });

    it('should handle HTTP errors without throwing', () => {
      expect(() => {
        recordHttpMetrics('GET', 'https://api.example.com/error', 500, 200);
      }).not.toThrow();
    });
  });

  describe('when recording job metrics', () => {
    beforeEach(async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);
    });

    it('should record successful job processing', () => {
      expect(() => {
        recordJobMetrics('job-123', 'sync', 'success', 2500, {
          source: 'drivehr',
          jobCount: 10,
        });
      }).not.toThrow();
    });

    it('should record job errors separately', () => {
      expect(() => {
        recordJobMetrics('job-456', 'fetch', 'error', 1000, {
          errorType: 'timeout',
        });
      }).not.toThrow();
    });

    it('should handle different job statuses', () => {
      expect(() => {
        recordJobMetrics('job-789', 'validate', 'timeout', 5000);
      }).not.toThrow();
    });
  });

  describe('when recording webhook metrics', () => {
    beforeEach(async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);
    });

    it('should record successful webhook deliveries', () => {
      expect(() => {
        recordWebhookMetrics('wordpress-sync', 'success', 200, 300, {
          'webhook.event': 'job.completed',
          'payload.size': 1024,
        });
      }).not.toThrow();
    });

    it('should record webhook failures separately', () => {
      expect(() => {
        recordWebhookMetrics('notification-webhook', 'failure', 500, 1000);
      }).not.toThrow();
    });

    it('should handle webhook timeouts and retries', () => {
      expect(() => {
        recordWebhookMetrics('retry-webhook', 'retry', 408, 2000);
      }).not.toThrow();
    });
  });

  describe('when shutting down telemetry', () => {
    it('should shutdown successfully when initialized', async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);

      await shutdownTelemetry();

      expect(mockSDK.shutdown).toHaveBeenCalledTimes(1);
      expect(TelemetryTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'Shutting down OpenTelemetry SDK'
      );
      expect(TelemetryTestUtils.mockLogger.info).toHaveBeenCalledWith(
        'OpenTelemetry SDK shutdown completed'
      );
      expect(isTelemetryInitialized()).toBe(false);
    });

    it('should skip shutdown when not initialized', async () => {
      await shutdownTelemetry();

      expect(mockSDK.shutdown).not.toHaveBeenCalled();
      expect(TelemetryTestUtils.mockLogger.warn).toHaveBeenCalledWith(
        'Telemetry not initialized, skipping shutdown'
      );
    });

    it('should handle shutdown errors', async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);

      const error = TelemetryTestUtils.createTelemetryError('Shutdown failed');
      mockSDK.shutdown.mockRejectedValueOnce(error);

      await expect(shutdownTelemetry()).rejects.toThrow('Shutdown failed');

      expect(TelemetryTestUtils.mockLogger.error).toHaveBeenCalledWith(
        'Error during telemetry shutdown',
        { error }
      );
    });
  });

  describe('when checking initialization status', () => {
    it('should return false when not initialized', () => {
      expect(isTelemetryInitialized()).toBe(false);
    });

    it('should return true when fully initialized', async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);

      expect(isTelemetryInitialized()).toBe(true);
    });

    it('should return false after shutdown', async () => {
      const config = TelemetryTestUtils.createMockConfig();
      await initializeTelemetry(config);
      await shutdownTelemetry();

      expect(isTelemetryInitialized()).toBe(false);
    });
  });

  describe('when handling edge cases', () => {
    it('should handle undefined service version', async () => {
      const config = TelemetryTestUtils.createMockConfig({ serviceVersion: undefined });

      await initializeTelemetry(config);

      expect(mockSDK.start).toHaveBeenCalledTimes(1);
    });

    it('should handle empty resource attributes', async () => {
      const config = TelemetryTestUtils.createMockConfig({ resourceAttributes: {} });

      await initializeTelemetry(config);

      expect(mockSDK.start).toHaveBeenCalledTimes(1);
    });

    it('should handle debug mode configuration', async () => {
      const config = TelemetryTestUtils.createMockConfig({ debug: true });

      await initializeTelemetry(config);

      expect(TelemetryTestUtils.mockLogger.debug).toHaveBeenCalledWith(
        'Business metrics initialized',
        expect.objectContaining({
          metricsCount: expect.any(Number),
        })
      );
    });
  });
});
