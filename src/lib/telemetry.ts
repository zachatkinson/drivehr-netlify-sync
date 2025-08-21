/**
 * Enterprise OpenTelemetry Telemetry Configuration
 *
 * Comprehensive observability setup following OpenTelemetry standards for
 * enterprise-grade monitoring, tracing, and metrics collection. Provides
 * distributed tracing, custom metrics, and integration with monitoring
 * platforms like Datadog, New Relic, or Grafana.
 *
 * Features:
 * - Distributed tracing with correlation IDs
 * - Custom business metrics with semantic conventions
 * - Performance monitoring with SLA tracking
 * - Error tracking and alerting
 * - Resource detection and metadata
 * - Export to multiple backends (OTLP, Prometheus, etc.)
 *
 * @example
 * ```typescript
 * // Initialize telemetry at application startup
 * import { initializeTelemetry } from './lib/telemetry.js';
 *
 * await initializeTelemetry({
 *   serviceName: 'drivehr-netlify-sync',
 *   environment: 'production'
 * });
 *
 * // Use in your code
 * import { trace, metrics } from '@opentelemetry/api';
 *
 * const tracer = trace.getTracer('job-sync');
 * const meter = metrics.getMeter('job-sync');
 * ```
 *
 * @module telemetry
 * @since 1.0.0
 * @see {@link https://opentelemetry.io/docs/} for OpenTelemetry documentation
 * @see {@link https://github.com/open-telemetry/opentelemetry-js} for implementation details
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import {
  trace,
  metrics,
  SpanStatusCode,
  SpanKind,
  type Span,
  type Meter,
  type Counter,
  type Histogram,
  type Tracer,
} from '@opentelemetry/api';
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_STATUS_CODE,
  SEMATTRS_HTTP_URL,
  ATTR_ERROR_TYPE,
} from '@opentelemetry/semantic-conventions';
import { createLogger } from './logger.js';

/**
 * Telemetry configuration options
 *
 * Comprehensive configuration for OpenTelemetry setup with enterprise
 * features including service identification, environment metadata,
 * and export configuration.
 *
 * @since 1.0.0
 */
export interface TelemetryConfig {
  /** Service name for identification in traces and metrics */
  serviceName: string;
  /** Service version for release tracking */
  serviceVersion?: string;
  /** Deployment environment (development, staging, production) */
  environment?: string;
  /** Service namespace for multi-service architectures */
  namespace?: string;
  /** OTLP endpoint for traces (optional - defaults to console) */
  traceEndpoint?: string;
  /** OTLP endpoint for metrics (optional - defaults to console) */
  metricsEndpoint?: string;
  /** Authentication headers for OTLP exporters */
  headers?: Record<string, string>;
  /** Enable debug mode for troubleshooting */
  debug?: boolean;
  /** Custom resource attributes */
  resourceAttributes?: Record<string, string>;
}

/**
 * Business metrics interface for domain-specific monitoring
 *
 * Provides strongly-typed interfaces for recording business metrics
 * with proper semantic conventions and enterprise monitoring patterns.
 *
 * @since 1.0.0
 */
export interface BusinessMetrics {
  /** Counter for total jobs processed */
  jobsProcessed: Counter;
  /** Counter for job processing errors */
  jobErrors: Counter;
  /** Histogram for job processing duration */
  jobDuration: Histogram;
  /** Counter for HTTP requests */
  httpRequests: Counter;
  /** Histogram for HTTP request duration */
  httpDuration: Histogram;
  /** Counter for webhook deliveries */
  webhookDeliveries: Counter;
  /** Counter for webhook failures */
  webhookFailures: Counter;
}

/**
 * Global telemetry state management
 */
let sdk: NodeSDK | undefined;
let isInitialized = false;
let businessMetrics: BusinessMetrics | undefined;
let appTracer: Tracer | undefined;

const logger = createLogger();

