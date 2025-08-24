/**
 * Enterprise Telemetry Initialization System
 *
 * Application-wide telemetry initialization framework providing OpenTelemetry
 * monitoring configuration for the DriveHR Netlify sync service. Enables
 * distributed tracing, business metrics collection, and seamless integration
 * with enterprise monitoring platforms following industry best practices.
 *
 * The system provides environment-specific configurations optimized for
 * development, testing, and production environments with automatic error
 * handling and graceful degradation when telemetry services are unavailable.
 *
 * Key Features:
 * - Environment-aware configuration selection (development, test, production)
 * - Automatic service discovery and endpoint configuration
 * - Resource attribute injection for cloud platform metadata
 * - Graceful error handling with environment-specific behavior
 * - Process signal handling for clean telemetry shutdown
 * - Configuration validation and debugging utilities
 *
 * This module should be initialized at the very beginning of the application
 * lifecycle, before any other modules are loaded, to ensure complete
 * instrumentation coverage across all application components.
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
 * @module enterprise-telemetry-initialization
 * @since 1.0.0
 * @see {@link ./telemetry.ts} for core telemetry functionality
 * @see {@link initializeApplicationTelemetry} for main initialization function
 * @see {@link https://opentelemetry.io/docs/languages/js/getting-started/nodejs/} for OpenTelemetry setup guide
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
 * Production telemetry configuration for enterprise deployment
 *
 * Comprehensive configuration optimized for production deployment with
 * enterprise-grade monitoring, observability features, and integration
 * with major monitoring platforms including Datadog and New Relic.
 *
 * Features:
 * - Cloud platform metadata injection (Netlify, AWS)
 * - Git commit and repository tracking
 * - Multi-provider API key support
 * - Resource attribute enrichment
 * - Environment variable-driven configuration
 *
 * @since 1.0.0
 * @see {@link TelemetryConfig} for configuration interface
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
 * Development telemetry configuration for local debugging
 *
 * Lightweight configuration optimized for local development with enhanced
 * debugging capabilities and console-based telemetry output. Minimizes
 * external dependencies while providing comprehensive instrumentation.
 *
 * Features:
 * - Debug mode enabled by default
 * - Developer identity tracking
 * - Local service identification
 * - Console-based telemetry export
 *
 * @since 1.0.0
 * @see {@link TelemetryConfig} for configuration interface
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
 * Test telemetry configuration for testing environments
 *
 * Minimal configuration designed for testing environments with reduced
 * instrumentation overhead and no external telemetry dependencies.
 * Prevents telemetry interference with test execution and timing.
 *
 * Features:
 * - Minimal resource usage
 * - No external endpoint dependencies
 * - Test runner identification
 * - Disabled debug logging to reduce test noise
 *
 * @since 1.0.0
 * @see {@link TelemetryConfig} for configuration interface
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
 * Select appropriate telemetry configuration based on environment
 *
 * Automatically selects the optimal telemetry configuration based on the
 * current execution environment. Supports configuration overrides for
 * testing scenarios and custom deployment requirements.
 *
 * @param environment - Current execution environment (development, test, production)
 * @param forceConfig - Optional configuration override for testing or custom scenarios
 * @returns Complete telemetry configuration object
 * @example
 * ```typescript
 * // Standard environment-based selection
 * const config = selectTelemetryConfig('production');
 *
 * // Custom configuration for testing
 * const testConfig = selectTelemetryConfig('test', {
 *   serviceName: 'custom-test-service',
 *   debug: true
 * });
 * ```
 * @since 1.0.0
 * @see {@link TelemetryConfig} for configuration options
 */
function selectTelemetryConfig(
  environment: string,
  forceConfig?: Partial<TelemetryConfig>
): TelemetryConfig {
  if (forceConfig) {
    // Use forced configuration (typically for testing)
    return { ...DEVELOPMENT_CONFIG, ...forceConfig };
  }

  switch (environment) {
    case 'development':
    case 'dev':
      return DEVELOPMENT_CONFIG;
    case 'test':
    case 'testing':
      return TEST_CONFIG;
    case 'production':
    case 'prod':
    default:
      return PRODUCTION_CONFIG;
  }
}

/**
 * Handle telemetry initialization errors with environment-specific behavior
 *
 * Provides intelligent error handling for telemetry initialization failures
 * with different behaviors based on the execution environment. Production
 * environments continue execution with degraded telemetry, while development
 * environments fail fast to surface configuration issues.
 *
 * @param error - The error that occurred during telemetry initialization
 * @param environment - Current execution environment
 * @throws {Error} In non-production environments to surface configuration issues
 * @example
 * ```typescript
 * try {
 *   await initializeTelemetry(config);
 * } catch (error) {
 *   handleTelemetryError(error, 'production'); // Logs error, continues execution
 * }
 * ```
 * @since 1.0.0
 */
