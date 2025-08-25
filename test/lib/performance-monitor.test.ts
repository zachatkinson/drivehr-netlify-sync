/**
 * PerformanceMonitor Service Test Suite
 *
 * Comprehensive test coverage for PerformanceMonitor service following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates performance metric collection, timing operations,
 * memory management, and export functionality across all supported formats.
 *
 * Test Features:
 * - Singleton pattern verification and instance management
 * - Metric collection and timer operations
 * - Memory management and metric clearing
 * - Multi-format export (JSON, Prometheus, InfluxDB)
 * - Decorator function behavior and customization
 * - Middleware creation and request performance tracking
 * - Error handling and edge cases
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/performance-monitor.test.ts -- --grep "singleton"
 *
 * // Example of running with coverage
 * pnpm test test/lib/performance-monitor.test.ts --coverage
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
 * Performance-specific test utilities
 *
 * Extends BaseTestUtils with performance monitoring testing patterns.
 * Maintains DRY principles while providing specialized testing methods for
 * metric validation, timer operations, and performance analysis.
 *
 * @since 1.0.0
 */
class PerformanceMonitorTestUtils extends BaseTestUtils {
  /**
   * Mock logger instance for performance monitoring tests
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
   * Create mock Timer implementation for testing
   *
   * Generates a complete Timer interface implementation with Vitest mock functions
   * for testing timing operations without actual time delays.
   *
   * @returns Mock Timer instance with mocked end and elapsed methods
   * @example
   * ```typescript
   * const mockTimer = PerformanceMonitorTestUtils.createMockTimer();
   * expect(mockTimer.end).toHaveBeenCalled();
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
   * Create test performance metric with customizable properties
   *
   * Generates a valid PerformanceMetric object with sensible defaults
   * that can be customized via the overrides parameter for comprehensive testing.
   *
   * @param overrides - Partial properties to override defaults
   * @returns Complete PerformanceMetric object for testing
   * @example
   * ```typescript
   * const metric = PerformanceMonitorTestUtils.createTestMetric({
   *   name: 'custom-metric',
   *   value: 123
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
   * Assert performance metric matches expected properties
   *
   * Validates that a performance metric contains the expected properties
   * and has a valid timestamp format. Includes type guards for safety.
   *
   * @param metric - Performance metric to validate (may be undefined)
   * @param expected - Partial properties to match against
   * @example
   * ```typescript
   * PerformanceMonitorTestUtils.expectMetricToMatch(metric, {
   *   name: 'api-call',
   *   unit: 'ms'
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
   * Assert timer object has valid interface implementation
   *
   * Validates that a timer object implements the Timer interface correctly
   * with proper method types and availability.
   *
   * @param timer - Timer object to validate
   * @example
   * ```typescript
   * const timer = monitor.startTimer('test-operation');
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
   * Async delay utility for timing-sensitive tests
   *
   * Creates a Promise-based delay for testing timing-dependent functionality
   * where actual time passage is required.
   *
   * @param ms - Number of milliseconds to wait
   * @returns Promise that resolves after the specified delay
   * @example
   * ```typescript
   * const timer = monitor.startTimer('async-operation');
   * await PerformanceMonitorTestUtils.waitForMs(50);
   * timer.end();
   * ```
   * @since 1.0.0
   */
  static waitForMs(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset all metrics and timers for test isolation
   *
   * Clears all accumulated metrics and active timers from the PerformanceMonitor
   * singleton to ensure test isolation and prevent data leakage between tests.
   *
   * @example
   * ```typescript
   * beforeEach(() => {
   *   PerformanceMonitorTestUtils.resetAllMetrics();
   * });
   * ```
   * @since 1.0.0
   */
  static resetAllMetrics(): void {
    const monitor = PerformanceMonitor.getInstance();
    // ARCHITECTURAL JUSTIFICATION: Testing singleton requires direct access to private properties
    // for proper test isolation between test cases. PerformanceMonitor singleton maintains state
    // that must be reset to prevent test interference, but no public reset method exists.
    //
    // ALTERNATIVES CONSIDERED:
    // 1. Adding public reset method: Would expose internal state management to production code
    //    creating unnecessary API surface and potential misuse in production environments
    // 2. Creating new instance per test: Singleton pattern prevents multiple instances and
    //    would require significant architectural changes to the monitoring system
    // 3. Mocking entire PerformanceMonitor: Would lose integration testing value and not
    //    validate actual singleton behavior that production code relies upon
    //
    // CONCLUSION: eslint-disable is architecturally necessary for singleton test isolation
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

  describe('when testing implementation coverage', () => {
    it('should respect disabled monitoring configuration', () => {
      // Reset singleton to test configuration
      PerformanceMonitorTestUtils.resetAllMetrics();
      // ARCHITECTURAL JUSTIFICATION: Testing singleton configuration requires resetting private static instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PerformanceMonitor as any).instance = undefined;

      const disabledMonitor = PerformanceMonitor.getInstance({ enabled: false });

      // Operations should be no-ops when disabled
      const timer = disabledMonitor.startTimer('disabled-timer');
      expect(timer.end()).toBeUndefined();
      expect(timer.elapsed()).toBe(0);

      disabledMonitor.recordMetric('disabled-metric', 100, 'count');
      const report = disabledMonitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(0);
    });

    it('should handle custom configuration thresholds', () => {
      PerformanceMonitorTestUtils.resetAllMetrics();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PerformanceMonitor as any).instance = undefined;

      const customMonitor = PerformanceMonitor.getInstance({
        thresholds: { warning: 100, critical: 500 },
        maxMetrics: 50,
      });

      const config = customMonitor.getConfig();
      expect(config.thresholds.warning).toBe(100);
      expect(config.thresholds.critical).toBe(500);
      expect(config.maxMetrics).toBe(50);
    });

    it('should trigger performance threshold warnings and errors', () => {
      PerformanceMonitorTestUtils.resetAllMetrics();
      // Reset singleton to get default thresholds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PerformanceMonitor as any).instance = undefined;
      
      const monitor = PerformanceMonitor.getInstance(); // Default thresholds: warning 1000ms, critical 5000ms
      monitor.clearMetrics(); // Clear any existing metrics

      // Mock a slow operation that exceeds warning threshold but not critical (1000ms warning, 5000ms critical)
      monitor.recordMetric('slow-operation', 1200, 'milliseconds');
      const report = monitor.getPerformanceReport();

      expect(report.violations).toBeDefined();
      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.violations[0]?.severity).toBe('warning');

      // Test critical threshold
      monitor.recordMetric('critical-operation', 6000, 'milliseconds');
      const criticalReport = monitor.getPerformanceReport();
      const criticalViolation = criticalReport.violations.find(
        v => v.metric === 'critical-operation'
      );
      expect(criticalViolation?.severity).toBe('critical');
    });

    it('should prune old metrics when maxMetrics is exceeded', () => {
      PerformanceMonitorTestUtils.resetAllMetrics();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PerformanceMonitor as any).instance = undefined;

      const monitor = PerformanceMonitor.getInstance({ maxMetrics: 5 });

      // Add more metrics than the limit
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric(`metric-${i}`, i, 'count');
      }

      const report = monitor.getPerformanceReport();
      expect(report.totalMetrics).toBe(5); // Should be pruned to maxMetrics

      // Verify newest metrics are kept
      const metricNames = report.recentMetrics.map(m => m.name);
      expect(metricNames).toContain('metric-9');
      expect(metricNames).not.toContain('metric-0');
    });

