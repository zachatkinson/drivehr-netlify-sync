/**
 * Enterprise Application Logging System
 *
 * Production-grade centralized logging service providing consistent formatting,
 * configurable log levels, structured output support, and comprehensive error
 * handling. Designed to replace console statements with professional logging
 * that supports both development debugging and production monitoring.
 *
 * The logging system provides two output formats:
 * - Structured JSON format for production log aggregation and monitoring
 * - Human-readable text format for local development and debugging
 *
 * Features:
 * - Five log levels with intelligent filtering (error, warn, info, debug, trace)
 * - Singleton pattern for consistent application-wide logging behavior
 * - Factory pattern for creating specialized logger instances
 * - Structured context data support for enhanced debugging
 * - Console integration with proper method mapping
 * - TypeScript interfaces for type safety and IDE support
 * - ESLint exemptions with architectural justifications
 *
 * The system is optimized for serverless environments where console output
 * is the primary logging mechanism, while providing structure and consistency
 * that enterprise applications require.
 *
 * @example
 * ```typescript
 * import { getLogger, createLogger, setLogger } from './logger.js';
 *
 * // Use singleton logger (recommended for most cases)
 * const logger = getLogger();
 * logger.info('Application started', { version: '1.0.0', port: 3000 });
 * logger.error('Database connection failed', {
 *   host: 'db.example.com',
 *   error: 'Connection timeout',
 *   retryAttempt: 3
 * });
 *
 * // Create custom logger for specific components
 * const apiLogger = createLogger('debug', true); // JSON output
 * apiLogger.debug('Processing request', { endpoint: '/api/users' });
 *
 * // Configure application logger at startup
 * const productionLogger = createLogger('info', true);
 * setLogger(productionLogger);
 * ```
 *
 * @module application-logging-system
 * @since 1.0.0
 * @see {@link ../types/config.ts} for LogLevel type definition
 * @see {@link Logger} for the main logger interface
 * @see {@link ApplicationLogger} for the concrete implementation
 */

import type { LogLevel } from '../types/config.js';

/**
 * Contextual data structure for enhanced log messages
 *
 * Provides additional structured data to include with log messages for
 * debugging, monitoring, and operational insights. All property values
 * must be serializable to support JSON output format in production.
 *
 * The interface uses readonly properties and unknown values to ensure
 * type safety while maintaining flexibility for various data types.
 * Common use cases include error details, performance metrics, user
 * context, request information, and system state.
 *
 * @example
 * ```typescript
 * // Error logging with context
 * const errorContext: LogContext = {
 *   userId: 'user123',
 *   operation: 'database_query',
 *   query: 'SELECT * FROM users WHERE id = ?',
 *   executionTime: 1500,
 *   error: 'Connection timeout after 30s'
 * };
 * logger.error('Database query failed', errorContext);
 *
 * // Performance monitoring context
 * const performanceContext: LogContext = {
 *   endpoint: '/api/jobs',
 *   method: 'POST',
 *   responseTime: 250,
 *   statusCode: 200,
 *   requestSize: 1024,
 *   responseSize: 2048
 * };
 * logger.info('API request completed', performanceContext);
 * ```
 * @since 1.0.0
 * @see {@link Logger} for methods that accept LogContext
 */
export interface LogContext {
  readonly [key: string]: unknown;
}

/**
 * Logger interface defining standard enterprise logging methods
 *
 * Provides consistent logging API across the application with support for
 * all standard log levels and structured context data. Each method accepts
 * an optional context object for enhanced debugging and monitoring.
 *
 * The interface follows enterprise logging standards with five distinct
 * levels arranged by severity: error (most critical) to trace (most verbose).
 *
 * @example
 * ```typescript
 * function processData(logger: Logger) {
 *   logger.info('Processing started', { recordCount: 100 });
 *   try {
 *     logger.debug('Validation completed', { validRecords: 98 });
 *   } catch (error) {
 *     logger.error('Processing failed', { error: error.message });
 *   }
 * }
 * ```
 * @since 1.0.0
 * @see {@link ApplicationLogger} for the production implementation
 * @see {@link LogContext} for context data structure
 */
