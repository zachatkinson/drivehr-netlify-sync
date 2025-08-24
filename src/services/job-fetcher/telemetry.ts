/**
 * Job Fetch Telemetry Strategy
 *
 * Enterprise-grade telemetry strategy implementation providing specialized observability
 * capabilities for DriveHR job fetching operations. This strategy extends the base telemetry
 * framework with job-fetch specific metrics collection, distributed tracing integration,
 * and comprehensive performance monitoring tailored for job data extraction workflows.
 *
 * The strategy implements the Strategy pattern for telemetry operations, enabling flexible
 * instrumentation approaches while maintaining consistent observability interfaces. It provides
 * seamless integration with OpenTelemetry standards and gracefully handles environments where
 * telemetry infrastructure may not be available or properly configured.
 *
 * Core Telemetry Features:
 * - Job-specific metrics collection with semantic conventions
 * - OpenTelemetry distributed tracing integration
 * - Performance monitoring with duration and throughput tracking
 * - Error tracking and success rate measurement
 * - Strategy-specific attribute enrichment for debugging
 * - Graceful degradation when telemetry is unavailable
 *
 * @example
 * ```typescript
 * import { DefaultFetchTelemetryStrategy } from './telemetry.js';
 * import { withSpan } from '../../lib/telemetry.js';
 *
 * // Initialize telemetry strategy for job fetch operations
 * const telemetryStrategy = new DefaultFetchTelemetryStrategy();
 *
 * // Record successful job fetch operation metrics
 * telemetryStrategy.recordMetrics(
 *   'fetch-operation-123',
 *   'fetch',
 *   'success',
 *   2500, // Duration in milliseconds
 *   {
 *     source: 'webhook',
 *     strategy: 'html',
 *     jobCount: 12,
 *     companyId: 'tech-startup',
 *     fetchMethod: 'html-scraping'
 *   }
 * );
 *
 * // Record error metrics for failed operations
 * telemetryStrategy.recordMetrics(
 *   'fetch-operation-124',
 *   'fetch',
 *   'error',
 *   1200,
 *   {
 *     source: 'manual',
 *     strategy: 'api',
 *     error: 'timeout',
 *     companyId: 'enterprise-corp'
 *   }
 * );
 *
 * // Enrich distributed tracing spans with job-specific attributes
 * const span = getCurrentSpan(); // From OpenTelemetry context
 * telemetryStrategy.setSpanAttributes(span, {
 *   'job.count': 8,
 *   'job.strategy_used': 'html',
 *   'job.source': 'webhook',
 *   'job.duration_ms': 1800
 * });
 * ```
 *
 * @module job-fetch-telemetry
 * @since 1.0.0
 * @see {@link BaseTelemetryStrategy} for base telemetry functionality
 * @see {@link IFetchTelemetryStrategy} for the complete interface contract
 * @see {@link recordJobMetrics} for core metrics recording function
 */

import { BaseTelemetryStrategy } from '../../lib/telemetry-strategy.js';
import { recordJobMetrics } from '../../lib/telemetry.js';
import type { IFetchTelemetryStrategy } from './types.js';

/**
 * Default job fetch telemetry strategy implementation
 *
 * Concrete implementation of the fetch telemetry strategy providing comprehensive
 * observability capabilities for job fetching operations. This strategy extends the
 * base telemetry framework with specialized metrics collection, distributed tracing
 * integration, and performance monitoring tailored for job data extraction workflows.
 *
 * The implementation provides seamless OpenTelemetry integration while gracefully
 * handling environments where telemetry infrastructure may not be available. All
 * telemetry operations are conditionally executed based on telemetry availability,
 * ensuring the job fetching system remains functional even without observability
 * infrastructure.
 *
 * Key Capabilities:
 * - Job-specific metrics with semantic naming conventions
 * - Performance tracking with duration and throughput measurement
 * - Error rate monitoring and success/failure tracking
 * - Distributed tracing span enrichment with job context
 * - Conditional telemetry execution with graceful degradation
 * - Strategy-specific attribute collection for debugging
 *
 * @implements {IFetchTelemetryStrategy}
 * @since 1.0.0
 * @see {@link BaseTelemetryStrategy} for inherited telemetry capabilities
 * @see {@link recordJobMetrics} for the underlying metrics recording implementation
 */
export class DefaultFetchTelemetryStrategy
  extends BaseTelemetryStrategy
  implements IFetchTelemetryStrategy
{
  /**
   * Record comprehensive job fetch metrics with OpenTelemetry integration
   *
   * Records detailed metrics for job fetch operations including performance data,
   * success/failure status, and contextual attributes for comprehensive observability.
   * This method provides the primary interface for collecting job-specific telemetry
   * data with automatic conditioning based on telemetry availability.
   *
   * The method delegates to the core telemetry infrastructure while providing job-fetch
   * specific metric naming and attribute handling. All operations are conditionally
   * executed to ensure graceful behavior when telemetry is not available or properly
   * configured in the deployment environment.
   *
   * Collected Metrics:
   * - Operation duration for performance monitoring
   * - Success/failure rates for reliability tracking
   * - Job count and throughput measurement
   * - Source attribution for traffic analysis
   * - Strategy effectiveness for optimization insights
   * - Company-specific metrics for tenant isolation
   *
   * @param jobId - Unique identifier for tracking the specific fetch operation
   * @param operation - Operation type identifier (e.g., 'fetch', 'normalize', 'validate')
   * @param status - Operation outcome status for success/failure tracking
   * @param duration - Operation duration in milliseconds for performance analysis
   * @param attributes - Additional contextual attributes for metric enrichment
   * @example
   * ```typescript
   * const telemetryStrategy = new DefaultFetchTelemetryStrategy();
   *
   * // Record successful HTML scraping operation
   * telemetryStrategy.recordMetrics(
   *   'fetch-html-001',
   *   'fetch',
   *   'success',
   *   3200,
   *   {
   *     source: 'webhook',
   *     strategy: 'html',
   *     jobCount: 15,
   *     companyId: 'startup-xyz',
   *     careersUrl: 'https://startup-xyz.com/careers'
   *   }
   * );
   *
   * // Record failed API fetch operation
   * telemetryStrategy.recordMetrics(
   *   'fetch-api-002',
   *   'fetch',
   *   'error',
   *   5000, // Timeout duration
   *   {
   *     source: 'manual',
   *     strategy: 'api',
   *     error: 'timeout',
   *     companyId: 'enterprise-abc',
   *     apiEndpoint: 'https://api.drivehr.app/v1/jobs'
   *   }
   * );
   *
   * // Record normalization metrics
   * telemetryStrategy.recordMetrics(
   *   'normalize-001',
   *   'normalize',
   *   'success',
   *   150,
   *   {
   *     source: 'webhook',
   *     rawJobCount: 20,
   *     normalizedJobCount: 18,
   *     filteredCount: 2
   *   }
   * );
   * ```
   * @since 1.0.0
   * @see {@link recordJobMetrics} for the underlying metrics implementation
   * @see {@link isTelemetryEnabled} for telemetry availability checking
   */
  public recordMetrics(
    jobId: string,
    operation: string,
    status: 'success' | 'error',
    duration: number,
    attributes: Record<string, string | number | boolean>
  ): void {
    if (this.isTelemetryEnabled()) {
      recordJobMetrics(jobId, operation, status, duration, attributes);
    }
  }
}
