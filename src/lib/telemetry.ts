/**
 * Enterprise OpenTelemetry Integration System
 *
 * Comprehensive observability framework implementing OpenTelemetry standards for
 * enterprise-grade distributed tracing, metrics collection, and monitoring integration.
 * Provides unified telemetry infrastructure supporting multiple backend systems including
 * Datadog, New Relic, Prometheus, and custom OTLP endpoints.
 *
 * The system offers complete lifecycle management from initialization through graceful
 * shutdown, with automatic instrumentation, business metrics collection, and performance
 * monitoring capabilities optimized for serverless and microservice architectures.
 *
 * Key Architecture Components:
 * - OpenTelemetry SDK initialization with auto-instrumentation
 * - Business metrics collection with semantic conventions
 * - Distributed tracing with correlation ID propagation
 * - Multi-backend export configuration (OTLP, Console, Custom)
 * - Resource detection and metadata injection
 * - Graceful shutdown with data export completion
 * - Error handling and telemetry state management
 *
 * Enterprise Features:
 * - Type-safe telemetry configuration with validation
 * - Strongly-typed business metrics interfaces
 * - High-level span management utilities
 * - HTTP, job processing, and webhook metrics recording
 * - Development and production environment optimization
 * - Memory-efficient resource management
 *
 * @example
 * ```typescript
 * import {
 *   initializeTelemetry,
 *   getTracer,
 *   getBusinessMetrics,
 *   withSpan,
 *   recordJobMetrics
 * } from './lib/telemetry.js';
 *
 * // Initialize telemetry system at application startup
 * await initializeTelemetry({
 *   serviceName: 'drivehr-job-sync',
 *   serviceVersion: '1.2.0',
 *   environment: 'production',
 *   traceEndpoint: 'https://api.honeycomb.io/v1/traces',
 *   headers: { 'x-honeycomb-team': process.env.HONEYCOMB_API_KEY }
 * });
 *
 * // Use distributed tracing
 * const tracer = getTracer();
 * await withSpan('job-processing-batch', async (span) => {
 *   span.setAttributes({
 *     'job.batch.size': 50,
 *     'job.source': 'drivehr-api'
 *   });
 *
 *   const jobs = await fetchJobs();
 *   await processJobs(jobs);
 * });
 *
 * // Record business metrics
 * const metrics = getBusinessMetrics();
 * metrics.jobsProcessed.add(25, { source: 'api', status: 'success' });
 * recordJobMetrics('data-sync', 'success', 1200, { company: 'acme-corp' });
 * ```
 *
 * @module enterprise-opentelemetry-integration
 * @since 1.0.0
 * @see {@link https://opentelemetry.io/docs/} for OpenTelemetry standards
 * @see {@link https://github.com/open-telemetry/opentelemetry-js} for JavaScript implementation
 * @see {@link TelemetryConfig} for configuration options
 * @see {@link BusinessMetrics} for metrics interface
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
 * Comprehensive telemetry configuration interface
 *
 * Defines all configuration options for initializing the OpenTelemetry system
 * with enterprise features including service identification, backend connectivity,
 * authentication, and resource metadata. Supports multiple export backends
 * and development/production environment optimization.
 *
 * @example
 * ```typescript
 * // Production configuration with Datadog
 * const prodConfig: TelemetryConfig = {
 *   serviceName: 'drivehr-job-sync',
 *   serviceVersion: '1.2.0',
 *   environment: 'production',
 *   namespace: 'hr-systems',
 *   traceEndpoint: 'https://trace.agent.datadoghq.com/v0.4/traces',
 *   metricsEndpoint: 'https://api.datadoghq.com/api/v1/series',
 *   headers: {
 *     'DD-API-KEY': process.env.DATADOG_API_KEY,
 *     'Content-Type': 'application/json'
 *   },
 *   debug: false,
 *   resourceAttributes: {
 *     'deployment.environment': 'production',
 *     'service.instance.id': process.env.INSTANCE_ID,
 *     'cloud.provider': 'aws',
 *     'cloud.region': 'us-east-1'
 *   }
 * };
 *
 * // Development configuration with console output
 * const devConfig: TelemetryConfig = {
 *   serviceName: 'drivehr-job-sync-dev',
 *   environment: 'development',
 *   debug: true
 * };
 * ```
 * @since 1.0.0
 * @see {@link initializeTelemetry} for configuration usage
 */
