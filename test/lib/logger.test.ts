/**
 * @fileoverview Comprehensive test suite for ApplicationLogger service
 *
 * Tests the complete logging functionality including log levels, structured output,
 * singleton management, and proper console integration. Uses DRY principles with
 * shared utilities for consistent test patterns and maintainable code.
 *
 * Key test areas:
 * - Logger interface implementation and contract compliance
 * - Log level filtering and hierarchical behavior
 * - Structured JSON vs plain text output formats
 * - Singleton pattern with getLogger/setLogger functions
 * - Factory function behavior with createLogger
 * - Console output verification and format validation
 * - Context data handling and serialization
 * - Log level mapping and priority enforcement
 *
 * @since 1.0.0
 * @see {@link ../../src/lib/logger.ts} for implementation details
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { Logger, LogContext, createLogger, getLogger, setLogger } from '../../src/lib/logger.js';
import type { LogLevel } from '../../src/types/config.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';

/**
 * Specialized test utilities for logger service testing
 *
 * Extends BaseTestUtils with logger-specific testing capabilities including
 * console mocking, log level verification, and structured output validation.
 * Implements DRY principles to eliminate code duplication across logger tests.
 *
 * @extends BaseTestUtils
 * @since 1.0.0
 */
class LoggerTestUtils extends BaseTestUtils {
  /**
   * Console spy instances for intercepting log outputs
   * Maps console methods to their respective spies for verification
   * @since 1.0.0
   */
  private static consoleMocks: Record<string, MockInstance> = {};

  /**
   * Standard test log levels with expected behavior
   * Provides consistent test data for log level filtering tests
   * @since 1.0.0
   */
  static readonly LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