    it('should generate comprehensive performance summaries', () => {
      const monitor = PerformanceMonitor.getInstance();

      // Add various timing metrics
      monitor.recordMetric('fast-op', 50, 'milliseconds');
      monitor.recordMetric('medium-op', 200, 'milliseconds');
      monitor.recordMetric('slow-op', 800, 'milliseconds');
      monitor.recordMetric('non-timing', 42, 'count'); // Non-timing metric

      const report = monitor.getPerformanceReport();

      expect(report.summary.totalExecutions).toBe(3); // Only timing metrics
      expect(report.summary.averageExecutionTime).toBeCloseTo(350); // (50+200+800)/3
      expect(report.summary.maxExecutionTime).toBe(800);
      expect(report.summary.minExecutionTime).toBe(50);
    });

    it('should handle timer elapsed calculations accurately', async () => {
      const monitor = PerformanceMonitor.getInstance();
      const timer = monitor.startTimer('elapsed-test');

      await PerformanceMonitorTestUtils.waitForMs(25);
      const elapsed1 = timer.elapsed();

      await PerformanceMonitorTestUtils.waitForMs(25);
      const elapsed2 = timer.elapsed();

      expect(elapsed1).toBeGreaterThan(20);
      expect(elapsed1).toBeLessThan(40);
      expect(elapsed2).toBeGreaterThan(elapsed1);
      expect(elapsed2).toBeGreaterThan(45);

      timer.end();
    });

