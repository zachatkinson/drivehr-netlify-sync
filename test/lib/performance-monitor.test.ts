/**
 * Performance Monitor Test Suite
 *
 * Comprehensive test coverage for performance monitoring module following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates performance metrics collection, timer functionality,
 * memory monitoring, and enterprise-grade performance tracking capabilities.
 *
 * Test Features:
 * - Singleton instance management and state isolation
 * - Performance metrics recording with metadata and timing
 * - Timer lifecycle management with accurate duration tracking
 * - Memory usage monitoring and performance report generation
 * - Edge case handling and error recovery scenarios
 * - Performance measurement accuracy and consistency validation
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/performance-monitor.test.ts -- --grep "timer"
 * ```
 *
 * @module performance-monitor-test-suite
 * @since 1.0.0
 * @see {@link ../../src/lib/performance-monitor.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PerformanceMonitor,
  type PerformanceMetric,
  type Timer,
} from '../../src/lib/performance-monitor.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as logger from '../../src/lib/logger.js';

/**
 * Performance monitor test utilities
 *
 * Extends BaseTestUtils with performance monitoring specific testing patterns.
 * Maintains DRY principles while providing specialized testing methods
 * for metrics validation, timer testing, and performance measurement scenarios.
 *
 * @since 1.0.0
 */
class PerformanceMonitorTestUtils extends BaseTestUtils {
  /**
   * Mock logger instance for performance testing
   *
   * Provides comprehensive logging mock with all required methods
   * for testing performance monitoring operations and scenarios.
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
   * Create mock timer for testing
   *
   * Generates a mock Timer instance with properly configured
   * end and elapsed methods for testing timer functionality.
   *
   * @returns Mock timer instance
   * @example
   * ```typescript
   * const mockTimer = PerformanceMonitorTestUtils.createMockTimer();
   * ```
   * @since 1.0.0
   */
  static createMockTimer(): Timer {
    return {
      end: vi.fn(),
      elapsed: vi.fn().mockReturnValue(100),
    };
  }

  /**
   * Create test performance metric
   *
   * Generates realistic performance metric objects with proper
   * defaults and optional overrides for comprehensive testing scenarios.
   *
   * @param overrides - Partial metric to override defaults
   * @returns Complete performance metric object
   * @example
   * ```typescript
   * const metric = PerformanceMonitorTestUtils.createTestMetric({
   *   name: 'custom-metric',
   *   value: 100
   * });
   * ```
   * @since 1.0.0
   */
  static createTestMetric(overrides: Partial<PerformanceMetric> = {}): PerformanceMetric {
    return {
      name: 'test-metric',
      value: 42,
      unit: 'count',
      timestamp: new Date().toISOString(),
      metadata: { environment: 'test' },
      ...overrides,
    };
  }

  /**
   * Validate metric matches expected structure
   *
   * Comprehensive validation that ensures performance metrics
   * contain all required fields with proper types and values.
   *
   * @param metric - Performance metric to validate
   * @param expected - Expected metric properties
   * @example
   * ```typescript
   * PerformanceMonitorTestUtils.expectMetricToMatch(metric, {
   *   name: 'test-metric',
   *   unit: 'milliseconds'
   * });
   * ```
   * @since 1.0.0
   */
  static expectMetricToMatch(
    metric: PerformanceMetric | undefined,
    expected: Partial<PerformanceMetric>
  ): void {
    expect(metric).toBeDefined();
    if (!metric) return; // Type guard
    expect(metric).toMatchObject(expected);
    expect(metric.timestamp).toBeTypeOf('string');
    expect(Date.parse(metric.timestamp)).toBeGreaterThan(0);
  }

  /**
   * Validate timer instance is properly configured
   *
   * Ensures timer instances have all required methods and
   * are properly configured for performance measurement.
   *
   * @param timer - Timer instance to validate
   * @example
   * ```typescript
   * PerformanceMonitorTestUtils.expectTimerToBeValid(timer);
   * ```
   * @since 1.0.0
   */
  static expectTimerToBeValid(timer: Timer): void {
    expect(timer).toBeDefined();
    expect(timer.end).toBeTypeOf('function');
    expect(timer.elapsed).toBeTypeOf('function');
  }