  /**
   * Log level priority mapping for filtering tests
   * Lower numbers indicate higher priority (more important logs)
   * @since 1.0.0
   */
  static readonly LEVEL_PRIORITIES: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
  };

  /**
   * Setup console method mocking for log output verification
   *
   * Mocks all console methods used by the logger to capture and verify
   * log outputs during testing. Essential for testing console integration
   * without cluttering test output.
   *
   * @example
   * ```typescript
   * LoggerTestUtils.setupConsoleMocks();
   * logger.info('test message');
   * expect(console.info).toHaveBeenCalledWith(expect.stringContaining('test message'));
   * ```
   * @since 1.0.0
   */
  static setupConsoleMocks(): void {
    // Mock all console methods that the logger uses
    this.consoleMocks['error'] = vi.spyOn(console, 'error').mockImplementation(() => {});
    this.consoleMocks['warn'] = vi.spyOn(console, 'warn').mockImplementation(() => {});
    this.consoleMocks['info'] = vi.spyOn(console, 'info').mockImplementation(() => {});
    this.consoleMocks['debug'] = vi.spyOn(console, 'debug').mockImplementation(() => {});
  }

  /**
   * Restore original console methods after testing
   *
   * Restores all console methods to their original implementations
   * and clears spy history. Essential cleanup to prevent test interference.
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   LoggerTestUtils.restoreConsoleMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static restoreConsoleMocks(): void {
    Object.values(this.consoleMocks).forEach(mock => mock.mockRestore());
    this.consoleMocks = {};
  }

  /**
   * Get console mock for specific log level
   *
   * Returns the appropriate console spy for the given log level,
   * handling the trace->debug mapping used by the logger implementation.
   *
   * @param level - The log level to get console mock for
   * @returns Console spy instance for verification
   * @example
   * ```typescript
   * const consoleMock = LoggerTestUtils.getConsoleMock('info');
   * expect(consoleMock).toHaveBeenCalledTimes(1);
   * ```
   * @since 1.0.0
   */
  static getConsoleMock(level: LogLevel): MockInstance {
    // Logger maps trace to debug for console compatibility
    const consoleMethod = level === 'trace' ? 'debug' : level;
    const mock = this.consoleMocks[consoleMethod];
    if (!mock) {
      throw new Error(`Console mock for level '${level}' not found`);
    }
    return mock;
  }

  /**
   * Verify console output format for plain text logging
   *
   * Validates that console output matches expected plain text format
   * with timestamp, log level, message, and optional context.
   *
   * @param level - Log level that was used
   * @param message - Expected log message
   * @param context - Optional context data
   * @example
   * ```typescript
   * LoggerTestUtils.verifyPlainTextOutput('info', 'Test message', { key: 'value' });
   * ```
   * @since 1.0.0
   */
  static verifyPlainTextOutput(level: LogLevel, message: string, context?: LogContext): void {
    const consoleMock = this.getConsoleMock(level);
    const call = consoleMock.mock.calls[consoleMock.mock.calls.length - 1];
    if (!call) {
      throw new Error(`No console calls found for level '${level}'`);
    }
    const logOutput = call[0];

    // Verify timestamp format (ISO string in brackets)
    expect(logOutput).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);

    // Verify log level (uppercase in brackets)
    expect(logOutput).toContain(`[${level.toUpperCase()}]`);

    // Verify message content
    expect(logOutput).toContain(message);

    // Verify context if provided
    if (context) {
      expect(logOutput).toContain(JSON.stringify(context));
    }
  }

  /**
   * Verify console output format for structured JSON logging
   *
   * Validates that console output is properly formatted JSON with required
   * fields including timestamp, level, message, and optional context.
   *
   * @param level - Log level that was used
   * @param message - Expected log message
   * @param context - Optional context data
   * @example
   * ```typescript
   * LoggerTestUtils.verifyStructuredOutput('error', 'Error occurred', { code: 500 });
   * ```
   * @since 1.0.0
   */
  static verifyStructuredOutput(level: LogLevel, message: string, context?: LogContext): void {
    const consoleMock = this.getConsoleMock(level);
    const call = consoleMock.mock.calls[consoleMock.mock.calls.length - 1];
    if (!call) {
      throw new Error(`No console calls found for level '${level}'`);
    }
    const logOutput = call[0];

    // Parse JSON output
    const parsed = JSON.parse(logOutput);

    // Verify required fields
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(parsed.level).toBe(level);
    expect(parsed.message).toBe(message);

    // Verify context if provided
    if (context) {
      expect(parsed.context).toEqual(context);
    } else {
      expect(parsed.context).toBeUndefined();
    }
  }

  /**
   * Verify that no console output was generated
   *
   * Ensures that no console methods were called, useful for testing
   * log level filtering where messages should be suppressed.
   *
   * @example
   * ```typescript
   * LoggerTestUtils.verifyNoConsoleOutput();
   * ```
   * @since 1.0.0
   */
  static verifyNoConsoleOutput(): void {
    Object.values(this.consoleMocks).forEach(mock => {
      expect(mock).not.toHaveBeenCalled();
    });
  }

  /**
   * Create mock logger implementation for testing
   *
   * Creates a mock logger that implements the Logger interface with
   * spy functions for all methods. Useful for testing singleton behavior
   * and dependency injection scenarios.
   *
   * @returns Mock logger with spy methods
   * @example
   * ```typescript
   * const mockLogger = LoggerTestUtils.createMockLogger();
   * setLogger(mockLogger);
   * getLogger().info('test');
   * expect(mockLogger.info).toHaveBeenCalledWith('test');
   * ```
   * @since 1.0.0
   */
  static createMockLogger(): Logger {
    return {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };
  }

  /**
   * Get test scenarios for log level filtering
   *
   * Provides comprehensive test scenarios for verifying log level filtering
   * behavior across all combinations of logger levels and message levels.
   *
   * @returns Array of test scenarios with logger level, message level, and expected behavior
   * @example
   * ```typescript
   * LoggerTestUtils.getLogLevelScenarios().forEach(({ loggerLevel, messageLevel, shouldLog }) => {
   *   it(`should ${shouldLog ? '' : 'not '}log ${messageLevel} when level is ${loggerLevel}`, () => {
   *     const logger = createLogger(loggerLevel);
   *     logger[messageLevel]('test');
   *     if (shouldLog) {
   *       expect(console[messageLevel]).toHaveBeenCalled();
   *     } else {
   *       LoggerTestUtils.verifyNoConsoleOutput();
   *     }
   *   });
   * });
   * ```
   * @since 1.0.0
   */
  static getLogLevelScenarios(): Array<{
    loggerLevel: LogLevel;
    messageLevel: LogLevel;
    shouldLog: boolean;
  }> {
    const scenarios: Array<{
      loggerLevel: LogLevel;
      messageLevel: LogLevel;
      shouldLog: boolean;
    }> = [];

    for (const loggerLevel of this.LOG_LEVELS) {
      for (const messageLevel of this.LOG_LEVELS) {
        const shouldLog = this.LEVEL_PRIORITIES[messageLevel] <= this.LEVEL_PRIORITIES[loggerLevel];
        scenarios.push({
          loggerLevel,
          messageLevel,
          shouldLog,
        });
      }
    }

    return scenarios;
  }
}

