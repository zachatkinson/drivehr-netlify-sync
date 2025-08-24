/**
 * Enterprise Performance Monitoring System
 *
 * Comprehensive performance monitoring framework providing real-time metrics
 * collection, timing analysis, and operational insights for serverless applications.
 * The system offers enterprise-grade monitoring capabilities with support for
 * multiple export formats, configurable thresholds, and automatic alerting.
 *
 * Core Features:
 * - High-precision timing measurements using Node.js hrtime API
 * - Singleton pattern for consistent monitoring across application lifecycle
 * - Memory usage tracking with automatic collection intervals
 * - Performance threshold monitoring with warning and critical alerts
 * - Multi-format metric export (JSON, Prometheus, InfluxDB)
 * - TypeScript decorator for automatic function monitoring
 * - Express middleware for HTTP request performance tracking
 *
 * The monitoring system follows enterprise patterns with configurable retention
 * policies, structured logging integration, and comprehensive error handling.
 * It's optimized for serverless environments where memory efficiency and
 * rapid startup times are critical.
 *
 * @example
 * ```typescript
 * import { PerformanceMonitor, performanceMonitor } from './performance-monitor.js';
 *
 * // Basic usage with singleton pattern
 * const monitor = PerformanceMonitor.getInstance();
 * const timer = monitor.startTimer('database-operation');
 * await performDatabaseQuery();
 * timer.end();
 *
 * // Custom metrics recording
 * monitor.recordMetric('jobs-processed', 50, 'count', {
 *   source: 'drivehr',
 *   batch_size: 50
 * });
 *
 * // Performance reporting
 * const report = monitor.getPerformanceReport();
 * console.log(`Average execution time: ${report.summary.averageExecutionTime}ms`);
 *
 * // Decorator-based monitoring
 * class JobService {
 *   @performanceMonitor('job-fetch')
 *   async fetchJobs(): Promise<Job[]> {
 *     return await this.jobRepository.findAll();
 *   }
 * }
 * ```
 *
 * @module enterprise-performance-monitoring
 * @since 1.0.0
 * @see {@link ../types/config.ts} for configuration interfaces
 * @see {@link ./logger.ts} for logging integration
 * @see {@link PerformanceMonitor} for the main monitoring class
 * @see {@link performanceMonitor} for the function decorator
 */

import { createLogger } from './logger.js';

/**
 * Performance metric data structure for operational measurements
 *
 * Defines the standardized structure for all performance metrics collected
 * by the monitoring system. Each metric contains the essential data needed
 * for analysis, alerting, and reporting in enterprise monitoring systems.
 *
 * @example
 * ```typescript
 * const metric: PerformanceMetric = {
 *   name: 'api-response-time',
 *   value: 245.7,
 *   unit: 'milliseconds',
 *   timestamp: '2025-01-20T10:30:00.000Z',
 *   metadata: {
 *     endpoint: '/api/jobs',
 *     method: 'GET',
 *     status: 200
 *   }
 * };
 * ```
 * @since 1.0.0
 * @see {@link PerformanceMonitor.recordMetric} for metric creation
 */
export interface PerformanceMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * High-precision timer interface for operation measurement
 *
 * Provides methods for measuring execution duration with nanosecond precision
 * using Node.js hrtime API. Timer instances are created by the performance
 * monitor and automatically record metrics when ended.
 *
 * @example
 * ```typescript
 * const timer = monitor.startTimer('database-query');
 *
 * // Check elapsed time without ending timer
 * console.log(`Elapsed: ${timer.elapsed()}ms`);
 *
 * // End timer and record metric
 * const result = await performQuery();
 * timer.end();
 * ```
 * @since 1.0.0
 * @see {@link PerformanceMonitor.startTimer} for timer creation
 */
export interface Timer {
  end(): void;
  elapsed(): number;
}

