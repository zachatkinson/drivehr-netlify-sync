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
 * @implements {IFetchTelemetryStrategy}
 * @since 1.0.0
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