describe('Logger Service', () => {
  beforeEach(() => {
    LoggerTestUtils.setupConsoleMocks();
  });

  afterEach(() => {
    LoggerTestUtils.restoreConsoleMocks();
    // Reset singleton state
    setLogger(createLogger());
  });

  describe('Logger Interface Implementation', () => {
    it('should implement all required logger methods', () => {
      const logger = createLogger();

      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
    });

    it('should accept message and optional context parameters', () => {
      const logger = createLogger('debug');

      // Test without context
      expect(() => logger.info('Test message')).not.toThrow();

      // Test with context
      const context = { userId: '123', action: 'login' };
      expect(() => logger.info('User logged in', context)).not.toThrow();
    });
  });

  describe('Log Level Filtering', () => {
    LoggerTestUtils.getLogLevelScenarios().forEach(({ loggerLevel, messageLevel, shouldLog }) => {
      it(`should ${shouldLog ? '' : 'not '}log ${messageLevel} messages when logger level is ${loggerLevel}`, () => {
        const logger = createLogger(loggerLevel);
        const testMessage = `Test ${messageLevel} message`;

        logger[messageLevel](testMessage);

        if (shouldLog) {
          const consoleMock = LoggerTestUtils.getConsoleMock(messageLevel);
          expect(consoleMock).toHaveBeenCalledTimes(1);
        } else {
          LoggerTestUtils.verifyNoConsoleOutput();
        }
      });
    });

    it('should handle default log level (info) correctly', () => {
      const logger = createLogger(); // Default level is 'info'

      logger.error('Error message');
      logger.warn('Warning message');
      logger.info('Info message');
      logger.debug('Debug message'); // Should be filtered out
      logger.trace('Trace message'); // Should be filtered out

      expect(LoggerTestUtils.getConsoleMock('error')).toHaveBeenCalledTimes(1);
      expect(LoggerTestUtils.getConsoleMock('warn')).toHaveBeenCalledTimes(1);
      expect(LoggerTestUtils.getConsoleMock('info')).toHaveBeenCalledTimes(1);
      expect(LoggerTestUtils.getConsoleMock('debug')).not.toHaveBeenCalled();
    });
  });

  describe('Plain Text Output Format', () => {
    it('should format log messages correctly without context', () => {
      const logger = createLogger('info', false); // Plain text format
      const testMessage = 'Test log message';

      logger.info(testMessage);

      LoggerTestUtils.verifyPlainTextOutput('info', testMessage);
    });

    it('should include context data in plain text format', () => {
      const logger = createLogger('info', false);
      const testMessage = 'User action';
      const context = { userId: '12345', action: 'login', timestamp: Date.now() };

      logger.warn(testMessage, context);

      LoggerTestUtils.verifyPlainTextOutput('warn', testMessage, context);
    });

    it('should format all log levels correctly in plain text', () => {
      const logger = createLogger('trace', false); // Enable all levels

      LoggerTestUtils.LOG_LEVELS.forEach(level => {
        const message = `${level} message`;
        const context = { level, test: true };

        logger[level](message, context);
        LoggerTestUtils.verifyPlainTextOutput(level, message, context);
      });
    });
  });

  describe('Structured JSON Output Format', () => {
    it('should format log messages as JSON without context', () => {
      const logger = createLogger('info', true); // JSON format
      const testMessage = 'Structured log message';

      logger.error(testMessage);

      LoggerTestUtils.verifyStructuredOutput('error', testMessage);
    });

    it('should include context data in JSON format', () => {
      const logger = createLogger('debug', true);
      const testMessage = 'Processing request';
      const context = {
        requestId: 'req-123',
        userId: 'user-456',
        processing_time_ms: 150,
        success: true,
      };

      logger.debug(testMessage, context);

      LoggerTestUtils.verifyStructuredOutput('debug', testMessage, context);
    });

    it('should handle complex context objects in JSON', () => {
      const logger = createLogger('trace', true);
      const complexContext = {
        nested: { data: { value: 42 } },
        array: [1, 2, 3],
        nullValue: null,
        booleanValue: false,
        stringValue: 'test',
      };

      logger.trace('Complex context test', complexContext);

      LoggerTestUtils.verifyStructuredOutput('trace', 'Complex context test', complexContext);
    });
  });

  describe('Factory Function (createLogger)', () => {
    it('should create logger with default configuration', () => {
      const logger = createLogger();

      // Default level is 'info', structured is false
      logger.info('Test info message');
      logger.debug('Test debug message'); // Should be filtered

      expect(LoggerTestUtils.getConsoleMock('info')).toHaveBeenCalledTimes(1);
      expect(LoggerTestUtils.getConsoleMock('debug')).not.toHaveBeenCalled();

      // Should use plain text format (not JSON)
      const call = LoggerTestUtils.getConsoleMock('info').mock.calls[0];
      if (!call) {
        throw new Error('No console calls found for info level');
      }
      expect(() => JSON.parse(call[0])).toThrow(); // Not valid JSON
    });

    it('should create logger with custom log level', () => {
      const logger = createLogger('debug');

      logger.debug('Debug message');
      logger.trace('Trace message'); // Should be filtered

      expect(LoggerTestUtils.getConsoleMock('debug')).toHaveBeenCalledTimes(1);
      expect(LoggerTestUtils.getConsoleMock('debug')).not.toHaveBeenCalledTimes(2); // trace maps to debug
    });

    it('should create logger with structured output enabled', () => {
      const logger = createLogger('info', true);

      logger.info('Structured test message');

      const call = LoggerTestUtils.getConsoleMock('info').mock.calls[0];
      if (!call) {
        throw new Error('No console calls found for info level');
      }
      expect(() => JSON.parse(call[0])).not.toThrow(); // Should be valid JSON
    });

    it('should create independent logger instances', () => {
      const logger1 = createLogger('error');
      const logger2 = createLogger('debug');

      logger1.warn('Warning from logger1'); // Should be filtered (error level only)
      logger2.warn('Warning from logger2'); // Should be logged (debug level)

      expect(LoggerTestUtils.getConsoleMock('warn')).toHaveBeenCalledTimes(1);
    });
  });

  describe('Singleton Pattern (getLogger/setLogger)', () => {
    it('should return the same instance on multiple calls', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();

      expect(logger1).toBe(logger2);
    });

    it('should use default configuration for singleton', () => {
      const logger = getLogger();

      logger.info('Info message');
      logger.debug('Debug message'); // Should be filtered with default 'info' level

      expect(LoggerTestUtils.getConsoleMock('info')).toHaveBeenCalledTimes(1);
      expect(LoggerTestUtils.getConsoleMock('debug')).not.toHaveBeenCalled();
    });

    it('should allow replacing singleton with setLogger', () => {
      const mockLogger = LoggerTestUtils.createMockLogger();

      setLogger(mockLogger);

      const retrievedLogger = getLogger();
      expect(retrievedLogger).toBe(mockLogger);
    });

    it('should use custom logger after setLogger', () => {
      const mockLogger = LoggerTestUtils.createMockLogger();
      const testMessage = 'Test message for mock logger';
      const testContext = { mock: true };

      setLogger(mockLogger);

      const logger = getLogger();
      logger.error(testMessage, testContext);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(testMessage, testContext);
    });

    it('should maintain singleton state across multiple getLogger calls after setLogger', () => {
      const mockLogger = LoggerTestUtils.createMockLogger();

      setLogger(mockLogger);

      const logger1 = getLogger();
      const logger2 = getLogger();

      expect(logger1).toBe(mockLogger);
      expect(logger2).toBe(mockLogger);
      expect(logger1).toBe(logger2);
    });
  });

  describe('Console Integration', () => {
    it('should map trace level to console.debug', () => {
      const logger = createLogger('trace');

      logger.trace('Trace message');

      // Trace should use console.debug, not console.trace
      expect(LoggerTestUtils.getConsoleMock('trace')).toHaveBeenCalledTimes(1);

      // ARCHITECTURAL JUSTIFICATION: Testing logger implementation requires direct console verification
      // to ensure proper mapping between log levels and console methods. Mocking console is necessary
      // for unit test isolation and cannot be avoided when testing console-based logging systems.
      // eslint-disable-next-line no-console
      expect(console.debug).toHaveBeenCalledTimes(1);
    });

    it('should use correct console method for each level', () => {
      const logger = createLogger('trace'); // Enable all levels

      logger.error('Error message');
      logger.warn('Warn message');
      logger.info('Info message');
      logger.debug('Debug message');

      // ARCHITECTURAL JUSTIFICATION: Testing logger implementation requires direct console verification
      // to ensure proper mapping between log levels and console methods. Mocking console is necessary
      // for unit test isolation and cannot be avoided when testing console-based logging systems.
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledTimes(1);

      // ARCHITECTURAL JUSTIFICATION: Testing logger implementation requires direct console verification
      // to ensure proper mapping between log levels and console methods. Mocking console is necessary
      // for unit test isolation and cannot be avoided when testing console-based logging systems.
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalledTimes(1);

      // ARCHITECTURAL JUSTIFICATION: Testing logger implementation requires direct console verification
      // to ensure proper mapping between log levels and console methods. Mocking console is necessary
      // for unit test isolation and cannot be avoided when testing console-based logging systems.
      // eslint-disable-next-line no-console
      expect(console.info).toHaveBeenCalledTimes(1);

      // ARCHITECTURAL JUSTIFICATION: Testing logger implementation requires direct console verification
      // to ensure proper mapping between log levels and console methods. Mocking console is necessary
      // for unit test isolation and cannot be avoided when testing console-based logging systems.
      // eslint-disable-next-line no-console
      expect(console.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe('Context Data Handling', () => {
    it('should handle undefined context gracefully', () => {
      const logger = createLogger('info');

      expect(() => logger.info('Message without context')).not.toThrow();

      LoggerTestUtils.verifyPlainTextOutput('info', 'Message without context');
    });

    it('should handle empty context object', () => {
      const logger = createLogger('info', true); // JSON format for easier verification

      logger.info('Message with empty context', {});

      LoggerTestUtils.verifyStructuredOutput('info', 'Message with empty context', {});
    });

    it('should serialize complex context data correctly', () => {
      const logger = createLogger('debug', false); // Plain text format
      const complexContext: LogContext = {
        user: { id: 123, name: 'Test User' },
        metadata: { timestamp: Date.now(), version: '1.0.0' },
        flags: { featureA: true, featureB: false },
        tags: ['important', 'user-action'],
      };

      logger.debug('Complex context test', complexContext);

      const consoleMock = LoggerTestUtils.getConsoleMock('debug');
      const call = consoleMock.mock.calls[0];
      if (!call) {
        throw new Error('No console calls found for debug level');
      }
      const output = call[0];

      // Should contain serialized context
      expect(output).toContain(JSON.stringify(complexContext));
    });
  });
});