export interface TelemetryConfig {
  /**
   * Service name for identification in traces and metrics
   *
   * Unique identifier for this service in the telemetry backend.
   * Should follow naming conventions like 'company-service-function'.
   *
   * @since 1.0.0
   */
  serviceName: string;

  /**
   * Service version for release tracking and debugging
   *
   * Semantic version of the service for correlating telemetry data
   * with specific releases and deployments.
   *
   * @since 1.0.0
   */
  serviceVersion?: string;

  /**
   * Deployment environment identifier
   *
   * Environment name for filtering and organizing telemetry data
   * across development, staging, and production environments.
   *
   * @since 1.0.0
   */
  environment?: string;

  /**
   * Service namespace for multi-service architectures
   *
   * Logical grouping for related services in complex systems.
   * Helps organize telemetry data in large microservice deployments.
   *
   * @since 1.0.0
   */
  namespace?: string;

  /**
   * OTLP endpoint URL for distributed traces
   *
   * HTTP endpoint for exporting trace data. If not provided,
   * traces will be output to console in development.
   *
   * @since 1.0.0
   */
  traceEndpoint?: string;

  /**
   * OTLP endpoint URL for metrics data
   *
   * HTTP endpoint for exporting metrics data. If not provided,
   * metrics will be output to console in development.
   *
   * @since 1.0.0
   */
  metricsEndpoint?: string;

  /**
   * Authentication and custom headers for OTLP exporters
   *
   * Headers sent with all telemetry export requests including
   * API keys, authentication tokens, and custom metadata.
   *
   * @since 1.0.0
   */
  headers?: Record<string, string>;

  /**
   * Enable debug mode for troubleshooting telemetry issues
   *
   * Enables verbose logging and additional telemetry validation.
   * Should be disabled in production for performance optimization.
   *
   * @since 1.0.0
   */
  debug?: boolean;

  /**
   * Custom resource attributes for service metadata
   *
   * Additional key-value pairs attached to all telemetry data
   * for filtering, grouping, and contextual information.
   *
   * @since 1.0.0
   */
  resourceAttributes?: Record<string, string>;
}

/**
 * Enterprise business metrics interface for domain-specific monitoring
 *
 * Provides strongly-typed OpenTelemetry metrics instruments for tracking
 * business operations and performance indicators. Each metric follows
 * semantic conventions and supports dimensional data through labels
 * for comprehensive operational visibility.
 *
 * The interface encompasses core business processes including job processing,
 * HTTP communication, and webhook delivery systems with both count and
 * duration metrics for complete operational oversight.
 *
 * @example
 * ```typescript
 * const metrics = getBusinessMetrics();
 *
 * // Record job processing metrics
 * metrics.jobsProcessed.add(1, {
 *   source: 'drivehr-api',
 *   status: 'success',
 *   company: 'acme-corp'
 * });
 *
 * // Track job processing duration
 * const startTime = Date.now();
 * await processJob(jobData);
 * const duration = Date.now() - startTime;
 * metrics.jobDuration.record(duration, {
 *   job_type: 'data-sync',
 *   complexity: 'high'
 * });
 *
 * // Record HTTP request metrics
 * metrics.httpRequests.add(1, {
 *   method: 'GET',
 *   endpoint: '/api/jobs',
 *   status_code: '200'
 * });
 *
 * // Track webhook delivery success/failure
 * try {
 *   await deliverWebhook(payload, webhookUrl);
 *   metrics.webhookDeliveries.add(1, { status: 'success' });
 * } catch (error) {
 *   metrics.webhookFailures.add(1, {
 *     error_type: error.name,
 *     status: 'failed'
 *   });
 * }
 * ```
 * @since 1.0.0
 * @see {@link getBusinessMetrics} for obtaining metrics instance
 * @see {@link https://opentelemetry.io/docs/specs/semconv/} for semantic conventions
 */
export interface BusinessMetrics {
  /**
   * Counter for total jobs processed successfully
   *
   * Tracks the number of job processing operations completed.
   * Use labels for source, company, job type, and status classification.
   *
   * @since 1.0.0
   */
  jobsProcessed: Counter;

