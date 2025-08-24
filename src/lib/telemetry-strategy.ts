/**
 * Telemetry Strategy Framework for Enterprise Applications
 *
 * Comprehensive base classes and interfaces implementing the Strategy pattern
 * for telemetry operations across the DriveHR application. Provides shared
 * functionality and abstractions to eliminate code duplication while maintaining
 * flexibility for different telemetry contexts and use cases.
 *
 * The framework centralizes common telemetry operations including span attribute
 * management, telemetry state checking, and OpenTelemetry integration patterns.
 * This reduces implementation overhead and ensures consistent telemetry behavior
 * across job fetching, WordPress synchronization, and other application services.
 *
 * Key Features:
 * - Abstract base class with common telemetry operations
 * - Type-safe span attribute handling with runtime validation
 * - Telemetry initialization state checking
 * - Strategy pattern implementation for extensibility
 * - Integration with OpenTelemetry standards
 * - Error-resistant telemetry operations
 *
 * The framework supports multiple telemetry backends and provides graceful
 * degradation when telemetry services are unavailable or not configured.
 *
 * @example
 * ```typescript
 * import { BaseTelemetryStrategy } from './telemetry-strategy.js';
 *
 * // Implement custom telemetry strategy
 * class JobFetchTelemetryStrategy extends BaseTelemetryStrategy {
 *   public recordJobFetchMetrics(jobId: string, duration: number, success: boolean): void {
 *     if (this.isTelemetryEnabled()) {
 *       const span = trace.getActiveSpan();
 *       this.setSpanAttributes(span, {
 *         'job.id': jobId,
 *         'job.fetch.duration': duration,
 *         'job.fetch.success': success
 *       });
 *     }
 *   }
 * }
 *
 * // Use in service implementations
 * const telemetryStrategy = new JobFetchTelemetryStrategy();
 * const span = tracer.startSpan('job-fetch-operation');
 * telemetryStrategy.setSpanAttributes(span, { 'operation.type': 'fetch' });
 * ```
 *
 * @module telemetry-strategy-framework
 * @since 1.0.0
 * @see {@link ./telemetry.ts} for core telemetry functionality
 * @see {@link ../services/job-fetcher/telemetry.ts} for job fetching telemetry usage
 * @see {@link ITelemetryStrategy} for the strategy interface
 * @see {@link BaseTelemetryStrategy} for the base implementation
 */

import { isTelemetryInitialized } from './telemetry.js';

/**
 * Telemetry strategy interface defining common operations
 *
 * Establishes the contract that all telemetry strategy implementations must
 * follow. Currently focuses on span attribute management which is fundamental
 * to distributed tracing and observability across all application services.
 *
 * This interface ensures consistency across different telemetry contexts while
 * allowing for specialized implementations based on specific business requirements
 * and telemetry backend capabilities.
 *
 * @example
 * ```typescript
 * // Custom telemetry strategy implementation
 * class DatabaseTelemetryStrategy implements ITelemetryStrategy {
 *   public setSpanAttributes(span: unknown, attributes: Record<string, unknown>): void {
 *     // Add database-specific attribute validation and transformation
 *     const dbAttributes = this.transformDatabaseAttributes(attributes);
 *
 *     if (this.isValidSpan(span)) {
 *       span.setAttributes(dbAttributes);
 *     }
 *   }
 *
 *   private transformDatabaseAttributes(attrs: Record<string, unknown>) {
 *     // Transform attributes for database telemetry standards
 *     return { ...attrs, 'db.system': 'postgresql' };
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link BaseTelemetryStrategy} for the default implementation
 */
export interface ITelemetryStrategy {
  /**
   * Set attributes on an OpenTelemetry span
   *
   * Sets key-value attributes on a telemetry span object to provide context
   * and metadata for distributed tracing. Implementations should handle type
   * validation and graceful error handling when spans are unavailable.
   *
   * @param span - The OpenTelemetry span object to modify
   * @param attributes - Key-value pairs to set as span attributes
   * @since 1.0.0
   */
  setSpanAttributes(span: unknown, attributes: Record<string, unknown>): void;
}

