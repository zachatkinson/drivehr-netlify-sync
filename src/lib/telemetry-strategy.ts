/**
 * Telemetry Strategy Base Classes
 *
 * Provides common base classes and interfaces for telemetry strategies across
 * the application. Implements the Strategy pattern with shared functionality
 * to eliminate code duplication while maintaining flexibility for different
 * telemetry use cases.
 *
 * This module reduces duplication between job fetching and WordPress sync
 * telemetry implementations by extracting common span attribute handling
 * and telemetry state checking into a reusable base class.
 *
 * @module telemetry-strategy
 * @since 1.0.0
 * @see {@link ../services/job-fetcher.ts} for job fetching telemetry usage
 * @see {@link ../services/wordpress-client.ts} for sync telemetry usage
 */

import { isTelemetryInitialized } from './telemetry.js';

/**
 * Base interface for telemetry strategy implementations
 *
 * Defines the common contract that all telemetry strategies must implement.
 * Currently focuses on span attribute management which is shared across
 * all telemetry use cases in the application.
 *
 * @since 1.0.0
 * @see {@link BaseTelemetryStrategy} for the base implementation
 */
export interface ITelemetryStrategy {
  /**
   * Set attributes on a telemetry span
   *
   * @param span - The span object to modify (if available)
   * @param attributes - Attributes to set on the span
   * @since 1.0.0
   */
  setSpanAttributes(span: unknown, attributes: Record<string, unknown>): void;
}

/**
 * Abstract base class for telemetry strategies
 *
 * Provides common implementation for telemetry strategies, reducing code
 * duplication across different telemetry contexts. Handles span attribute
 * setting with proper type checking and provides utility methods for
 * checking telemetry initialization state.
 *
 * Subclasses should extend this base class and implement their specific
 * metrics recording methods while leveraging the shared functionality.
 *
 * @abstract
 * @implements {ITelemetryStrategy}
 * @example
 * ```typescript
 * class CustomTelemetryStrategy extends BaseTelemetryStrategy {
 *   public recordMetrics(operation: string, status: string, duration: number): void {
 *     if (this.isTelemetryEnabled()) {
 *       // Custom metrics recording logic
 *     }
 *   }
 * }
 * ```
 * @since 1.0.0
 */
export abstract class BaseTelemetryStrategy implements ITelemetryStrategy {
  /**
   * Set attributes on an OpenTelemetry span with type safety
   *
   * Safely sets attributes on a span object after verifying it has the
   * expected structure. This method performs runtime type checking to
   * ensure the span object has a setAttributes method before attempting
   * to call it, preventing runtime errors in environments where telemetry
   * may not be fully initialized.
   *
   * @param span - The span object to modify (typically from OpenTelemetry)
   * @param attributes - Key-value pairs to set as span attributes
   * @example
   * ```typescript
   * const span = trace.getActiveSpan();
   * strategy.setSpanAttributes(span, {
   *   'job.id': '123',
   *   'operation.type': 'fetch',
   *   'retry.count': 2
   * });
   * ```
   * @since 1.0.0
   */
  public setSpanAttributes(span: unknown, attributes: Record<string, unknown>): void {
    if (
      span &&
      typeof span === 'object' &&
      span !== null &&
      'setAttributes' in span &&
      typeof span.setAttributes === 'function'
    ) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Check if telemetry is enabled and initialized
   *
   * Protected utility method for subclasses to check whether telemetry
   * is currently enabled and initialized. This allows conditional
   * execution of telemetry operations to avoid errors when telemetry
   * is disabled or not yet initialized.
   *
   * @returns True if telemetry is initialized and ready for use
   * @protected
   * @example
   * ```typescript
   * public recordMetrics(data: MetricData): void {
   *   if (this.isTelemetryEnabled()) {
   *     // Safe to use telemetry APIs
   *     recordCustomMetrics(data);
   *   }
   * }
   * ```
   * @since 1.0.0
   * @see {@link isTelemetryInitialized} for the underlying check
   */
  protected isTelemetryEnabled(): boolean {
    return isTelemetryInitialized();
  }
}
