/**
 * ApplicationLogger Service Test Suite
 *
 * Comprehensive test coverage for ApplicationLogger service following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates the complete logging functionality including log
 * levels, structured output, singleton management, and proper console integration.
 *
 * Test Features:
 * - Logger interface implementation and contract compliance
 * - Log level filtering and hierarchical behavior
 * - Structured JSON vs plain text output formats
 * - Singleton pattern with getLogger/setLogger functions
 * - Factory function behavior with createLogger
 * - Console output verification and format validation
 * - Context data handling and serialization
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/logger.test.ts -- --grep "structured"
 * ```
 *
 * @module logger-test-suite
 * @since 1.0.0
 * @see {@link ../../src/lib/logger.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { Logger, LogContext, createLogger, getLogger, setLogger } from '../../src/lib/logger.js';
import type { LogLevel } from '../../src/types/config.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';

/**
 * Logger-specific test utilities
 *
 * Extends BaseTestUtils with specialized logger testing capabilities including
 * console mocking, output verification, and log level scenario generation.
 * Maintains DRY principles while providing comprehensive testing support.
 *
 * @extends BaseTestUtils
 * @since 1.0.0
 */
class LoggerTestUtils extends BaseTestUtils {
  private static consoleMocks: Record<string, MockInstance> = {};

  static readonly LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

  static readonly LEVEL_PRIORITIES: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
  };

  /**
   * Setup console method mocks for testing
   *
   * Configures Vitest mocks for all console methods used by the logger
   * to prevent actual console output during tests and enable output verification.
   *
   * @example
   * ```typescript
   * LoggerTestUtils.setupConsoleMocks();
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
   * Restore all console mocks to original implementations
   *
   * Cleans up all Vitest console mocks and restores original console methods.
   * Essential for proper test isolation and teardown procedures.
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
   * Get console mock instance for a specific log level
   *
   * Retrieves the appropriate Vitest console mock for verification of logger output.
   * Handles the mapping of 'trace' level to 'debug' console method for compatibility.
   *
   * @param level - Log level to get mock for
   * @returns The Vitest mock instance for the console method
   * @throws {Error} When mock for the specified level is not found
   * @example
   * ```typescript
   * const debugMock = LoggerTestUtils.getConsoleMock('debug');
   * expect(debugMock).toHaveBeenCalledWith(expectedOutput);
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
   * Verify plain text logger output format and content
   *
   * Validates that logger output matches expected plain text format with proper
   * timestamp, log level, message, and optional context data formatting.
   *
   * @param level - Expected log level in the output
   * @param message - Expected message content
   * @param context - Optional context data to verify in output
   * @throws {Error} When console calls are not found for the specified level
   * @example
   * ```typescript
   * LoggerTestUtils.verifyPlainTextOutput('info', 'Test message', { userId: 123 });
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
   * Verify structured JSON logger output format and content
   *
   * Validates that logger output matches expected structured JSON format with proper
   * timestamp, log level, message, and optional context data structure.
   *
   * @param level - Expected log level in the output
   * @param message - Expected message content
   * @param context - Optional context data to verify in output
   * @throws {Error} When console calls are not found for the specified level
   * @example
   * ```typescript
   * LoggerTestUtils.verifyStructuredOutput('error', 'API failed', { statusCode: 500 });
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
   * Verify no console output was generated
   *
   * Validates that none of the console mock methods were called, useful for
   * testing log level filtering where lower priority messages should be suppressed.
   *
   * @example
   * ```typescript
   * // After logging below threshold
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
   * Create mock Logger implementation for testing
   *
   * Generates a complete Logger interface implementation with Vitest mock functions
   * for all log levels, useful for dependency injection testing scenarios.
   *
   * @returns Mock Logger instance with all methods as Vitest functions
   * @example
   * ```typescript
   * const mockLogger = LoggerTestUtils.createMockLogger();
   * setLogger(mockLogger);
   * expect(mockLogger.info).toHaveBeenCalledWith('Expected message');
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
   * Generate comprehensive log level testing scenarios
   *
   * Creates all combinations of logger levels and message levels to test
   * hierarchical log level filtering behavior comprehensively.
   *
   * @returns Array of test scenarios with logger level, message level, and expected behavior
   * @example
   * ```typescript
   * const scenarios = LoggerTestUtils.getLogLevelScenarios();
   * scenarios.forEach(({ loggerLevel, messageLevel, shouldLog }) => {
   *   // Test each scenario
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

      // ARCHITECTURAL JUSTIFICATION: Logger testing requires direct console method verification to ensure
      // proper log level to console method mapping. The logger's core functionality is console output delegation.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. Testing only LoggerTestUtils mocks: Would lose verification of actual console integration
      // 2. Using console spy without direct access: Vitest/Jest require direct console reference for assertions
      // 3. Refactoring logger to avoid console: Would break serverless logging architecture
      //
      // CONCLUSION: eslint-disable is architecturally necessary for testing console-based logging implementation
      // eslint-disable-next-line no-console
      expect(console.debug).toHaveBeenCalledTimes(1);
    });

    it('should use correct console method for each level', () => {
      const logger = createLogger('trace'); // Enable all levels

      logger.error('Error message');
      logger.warn('Warn message');
      logger.info('Info message');
      logger.debug('Debug message');

      // ARCHITECTURAL JUSTIFICATION: Logger testing requires direct console method verification to ensure
      // proper log level to console method mapping. The logger's core functionality is console output delegation.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. Testing only LoggerTestUtils mocks: Would lose verification of actual console integration
      // 2. Using console spy without direct access: Vitest/Jest require direct console reference for assertions
      // 3. Refactoring logger to avoid console: Would break serverless logging architecture
      //
      // CONCLUSION: eslint-disable is architecturally necessary for testing console-based logging implementation
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledTimes(1);

      // ARCHITECTURAL JUSTIFICATION: Logger testing requires direct console method verification to ensure
      // proper log level to console method mapping. The logger's core functionality is console output delegation.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. Testing only LoggerTestUtils mocks: Would lose verification of actual console integration
      // 2. Using console spy without direct access: Vitest/Jest require direct console reference for assertions
      // 3. Refactoring logger to avoid console: Would break serverless logging architecture
      //
      // CONCLUSION: eslint-disable is architecturally necessary for testing console-based logging implementation
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalledTimes(1);

      // ARCHITECTURAL JUSTIFICATION: Logger testing requires direct console method verification to ensure
      // proper log level to console method mapping. The logger's core functionality is console output delegation.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. Testing only LoggerTestUtils mocks: Would lose verification of actual console integration
      // 2. Using console spy without direct access: Vitest/Jest require direct console reference for assertions
      // 3. Refactoring logger to avoid console: Would break serverless logging architecture
      //
      // CONCLUSION: eslint-disable is architecturally necessary for testing console-based logging implementation
      // eslint-disable-next-line no-console
      expect(console.info).toHaveBeenCalledTimes(1);

      // ARCHITECTURAL JUSTIFICATION: Logger testing requires direct console method verification to ensure
      // proper log level to console method mapping. The logger's core functionality is console output delegation.
      //
      // ALTERNATIVES CONSIDERED:
      // 1. Testing only LoggerTestUtils mocks: Would lose verification of actual console integration
      // 2. Using console spy without direct access: Vitest/Jest require direct console reference for assertions
      // 3. Refactoring logger to avoid console: Would break serverless logging architecture
      //
      // CONCLUSION: eslint-disable is architecturally necessary for testing console-based logging implementation
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