/**
 * Performance monitoring configuration interface
 *
 * Defines comprehensive configuration options for the performance monitoring
 * system including thresholds, retention policies, and feature toggles.
 * All properties are readonly to ensure configuration immutability.
 *
 * @example
 * ```typescript
 * const config: PerformanceConfig = {
 *   enabled: true,
 *   logLevel: 'info',
 *   maxMetrics: 1000,
 *   thresholds: {
 *     warning: 1000,  // 1 second
 *     critical: 5000  // 5 seconds
 *   },
 *   trackMemory: true,
 *   collectionInterval: 60
 * };
 *
 * const monitor = PerformanceMonitor.getInstance(config);
 * ```
 * @since 1.0.0
 * @see {@link PerformanceMonitor.getInstance} for configuration usage
 */
export interface PerformanceConfig {
  readonly enabled: boolean;
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  readonly maxMetrics: number;
  readonly thresholds: {
    readonly warning: number;
    readonly critical: number;
  };
  readonly trackMemory: boolean;
  readonly collectionInterval: number;
}

/**
 * Comprehensive performance analysis report
 *
 * Contains detailed performance statistics, memory usage data, threshold
 * violations, and recent metrics for operational analysis and monitoring.
 * Generated by the performance monitor for reporting and alerting purposes.
 *
 * @example
 * ```typescript
 * const report = monitor.getPerformanceReport();
 *
 * console.log(`Total metrics: ${report.totalMetrics}`);
 * console.log(`Average execution: ${report.summary.averageExecutionTime}ms`);
 * console.log(`Memory usage: ${(report.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
 *
 * if (report.violations.length > 0) {
 *   console.warn('Performance violations detected:', report.violations);
 * }
 * ```
 * @since 1.0.0
 * @see {@link PerformanceMonitor.getPerformanceReport} for report generation
 */
export interface PerformanceReport {
  readonly timestamp: string;
  readonly totalMetrics: number;
  readonly summary: {
    readonly averageExecutionTime: number;
    readonly maxExecutionTime: number;
    readonly minExecutionTime: number;
    readonly totalExecutions: number;
  };
  readonly memory: {
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
    readonly rss: number;
  };
  readonly recentMetrics: readonly PerformanceMetric[];
  readonly violations: readonly {
    readonly metric: string;
    readonly value: number;
    readonly threshold: number;
    readonly severity: 'warning' | 'critical';
  }[];
}

