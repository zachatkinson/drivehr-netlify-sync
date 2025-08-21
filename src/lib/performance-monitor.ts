/**
 * Performance Monitoring and Metrics Collection
 *
 * Enterprise-grade performance monitoring system that provides comprehensive
 * metrics collection, timing analysis, and operational insights for the DriveHR
 * sync application. Implements structured logging, metric aggregation, and
 * performance alerting capabilities.
 *
 * Key Features:
 * - Function execution timing with high precision
 * - Memory usage tracking and leak detection
 * - HTTP request performance metrics
 * - Custom business metric collection
 * - Structured metric export for monitoring systems
 * - Performance threshold alerting
 * - Resource utilization monitoring
 *
 * @example
 * ```typescript
 * const monitor = PerformanceMonitor.getInstance();
 *
 * // Time a function execution
 * const timer = monitor.startTimer('job-fetch-operation');
 * await fetchJobs();
 * timer.end();
 *
 * // Track custom metrics
 * monitor.recordMetric('jobs-processed', 45, 'count');
 * monitor.recordMetric('sync-duration', 2.5, 'seconds');
 *
 * // Get performance report
 * const report = monitor.getPerformanceReport();
 * console.log(report);
 * ```
 *
 * @module performance-monitor
 * @since 1.0.0
 * @see {@link ../../CLAUDE.md} for enterprise monitoring standards
 */

import { createLogger } from './logger.js';

/**
 * Performance metric data structure
 *
 * Standardized metric format that captures performance data with
 * timestamps, values, and contextual metadata for analysis.
 *
 * @since 1.0.0
 */
