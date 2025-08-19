/**
 * Application Logging Service
 *
 * Enterprise-grade centralized logging with proper formatting, log levels,
 * and structured output support. Replaces console statements with
 * consistent, production-ready logging. Supports JSON output for
 * log aggregation services and plain text for local development.
 *
 * @module logger
 * @since 1.0.0
 * @see {@link LogLevel} for available logging levels
 * @see {@link createLogger} for creating logger instances
 */

import type { LogLevel } from '../types/config.js';

/**
 * Contextual data to include with log messages
 *
 * Provides additional structured data for debugging and monitoring.
 * All values should be serializable for JSON output.
 *
 * @example
 * ```typescript
 * logger.error('Database connection failed', {
 *   host: 'db.example.com',
 *   port: 5432,
 *   error: error.message
 * });
 * ```
 * @since 1.0.0
 */
export interface LogContext {
  readonly [key: string]: unknown;
}

/**
 * Logger interface defining standard logging methods
 *
 * Provides consistent logging API across the application with
 * support for all standard log levels. Each method accepts an
 * optional context object for structured logging.
 *
 * @since 1.0.0
 * @see {@link ApplicationLogger} for the default implementation
 */
export interface Logger {
  /**
   * Log error messages - critical issues requiring immediate attention
   * @param message - The error message to log
   * @param context - Optional contextual data
   * @since 1.0.0
   */
  error(message: string, context?: LogContext): void;

  /**
   * Log warning messages - potential issues that should be investigated
   * @param message - The warning message to log
   * @param context - Optional contextual data
   * @since 1.0.0
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log informational messages - normal operational events
   * @param message - The info message to log
   * @param context - Optional contextual data
   * @since 1.0.0
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log debug messages - detailed diagnostic information
   * @param message - The debug message to log
   * @param context - Optional contextual data
   * @since 1.0.0
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log trace messages - most detailed level of diagnostic information
   * @param message - The trace message to log
   * @param context - Optional contextual data
   * @since 1.0.0
   */
  trace(message: string, context?: LogContext): void;
}

/**
 * Default logger implementation with configurable levels and output formats
 *
 * Provides production-ready logging with support for structured JSON output
 * and human-readable text format. Implements log level filtering to reduce
 * noise in production environments.
 *
 * @implements {Logger}
 * @since 1.0.0
 */
class ApplicationLogger implements Logger {
  private readonly level: LogLevel;
  private readonly enableStructured: boolean;

  /**
   * Create a new ApplicationLogger instance
   *
   * @param level - Minimum log level to output (error, warn, info, debug, trace)
   * @param enableStructured - Whether to output JSON formatted logs
   * @example
   * ```typescript
   * const logger = new ApplicationLogger('debug', true);
   * logger.debug('Application started', { port: 3000 });
   * ```
   * @since 1.0.0
   */
  constructor(level: LogLevel = 'info', enableStructured: boolean = false) {
    this.level = level;
    this.enableStructured = enableStructured;
  }