export interface Logger {
  /**
   * Log critical error messages requiring immediate attention
   *
   * @param message - Human-readable error description
   * @param context - Optional structured data for debugging
   * @since 1.0.0
   */
  error(message: string, context?: LogContext): void;

  /**
   * Log warning messages for potential issues requiring investigation
   *
   * @param message - Human-readable warning description
   * @param context - Optional structured data for monitoring
   * @since 1.0.0
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log informational messages about normal operational events
   *
   * @param message - Human-readable informational description
   * @param context - Optional structured data for monitoring
   * @since 1.0.0
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log detailed diagnostic information for troubleshooting
   *
   * @param message - Human-readable debug description
   * @param context - Optional structured data for debugging
   * @since 1.0.0
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log most detailed diagnostic information for fine-grained analysis
   *
   * @param message - Human-readable trace description
   * @param context - Optional structured data for detailed tracing
   * @since 1.0.0
   */
  trace(message: string, context?: LogContext): void;
}

class ApplicationLogger implements Logger {
  private readonly level: LogLevel;
  private readonly enableStructured: boolean;

  constructor(level: LogLevel = 'info', enableStructured: boolean = false) {
    this.level = level;
    this.enableStructured = enableStructured;
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.log('error', message, context);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.log('info', message, context);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, context);
    }
  }

  trace(message: string, context?: LogContext): void {
    if (this.shouldLog('trace')) {
      this.log('trace', message, context);
    }
  }

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

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();

    if (this.enableStructured) {
      const logEntry = {
        timestamp,
        level,
        message,
        ...(context && { context }),
      };

      // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Console output is the intended behavior for logger implementation. This is the core functionality of the logging service in serverless environments.
      console[level === 'trace' ? 'debug' : level](JSON.stringify(logEntry));
    } else {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';

      // eslint-disable-next-line no-console -- ARCHITECTURAL JUSTIFICATION: Console output is the intended behavior for logger implementation. This is the core functionality of the logging service in serverless environments.
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
 * components or environments.
 *
 * @param level - Minimum log level to output (defaults to 'info')
 * @param enableStructured - Whether to use JSON structured output (defaults to false)
 * @returns A new Logger instance
 * @example
 * ```typescript
 * const devLogger = createLogger('debug', false);
 * const prodLogger = createLogger('info', true);
 * ```
 * @since 1.0.0
 * @see {@link Logger} for the logger interface
 */
export function createLogger(level: LogLevel = 'info', enableStructured: boolean = false): Logger {
  return new ApplicationLogger(level, enableStructured);
}

/**
 * Get the singleton logger instance
 *
 * Returns the global logger instance, creating it with default settings
 * if it doesn't exist. This is the recommended way to access the logger
 * throughout the application.
 *
 * @returns The singleton Logger instance
 * @example
 * ```typescript
 * import { getLogger } from './logger.js';
 * const logger = getLogger();
 * logger.info('Application started');
 * ```
 * @since 1.0.0
 * @see {@link setLogger} for configuring the singleton
 */
export function getLogger(): Logger {
  loggerInstance ??= new ApplicationLogger();
  return loggerInstance;
}

/**
 * Set the singleton logger instance
 *
 * Replaces the global logger instance with a custom logger implementation.
 * Useful for dependency injection and testing with mock loggers.
 *
 * @param logger - The Logger instance to use as the singleton
 * @example
 * ```typescript
 * const customLogger = createLogger('debug', true);
 * setLogger(customLogger);
 * ```
 * @since 1.0.0
 * @see {@link getLogger} for accessing the singleton
 */
export function setLogger(logger: Logger): void {
  loggerInstance = logger;
}