/**
 * Enterprise performance monitoring system implementation
 *
 * Singleton class providing comprehensive performance monitoring capabilities
 * for serverless applications. Offers high-precision timing, memory tracking,
 * configurable thresholds, and multi-format metric export functionality.
 *
 * Features:
 * - Nanosecond precision timing using Node.js hrtime
 * - Automatic memory usage collection at configurable intervals
 * - Performance threshold monitoring with warning/critical alerts
 * - Metric retention management to prevent memory leaks
 * - Export capabilities for Prometheus, InfluxDB, and JSON formats
 * - Integration with structured logging system
 *
 * The class implements the singleton pattern to ensure consistent monitoring
 * across the entire application lifecycle and prevent duplicate metric
 * collection.
 *
 * @example
 * ```typescript
 * // Initialize with custom configuration
 * const monitor = PerformanceMonitor.getInstance({
 *   maxMetrics: 500,
 *   thresholds: { warning: 500, critical: 2000 }
 * });
 *
 * // Start timing an operation
 * const timer = monitor.startTimer('api-call', { endpoint: '/jobs' });
 * const response = await fetch('/api/jobs');
 * timer.end(); // Automatically records metric
 *
 * // Record custom business metrics
 * monitor.recordMetric('jobs-synchronized', 25, 'count');
 *
 * // Generate performance report
 * const report = monitor.getPerformanceReport();
 * await sendToMonitoringSystem(report);
 * ```
 * @since 1.0.0
 * @see {@link PerformanceConfig} for configuration options
 * @see {@link PerformanceReport} for report structure
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor | undefined;
  private readonly logger = createLogger('debug');
  private readonly metrics: PerformanceMetric[] = [];
  private readonly timers = new Map<string, { start: number; name: string }>();
  private readonly config: PerformanceConfig;

  /**
   * Create performance monitor instance with configuration
   *
   * Private constructor implementing singleton pattern to ensure single
   * point of performance monitoring across the application. Initializes
   * monitoring configuration and starts memory tracking if enabled.
   *
   * @param config - Optional partial configuration to override defaults
   * @since 1.0.0
   * @see {@link getInstance} for public access to singleton instance
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
   * Returns the global performance monitor instance, creating it with
   * the provided configuration if it doesn't exist. Ensures consistent
   * monitoring behavior across the entire application.
   *
   * @param config - Optional configuration for first-time initialization
   * @returns The singleton PerformanceMonitor instance
   * @example
   * ```typescript
   * // Initialize with default configuration
   * const monitor = PerformanceMonitor.getInstance();
   *
   * // Initialize with custom configuration (only on first call)
   * const customMonitor = PerformanceMonitor.getInstance({
   *   enabled: true,
   *   maxMetrics: 2000,
   *   thresholds: { warning: 800, critical: 3000 }
   * });
   * ```
   * @since 1.0.0
   * @see {@link PerformanceConfig} for available configuration options
   */
  static getInstance(config?: Partial<PerformanceConfig>): PerformanceMonitor {
    PerformanceMonitor.instance ??= new PerformanceMonitor(config);
    return PerformanceMonitor.instance;
  }

  /**
   * Start high-precision timer for operation measurement
   *
   * Creates a timer instance for measuring execution duration with nanosecond
   * precision using Node.js hrtime API. When the timer is ended, it automatically
   * records the timing metric and checks against performance thresholds.
   *
   * @param name - Unique identifier for the operation being timed
   * @param metadata - Optional contextual data for the timing operation
   * @returns Timer instance with end() and elapsed() methods
   * @throws {Error} When a timer with the same name already exists
   * @example
   * ```typescript
   * // Basic timing
   * const timer = monitor.startTimer('database-query');
   * const result = await db.query('SELECT * FROM jobs');
   * timer.end();
   *
   * // Timing with metadata
   * const apiTimer = monitor.startTimer('api-request', {
   *   endpoint: '/api/jobs',
   *   method: 'GET',
   *   userId: 'user123'
   * });
   * const response = await fetch('/api/jobs');
   * apiTimer.end();
   *
   * // Check elapsed time without ending
   * const longTimer = monitor.startTimer('batch-process');
   * processData();
   * console.log(`Processing time so far: ${longTimer.elapsed()}ms`);
   * longTimer.end();
   * ```
   * @since 1.0.0
   * @see {@link Timer} for timer interface methods
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
   * Captures custom business and operational metrics with structured metadata
   * for analysis and monitoring. Automatically manages metric retention based
   * on configuration limits and provides integration with logging system.
   *
   * @param name - Unique metric identifier
   * @param value - Numeric metric value
   * @param unit - Unit of measurement (e.g., 'count', 'bytes', 'milliseconds')
   * @param metadata - Optional contextual metadata for the metric
   * @example
   * ```typescript
   * // Business metrics
   * monitor.recordMetric('jobs-processed', 125, 'count', {
   *   source: 'drivehr',
   *   sync_type: 'incremental',
   *   batch_size: 125
   * });
   *
   * // Performance metrics
   * monitor.recordMetric('memory-usage', 256.5, 'megabytes');
   * monitor.recordMetric('cpu-utilization', 45.2, 'percentage');
   *
   * // Error rates
   * monitor.recordMetric('error-rate', 0.02, 'percentage', {
   *   service: 'job-fetcher',
   *   error_type: 'timeout'
   * });
   * ```
   * @since 1.0.0
   * @see {@link PerformanceMetric} for metric data structure
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
   * Generate comprehensive performance report
   *
   * Creates detailed performance analysis including timing statistics,
   * memory utilization, threshold violations, and recent metrics for
   * operational monitoring and optimization insights.
   *
   * @returns Complete performance report with statistics and analysis
   * @example
   * ```typescript
   * const report = monitor.getPerformanceReport();
   *
   * // Performance summary
   * console.log(`Total metrics collected: ${report.totalMetrics}`);
   * console.log(`Average execution time: ${report.summary.averageExecutionTime}ms`);
   * console.log(`Max execution time: ${report.summary.maxExecutionTime}ms`);
   *
   * // Memory analysis
   * const heapMB = (report.memory.heapUsed / 1024 / 1024).toFixed(2);
   * console.log(`Heap memory usage: ${heapMB}MB`);
   *
   * // Threshold violations
   * if (report.violations.length > 0) {
   *   console.warn('Performance threshold violations:');
   *   report.violations.forEach(v => {
   *     console.warn(`${v.metric}: ${v.value}ms (${v.severity})`);
   *   });
   * }
   *
   * // Recent activity
   * console.log(`Recent metrics: ${report.recentMetrics.length}`);
   * ```
   * @since 1.0.0
   * @see {@link PerformanceReport} for complete report structure
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
   * Export metrics in structured format for external systems
   *
   * Exports collected metrics in various formats suitable for different
   * monitoring and analysis systems. Supports JSON for general use,
   * Prometheus for metric scraping, and InfluxDB for time series analysis.
   *
   * @param format - Export format: 'json', 'prometheus', or 'influxdb'
   * @returns Formatted metrics data as string
   * @example
   * ```typescript
   * // JSON export for general monitoring
   * const jsonMetrics = monitor.exportMetrics('json');
   * await sendToLogAggregator(jsonMetrics);
   *
   * // Prometheus format for scraping
   * const prometheusMetrics = monitor.exportMetrics('prometheus');
   * response.setHeader('Content-Type', 'text/plain');
   * response.send(prometheusMetrics);
   *
   * // InfluxDB line protocol for time series
   * const influxMetrics = monitor.exportMetrics('influxdb');
   * await influxClient.write(influxMetrics);
   * ```
   * @since 1.0.0
   * @see {@link formatPrometheusMetrics} for Prometheus format details
   * @see {@link formatInfluxDBMetrics} for InfluxDB format details
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
   * Clear all collected performance metrics
   *
   * Removes all stored metrics from memory to free resources or reset
   * monitoring state. Useful for testing scenarios or implementing custom
   * metric retention policies with external storage systems.
   *
   * @example
   * ```typescript
   * // Export and clear metrics periodically
   * const metrics = monitor.exportMetrics('json');
   * await sendToExternalMonitoring(metrics);
   * monitor.clearMetrics(); // Free memory after export
   *
   * // Clear metrics for testing
   * beforeEach(() => {
   *   monitor.clearMetrics();
   * });
   * ```
   * @since 1.0.0
   * @see {@link exportMetrics} for exporting before clearing
   */
  clearMetrics(): void {
    this.metrics.length = 0;
    this.logger.info('Performance metrics cleared');
  }

  /**
   * Get current performance monitoring configuration
   *
   * Returns a copy of the current performance monitoring configuration
   * for inspection, debugging, or configuration validation purposes.
   * Returns a shallow copy to prevent external modification.
   *
   * @returns Current performance monitoring configuration
   * @example
   * ```typescript
   * const config = monitor.getConfig();
   * console.log(`Monitoring enabled: ${config.enabled}`);
   * console.log(`Max metrics: ${config.maxMetrics}`);
   * console.log(`Warning threshold: ${config.thresholds.warning}ms`);
   * console.log(`Critical threshold: ${config.thresholds.critical}ms`);
   * ```
   * @since 1.0.0
   * @see {@link PerformanceConfig} for configuration structure
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Check performance thresholds and generate alerts
   *
   * Internal method that evaluates timing metrics against configured
   * thresholds and generates appropriate log messages for performance
   * monitoring and alerting systems.
   *
   * @param operation - Name of the operation that was measured
   * @param duration - Execution duration in milliseconds
   * @since 1.0.0
   * @see {@link PerformanceConfig.thresholds} for threshold configuration
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
   * Internal method that maintains metric collection within configured
   * limits to prevent memory bloat in long-running serverless functions.
   * Removes oldest metrics when limit is exceeded.
   *
   * @since 1.0.0
   * @see {@link PerformanceConfig.maxMetrics} for retention limit
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
   * Internal method that begins collecting memory usage metrics at
   * configured intervals for resource monitoring and memory leak detection.
   * Tracks heap, external, and RSS memory usage.
   *
   * @since 1.0.0
   * @see {@link PerformanceConfig.trackMemory} for enabling memory tracking
   * @see {@link PerformanceConfig.collectionInterval} for interval configuration
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
   * Format metrics for Prometheus monitoring system
   *
   * Internal method that converts collected metrics into Prometheus
   * exposition format for integration with Prometheus monitoring and
   * alerting infrastructure.
   *
   * @returns Prometheus-formatted metrics string
   * @since 1.0.0
   * @see {@link exportMetrics} for public export interface
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
   * Internal method that converts collected metrics into InfluxDB line
   * protocol format for time series storage, analysis, and visualization
   * in systems like Grafana.
   *
   * @returns InfluxDB line protocol formatted metrics string
   * @since 1.0.0
   * @see {@link exportMetrics} for public export interface
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
 * TypeScript decorator for automatic function performance monitoring
 *
 * Decorator that automatically wraps function execution with performance
 * timing and metric collection. Provides seamless integration of performance
 * monitoring into existing code without manual timer management.
 *
 * The decorator captures execution time, records metrics, handles errors,
 * and includes contextual metadata about the decorated method.
 *
 * @param metricName - Custom metric name (defaults to ClassName.methodName)
 * @returns Method decorator function
 * @example
 * ```typescript
 * class JobService {
 *   @performanceMonitor('job-fetch-operation')
 *   async fetchJobs(companyId: string): Promise<Job[]> {
 *     return await this.jobRepository.findByCompany(companyId);
 *   }
 *
 *   @performanceMonitor() // Uses JobService.processJobs as metric name
 *   async processJobs(jobs: Job[]): Promise<void> {
 *     for (const job of jobs) {
 *       await this.processJob(job);
 *     }
 *   }
 * }
 *
 * // Usage automatically records timing metrics
 * const jobService = new JobService();
 * const jobs = await jobService.fetchJobs('company-123');
 * await jobService.processJobs(jobs);
 * ```
 * @since 1.0.0
 * @see {@link PerformanceMonitor} for manual timing operations
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
 * Creates Express middleware that automatically tracks HTTP request
 * performance including response times, status codes, and request
 * metadata for comprehensive API monitoring and analysis.
 *
 * The middleware integrates with the performance monitoring system to
 * provide detailed insights into API performance patterns and bottlenecks.
 *
 * @returns Express middleware function for request performance tracking
 * @example
 * ```typescript
 * import express from 'express';
 * import { createPerformanceMiddleware } from './performance-monitor.js';
 *
 * const app = express();
 *
 * // Add performance monitoring to all routes
 * app.use(createPerformanceMiddleware());
 *
 * app.get('/api/jobs', async (req, res) => {
 *   // Request performance automatically tracked
 *   const jobs = await jobService.fetchJobs();
 *   res.json(jobs);
 * });
 *
 * // Performance metrics are automatically recorded:
 * // - http-request: Request duration timing
 * // - http-response-status: Response status code distribution
 * ```
 * @since 1.0.0
 * @see {@link PerformanceMonitor} for manual performance tracking
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
