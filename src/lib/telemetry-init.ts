/**
 * Enterprise Telemetry Initialization
 *
 * Application-wide telemetry initialization that sets up OpenTelemetry
 * monitoring for the DriveHR Netlify sync service. Configures distributed
 * tracing, business metrics, and integration with enterprise monitoring
 * platforms following best practices.
 *
 * This module should be imported and initialized at the very beginning
 * of the application lifecycle, before any other modules are loaded,
 * to ensure complete instrumentation coverage.
 *
 * @example
 * ```typescript
 * // In your main application file (e.g., sync-jobs.mts)
 * import { initializeApplicationTelemetry } from './lib/telemetry-init.js';
 *
 * // Initialize telemetry before any other imports
 * await initializeApplicationTelemetry();
 *
 * // Now proceed with your application logic
 * import { createJobFetcher } from './services/job-fetcher.js';
 * ```
 *
 * @module telemetry-init
 * @since 1.0.0
 * @see {@link initializeTelemetry} for the core initialization function
 * @see {@link https://opentelemetry.io/docs/languages/js/getting-started/nodejs/} for setup guide
 */

import {
  initializeTelemetry,
  shutdownTelemetry,
  isTelemetryInitialized,
  type TelemetryConfig,
} from './telemetry.js';
import { createLogger } from './logger.js';
import { getEnvVar } from './env.js';

const logger = createLogger();

/**
 * Production telemetry configuration
 *
 * Enterprise-grade configuration for production deployment with
 * comprehensive monitoring and observability features.
 *
 * @since 1.0.0
 */
const PRODUCTION_CONFIG: TelemetryConfig = {
  serviceName: 'drivehr-netlify-sync',
  serviceVersion: getEnvVar('npm_package_version', '1.0.0'),
  environment: 'production',
  namespace: 'drivehr',
  traceEndpoint: getEnvVar('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', undefined),
  metricsEndpoint: getEnvVar('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT', undefined),
  headers: {
    ...(getEnvVar('OTEL_EXPORTER_OTLP_HEADERS', undefined) &&
      Object.fromEntries(
        getEnvVar('OTEL_EXPORTER_OTLP_HEADERS', '')
          .split(',')
          .map(h => h.trim().split('='))
      )),
    ...(getEnvVar('OTEL_API_KEY', undefined) && { 'x-api-key': getEnvVar('OTEL_API_KEY', '') }),
    ...(getEnvVar('DATADOG_API_KEY', undefined) && {
      'DD-API-KEY': getEnvVar('DATADOG_API_KEY', ''),
    }),
    ...(getEnvVar('NEW_RELIC_LICENSE_KEY', undefined) && {
      'Api-Key': getEnvVar('NEW_RELIC_LICENSE_KEY', ''),
    }),
  },
  debug: getEnvVar('OTEL_DEBUG', 'false') === 'true',
  resourceAttributes: {
    'deployment.environment': getEnvVar('NODE_ENV', 'production'),
    'service.instance.id': getEnvVar('NETLIFY_DEPLOY_ID', 'local'),
    'cloud.provider': 'netlify',
    'cloud.platform': 'netlify_functions',
    'cloud.region': getEnvVar('AWS_REGION', 'us-east-1'),
    'git.commit.id': getEnvVar('COMMIT_REF', 'unknown'),
    'git.repository.url': getEnvVar('REPOSITORY_URL', 'unknown'),
  },
};

/**
 * Development telemetry configuration
 *
 * Lightweight configuration for local development with console
 * logging and debugging features enabled.
 *
 * @since 1.0.0
 */
const DEVELOPMENT_CONFIG: TelemetryConfig = {
  serviceName: 'drivehr-netlify-sync-dev',
  serviceVersion: '1.0.0-dev',
  environment: 'development',
  namespace: 'drivehr-dev',
  debug: true,
  resourceAttributes: {
    'deployment.environment': 'development',
    'service.instance.id': 'local-dev',
    'developer.name': getEnvVar('USER', 'unknown'),
  },
};