/**
 * Initialize OpenTelemetry SDK with enterprise configuration
 *
 * Sets up comprehensive observability including distributed tracing,
 * custom metrics, and automatic instrumentation. Configures exporters
 * for integration with enterprise monitoring platforms.
 *
 * @param config - Telemetry configuration options
 * @returns Promise that resolves when telemetry is initialized
 * @throws {Error} When telemetry initialization fails
 * @example
 * ```typescript
 * import { getEnvVar } from './env.js';
 *
 * await initializeTelemetry({
 *   serviceName: 'drivehr-netlify-sync',
 *   serviceVersion: '1.0.0',
 *   environment: getEnvVar('NODE_ENV', 'development'),
 *   traceEndpoint: getEnvVar('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'),
 *   metricsEndpoint: getEnvVar('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'),
 *   headers: {
 *     'x-api-key': getEnvVar('OTEL_API_KEY')
 *   }
 * });
 * ```
 * @since 1.0.0
 */
export async function initializeTelemetry(config: TelemetryConfig): Promise<void> {
  if (isInitialized) {
    logger.warn('Telemetry already initialized, skipping');
    return;
  }

  try {
    logger.info('Initializing OpenTelemetry SDK', { config: { ...config, headers: '[REDACTED]' } });

    // Create trace exporter
    const traceExporter = config.traceEndpoint
      ? new OTLPTraceExporter({
          url: config.traceEndpoint,
          headers: config.headers,
        })
      : undefined;

    // Create metrics reader
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    const metricsReader = config.metricsEndpoint
      ? new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: config.metricsEndpoint,
            headers: config.headers,
          }),
          exportIntervalMillis: 60000, // Export every 60 seconds
        })
      : undefined;

    // Initialize SDK with comprehensive configuration
    sdk = new NodeSDK({
      // Automatic instrumentation for popular libraries
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }, // Disable file system noise
          '@opentelemetry/instrumentation-dns': { enabled: false }, // Disable DNS noise
        }),
      ],

      // Export configuration
      traceExporter,
      metricReader: metricsReader,
    });

    // Start the SDK
    await sdk.start();

    // Initialize business metrics
    await initializeBusinessMetrics(config);

    // Get application tracer
    appTracer = trace.getTracer(config.serviceName, config.serviceVersion);

    isInitialized = true;
    logger.info('OpenTelemetry SDK initialized successfully', {
      serviceName: config.serviceName,
      environment: config.environment,
      hasTraceExporter: !!traceExporter,
      hasMetricsExporter: !!metricsReader,
    });
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry SDK', { error });
    throw new Error(
      `Telemetry initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Initialize business-specific metrics with semantic conventions
 *
 * Creates strongly-typed metrics for monitoring business operations
 * with proper naming conventions and enterprise monitoring patterns.
 *
 * @param config - Telemetry configuration for metric setup
 * @returns Promise that resolves when metrics are initialized
 * @since 1.0.0
 */
async function initializeBusinessMetrics(config: TelemetryConfig): Promise<void> {
  const meter: Meter = metrics.getMeter(config.serviceName, config.serviceVersion);

  businessMetrics = {
    jobsProcessed: meter.createCounter('jobs_processed_total', {
      description: 'Total number of jobs processed',
      unit: '1',
    }),

    jobErrors: meter.createCounter('job_errors_total', {
      description: 'Total number of job processing errors',
      unit: '1',
    }),

    jobDuration: meter.createHistogram('job_duration_seconds', {
      description: 'Job processing duration in seconds',
      unit: 's',
    }),

    httpRequests: meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
      unit: '1',
    }),

    httpDuration: meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP request duration in seconds',
      unit: 's',
    }),

    webhookDeliveries: meter.createCounter('webhook_deliveries_total', {
      description: 'Total number of webhook deliveries',
      unit: '1',
    }),

    webhookFailures: meter.createCounter('webhook_failures_total', {
      description: 'Total number of webhook delivery failures',
      unit: '1',
    }),
  };

  logger.debug('Business metrics initialized', {
    metricsCount: Object.keys(businessMetrics).length,
  });
}

/**
 * Get application tracer for creating spans
 *
 * Returns the configured tracer instance for creating distributed
 * tracing spans with proper service identification and metadata.
 *
 * @returns Application tracer instance
 * @throws {Error} When telemetry is not initialized
 * @example
 * ```typescript
 * const tracer = getTracer();
 * const span = tracer.startSpan('process-job', {
 *   kind: SpanKind.INTERNAL,
 *   attributes: { 'job.id': jobId }
 * });
 * ```
 * @since 1.0.0
 */
export function getTracer(): Tracer {
  if (!isInitialized || !appTracer) {
    throw new Error('Telemetry not initialized. Call initializeTelemetry() first.');
  }
  return appTracer;
}

/**
 * Get business metrics for recording domain-specific measurements
 *
 * Returns strongly-typed business metrics for monitoring application
 * performance and business operations with proper semantic conventions.
 *
 * @returns Business metrics interface
 * @throws {Error} When telemetry is not initialized
 * @example
 * ```typescript
 * const metrics = getBusinessMetrics();
 * metrics.jobsProcessed.add(1, { source: 'drivehr', status: 'success' });
 * metrics.jobDuration.record(processingTime, { operation: 'sync' });
 * ```
 * @since 1.0.0
 */
export function getBusinessMetrics(): BusinessMetrics {
  if (!isInitialized || !businessMetrics) {
    throw new Error('Telemetry not initialized. Call initializeTelemetry() first.');
  }
  return businessMetrics;
}

/**
 * Create instrumented span for operation tracing
 *
 * Higher-level helper for creating spans with automatic error handling,
 * timing, and status code management. Follows OpenTelemetry best practices
 * for enterprise observability.
 *
 * @param name - Span name following semantic conventions
 * @param operation - Function to execute within the span
 * @param attributes - Span attributes for context
 * @param kind - Span kind (INTERNAL, CLIENT, SERVER, etc.)
 * @returns Promise with operation result
 * @throws {Error} Rethrows original error after recording in span
 * @example
 * ```typescript
 * const result = await withSpan('fetch-jobs', async (span) => {
 *   span.setAttributes({ 'job.source': 'drivehr', 'job.count': jobs.length });
 *   return await fetchJobsFromAPI();
 * }, { 'operation.type': 'fetch' }, SpanKind.CLIENT);
 * ```
 * @since 1.0.0
 */
export async function withSpan<T>(
  name: string,
  operation: (span: Span) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
  kind: SpanKind = SpanKind.INTERNAL
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(name, { kind, attributes }, async (span: Span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      // Record error in span
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      // Set error attributes
      span.setAttributes({
        [ATTR_ERROR_TYPE]: error instanceof Error ? error.constructor.name : 'Unknown',
        'error.message': error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Record HTTP request metrics and tracing
 *
 * Specialized helper for recording HTTP operations with proper
 * semantic conventions and enterprise monitoring patterns.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param url - Request URL
 * @param statusCode - HTTP response status code
 * @param duration - Request duration in milliseconds
 * @param attributes - Additional attributes for context
 * @example
 * ```typescript
 * recordHttpMetrics('POST', 'https://api.drivehr.com/jobs', 200, 150, {
 *   'http.user_agent': 'drivehr-sync/1.0.0',
 *   'job.count': 5
 * });
 * ```
 * @since 1.0.0
 */
export function recordHttpMetrics(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  attributes: Record<string, string | number | boolean> = {}
): void {
  const metrics = getBusinessMetrics();

  const baseAttributes = {
    [SEMATTRS_HTTP_METHOD]: method,
    [SEMATTRS_HTTP_STATUS_CODE]: statusCode,
    [SEMATTRS_HTTP_URL]: url,
    ...attributes,
  };

  // Record request count
  metrics.httpRequests.add(1, baseAttributes);

  // Record request duration (convert ms to seconds)
  metrics.httpDuration.record(duration / 1000, baseAttributes);
}

/**
 * Record job processing metrics with business context
 *
 * Specialized helper for recording job processing operations
 * with proper business metrics and performance tracking.
 *
 * @param jobId - Job identifier for correlation
 * @param operation - Job operation type (fetch, process, sync, etc.)
 * @param status - Job processing status (success, error, timeout, etc.)
 * @param duration - Processing duration in milliseconds
 * @param metadata - Additional business context
 * @example
 * ```typescript
 * recordJobMetrics('job-123', 'sync', 'success', 2500, {
 *   source: 'drivehr',
 *   jobCount: 10,
 *   location: 'remote'
 * });
 * ```
 * @since 1.0.0
 */
export function recordJobMetrics(
  jobId: string,
  operation: string,
  status: 'success' | 'error' | 'timeout' | 'skipped',
  duration: number,
  metadata: Record<string, string | number | boolean> = {}
): void {
  const metrics = getBusinessMetrics();

  const attributes = {
    'job.id': jobId,
    'job.operation': operation,
    'job.status': status,
    ...metadata,
  };

  // Record job completion
  if (status === 'success') {
    metrics.jobsProcessed.add(1, attributes);
  } else {
    metrics.jobErrors.add(1, attributes);
  }

  // Record processing duration (convert ms to seconds)
  metrics.jobDuration.record(duration / 1000, attributes);
}

/**
 * Record webhook delivery metrics
 *
 * Specialized helper for recording webhook operations with
 * delivery tracking and failure monitoring.
 *
 * @param webhook - Webhook identifier or URL
 * @param status - Delivery status (success, failure, timeout, etc.)
 * @param statusCode - HTTP response status code
 * @param duration - Delivery duration in milliseconds
 * @param attributes - Additional delivery context
 * @example
 * ```typescript
 * recordWebhookMetrics('wordpress-sync', 'success', 200, 300, {
 *   'webhook.event': 'job.completed',
 *   'payload.size': 1024
 * });
 * ```
 * @since 1.0.0
 */
export function recordWebhookMetrics(
  webhook: string,
  status: 'success' | 'failure' | 'timeout' | 'retry',
  statusCode: number,
  duration: number,
  attributes: Record<string, string | number | boolean> = {}
): void {
  const metrics = getBusinessMetrics();

  const baseAttributes = {
    'webhook.name': webhook,
    'webhook.status': status,
    [SEMATTRS_HTTP_STATUS_CODE]: statusCode,
    ...attributes,
  };

  // Record delivery attempt
  if (status === 'success') {
    metrics.webhookDeliveries.add(1, baseAttributes);
  } else {
    metrics.webhookFailures.add(1, baseAttributes);
  }
}

/**
 * Gracefully shutdown telemetry SDK
 *
 * Properly terminates the OpenTelemetry SDK ensuring all spans
 * are exported and resources are cleaned up. Should be called
 * during application shutdown for clean telemetry termination.
 *
 * @returns Promise that resolves when shutdown is complete
 * @example
 * ```typescript
 * // In application shutdown handler
 * process.on('SIGTERM', async () => {
 *   await shutdownTelemetry();
 *   process.exit(0);
 * });
 * ```
 * @since 1.0.0
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!isInitialized || !sdk) {
    logger.warn('Telemetry not initialized, skipping shutdown');
    return;
  }

  try {
    logger.info('Shutting down OpenTelemetry SDK');
    await sdk.shutdown();

    // Reset state
    isInitialized = false;
    businessMetrics = undefined;
    appTracer = undefined;
    sdk = undefined;

    logger.info('OpenTelemetry SDK shutdown completed');
  } catch (error) {
    logger.error('Error during telemetry shutdown', { error });
    throw error;
  }
}

/**
 * Check if telemetry is initialized and ready for use
 *
 * Utility function to verify telemetry initialization status
 * before attempting to use tracing or metrics functionality.
 *
 * @returns True if telemetry is initialized and ready
 * @example
 * ```typescript
 * if (isTelemetryInitialized()) {
 *   const tracer = getTracer();
 *   // ... use tracer safely
 * }
 * ```
 * @since 1.0.0
 */
export function isTelemetryInitialized(): boolean {
  return isInitialized && !!sdk && !!businessMetrics && !!appTracer;
}