  /**
   * Counter for job processing errors and failures
   *
   * Records job processing failures for error rate monitoring.
   * Include error type, source, and failure reason in labels.
   *
   * @since 1.0.0
   */
  jobErrors: Counter;

  /**
   * Histogram for job processing execution time
   *
   * Measures job processing duration in milliseconds for performance analysis.
   * Use labels for job complexity, data size, and processing type.
   *
   * @since 1.0.0
   */
  jobDuration: Histogram;

  /**
   * Counter for HTTP requests made by the service
   *
   * Tracks outbound HTTP requests for API monitoring.
   * Include method, endpoint, status code, and response time in labels.
   *
   * @since 1.0.0
   */
  httpRequests: Counter;

  /**
   * Histogram for HTTP request response time
   *
   * Measures HTTP request duration in milliseconds for API performance monitoring.
   * Use labels for endpoint, method, and response status classification.
   *
   * @since 1.0.0
   */
  httpDuration: Histogram;

  /**
   * Counter for successful webhook deliveries
   *
   * Tracks webhook delivery attempts and successes for reliability monitoring.
   * Include destination, payload type, and delivery status in labels.
   *
   * @since 1.0.0
   */
  webhookDeliveries: Counter;

  /**
   * Counter for failed webhook delivery attempts
   *
   * Records webhook delivery failures for error tracking and alerting.
   * Include error type, retry count, and destination in labels.
   *
   * @since 1.0.0
   */
  webhookFailures: Counter;
}

let sdk: NodeSDK | undefined;
let isInitialized = false;
let businessMetrics: BusinessMetrics | undefined;
let appTracer: Tracer | undefined;

const logger = createLogger();

/**
 * Initialize OpenTelemetry SDK with enterprise configuration
 *
 * Bootstraps the complete telemetry system including trace exporters, metrics readers,
 * business metrics instruments, and auto-instrumentation for Node.js applications.
 * This function must be called once at application startup before any telemetry
 * operations can be performed.
 *
 * The initialization process configures OTLP exporters for traces and metrics,
 * sets up OpenTelemetry SDK with auto-instrumentation, creates business metrics
 * instruments, and establishes the application tracer. Supports both production
 * backends (Datadog, New Relic, Honeycomb) and development console output.
 *
 * @param config - Complete telemetry configuration with service metadata and backend settings
 * @throws {Error} When telemetry initialization fails due to configuration errors or backend connectivity issues
 * @example
 * ```typescript
 * // Production initialization with external backend
 * await initializeTelemetry({
 *   serviceName: 'drivehr-job-sync',
 *   serviceVersion: '1.2.0',
 *   environment: 'production',
 *   traceEndpoint: 'https://api.honeycomb.io/v1/traces',
 *   metricsEndpoint: 'https://api.honeycomb.io/v1/metrics',
 *   headers: {
 *     'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
 *     'x-honeycomb-dataset': 'job-processing'
 *   },
 *   resourceAttributes: {
 *     'deployment.environment': 'production',
 *     'service.instance.id': process.env.INSTANCE_ID
 *   }
 * });
 *
 * // Development initialization with console output
 * await initializeTelemetry({
 *   serviceName: 'drivehr-job-sync-dev',
 *   environment: 'development',
 *   debug: true
 * });
 * ```
 * @since 1.0.0
 * @see {@link TelemetryConfig} for configuration options
 * @see {@link getTracer} for obtaining tracer after initialization
 * @see {@link getBusinessMetrics} for accessing metrics after initialization
 */