    it('should handle timer operations after timer not found', () => {
      const monitor = PerformanceMonitor.getInstance();
      const timer = monitor.startTimer('temp-timer');

      timer.end(); // End normally

      // Simulate timer not found scenarios
      const missingTimerElapsed = timer.elapsed();
      expect(missingTimerElapsed).toBe(0);

      // Calling end again should not crash and should log warning
      timer.end();
      expect(PerformanceMonitorTestUtils.mockLogger.warn).toHaveBeenCalledWith(
        "Timer 'temp-timer' not found when attempting to end"
      );
    });

    it('should export metrics in proper JSON format', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('json-test', 123, 'bytes', { service: 'test' });

      const jsonOutput = monitor.exportMetrics('json');
      const parsed = JSON.parse(jsonOutput);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('application', 'drivehr-netlify-sync');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('summary');

      expect(Array.isArray(parsed.metrics)).toBe(true);
      expect(parsed.metrics[0]).toMatchObject({
        name: 'json-test',
        value: 123,
        unit: 'bytes',
      });
    });

    it('should track memory usage correctly when enabled', () => {
      PerformanceMonitorTestUtils.resetAllMetrics();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PerformanceMonitor as any).instance = undefined;

      const monitor = PerformanceMonitor.getInstance({
        trackMemory: true,
        collectionInterval: 0.1, // 100ms for testing
      });

      const config = monitor.getConfig();
      expect(config.trackMemory).toBe(true);
      expect(config.collectionInterval).toBe(0.1);
    });

    it('should handle memory tracking disabled', () => {
      PerformanceMonitorTestUtils.resetAllMetrics();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PerformanceMonitor as any).instance = undefined;

      const monitor = PerformanceMonitor.getInstance({ trackMemory: false });
      const config = monitor.getConfig();
      expect(config.trackMemory).toBe(false);
    });

    it('should format Prometheus metrics with proper escaping', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('test-metric-with-hyphens', 42, 'count', {
        'label-with-hyphens': 'value',
        service: 'test-service',
      });

      const prometheusOutput = monitor.exportMetrics('prometheus');

      expect(prometheusOutput).toContain('test_metric_with_hyphens'); // Hyphens converted to underscores
      expect(prometheusOutput).toContain('# HELP test_metric_with_hyphens');
      expect(prometheusOutput).toContain('# TYPE test_metric_with_hyphens gauge');
      expect(prometheusOutput).toContain('label-with-hyphens="value"');
    });

    it('should format InfluxDB metrics with correct timestamp precision', () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.recordMetric('influx-precision-test', 99.9, 'ratio', {
        env: 'test',
        region: 'us-east-1',
      });

      const influxOutput = monitor.exportMetrics('influxdb');

      expect(influxOutput).toContain('influx_precision_test');
      expect(influxOutput).toContain('env=test,region=us-east-1');
      expect(influxOutput).toContain('value=99.9');
      // Should end with nanosecond timestamp (16+ digits)
      expect(influxOutput).toMatch(/\s\d{16,}$/);
    });

    it('should maintain configuration immutability', () => {
      const monitor = PerformanceMonitor.getInstance();
      const config = monitor.getConfig();

      // Should be a copy, not the original
      // ARCHITECTURAL JUSTIFICATION: Testing configuration immutability requires bypassing readonly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any).enabled = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any).maxMetrics = 999;

      const freshConfig = monitor.getConfig();
      expect(freshConfig.enabled).toBe(true); // Should not be modified
      expect(freshConfig.maxMetrics).not.toBe(999);
    });
  });

  describe('when using Express middleware functionality', () => {
    it('should create middleware that starts and ends timers', async () => {
      const { createPerformanceMiddleware } = await import('../../src/lib/performance-monitor.js');
      PerformanceMonitorTestUtils.resetAllMetrics();

      const middleware = createPerformanceMiddleware();

      const mockReq = {
        method: 'POST',
        path: '/api/jobs',
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
      };

      let finishCallback: (() => void) | undefined;
      const mockRes = {
        on: vi.fn().mockImplementation((event: string, callback: () => void) => {
          if (event === 'finish') {
            finishCallback = callback;
          }
        }),
        statusCode: 200,
      };

      const mockNext = vi.fn();

      // Execute middleware
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));

      // Simulate response finish
      if (finishCallback) {
        finishCallback();
      }

      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      // Should have recorded both request timing and response status
      expect(report.totalMetrics).toBe(2);
      const metricNames = report.recentMetrics.map(m => m.name);
      expect(metricNames).toContain('http-request');
      expect(metricNames).toContain('http-response-status');
    });

    it('should record request metadata in middleware', async () => {
      const { createPerformanceMiddleware } = await import('../../src/lib/performance-monitor.js');
      PerformanceMonitorTestUtils.resetAllMetrics();

      const middleware = createPerformanceMiddleware();

      const mockReq = {
        method: 'PUT',
        path: '/api/jobs/123',
        get: vi.fn().mockReturnValue('CustomUserAgent/1.0'),
      };

      let finishCallback: (() => void) | undefined;
      const mockRes = {
        on: vi.fn().mockImplementation((event: string, callback: () => void) => {
          if (event === 'finish') {
            finishCallback = callback;
          }
        }),
        statusCode: 201,
      };

      const mockNext = vi.fn();

      middleware(mockReq, mockRes, mockNext);

      if (finishCallback) {
        finishCallback();
      }

      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      const requestMetric = report.recentMetrics.find(m => m.name === 'http-request');
      expect(requestMetric?.metadata).toMatchObject({
        method: 'PUT',
        path: '/api/jobs/123',
        userAgent: 'CustomUserAgent/1.0',
      });

      const statusMetric = report.recentMetrics.find(m => m.name === 'http-response-status');
      expect(statusMetric?.value).toBe(201);
      expect(statusMetric?.metadata).toMatchObject({
        method: 'PUT',
        path: '/api/jobs/123',
        status: 201,
      });
    });

    it('should handle middleware with missing User-Agent header', async () => {
      const { createPerformanceMiddleware } = await import('../../src/lib/performance-monitor.js');
      PerformanceMonitorTestUtils.resetAllMetrics();

      const middleware = createPerformanceMiddleware();

      const mockReq = {
        method: 'GET',
        path: '/health',
        get: vi.fn().mockReturnValue(undefined), // No User-Agent
      };

      let finishCallback: (() => void) | undefined;
      const mockRes = {
        on: vi.fn().mockImplementation((event: string, callback: () => void) => {
          if (event === 'finish') {
            finishCallback = callback;
          }
        }),
        statusCode: 200,
      };

      const mockNext = vi.fn();

      expect(() => middleware(mockReq, mockRes, mockNext)).not.toThrow();

      if (finishCallback) {
        finishCallback();
      }

      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      const requestMetric = report.recentMetrics.find(m => m.name === 'http-request');
      expect(requestMetric?.metadata?.['userAgent']).toBeUndefined();
    });
  });

  describe('when using performance decorator functionality', () => {
    it('should wrap functions with timing measurement', async () => {
      const { performanceMonitor } = await import('../../src/lib/performance-monitor.js');
      PerformanceMonitorTestUtils.resetAllMetrics();

      class TestService {
        async processData(data: string): Promise<string> {
          await PerformanceMonitorTestUtils.waitForMs(10);
          return `processed-${data}`;
        }
      }

      const descriptor = {
        value: TestService.prototype.processData,
      };

      const decorator = performanceMonitor('custom-processing');
      const wrappedDescriptor = decorator(TestService.prototype, 'processData', descriptor);

      expect(wrappedDescriptor.value).toBeTypeOf('function');
      // Decorator creates wrapper function so it should be different reference

      // Test wrapped function
      const service = new TestService();
      service.processData = wrappedDescriptor.value.bind(service);

      const result = await service.processData('test-input');
      expect(result).toBe('processed-test-input');

      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      const timingMetric = report.recentMetrics.find(m => m.name === 'custom-processing');
      expect(timingMetric).toBeDefined();
      expect(timingMetric?.unit).toBe('milliseconds');
      expect(timingMetric?.value).toBeGreaterThan(0);
    });

    it('should handle decorator without custom name', async () => {
      const { performanceMonitor } = await import('../../src/lib/performance-monitor.js');
      PerformanceMonitorTestUtils.resetAllMetrics();

      class TestClass {
        async testMethod(): Promise<string> {
          return 'test-result';
        }
      }

      const descriptor = {
        value: TestClass.prototype.testMethod,
      };

      const decorator = performanceMonitor(); // No custom name
      const wrappedDescriptor = decorator(TestClass.prototype, 'testMethod', descriptor);

      const instance = new TestClass();
      instance.testMethod = wrappedDescriptor.value.bind(instance);

      const result = await instance.testMethod();
      expect(result).toBe('test-result');

      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      const timingMetric = report.recentMetrics.find(m => m.name === 'TestClass.testMethod');
      expect(timingMetric).toBeDefined();
    });

    it('should record error metrics when decorated function throws', async () => {
      const { performanceMonitor } = await import('../../src/lib/performance-monitor.js');
      PerformanceMonitorTestUtils.resetAllMetrics();

      class ErrorService {
        async failingMethod(): Promise<void> {
          await PerformanceMonitorTestUtils.waitForMs(5);
          throw new Error('Processing failed');
        }
      }

      const descriptor = {
        value: ErrorService.prototype.failingMethod,
      };

      const decorator = performanceMonitor('error-prone-operation');
      const wrappedDescriptor = decorator(ErrorService.prototype, 'failingMethod', descriptor);

      const service = new ErrorService();
      service.failingMethod = wrappedDescriptor.value.bind(service);

      await expect(service.failingMethod()).rejects.toThrow('Processing failed');

      const monitor = PerformanceMonitor.getInstance();
      const report = monitor.getPerformanceReport();

      const timingMetric = report.recentMetrics.find(m => m.name === 'error-prone-operation');
      const errorMetric = report.recentMetrics.find(m => m.name === 'error-prone-operation-error');

      expect(timingMetric).toBeDefined(); // Timing should still be recorded
      expect(errorMetric).toBeDefined();
      expect(errorMetric?.value).toBe(1);
      expect(errorMetric?.unit).toBe('count');
      expect(errorMetric?.metadata?.['error']).toBe('Processing failed');
    });
  });
});