  /**
   * Log error messages - critical issues requiring immediate attention
   *
   * Logs messages at the ERROR level for critical issues that require
   * immediate attention and may indicate system failures or security
   * concerns. Always outputs if log level permits.
   *
   * @param message - The error message to log
   * @param context - Optional contextual data for debugging
   * @example
   * ```typescript
   * logger.error('Database connection failed', {
   *   host: 'db.example.com',
   *   error: 'Connection timeout after 30s',
   *   retryAttempt: 3
   * });
   * ```
   * @since 1.0.0
   * @see {@link LogContext} for context structure
   */
  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.log('error', message, context);
    }
  }

  /**
   * Log warning messages - potential issues that should be investigated
   *
   * Logs messages at the WARN level for potentially harmful situations
   * that don't prevent the application from functioning but should be
   * investigated. Useful for deprecated API usage or configuration issues.
   *
   * @param message - The warning message to log
   * @param context - Optional contextual data for debugging
   * @example
   * ```typescript
   * logger.warn('Using deprecated API endpoint', {
   *   endpoint: '/v1/legacy',
   *   deprecatedSince: '2024-01-01',
   *   migrateToEndpoint: '/v2/current'
   * });
   * ```
   * @since 1.0.0
   * @see {@link LogContext} for context structure
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, context);
    }
  }

  /**
   * Log informational messages - normal operational events
   *
   * Logs messages at the INFO level for normal application flow
   * and operational events. Useful for tracking application state
   * changes, successful operations, and general application flow.
   *
   * @param message - The informational message to log
   * @param context - Optional contextual data for monitoring
   * @example
   * ```typescript
   * logger.info('User authentication successful', {
   *   userId: 'user123',
   *   sessionId: 'session456',
   *   loginMethod: 'oauth'
   * });
   * ```
   * @since 1.0.0
   * @see {@link LogContext} for context structure
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.log('info', message, context);
    }
  }

  /**
   * Log debug messages - detailed diagnostic information
   *
   * Logs messages at the DEBUG level for detailed diagnostic information
   * useful during development and troubleshooting. Contains detailed
   * application state and execution flow information.
   *
   * @param message - The debug message to log
   * @param context - Optional contextual data for debugging
   * @example
   * ```typescript
   * logger.debug('Processing webhook payload', {
   *   webhookType: 'job.created',
   *   payloadSize: 1024,
   *   processingTime: 150,
   *   requestId: 'req_abc123'
   * });
   * ```
   * @since 1.0.0
   * @see {@link LogContext} for context structure
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, context);
    }
  }

  /**
   * Log trace messages - most detailed level of diagnostic information
   *
   * Logs messages at the TRACE level for the most detailed diagnostic
   * information including fine-grained execution details. Typically used
   * for step-by-step execution tracking and performance analysis.
   *
   * @param message - The trace message to log
   * @param context - Optional contextual data for detailed tracing
   * @example
   * ```typescript
   * logger.trace('Entering function processJobData', {
   *   functionName: 'processJobData',
   *   argumentCount: 2,
   *   stackDepth: 5,
   *   timestamp: Date.now()
   * });
   * ```
   * @since 1.0.0
   * @see {@link LogContext} for context structure
   */
  trace(message: string, context?: LogContext): void {
    if (this.shouldLog('trace')) {
      this.log('trace', message, context);
    }
  }

  /**
   * Determine if a message should be logged based on current log level
   *
   * Implements log level filtering by comparing the message level against
   * the configured minimum log level. Uses numeric level mapping where
   * lower numbers indicate higher priority levels.
   *
   * @param level - The log level to check
   * @returns True if the message should be logged
   * @example
   * ```typescript
   * // With logger level set to 'info'
   * this.shouldLog('error'); // true (0 <= 2)
   * this.shouldLog('debug'); // false (3 > 2)
   * ```
   * @since 1.0.0
   * @see {@link LogLevel} for available levels
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
    };

    return levels[level] <= levels[this.level];
  }

  /**
   * Internal logging implementation with format selection
   *
   * Handles the actual logging output with support for both structured
   * JSON format (for production log aggregation) and human-readable
   * text format (for development). Maps trace level to debug for
   * console compatibility.
   *
   * @param level - The log level for this message
   * @param message - The message to log
   * @param context - Optional contextual data
   * @example
   * ```typescript
   * // Structured output (enableStructured = true)
   * // {"timestamp":"2025-01-01T12:00:00.000Z","level":"info","message":"User login","context":{"userId":"123"}}
   *
   * // Text output (enableStructured = false)
   * // [2025-01-01T12:00:00.000Z] [INFO] User login {"userId":"123"}
   * ```
   * @since 1.0.0
   * @see {@link LogContext} for context structure
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();

    if (this.enableStructured) {
      const logEntry = {
        timestamp,
        level,
        message,
        ...(context && { context }),
      };
      // eslint-disable-next-line no-console
      console[level === 'trace' ? 'debug' : level](JSON.stringify(logEntry));
    } else {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      // eslint-disable-next-line no-console
      console[level === 'trace' ? 'debug' : level](
        `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
      );
    }
  }
}

let loggerInstance: Logger | null = null;

/**
 * Create a new logger instance with specified configuration
 *
 * Factory function for creating logger instances with custom log level
 * and output format. Useful for creating specialized loggers for different
 * parts of the application or different environments.
 *
 * @param level - Minimum log level to output (defaults to 'info')
 * @param enableStructured - Whether to use JSON structured output (defaults to false)
 * @returns A new Logger instance
 * @example
 * ```typescript
 * // Development logger with debug level and text output
 * const devLogger = createLogger('debug', false);
 *
 * // Production logger with info level and JSON output
 * const prodLogger = createLogger('info', true);
 *
 * // Error-only logger for critical monitoring
 * const errorLogger = createLogger('error', true);
 * ```
 * @since 1.0.0
 * @see {@link Logger} for the logger interface
 * @see {@link ApplicationLogger} for the implementation
 */
export function createLogger(level: LogLevel = 'info', enableStructured: boolean = false): Logger {
  return new ApplicationLogger(level, enableStructured);
}

/**
 * Get the singleton logger instance
 *
 * Returns the global logger instance, creating it with default settings
 * if it doesn't exist. This is the recommended way to access the logger
 * throughout the application for consistent logging behavior.
 *
 * @returns The singleton Logger instance
 * @example
 * ```typescript
 * // Anywhere in your application
 * import { getLogger } from './logger.js';
 *
 * const logger = getLogger();
 * logger.info('Application started');
 * logger.error('Something went wrong', { error: 'details' });
 * ```
 * @since 1.0.0
 * @see {@link setLogger} for configuring the singleton
 * @see {@link createLogger} for creating custom instances
 */
export function getLogger(): Logger {
  loggerInstance ??= new ApplicationLogger();
  return loggerInstance;
}

/**
 * Set the singleton logger instance
 *
 * Replaces the global logger instance with a custom logger implementation.
 * Useful for dependency injection, testing with mock loggers, or configuring
 * application-wide logging behavior at startup.
 *
 * @param logger - The Logger instance to use as the singleton
 * @example
 * ```typescript
 * // At application startup
 * import { setLogger, createLogger } from './logger.js';
 *
 * const appLogger = createLogger('debug', true);
 * setLogger(appLogger);
 *
 * // In tests
 * const mockLogger = {
 *   error: vi.fn(),
 *   warn: vi.fn(),
 *   info: vi.fn(),
 *   debug: vi.fn(),
 *   trace: vi.fn()
 * };
 * setLogger(mockLogger);
 * ```
 * @since 1.0.0
 * @see {@link getLogger} for accessing the singleton
 * @see {@link createLogger} for creating logger instances
 */
export function setLogger(logger: Logger): void {
  loggerInstance = logger;
}