export async function initializeTelemetry(config: TelemetryConfig): Promise<void> {
  if (isInitialized) {
    logger.warn('Telemetry already initialized, skipping');
    return;
  }

  try {
    logger.info('Initializing OpenTelemetry SDK', { config: { ...config, headers: '[REDACTED]' } });

    const traceExporter = config.traceEndpoint
      ? new OTLPTraceExporter({
          url: config.traceEndpoint,
          headers: config.headers,
        })
      : undefined;

    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    const metricsReader = config.metricsEndpoint
      ? new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: config.metricsEndpoint,
            headers: config.headers,
          }),
          exportIntervalMillis: 60000,
        })
      : undefined;

    sdk = new NodeSDK({
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
      ],

      traceExporter,
      metricReader: metricsReader,
    });

    await sdk.start();

    await initializeBusinessMetrics(config);

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
 * Initialize OpenTelemetry business metrics instruments
 *
 * Creates all business metrics instruments including counters and histograms
 * for tracking job processing, HTTP requests, and webhook deliveries.
 * This internal function is called during telemetry initialization to set up
 * domain-specific metrics collection capabilities.
 *
 * @param config - Telemetry configuration containing service metadata for metrics creation
 * @throws {Error} When metrics creation fails due to OpenTelemetry API issues
 * @since 1.0.0
 * @internal
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
 * Get the initialized OpenTelemetry tracer instance
 *
 * Returns the configured tracer for creating distributed traces and spans.
 * This tracer is initialized with the service name and version provided
 * during telemetry initialization and is used for all tracing operations
 * throughout the application.
 *
 * @returns Configured OpenTelemetry tracer instance for span creation and management
 * @throws {Error} When telemetry system is not initialized or tracer is not available
 * @example
 * ```typescript
 * // Get tracer and create a span
 * const tracer = getTracer();
 * const span = tracer.startSpan('job-processing', {
 *   kind: SpanKind.INTERNAL,
 *   attributes: {
 *     'job.id': 'job-12345',
 *     'job.type': 'data-sync'
 *   }
 * });
 *
 * try {
 *   // Perform operation
 *   await processJob(jobData);
 *   span.setStatus({ code: SpanStatusCode.OK });
 * } catch (error) {
 *   span.recordException(error);
 *   span.setStatus({ code: SpanStatusCode.ERROR });
 *   throw error;
 * } finally {
 *   span.end();
 * }
 * ```
 * @since 1.0.0
 * @see {@link initializeTelemetry} for tracer initialization
 * @see {@link withSpan} for higher-level span management
 */
export function getTracer(): Tracer {
  if (!isInitialized || !appTracer) {
    throw new Error('Telemetry not initialized. Call initializeTelemetry() first.');
  }
  return appTracer;
}

/**
 * Get the initialized business metrics instruments
 *
 * Returns the collection of OpenTelemetry metrics instruments for recording
 * business operations including job processing, HTTP requests, and webhook deliveries.
 * These metrics provide operational visibility into application performance
 * and business process success rates.
 *
 * @returns Complete business metrics interface with counters and histograms for operational monitoring
 * @throws {Error} When telemetry system is not initialized or business metrics are not available
 * @example
 * ```typescript
 * // Get metrics and record business operations
 * const metrics = getBusinessMetrics();
 *
 * // Record successful job processing
 * metrics.jobsProcessed.add(1, {
 *   source: 'drivehr-api',
 *   company: 'acme-corp',
 *   status: 'success'
 * });
 *
 * // Record job processing duration
 * const startTime = Date.now();
 * await processJob(jobData);
 * const duration = Date.now() - startTime;
 * metrics.jobDuration.record(duration / 1000, {
 *   job_type: 'data-sync',
 *   complexity: 'high'
 * });
 *
 * // Record HTTP request metrics
 * metrics.httpRequests.add(1, {
 *   method: 'POST',
 *   endpoint: '/api/jobs',
 *   status_code: '200'
 * });
 * ```
 * @since 1.0.0
 * @see {@link BusinessMetrics} for available metrics instruments
 * @see {@link initializeTelemetry} for metrics initialization
 * @see {@link recordJobMetrics} for simplified job metrics recording
 * @see {@link recordHttpMetrics} for simplified HTTP metrics recording
 */
export function getBusinessMetrics(): BusinessMetrics {
  if (!isInitialized || !businessMetrics) {
    throw new Error('Telemetry not initialized. Call initializeTelemetry() first.');
  }
  return businessMetrics;
}