/**
 * Test telemetry configuration
 *
 * Minimal configuration for testing environments with
 * instrumentation disabled to avoid interference.
 *
 * @since 1.0.0
 */
const TEST_CONFIG: TelemetryConfig = {
  serviceName: 'drivehr-netlify-sync-test',
  serviceVersion: '1.0.0-test',
  environment: 'test',
  namespace: 'drivehr-test',
  debug: false,
  resourceAttributes: {
    'deployment.environment': 'test',
    'service.instance.id': 'test-runner',
  },
};

/**
 * Initialize telemetry for the application with environment-specific configuration
 *
 * Automatically detects the current environment and applies the appropriate
 * telemetry configuration. Handles initialization errors gracefully and
 * provides fallback behavior when telemetry services are unavailable.
 *
 * @param forceConfig - Optional configuration override for testing
 * @returns Promise that resolves when telemetry is initialized
 * @throws {Error} When telemetry initialization fails in critical environments
 * @example
 * ```typescript
 * // Standard initialization
 * await initializeApplicationTelemetry();
 *
 * // Custom configuration for testing
 * await initializeApplicationTelemetry({
 *   serviceName: 'test-service',
 *   environment: 'test',
 *   debug: true
 * });
 * ```
 * @since 1.0.0
 */
export async function initializeApplicationTelemetry(
  forceConfig?: Partial<TelemetryConfig>
): Promise<void> {
  // Skip if already initialized
  if (isTelemetryInitialized()) {
    logger.debug('Telemetry already initialized, skipping');
    return;
  }

  // Determine environment and select appropriate config
  const environment = getEnvVar('NODE_ENV', 'production');
  let config: TelemetryConfig;

  if (forceConfig) {
    // Use forced configuration (typically for testing)
    config = { ...DEVELOPMENT_CONFIG, ...forceConfig };
  } else {
    switch (environment) {
      case 'development':
      case 'dev':
        config = DEVELOPMENT_CONFIG;
        break;
      case 'test':
      case 'testing':
        config = TEST_CONFIG;
        break;
      case 'production':
      case 'prod':
      default:
        config = PRODUCTION_CONFIG;
        break;
    }
  }

  try {
    logger.info('Initializing application telemetry', {
      environment,
      serviceName: config.serviceName,
      hasTraceEndpoint: !!config.traceEndpoint,
      hasMetricsEndpoint: !!config.metricsEndpoint,
    });

    await initializeTelemetry(config);

    logger.info('Application telemetry initialized successfully', {
      serviceName: config.serviceName,
      environment: config.environment,
      namespace: config.namespace,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // In production, telemetry failures should not crash the application
    if (environment === 'production') {
      logger.error('Telemetry initialization failed, continuing without instrumentation', {
        error: errorMessage,
        environment,
      });
    } else {
      // In development/test, we want to know about telemetry issues
      logger.error('Telemetry initialization failed', { error: errorMessage });
      throw error;
    }
  }
}

/**
 * Gracefully shutdown application telemetry
 *
 * Properly terminates all telemetry resources and ensures data is
 * exported before application shutdown. Should be called during
 * application cleanup or process termination.
 *
 * @returns Promise that resolves when shutdown is complete
 * @example
 * ```typescript
 * // In application shutdown handler
 * process.on('SIGTERM', async () => {
 *   logger.info('Received SIGTERM, shutting down gracefully');
 *   await shutdownApplicationTelemetry();
 *   process.exit(0);
 * });
 *
 * process.on('SIGINT', async () => {
 *   logger.info('Received SIGINT, shutting down gracefully');
 *   await shutdownApplicationTelemetry();
 *   process.exit(0);
 * });
 * ```
 * @since 1.0.0
 */
export async function shutdownApplicationTelemetry(): Promise<void> {
  if (!isTelemetryInitialized()) {
    logger.debug('Telemetry not initialized, skipping shutdown');
    return;
  }

  try {
    logger.info('Shutting down application telemetry');
    await shutdownTelemetry();
    logger.info('Application telemetry shutdown completed');
  } catch (error) {
    logger.error('Error during telemetry shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - shutdown should be best-effort
  }
}

/**
 * Setup process handlers for graceful telemetry shutdown
 *
 * Automatically registers signal handlers to ensure telemetry
 * is properly shut down when the application terminates.
 * This prevents data loss and ensures clean resource cleanup.
 *
 * @example
 * ```typescript
 * // Call once during application startup
 * setupTelemetryShutdownHandlers();
 * ```
 * @since 1.0.0
 */
export function setupTelemetryShutdownHandlers(): void {
  const shutdownHandler = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down telemetry gracefully`);
    await shutdownApplicationTelemetry();
  };

  // Handle graceful shutdown signals
  process.on('SIGTERM', async () => await shutdownHandler('SIGTERM'));
  process.on('SIGINT', async () => await shutdownHandler('SIGINT'));

  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', async error => {
    logger.error('Uncaught exception, shutting down telemetry', { error: error.message });
    await shutdownApplicationTelemetry();
    process.exit(1);
  });

  process.on('unhandledRejection', async reason => {
    logger.error('Unhandled rejection, shutting down telemetry', { reason });
    await shutdownApplicationTelemetry();
    process.exit(1);
  });

  logger.debug('Telemetry shutdown handlers registered');
}

/**
 * Check if telemetry should be enabled for current environment
 *
 * Utility function to determine if telemetry should be active
 * based on environment variables and configuration flags.
 *
 * @returns True if telemetry should be enabled
 * @example
 * ```typescript
 * if (shouldEnableTelemetry()) {
 *   await initializeApplicationTelemetry();
 * }
 * ```
 * @since 1.0.0
 */
export function shouldEnableTelemetry(): boolean {
  // Explicit disable flag
  if (getEnvVar('DISABLE_TELEMETRY', 'false') === 'true') {
    return false;
  }

  // Enable in production by default
  const environment = getEnvVar('NODE_ENV', 'production');
  if (environment === 'production') {
    return true;
  }

  // Enable in development if explicitly requested
  if (environment === 'development' && getEnvVar('ENABLE_TELEMETRY', 'false') === 'true') {
    return true;
  }

  // Disable in test by default unless explicitly enabled
  if (environment === 'test') {
    return getEnvVar('ENABLE_TELEMETRY', 'false') === 'true';
  }

  return false;
}

/**
 * Get current telemetry configuration summary
 *
 * Returns a summary of the current telemetry configuration
 * for debugging and monitoring purposes.
 *
 * @returns Configuration summary object
 * @example
 * ```typescript
 * const summary = getTelemetryConfigSummary();
 * console.log(`Telemetry enabled: ${summary.enabled}`);
 * console.log(`Service: ${summary.serviceName}`);
 * ```
 * @since 1.0.0
 */
export function getTelemetryConfigSummary(): {
  enabled: boolean;
  serviceName?: string;
  environment?: string;
  hasTraceEndpoint: boolean;
  hasMetricsEndpoint: boolean;
} {
  const environment = getEnvVar('NODE_ENV', 'production');
  const enabled = isTelemetryInitialized();

  let config: TelemetryConfig;
  switch (environment) {
    case 'development':
      config = DEVELOPMENT_CONFIG;
      break;
    case 'test':
      config = TEST_CONFIG;
      break;
    default:
      config = PRODUCTION_CONFIG;
      break;
  }

  return {
    enabled,
    serviceName: config.serviceName,
    environment: config.environment,
    hasTraceEndpoint: !!config.traceEndpoint,
    hasMetricsEndpoint: !!config.metricsEndpoint,
  };
}