/**
 * Abstract base class providing common telemetry strategy functionality
 *
 * Implements shared telemetry operations and utilities for all strategy
 * implementations. Provides type-safe span attribute handling, telemetry
 * state checking, and integration with the OpenTelemetry ecosystem.
 *
 * This base class eliminates code duplication across telemetry implementations
 * while ensuring consistent behavior and error handling patterns. Subclasses
 * inherit common functionality and can focus on their specific telemetry
 * requirements.
 *
 * Features:
 * - Type-safe span attribute setting with runtime validation
 * - Telemetry initialization state checking
 * - Graceful error handling for missing telemetry infrastructure
 * - Integration with OpenTelemetry standards
 * - Protected utility methods for subclass usage
 *
 * @abstract
 * @implements {ITelemetryStrategy}
 * @example
 * ```typescript
 * // Extend for specific telemetry needs
 * class APITelemetryStrategy extends BaseTelemetryStrategy {
 *   public recordAPICall(endpoint: string, method: string, statusCode: number): void {
 *     if (this.isTelemetryEnabled()) {
 *       const span = trace.getActiveSpan();
 *       this.setSpanAttributes(span, {
 *         'http.method': method,
 *         'http.url': endpoint,
 *         'http.status_code': statusCode,
 *         'service.name': 'api-gateway'
 *       });
 *     }
 *   }
 *
 *   public recordError(error: Error, context: Record<string, unknown>): void {
 *     if (this.isTelemetryEnabled()) {
 *       const span = trace.getActiveSpan();
 *       this.setSpanAttributes(span, {
 *         'error.name': error.name,
 *         'error.message': error.message,
 *         ...context
 *       });
 *     }
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link ITelemetryStrategy} for the implemented interface
 */
export abstract class BaseTelemetryStrategy implements ITelemetryStrategy {
  /**
   * Set attributes on OpenTelemetry span with comprehensive type safety
   *
   * Safely sets attributes on a span object after performing thorough runtime
   * type validation. This method ensures the span object has the expected
   * structure and methods before attempting to modify it, preventing runtime
   * errors in environments where telemetry may be disabled or partially initialized.
   *
   * The method performs multiple validation checks:
   * - Verifies the span object exists and is not null
   * - Confirms the span has a setAttributes method
   * - Validates the setAttributes method is callable
   *
   * @param span - The OpenTelemetry span object to modify (type-validated at runtime)
   * @param attributes - Key-value pairs to set as span attributes for tracing context
   * @example
   * ```typescript
   * const span = trace.getActiveSpan();
   * const strategy = new ConcreteStrategy();
   *
   * // Set business context attributes
   * strategy.setSpanAttributes(span, {
   *   'job.id': 'job-12345',
   *   'job.type': 'data-sync',
   *   'operation.name': 'fetch-jobs',
   *   'retry.count': 2,
   *   'batch.size': 50
   * });
   *
   * // Set error context attributes
   * strategy.setSpanAttributes(span, {
   *   'error.occurred': true,
   *   'error.type': 'NetworkTimeout',
   *   'error.message': 'Request timeout after 30s'
   * });
   * ```
   * @since 1.0.0
   * @see {@link https://opentelemetry.io/docs/specs/semconv/} for semantic conventions
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
   * Check if telemetry system is enabled and properly initialized
   *
   * Protected utility method for subclasses to determine whether telemetry
   * operations should be performed. This check prevents errors and unnecessary
   * overhead when telemetry is disabled or not yet initialized.
   *
   * Subclasses should call this method before performing any telemetry operations
   * to ensure graceful degradation when telemetry services are unavailable.
   * This pattern allows the application to continue functioning normally
   * even when monitoring infrastructure is down.
   *
   * @returns True if telemetry is initialized and ready for operations
   * @protected
   * @example
   * ```typescript
   * class ServiceTelemetryStrategy extends BaseTelemetryStrategy {
   *   public recordServiceMetrics(operation: string, duration: number): void {
   *     // Always check telemetry availability before operations
   *     if (this.isTelemetryEnabled()) {
   *       const span = trace.getActiveSpan();
   *       this.setSpanAttributes(span, {
   *         'service.operation': operation,
   *         'service.duration': duration,
   *         'service.timestamp': new Date().toISOString()
   *       });
   *     }
   *     // Application continues normally regardless of telemetry state
   *   }
   *
   *   public recordBusinessEvent(eventType: string, data: Record<string, unknown>): void {
   *     if (this.isTelemetryEnabled()) {
   *       // Record custom business metrics
   *       const span = trace.getActiveSpan();
   *       this.setSpanAttributes(span, {
   *         'business.event.type': eventType,
   *         'business.event.data': JSON.stringify(data)
   *       });
   *     }
   *   }
   * }
   * ```
   * @since 1.0.0
   * @see {@link isTelemetryInitialized} for the underlying telemetry state check
   */
  protected isTelemetryEnabled(): boolean {
    return isTelemetryInitialized();
  }
}