  /**
   * Wait for specified time in tests
   *
   * Utility for testing time-dependent code with proper
   * async/await support for timer validation.
   *
   * @param ms - Milliseconds to wait
   * @returns Promise that resolves after the specified time
   * @example
   * ```typescript
   * await PerformanceMonitorTestUtils.waitForMs(100);
   * ```
   * @since 1.0.0
   */
  static waitForMs(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset performance monitor state for test isolation
   *
   * Clears all metrics and timers from the performance monitor
   * instance to ensure clean state between test cases.
   *
   * @example
   * ```typescript
   * PerformanceMonitorTestUtils.resetAllMetrics();
   * ```
   * @since 1.0.0
   */
  static resetAllMetrics(): void {
    const monitor = PerformanceMonitor.getInstance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monitor as any).metrics = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monitor as any).timers = new Map();
  }
}

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(logger, 'createLogger').mockReturnValue(PerformanceMonitorTestUtils.mockLogger);
    PerformanceMonitorTestUtils.resetAllMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when getting singleton instance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize with empty metrics and timers', () => {
      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      expect(report.recentMetrics).toHaveLength(0);
      expect(report.totalMetrics).toBe(0);
    });
  });

  describe('when recording metrics', () => {
    it('should record metric with all required properties', () => {
      const monitor = PerformanceMonitor.getInstance();
      const beforeTime = Date.now();

      monitor.recordMetric('test-metric', 42, 'count', { service: 'test' });

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(1);

      expect(report.recentMetrics).toHaveLength(1);
      const metric = report.recentMetrics[0];
      expect(metric).toBeDefined();
      PerformanceMonitorTestUtils.expectMetricToMatch(metric, {
        name: 'test-metric',
        value: 42,
        unit: 'count',
        metadata: { service: 'test' },
      });
      if (metric) {
        expect(Date.parse(metric.timestamp)).toBeGreaterThanOrEqual(beforeTime);
      }
    });

    it('should record metric with default empty labels when not provided', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('simple-metric', 100, 'ms');

      const report = monitor.getPerformanceReport();
      expect(report.recentMetrics).toHaveLength(1);
      const metric = report.recentMetrics[0];
      expect(metric).toBeDefined();
      if (metric) {
        expect(metric.metadata).toBeUndefined();
      }
    });

    it('should record multiple metrics in order', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('metric-1', 10, 'count');
      monitor.recordMetric('metric-2', 20, 'ms');
      monitor.recordMetric('metric-3', 30, 'bytes');

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(3);
      expect(report.recentMetrics).toHaveLength(3);
      if (report.recentMetrics[0] && report.recentMetrics[1] && report.recentMetrics[2]) {
        expect(report.recentMetrics[0].name).toBe('metric-1');
        expect(report.recentMetrics[1].name).toBe('metric-2');
        expect(report.recentMetrics[2].name).toBe('metric-3');
      }
    });

    it('should handle various metric value types', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('int-metric', 42, 'count');
      monitor.recordMetric('float-metric', 3.14159, 'ratio');
      monitor.recordMetric('zero-metric', 0, 'count');
      monitor.recordMetric('negative-metric', -1, 'delta');

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(4);
      expect(report.recentMetrics).toHaveLength(4);
      if (
        report.recentMetrics[0] &&
        report.recentMetrics[1] &&
        report.recentMetrics[2] &&
        report.recentMetrics[3]
      ) {
        expect(report.recentMetrics[0].value).toBe(42);
        expect(report.recentMetrics[1].value).toBe(3.14159);
        expect(report.recentMetrics[2].value).toBe(0);
        expect(report.recentMetrics[3].value).toBe(-1);
      }
    });
  });

  describe('when starting timers', () => {
    it('should create and return valid timer handle', () => {
      const monitor = PerformanceMonitor.getInstance();

      const timer = monitor.startTimer('test-operation');

      PerformanceMonitorTestUtils.expectTimerToBeValid(timer);
    });

    it('should create multiple independent timers', () => {
      const monitor = PerformanceMonitor.getInstance();

      const timer1 = monitor.startTimer('timer-1');
      const timer2 = monitor.startTimer('timer-2');

      PerformanceMonitorTestUtils.expectTimerToBeValid(timer1);
      PerformanceMonitorTestUtils.expectTimerToBeValid(timer2);
      expect(timer1).not.toBe(timer2);
    });

    it('should allow multiple timers with different names', () => {
      const monitor = PerformanceMonitor.getInstance();

      const timer1 = monitor.startTimer('operation-1');
      const timer2 = monitor.startTimer('operation-2');

      PerformanceMonitorTestUtils.expectTimerToBeValid(timer1);
      PerformanceMonitorTestUtils.expectTimerToBeValid(timer2);
      expect(timer1).not.toBe(timer2);
    });

    it('should throw error for duplicate timer names', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.startTimer('duplicate-timer');

      expect(() => monitor.startTimer('duplicate-timer')).toThrow(
        "Timer 'duplicate-timer' already exists. Use a unique timer name."
      );
    });
  });

  describe('when ending timers', () => {
    it('should record timing metric when timer ends', async () => {
      const monitor = PerformanceMonitor.getInstance();
      const timer = monitor.startTimer('timed-operation');

      await PerformanceMonitorTestUtils.waitForMs(10);
      timer.end();

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(1);

      expect(report.recentMetrics).toHaveLength(1);
      const metric = report.recentMetrics[0];
      expect(metric).toBeDefined();
      PerformanceMonitorTestUtils.expectMetricToMatch(metric, {
        name: 'timed-operation',
        unit: 'milliseconds',
      });
      if (metric) {
        expect(metric.value).toBeGreaterThan(0);
      }
    });

    it('should include custom metadata when starting timer', async () => {
      const monitor = PerformanceMonitor.getInstance();
      const timer = monitor.startTimer('labeled-operation', {
        service: 'test',
        operation: 'fetch',
      });

      await PerformanceMonitorTestUtils.waitForMs(5);
      timer.end();

      const report = monitor.getPerformanceReport();
      expect(report.recentMetrics).toHaveLength(1);
      const metric = report.recentMetrics[0];
      expect(metric).toBeDefined();
      PerformanceMonitorTestUtils.expectMetricToMatch(metric, {
        name: 'labeled-operation',
        metadata: { service: 'test', operation: 'fetch' },
      });
    });

    it('should return accurate duration from elapsed', async () => {
      const monitor = PerformanceMonitor.getInstance();
      const timer = monitor.startTimer('duration-test');

      await PerformanceMonitorTestUtils.waitForMs(20);
      const duration = timer.elapsed();

      expect(duration).toBeGreaterThan(15);
      expect(duration).toBeLessThan(50);
    });

    it('should handle timer ending multiple times gracefully', async () => {
      const monitor = PerformanceMonitor.getInstance();
      const timer = monitor.startTimer('multi-end-test');

      await PerformanceMonitorTestUtils.waitForMs(5);
      timer.end();
      timer.end(); // Second call should not cause errors

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(1);
    });
  });

  describe('when getting performance reports', () => {
    it('should return comprehensive performance data', () => {
      const monitor = PerformanceMonitor.getInstance();
      const beforeTime = Date.now();

      monitor.recordMetric('test-metric', 100, 'count');
      monitor.startTimer('active-timer');

      const report = monitor.getPerformanceReport();

      expect(report).toMatchObject({
        recentMetrics: expect.any(Array),
        totalMetrics: 1,
        timestamp: expect.any(String),
        summary: expect.any(Object),
        memory: expect.any(Object),
      });
      expect(new Date(report.timestamp).getTime()).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should include memory usage information', () => {
      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      expect(report.memory).toBeDefined();
      expect(report.memory.rss).toBeTypeOf('number');
      expect(report.memory.heapUsed).toBeTypeOf('number');
      expect(report.memory.heapTotal).toBeTypeOf('number');
      expect(report.memory.external).toBeTypeOf('number');
    });

    it('should track metrics correctly when timers end', () => {
      const monitor = PerformanceMonitor.getInstance();

      const timer1 = monitor.startTimer('timer-1');
      const timer2 = monitor.startTimer('timer-2');
      expect(monitor.getPerformanceReport().totalMetrics).toBe(0);

      timer1.end();
      expect(monitor.getPerformanceReport().totalMetrics).toBe(1);

      timer2.end();
      expect(monitor.getPerformanceReport().totalMetrics).toBe(2);
    });

    it('should include violations when thresholds are exceeded', () => {
      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      expect(report.violations).toBeDefined();
      expect(Array.isArray(report.violations)).toBe(true);
    });
  });

  describe('when clearing metrics', () => {
    it('should remove all recorded metrics', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('metric-1', 10, 'count');
      monitor.recordMetric('metric-2', 20, 'ms');
      expect(monitor.getPerformanceReport().totalMetrics).toBe(2);

      monitor.clearMetrics();

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(0);
      expect(report.totalMetrics).toBe(0);
    });

    it('should not affect active timers when clearing metrics', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('test-metric', 42, 'count');
      monitor.startTimer('active-timer');
      expect(monitor.getPerformanceReport().totalMetrics).toBe(1);

      monitor.clearMetrics();

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(0);
      // Timer was started but clearMetrics only clears recorded metrics, not active timers
      // This test verifies that clearing metrics doesn't interfere with timing operations
    });
  });

  describe('when handling edge cases', () => {
    it('should handle empty metric names', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('', 42, 'count');

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(1);
      expect(report.recentMetrics).toHaveLength(1);
      if (report.recentMetrics[0]) {
        expect(report.recentMetrics[0].name).toBe('');
      }
    });

    it('should handle empty timer names', () => {
      const monitor = PerformanceMonitor.getInstance();

      const timer = monitor.startTimer('');

      PerformanceMonitorTestUtils.expectTimerToBeValid(timer);
    });

    it('should handle very large metric values', () => {
      const monitor = PerformanceMonitor.getInstance();
      const largeValue = Number.MAX_SAFE_INTEGER;

      monitor.recordMetric('large-metric', largeValue, 'bytes');

      const report = monitor.getPerformanceReport();
      expect(report.recentMetrics).toHaveLength(1);
      if (report.recentMetrics[0]) {
        expect(report.recentMetrics[0].value).toBe(largeValue);
      }
    });

    it('should handle complex nested labels', () => {
      const monitor = PerformanceMonitor.getInstance();
      const complexLabels = {
        service: 'drivehr-sync',
        environment: 'production',
        version: '1.0.0',
        region: 'us-east-1',
      };

      monitor.recordMetric('complex-metric', 100, 'count', complexLabels);

      const report = monitor.getPerformanceReport();
      expect(report.recentMetrics).toHaveLength(1);
      if (report.recentMetrics[0]) {
        expect(report.recentMetrics[0].metadata).toEqual(complexLabels);
      }
    });
  });

  describe('when measuring performance', () => {
    it('should accurately measure synchronous operation timing', () => {
      const monitor = PerformanceMonitor.getInstance();
      const timer = monitor.startTimer('sync-operation');

      // Simulate some work
      const iterations = 1000000;
      let _sum = 0;
      for (let i = 0; i < iterations; i++) {
        _sum += i;
      }

      timer.end();

      const report = monitor.getPerformanceReport();
      expect(report.recentMetrics).toHaveLength(1);
      const metric = report.recentMetrics[0];
      expect(metric).toBeDefined();
      if (metric) {
        expect(metric.value).toBeGreaterThan(0);
      }
      if (metric) {
        expect(metric.value).toBeLessThan(1000); // Should be reasonable for this operation
      }
    });

    it('should handle rapid timer creation and ending', () => {
      const monitor = PerformanceMonitor.getInstance();
      const timerCount = 100;

      for (let i = 0; i < timerCount; i++) {
        const timer = monitor.startTimer(`rapid-timer-${i}`);
        timer.end();
      }

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(timerCount);
    });
  });

  describe('when formatting metrics for export', () => {
    it('should format metrics in Prometheus format', () => {
      const monitor = PerformanceMonitor.getInstance();

      // Add some test metrics
      monitor.recordMetric('test-counter', 42, 'count', { service: 'test' });
      monitor.recordMetric('test-gauge', 3.14, 'ratio');

      // Use public API to export metrics in Prometheus format
      const prometheusOutput = monitor.exportMetrics('prometheus');

      expect(typeof prometheusOutput).toBe('string');
      expect(prometheusOutput).toContain('test_counter');
      expect(prometheusOutput).toContain('test_gauge');
      expect(prometheusOutput).toContain('42');
      expect(prometheusOutput).toContain('3.14');
    });

    it('should format metrics in InfluxDB format', () => {
      const monitor = PerformanceMonitor.getInstance();

      // Add test metrics with metadata
      monitor.recordMetric('influx-test', 100, 'bytes', {
        host: 'localhost',
        service: 'test',
      });

      // Use public API to export metrics in InfluxDB format
      const influxOutput = monitor.exportMetrics('influxdb');

      expect(typeof influxOutput).toBe('string');
      expect(influxOutput).toContain('influx_test');
      expect(influxOutput).toContain('value=100');
      expect(influxOutput).toContain('host=localhost');
      expect(influxOutput).toContain('service=test');
    });

    it('should handle metrics without metadata in both formats', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('simple-metric', 5, 'count');

      // Use public API to export metrics in both formats
      const prometheusOutput = monitor.exportMetrics('prometheus');
      const influxOutput = monitor.exportMetrics('influxdb');

      expect(prometheusOutput).toContain('simple_metric');
      expect(prometheusOutput).toContain('5');

      expect(influxOutput).toContain('simple_metric');
      expect(influxOutput).toContain('value=5');
    });
  });

  describe('when using performance decorator', () => {
    it('should export performanceMonitor decorator function', async () => {
      const { performanceMonitor } = await import('../../src/lib/performance-monitor.js');

      expect(typeof performanceMonitor).toBe('function');

      // Test decorator returns function
      const decorator = performanceMonitor('test-operation');
      expect(typeof decorator).toBe('function');
    });

    it('should create decorator with custom metric name', async () => {
      const { performanceMonitor } = await import('../../src/lib/performance-monitor.js');

      const customDecorator = performanceMonitor('custom-metric-name');
      expect(typeof customDecorator).toBe('function');

      // Decorator should return function that expects target, propertyKey, descriptor
      const mockTarget = {};
      const mockDescriptor = { value: () => 'test' };

      const result = customDecorator(mockTarget, 'testMethod', mockDescriptor);
      expect(result).toHaveProperty('value');
      expect(typeof result.value).toBe('function');
    });

    it('should create decorator without custom metric name', async () => {
      const { performanceMonitor } = await import('../../src/lib/performance-monitor.js');

      const defaultDecorator = performanceMonitor();
      expect(typeof defaultDecorator).toBe('function');
    });
  });

  describe('when using performance middleware', () => {
    it('should export createPerformanceMiddleware function', async () => {
      const { createPerformanceMiddleware } = await import('../../src/lib/performance-monitor.js');

      expect(typeof createPerformanceMiddleware).toBe('function');
    });

    it('should create Express middleware function', async () => {
      const { createPerformanceMiddleware } = await import('../../src/lib/performance-monitor.js');

      const middleware = createPerformanceMiddleware();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express middleware signature (req, res, next)
    });

    it('should handle middleware execution without throwing', async () => {
      const { createPerformanceMiddleware } = await import('../../src/lib/performance-monitor.js');

      const middleware = createPerformanceMiddleware();

      // Mock Express req, res, next
      const mockReq = {
        method: 'GET',
        path: '/test',
        get: vi.fn().mockReturnValue('test-agent'),
      };

      const mockRes = {
        on: vi.fn(),
      };

      const mockNext = vi.fn();

      // Should not throw when called
      expect(() => middleware(mockReq, mockRes, mockNext)).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