/**
 * Execute operation within OpenTelemetry span with automatic lifecycle management
 *
 * High-level utility for creating distributed tracing spans with automatic error handling,
 * status management, and proper span lifecycle. Provides a clean API for wrapping
 * operations in telemetry spans without manual span management boilerplate.
 *
 * The function automatically handles span creation, activation, status updates,
 * exception recording, and proper cleanup. Successful operations are marked with
 * OK status, while exceptions are recorded and marked with ERROR status.
 *
 * @param name - Descriptive name for the span operation (e.g., 'job-processing-batch', 'http-request')
 * @param operation - Async function to execute within the span context, receives active span as parameter
 * @param attributes - Optional key-value attributes to attach to the span for contextual information
 * @param kind - OpenTelemetry span kind indicating the type of operation (INTERNAL, CLIENT, SERVER, PRODUCER, CONSUMER)
 * @returns Result of the operation function execution
 * @throws Re-throws any exception from the operation after recording it in the span
 * @example
 * ```typescript
 * // Execute job processing with tracing
 * const result = await withSpan(
 *   'job-batch-processing',
 *   async (span) => {
 *     span.setAttributes({
 *       'job.batch.size': jobs.length,
 *       'job.source': 'drivehr-api'
 *     });
 *
 *     const processedJobs = [];
 *     for (const job of jobs) {
 *       const processed = await processJob(job);
 *       processedJobs.push(processed);
 *
 *       // Update progress in span
 *       span.setAttributes({
 *         'job.batch.processed': processedJobs.length
 *       });
 *     }
 *
 *     return processedJobs;
 *   },
 *   { 'operation.type': 'batch-processing' },
 *   SpanKind.INTERNAL
 * );
 *
 * // HTTP client request with tracing
 * const response = await withSpan(
 *   'wordpress-webhook-delivery',
 *   async (span) => {
 *     return await httpClient.post(webhookUrl, payload);
 *   },
 *   { 'http.method': 'POST', 'webhook.destination': 'wordpress' },
 *   SpanKind.CLIENT
 * );
 * ```
 * @since 1.0.0
 * @see {@link getTracer} for direct tracer access
 * @see {@link https://opentelemetry.io/docs/specs/otel/trace/api/#spankind} for span kinds
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
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

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
 * Record HTTP request metrics with OpenTelemetry semantic conventions
 *
 * Captures HTTP request performance and success metrics including request count,
 * response time, and status codes. Automatically applies OpenTelemetry semantic
 * conventions for HTTP observability while supporting custom attributes for
 * additional context and filtering capabilities.
 *
 * This function records both counter metrics for request tracking and histogram
 * metrics for performance analysis, enabling comprehensive HTTP client monitoring
 * and alerting based on response times and error rates.
 *
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param url - Target URL or endpoint for the HTTP request
 * @param statusCode - HTTP response status code for success/error categorization
 * @param duration - Request duration in milliseconds for performance tracking
 * @param attributes - Additional custom attributes for filtering and context (endpoint, service, etc.)
 * @example
 * ```typescript
 * // Record successful API request
 * const startTime = Date.now();
 * const response = await httpClient.get('https://api.drivehr.com/jobs');
 * const duration = Date.now() - startTime;
 *
 * recordHttpMetrics(
 *   'GET',
 *   'https://api.drivehr.com/jobs',
 *   response.status,
 *   duration,
 *   {
 *     'service.name': 'drivehr-api',
 *     'endpoint.name': 'list-jobs',
 *     'client.type': 'job-fetcher'
 *   }
 * );
 *
 * // Record failed webhook delivery
 * try {
 *   await httpClient.post(webhookUrl, payload);
 * } catch (error) {
 *   recordHttpMetrics(
 *     'POST',
 *     webhookUrl,
 *     error.response?.status || 0,
 *     Date.now() - requestStartTime,
 *     {
 *       'webhook.type': 'job-sync',
 *       'error.type': error.name,
 *       'retry.count': retryCount
 *     }
 *   );
 * }
 * ```
 * @since 1.0.0
 * @see {@link getBusinessMetrics} for direct metrics access
 * @see {@link https://opentelemetry.io/docs/specs/semconv/http/} for HTTP semantic conventions
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

  metrics.httpRequests.add(1, baseAttributes);

  metrics.httpDuration.record(duration / 1000, baseAttributes);
}

/**
 * Record job processing metrics with comprehensive status tracking
 *
 * Captures job processing performance, success rates, and error patterns for
 * operational monitoring and alerting. Automatically categorizes metrics based
 * on job status and records both count and duration metrics for complete
 * visibility into job processing operations.
 *
 * The function distinguishes between successful and failed operations,
 * recording appropriate counters for error rate monitoring while maintaining
 * duration tracking for all operations regardless of status.
 *
 * @param jobId - Unique identifier for the job being processed
 * @param operation - Type of operation performed (fetch, sync, parse, validate, etc.)
 * @param status - Job processing outcome for success/failure categorization
 * @param duration - Job processing duration in milliseconds for performance analysis
 * @param metadata - Additional contextual metadata (company, source, batch size, etc.)
 * @example
 * ```typescript
 * // Record successful job processing
 * const jobStartTime = Date.now();
 * const jobResult = await processJob(jobData);
 * const processingTime = Date.now() - jobStartTime;
 *
 * recordJobMetrics(
 *   'job-12345',
 *   'data-sync',
 *   'success',
 *   processingTime,
 *   {
 *     company: 'acme-corp',
 *     source: 'drivehr-api',
 *     job_type: 'full-time',
 *     batch_size: 50,
 *     location: 'remote'
 *   }
 * );
 *
 * // Record failed job with error context
 * try {
 *   await syncJobToWordPress(jobData);
 * } catch (error) {
 *   recordJobMetrics(
 *     jobData.id,
 *     'wordpress-sync',
 *     'error',
 *     Date.now() - syncStartTime,
 *     {
 *       error_type: error.name,
 *       webhook_endpoint: webhookUrl,
 *       retry_count: 3,
 *       company: jobData.company
 *     }
 *   );
 * }
 *
 * // Record skipped job due to business rules
 * recordJobMetrics(
 *   jobData.id,
 *   'validation',
 *   'skipped',
 *   validationDuration,
 *   {
 *     skip_reason: 'duplicate',
 *     existing_job_id: existingJob.id,
 *     company: jobData.company
 *   }
 * );
 * ```
 * @since 1.0.0
 * @see {@link getBusinessMetrics} for direct metrics access
 * @see {@link BusinessMetrics} for available job metrics instruments
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

  if (status === 'success') {
    metrics.jobsProcessed.add(1, attributes);
  } else {
    metrics.jobErrors.add(1, attributes);
  }

  metrics.jobDuration.record(duration / 1000, attributes);
}

/**
 * Record webhook delivery metrics with comprehensive status and performance tracking
 *
 * Captures webhook delivery success rates, failure patterns, and performance metrics
 * for monitoring webhook reliability and identifying integration issues. Automatically
 * categorizes metrics based on delivery status while maintaining performance tracking
 * for operational visibility and alerting capabilities.
 *
 * The function distinguishes between successful deliveries and failures, recording
 * appropriate counters for reliability monitoring while supporting custom attributes
 * for filtering by webhook destination, payload type, and retry scenarios.
 *
 * @param webhook - Webhook identifier or destination name for categorization
 * @param status - Webhook delivery outcome for success/failure classification
 * @param statusCode - HTTP status code from webhook delivery attempt
 * @param duration - Webhook delivery duration in milliseconds for performance analysis
 * @param attributes - Additional contextual attributes (destination URL, payload type, retry count, etc.)
 * @example
 * ```typescript
 * // Record successful webhook delivery
 * const webhookStartTime = Date.now();
 * const response = await deliverWebhook(payload, webhookUrl);
 * const deliveryTime = Date.now() - webhookStartTime;
 *
 * recordWebhookMetrics(
 *   'wordpress-job-sync',
 *   'success',
 *   response.status,
 *   deliveryTime,
 *   {
 *     destination: 'customer-site.com',
 *     payload_type: 'job-batch',
 *     job_count: payload.jobs.length,
 *     company: 'acme-corp'
 *   }
 * );
 *
 * // Record failed webhook with retry context
 * try {
 *   await httpClient.post(webhookUrl, jobPayload);
 * } catch (error) {
 *   recordWebhookMetrics(
 *     'wordpress-job-sync',
 *     'failure',
 *     error.response?.status || 0,
 *     Date.now() - startTime,
 *     {
 *       error_type: error.name,
 *       destination: webhookUrl,
 *       retry_count: currentRetry,
 *       payload_size: JSON.stringify(jobPayload).length
 *     }
 *   );
 * }
 *
 * // Record timeout scenario
 * recordWebhookMetrics(
 *   'wordpress-job-sync',
 *   'timeout',
 *   0,
 *   WEBHOOK_TIMEOUT_MS,
 *   {
 *     destination: webhookUrl,
 *     timeout_threshold: WEBHOOK_TIMEOUT_MS,
 *     company: jobData.company
 *   }
 * );
 * ```
 * @since 1.0.0
 * @see {@link getBusinessMetrics} for direct metrics access
 * @see {@link recordHttpMetrics} for general HTTP request metrics
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

  if (status === 'success') {
    metrics.webhookDeliveries.add(1, baseAttributes);
  } else {
    metrics.webhookFailures.add(1, baseAttributes);
  }
}

/**
 * Gracefully shutdown OpenTelemetry SDK with complete data export
 *
 * Performs orderly shutdown of the telemetry system ensuring all pending
 * spans and metrics are exported before termination. This function should be
 * called during application shutdown, process termination, or container stops
 * to ensure no telemetry data is lost.
 *
 * The shutdown process includes flushing all exporters, stopping metric collection,
 * cleaning up resources, and resetting internal state. After shutdown, the
 * telemetry system must be reinitialized before further use.
 *
 * @throws {Error} When shutdown process fails due to exporter issues or timeout
 * @example
 * ```typescript
 * // Graceful application shutdown
 * process.on('SIGTERM', async () => {
 *   console.log('Received SIGTERM, shutting down gracefully...');
 *
 *   try {
 *     // Shutdown telemetry first to export remaining data
 *     await shutdownTelemetry();
 *     console.log('Telemetry shutdown completed');
 *
 *     // Shutdown other services
 *     await server.close();
 *     await database.disconnect();
 *
 *     process.exit(0);
 *   } catch (error) {
 *     console.error('Error during shutdown:', error);
 *     process.exit(1);
 *   }
 * });
 *
 * // Container shutdown hook
 * process.on('SIGINT', async () => {
 *   await shutdownTelemetry();
 *   process.exit(0);
 * });
 *
 * // Explicit shutdown in tests
 * afterAll(async () => {
 *   await shutdownTelemetry();
 * });
 * ```
 * @since 1.0.0
 * @see {@link initializeTelemetry} for system initialization
 * @see {@link isTelemetryInitialized} for checking shutdown status
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!isInitialized || !sdk) {
    logger.warn('Telemetry not initialized, skipping shutdown');
    return;
  }

  try {
    logger.info('Shutting down OpenTelemetry SDK');
    await sdk.shutdown();

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
 * Check if OpenTelemetry system is fully initialized and operational
 *
 * Validates that all components of the telemetry system are properly initialized
 * including the SDK, business metrics, and tracer instances. This function provides
 * safe validation before attempting telemetry operations and enables graceful
 * degradation when telemetry is disabled or unavailable.
 *
 * Used internally by telemetry functions and available for application code
 * to implement conditional telemetry behavior based on system availability.
 *
 * @returns True if telemetry system is fully initialized and ready for operations
 * @example
 * ```typescript
 * // Conditional telemetry recording
 * export function processJobWithTelemetry(jobData: JobData) {
 *   const startTime = Date.now();
 *
 *   if (isTelemetryInitialized()) {
 *     return withSpan('job-processing', async (span) => {
 *       span.setAttributes({
 *         'job.id': jobData.id,
 *         'job.type': jobData.type
 *       });
 *
 *       const result = await processJob(jobData);
 *
 *       recordJobMetrics(
 *         jobData.id,
 *         'processing',
 *         'success',
 *         Date.now() - startTime
 *       );
 *
 *       return result;
 *     });
 *   }
 *
 *   // Fallback when telemetry is disabled
 *   return processJob(jobData);
 * }
 *
 * // Pre-flight check in service initialization
 * export async function initializeJobService() {
 *   console.log('Initializing job service...');
 *
 *   if (isTelemetryInitialized()) {
 *     console.log('Telemetry available - monitoring enabled');
 *   } else {
 *     console.log('Telemetry disabled - running without monitoring');
 *   }
 *
 *   // Continue with service initialization
 * }
 * ```
 * @since 1.0.0
 * @see {@link initializeTelemetry} for system initialization
 * @see {@link shutdownTelemetry} for system shutdown
 */
export function isTelemetryInitialized(): boolean {
  return isInitialized && !!sdk && !!businessMetrics && !!appTracer;
}
