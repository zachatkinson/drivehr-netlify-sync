import { BaseTelemetryStrategy } from '../../lib/telemetry-strategy.js';
import { recordJobMetrics } from '../../lib/telemetry.js';
import type { IFetchTelemetryStrategy } from './types.js';

/**
 * Default fetch telemetry strategy implementation
 *
 * Standard implementation that uses OpenTelemetry for metrics and tracing.
 * Provides comprehensive instrumentation for production environments
 * while gracefully handling cases where telemetry is not available.
 *
 * This implementation extends BaseTelemetryStrategy to provide fetch-specific
 * telemetry capabilities including job fetch metrics, timing data, and
 * operation status tracking. Designed for enterprise environments with
 * observability requirements.
 *
 * @implements {IFetchTelemetryStrategy}
 * @example
 * ```typescript
 * const telemetryStrategy = new DefaultFetchTelemetryStrategy();
 *
 * // Record successful fetch operation
 * telemetryStrategy.recordMetrics(
 *   'fetch-123',
 *   'fetch',
 *   'success',
 *   1500,
 *   {
 *     source: 'drivehr',
 *     strategy: 'html',
 *     jobCount: 5,
 *     companyId: 'acme-corp'
 *   }
 * );
 *
 * // Set span attributes for distributed tracing
 * telemetryStrategy.setSpanAttributes(span, {
 *   'job.count': 5,
 *   'job.strategy_used': 'html'
 * });
 * ```
 * @since 1.0.0
 * @see {@link BaseTelemetryStrategy} for base implementation
 * @see {@link IFetchTelemetryStrategy} for the interface definition
 */
export class DefaultFetchTelemetryStrategy
  extends BaseTelemetryStrategy
  implements IFetchTelemetryStrategy
{
  /**
   * Record job metrics using OpenTelemetry
   *
   * @param jobId - Unique identifier for the fetch operation
   * @param operation - The operation type being performed
   * @param status - Success or failure status
   * @param duration - Operation duration in milliseconds
   * @param attributes - Additional attributes for the metric
   * @since 1.0.0
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