function handleTelemetryError(error: unknown, environment: string): void {
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

/**
 * Initialize application telemetry with environment-specific configuration
 *
 * Main telemetry initialization function that automatically detects the current
 * environment and applies appropriate telemetry configuration. Handles initialization
 * errors gracefully and provides fallback behavior when telemetry services are
 * unavailable.
 *
 * The function is idempotent - multiple calls will not result in duplicate
 * initialization. Supports configuration overrides for testing and custom
 * deployment scenarios.
 *
 * @param forceConfig - Optional configuration override for testing or custom scenarios
 * @returns Promise that resolves when telemetry initialization is complete
 * @throws {Error} When telemetry initialization fails in non-production environments
 * @example
 * ```typescript
 * // Standard initialization with automatic environment detection
 * await initializeApplicationTelemetry();
 *
 * // Custom configuration for testing
 * await initializeApplicationTelemetry({
 *   serviceName: 'test-service',
 *   environment: 'test',
 *   debug: true
 * });
 *
 * // Production initialization with custom endpoints
 * await initializeApplicationTelemetry({
 *   traceEndpoint: 'https://api.honeycomb.io/v1/traces',
 *   headers: { 'x-honeycomb-team': 'your-api-key' }
 * });
 * ```
 * @since 1.0.0
 * @see {@link TelemetryConfig} for configuration options
 * @see {@link selectTelemetryConfig} for environment-based configuration selection
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
  const config = selectTelemetryConfig(environment, forceConfig);

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
    handleTelemetryError(error, environment);
  }
}

/**
 * Gracefully shutdown application telemetry with resource cleanup
 *
 * Properly terminates all telemetry resources and ensures collected data is
 * exported before application shutdown. Handles shutdown errors gracefully
 * to prevent application hang during termination sequences.
 *
 * Should be called during application cleanup, process termination handlers,
 * or when telemetry is no longer needed. The function is safe to call multiple
 * times and will only perform shutdown operations once.
 *
 * @returns Promise that resolves when telemetry shutdown is complete
 * @example
 * ```typescript
 * // In application shutdown handler
 * process.on('SIGTERM', async () => {
 *   logger.info('Received SIGTERM, shutting down gracefully');
 *   await shutdownApplicationTelemetry();
 *   process.exit(0);
 * });
 *
 * // In serverless function cleanup
 * export const handler = async (event) => {
 *   try {
 *     // Your application logic here
 *     return response;
 *   } finally {
 *     await shutdownApplicationTelemetry();
 *   }
 * };
 *
 * // Manual shutdown in long-running applications
 * const cleanup = async () => {
 *   await shutdownApplicationTelemetry();
 *   await database.close();
 *   process.exit(0);
 * };
 * ```
 * @since 1.0.0
 * @see {@link shutdownTelemetry} for low-level shutdown operations
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
 * Setup process signal handlers for graceful telemetry shutdown
 *
 * Automatically registers signal handlers to ensure telemetry is properly
 * shut down when the application terminates. Handles SIGTERM, SIGINT,
 * uncaught exceptions, and unhandled promise rejections to prevent data
 * loss and ensure clean resource cleanup.
 *
 * This function should be called once during application startup after
 * telemetry initialization to ensure proper cleanup during all termination
 * scenarios.
 *
 * @example
 * ```typescript
 * // Call once during application startup
 * await initializeApplicationTelemetry();
 * setupTelemetryShutdownHandlers();
 *
 * // Your application logic here
 * ```
 * @since 1.0.0
 * @see {@link shutdownApplicationTelemetry} for manual shutdown operations
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
 * Determine if telemetry should be enabled for the current environment
 *
 * Utility function that evaluates environment variables and configuration
 * flags to determine if telemetry should be active. Provides intelligent
 * defaults while allowing explicit control through environment variables.
 *
 * Decision logic:
 * - Respects explicit DISABLE_TELEMETRY flag
 * - Enables by default in production environments
 * - Requires explicit ENABLE_TELEMETRY flag in development
 * - Disabled by default in test environments
 *
 * @returns True if telemetry should be enabled for the current environment
 * @example
 * ```typescript
 * // Conditional telemetry initialization
 * if (shouldEnableTelemetry()) {
 *   await initializeApplicationTelemetry();
 *   setupTelemetryShutdownHandlers();
 * }
 *
 * // Environment variable examples:
 * // Production: Default enabled (NODE_ENV=production)
 * // Development: ENABLE_TELEMETRY=true to enable
 * // Test: ENABLE_TELEMETRY=true to enable
 * // Any: DISABLE_TELEMETRY=true to disable
 * ```
 * @since 1.0.0
 * @see {@link initializeApplicationTelemetry} for telemetry initialization
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
 * Get comprehensive telemetry configuration summary for debugging
 *
 * Returns detailed summary of the current telemetry configuration including
 * initialization status, service information, and endpoint availability.
 * Useful for debugging telemetry issues and validating configuration.
 *
 * @returns Configuration summary object with current telemetry state
 * @example
 * ```typescript
 * const summary = getTelemetryConfigSummary();
 * console.log(`Telemetry enabled: ${summary.enabled}`);
 * console.log(`Service: ${summary.serviceName} (${summary.environment})`);
 * console.log(`Trace endpoint: ${summary.hasTraceEndpoint ? 'configured' : 'not configured'}`);
 * console.log(`Metrics endpoint: ${summary.hasMetricsEndpoint ? 'configured' : 'not configured'}`);
 *
 * // Use in health checks
 * app.get('/health', (req, res) => {
 *   const telemetrySummary = getTelemetryConfigSummary();
 *   res.json({
 *     status: 'healthy',
 *     telemetry: telemetrySummary
 *   });
 * });
 * ```
 * @since 1.0.0
 * @see {@link TelemetryConfig} for full configuration structure
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