export interface PerformanceMetric {
  /** Unique identifier for the metric */
  readonly name: string;
  /** Numeric value of the metric */
  readonly value: number;
  /** Unit of measurement for the metric */
  readonly unit: string;
  /** ISO timestamp when metric was recorded */
  readonly timestamp: string;
  /** Optional contextual metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Timer instance for measuring execution duration
 *
 * Provides high-precision timing measurements with automatic
 * metric recording and performance threshold monitoring.
 *
 * @since 1.0.0
 */
export interface Timer {
  /** End the timer and record the metric */
  end(): void;
  /** Get elapsed time without ending the timer */
  elapsed(): number;
}

/**
 * Performance monitoring configuration
 *
 * Controls performance monitoring behavior, thresholds,
 * and metric collection preferences.
 *
 * @since 1.0.0
 */
export interface PerformanceConfig {
  /** Enable/disable performance monitoring */
  readonly enabled: boolean;
  /** Log level for performance events */
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  /** Maximum number of metrics to retain in memory */
  readonly maxMetrics: number;
  /** Performance threshold warnings (in milliseconds) */
  readonly thresholds: {
    readonly warning: number;
    readonly critical: number;
  };
  /** Enable memory usage tracking */
  readonly trackMemory: boolean;
  /** Metric collection interval (in seconds) */
  readonly collectionInterval: number;
}

/**
 * Performance report summary
 *
 * Comprehensive performance analysis including timing statistics,
 * resource utilization, and performance trend analysis.
 *
 * @since 1.0.0
 */
export interface PerformanceReport {
  /** Report generation timestamp */
  readonly timestamp: string;
  /** Total metrics collected */
  readonly totalMetrics: number;
  /** Performance summary statistics */
  readonly summary: {
    readonly averageExecutionTime: number;
    readonly maxExecutionTime: number;
    readonly minExecutionTime: number;
    readonly totalExecutions: number;
  };
  /** Memory usage statistics */
  readonly memory: {
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
    readonly rss: number;
  };
  /** Recent performance metrics */
  readonly recentMetrics: readonly PerformanceMetric[];
  /** Performance threshold violations */
  readonly violations: readonly {
    readonly metric: string;
    readonly value: number;
    readonly threshold: number;
    readonly severity: 'warning' | 'critical';
  }[];
}

/**
 * Enterprise Performance Monitoring System
 *
 * Singleton performance monitoring service that provides comprehensive
 * metrics collection, timing analysis, and performance insights for
 * production applications. Implements enterprise-grade monitoring
 * patterns with structured logging and alerting capabilities.
 *
 * @since 1.0.0
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor | undefined;
  private readonly logger = createLogger('debug');
  private readonly metrics: PerformanceMetric[] = [];
  private readonly timers = new Map<string, { start: number; name: string }>();
  private readonly config: PerformanceConfig;

  /**
   * Create performance monitor instance
   *
   * Private constructor implementing singleton pattern to ensure
   * single point of performance monitoring across the application.
   *
   * @param config - Performance monitoring configuration
   * @since 1.0.0
   */
  private constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      enabled: true,
      logLevel: 'info',
      maxMetrics: 1000,
      thresholds: {
        warning: 1000, // 1 second
        critical: 5000, // 5 seconds
      },
      trackMemory: true,
      collectionInterval: 60, // 60 seconds
      ...config,
    };

    if (this.config.enabled) {
      this.startMemoryTracking();
      this.logger.info('Performance monitoring initialized', {
        config: this.config,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get singleton performance monitor instance
   *
   * Returns the single instance of the performance monitor,
   * creating it if it doesn't exist. Ensures consistent
   * monitoring across the entire application.
   *
   * @param config - Optional configuration for first-time initialization
   * @returns Performance monitor singleton instance
   * @example
   * ```typescript
   * const monitor = PerformanceMonitor.getInstance();
   * const timer = monitor.startTimer('api-call');
   * await apiCall();
   * timer.end();
   * ```
   * @since 1.0.0
   */
  static getInstance(config?: Partial<PerformanceConfig>): PerformanceMonitor {
    PerformanceMonitor.instance ??= new PerformanceMonitor(config);
    return PerformanceMonitor.instance;
  }

  /**
   * Start high-precision timer for operation measurement
   *
   * Creates a timer instance for measuring execution duration
   * with nanosecond precision. Automatically records metrics
   * when timer is ended and checks performance thresholds.
   *
   * @param name - Unique identifier for the operation being timed
   * @param metadata - Optional contextual data for the operation
   * @returns Timer instance for ending measurement
   * @throws {Error} When timer with same name already exists
   * @example
   * ```typescript
   * const timer = monitor.startTimer('database-query', { table: 'jobs' });
   * const result = await database.query('SELECT * FROM jobs');
   * timer.end(); // Automatically records timing metric
   * ```
   * @since 1.0.0
   */
  startTimer(name: string, metadata?: Record<string, unknown>): Timer {
    if (!this.config.enabled) {
      return {
        end: (): void => {},
        elapsed: (): number => 0,
      };
    }

    if (this.timers.has(name)) {
      throw new Error(`Timer '${name}' already exists. Use a unique timer name.`);
    }

    const start = process.hrtime.bigint();
    this.timers.set(name, { start: Number(start), name });

    this.logger.debug(`Timer started: ${name}`, { metadata });

    return {
      end: (): void => {
        const end = process.hrtime.bigint();
        const timerData = this.timers.get(name);

        if (!timerData) {
          this.logger.warn(`Timer '${name}' not found when attempting to end`);
          return;
        }

        const duration = Number(end - BigInt(timerData.start)) / 1_000_000; // Convert to milliseconds
        this.timers.delete(name);

        this.recordMetric(name, duration, 'milliseconds', metadata);
        this.checkPerformanceThresholds(name, duration);

        this.logger.debug(`Timer ended: ${name}`, {
          duration: `${duration.toFixed(2)}ms`,
          metadata,
        });
      },
      elapsed: (): number => {
        const current = process.hrtime.bigint();
        const timerData = this.timers.get(name);

        if (!timerData) {
          return 0;
        }

        return Number(current - BigInt(timerData.start)) / 1_000_000;
      },
    };
  }

  /**
   * Record custom performance metric
   *
   * Captures custom business and operational metrics with structured
   * metadata for analysis and monitoring. Automatically manages metric
   * retention and provides performance insights.
   *
   * @param name - Metric identifier
   * @param value - Numeric metric value
   * @param unit - Unit of measurement (e.g., 'count', 'bytes', 'seconds')
   * @param metadata - Optional contextual metadata
   * @example
   * ```typescript
   * monitor.recordMetric('jobs-processed', 125, 'count', {
   *   source: 'drivehr',
   *   sync_type: 'incremental'
   * });
   * monitor.recordMetric('memory-usage', 256.5, 'megabytes');
   * monitor.recordMetric('error-rate', 0.02, 'percentage');
   * ```
   * @since 1.0.0
   */
  recordMetric(
    name: string,
    value: number,
    unit: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.metrics.push(metric);
    this.pruneMetrics();

    this.logger.info(`Metric recorded: ${name}`, {
      value,
      unit,
      metadata,
    });
  }

  /**
   * Get comprehensive performance report
   *
   * Generates detailed performance analysis including timing statistics,
   * memory utilization, threshold violations, and operational insights
   * for monitoring and optimization purposes.
   *
   * @returns Comprehensive performance report
   * @example
   * ```typescript
   * const report = monitor.getPerformanceReport();
   * console.log(`Average execution time: ${report.summary.averageExecutionTime}ms`);
   * console.log(`Memory usage: ${report.memory.heapUsed / 1024 / 1024}MB`);
   *
   * if (report.violations.length > 0) {
   *   console.warn('Performance threshold violations detected');
   * }
   * ```
   * @since 1.0.0
   */
  getPerformanceReport(): PerformanceReport {
    const timingMetrics = this.metrics.filter(m => m.unit === 'milliseconds');
    const memoryUsage = process.memoryUsage();

    const summary =
      timingMetrics.length > 0
        ? {
            averageExecutionTime:
              timingMetrics.reduce((sum, m) => sum + m.value, 0) / timingMetrics.length,
            maxExecutionTime: Math.max(...timingMetrics.map(m => m.value)),
            minExecutionTime: Math.min(...timingMetrics.map(m => m.value)),
            totalExecutions: timingMetrics.length,
          }
        : {
            averageExecutionTime: 0,
            maxExecutionTime: 0,
            minExecutionTime: 0,
            totalExecutions: 0,
          };

    const violations = timingMetrics
      .filter(m => m.value >= this.config.thresholds.warning)
      .map(m => ({
        metric: m.name,
        value: m.value,
        threshold:
          m.value >= this.config.thresholds.critical
            ? this.config.thresholds.critical
            : this.config.thresholds.warning,
        severity:
          m.value >= this.config.thresholds.critical ? ('critical' as const) : ('warning' as const),
      }));

    return {
      timestamp: new Date().toISOString(),
      totalMetrics: this.metrics.length,
      summary,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      recentMetrics: this.metrics.slice(-20), // Last 20 metrics
      violations,
    };
  }

  /**
   * Export metrics in structured format
   *
   * Exports all collected metrics in a structured format suitable
   * for external monitoring systems, log aggregation, or analysis tools.
   *
   * @param format - Export format ('json' | 'prometheus' | 'influxdb')
   * @returns Formatted metrics data
   * @example
   * ```typescript
   * // Export for Prometheus monitoring
   * const prometheusMetrics = monitor.exportMetrics('prometheus');
   *
   * // Export for JSON logging
   * const jsonMetrics = monitor.exportMetrics('json');
   * ```
   * @since 1.0.0
   */
  exportMetrics(format: 'json' | 'prometheus' | 'influxdb' = 'json'): string {
    switch (format) {
      case 'prometheus':
        return this.formatPrometheusMetrics();
      case 'influxdb':
        return this.formatInfluxDBMetrics();
      case 'json':
      default:
        return JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            application: 'drivehr-netlify-sync',
            metrics: this.metrics,
            summary: this.getPerformanceReport().summary,
          },
          null,
          2
        );
    }
  }

  /**
   * Clear all collected metrics
   *
   * Removes all stored metrics from memory. Useful for testing
   * or when implementing custom metric retention policies.
   *
   * @example
   * ```typescript
   * // Clear metrics after export to external system
   * const metrics = monitor.exportMetrics('json');
   * await sendToMonitoringSystem(metrics);
   * monitor.clearMetrics();
   * ```
   * @since 1.0.0
   */
  clearMetrics(): void {
    this.metrics.length = 0;
    this.logger.info('Performance metrics cleared');
  }

  /**
   * Get current configuration
   *
   * Returns the current performance monitoring configuration
   * for inspection and debugging purposes.
   *
   * @returns Current performance monitoring configuration
   * @since 1.0.0
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Check performance thresholds and generate alerts
   *
   * Internal method that evaluates timing metrics against
   * configured thresholds and generates appropriate alerts
   * for performance monitoring systems.
   *
   * @param operation - Name of the operation measured
   * @param duration - Execution duration in milliseconds
   * @since 1.0.0
   */
  private checkPerformanceThresholds(operation: string, duration: number): void {
    if (duration >= this.config.thresholds.critical) {
      this.logger.error(`CRITICAL: Performance threshold exceeded`, {
        operation,
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${this.config.thresholds.critical}ms`,
        severity: 'critical',
      });
    } else if (duration >= this.config.thresholds.warning) {
      this.logger.warn(`WARNING: Performance threshold exceeded`, {
        operation,
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${this.config.thresholds.warning}ms`,
        severity: 'warning',
      });
    }
  }

  /**
   * Prune old metrics to prevent memory leaks
   *
   * Internal method that maintains metric collection within
   * configured limits to prevent memory bloat in long-running
   * serverless functions.
   *
   * @since 1.0.0
   */
  private pruneMetrics(): void {
    if (this.metrics.length > this.config.maxMetrics) {
      const removeCount = this.metrics.length - this.config.maxMetrics;
      this.metrics.splice(0, removeCount);
      this.logger.debug(`Pruned ${removeCount} old metrics`);
    }
  }

  /**
   * Start periodic memory usage tracking
   *
   * Internal method that begins collecting memory usage metrics
   * at configured intervals for resource monitoring and leak detection.
   *
   * @since 1.0.0
   */
  private startMemoryTracking(): void {
    if (!this.config.trackMemory) {
      return;
    }

    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.recordMetric('memory-heap-used', memUsage.heapUsed, 'bytes');
      this.recordMetric('memory-heap-total', memUsage.heapTotal, 'bytes');
      this.recordMetric('memory-external', memUsage.external, 'bytes');
      this.recordMetric('memory-rss', memUsage.rss, 'bytes');
    }, this.config.collectionInterval * 1000);
  }

  /**
   * Format metrics for Prometheus monitoring
   *
   * Internal method that converts collected metrics into
   * Prometheus exposition format for integration with
   * Prometheus monitoring systems.
   *
   * @returns Prometheus-formatted metrics
   * @since 1.0.0
   */
  private formatPrometheusMetrics(): string {
    const lines: string[] = [];

    // Group metrics by name
    const metricGroups = new Map<string, PerformanceMetric[]>();
    for (const metric of this.metrics) {
      const key = metric.name.replace(/-/g, '_');
      if (!metricGroups.has(key)) {
        metricGroups.set(key, []);
      }
      const group = metricGroups.get(key);
      if (group) {
        group.push(metric);
      }
    }

    // Format each metric group
    for (const [name, metrics] of metricGroups) {
      lines.push(`# HELP ${name} Performance metric: ${name}`);
      lines.push(`# TYPE ${name} gauge`);

      for (const metric of metrics) {
        const labels = metric.metadata
          ? Object.entries(metric.metadata)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')
          : '';

        lines.push(`${name}${labels ? `{${labels}}` : ''} ${metric.value}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format metrics for InfluxDB time series database
   *
   * Internal method that converts collected metrics into
   * InfluxDB line protocol format for time series storage
   * and analysis.
   *
   * @returns InfluxDB line protocol formatted metrics
   * @since 1.0.0
   */
  private formatInfluxDBMetrics(): string {
    return this.metrics
      .map(metric => {
        const tags = metric.metadata
          ? Object.entries(metric.metadata)
              .map(([k, v]) => `${k}=${v}`)
              .join(',')
          : '';

        const measurement = metric.name.replace(/-/g, '_');
        const tagString = tags ? `,${tags}` : '';
        const timestamp = new Date(metric.timestamp).getTime() * 1_000_000; // nanoseconds

        return `${measurement}${tagString} value=${metric.value} ${timestamp}`;
      })
      .join('\n');
  }
}

/**
 * Decorator for automatic function performance monitoring
 *
 * TypeScript decorator that automatically wraps function execution
 * with performance timing and metric collection. Provides seamless
 * integration of performance monitoring into existing code.
 *
 * @param metricName - Custom metric name (defaults to function name)
 * @returns Method decorator function
 * @example
 * ```typescript
 * class JobService {
 *   @performanceMonitor('job-fetch-operation')
 *   async fetchJobs(): Promise<Job[]> {
 *     // Function implementation
 *     return jobs;
 *   }
 * }
 * ```
 * @since 1.0.0
 */
export function performanceMonitor(metricName?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const monitor = PerformanceMonitor.getInstance();

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const name = metricName ?? `${target?.constructor.name ?? 'function'}.${propertyKey}`;
      const timer = monitor.startTimer(name, {
        class: target?.constructor.name,
        method: propertyKey,
        args: args.length,
      });

      try {
        const result = await originalMethod.apply(this, args);
        timer.end();
        return result;
      } catch (error) {
        timer.end();
        monitor.recordMetric(`${name}-error`, 1, 'count', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Express middleware for HTTP request performance monitoring
 *
 * Middleware function that automatically tracks HTTP request
 * performance including response times, status codes, and
 * request metadata for API monitoring.
 *
 * @returns Express middleware function
 * @example
 * ```typescript
 * import express from 'express';
 *
 * const app = express();
 * app.use(createPerformanceMiddleware());
 * ```
 * @since 1.0.0
 */
export function createPerformanceMiddleware() {
  const monitor = PerformanceMonitor.getInstance();

  // ARCHITECTURAL JUSTIFICATION: Express middleware signature requires 'any' types for compatibility.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  return (req: any, res: any, next: any): void => {
    const timer = monitor.startTimer('http-request', {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
    });

    res.on('finish', () => {
      timer.end();
      monitor.recordMetric('http-response-status', res.statusCode, 'status_code', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
      });
    });

    next();
  };
}
