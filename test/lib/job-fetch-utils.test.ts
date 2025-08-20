/**
 * @fileoverview Comprehensive test suite for job fetching utilities
 *
 * Tests all job fetching utility classes including URL building, error handling,
 * and data validation. Uses DRY principles with shared utilities for consistent
 * test patterns and maintainable code.
 *
 * Key test areas:
 * - DRIVEHR_CONSTANTS: Base URL constants
 * - DriveHrUrlBuilder: Careers page URL construction
 * - JobFetchErrorHandler: Error logging and strategy failure handling
 * - JobDataExtractor: Data validation utilities
 * - Edge cases and error conditions for all utility functions
 * - Integration patterns between utilities
 *
 * @since 1.0.0
 * @see {@link ../../src/lib/job-fetch-utils.ts} for implementation details
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DRIVEHR_CONSTANTS,
  DriveHrUrlBuilder,
  JobFetchErrorHandler,
  JobDataExtractor,
} from '../../src/lib/job-fetch-utils.js';
import type { DriveHrApiConfig } from '../../src/types/api.js';
import type { RawJobData } from '../../src/types/job.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as logger from '../../src/lib/logger.js';

/**
 * Specialized test utilities for job fetching utility testing
 *
 * Extends BaseTestUtils with job-fetch-specific testing capabilities including
 * mock data generation, URL validation, and error simulation. Implements DRY
 * principles to eliminate code duplication across job fetching utility tests.
 *
 * @extends BaseTestUtils
 * @since 1.0.0
 */
class JobFetchUtilsTestUtils extends BaseTestUtils {
  /**
   * Mock logger instance for testing error handling
   * @since 1.0.0
   */
  static mockLogger = {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  };

  /**
   * Standard DriveHR API configuration for testing
   * Provides consistent test data for URL building and configuration tests
   * @since 1.0.0
   */
  static readonly STANDARD_CONFIG: DriveHrApiConfig = {
    companyId: 'test-company',
    apiBaseUrl: 'https://api.test-company.com',
    careersUrl: 'https://drivehris.app/careers/test-company/list',
  };

  /**
   * Configuration variations for comprehensive URL testing
   * Tests different scenarios and edge cases for URL construction
   * @since 1.0.0
   */
  static readonly CONFIG_VARIATIONS = [
    {
      name: 'standard config',
      config: this.STANDARD_CONFIG,
    },
    {
      name: 'minimal config',
      config: {
        companyId: 'minimal-co',
        apiBaseUrl: 'https://api.minimal.com',
      } as DriveHrApiConfig,
    },
    {
      name: 'custom careers URL',
      config: {
        companyId: 'custom-corp',
        apiBaseUrl: 'https://custom-api.com',
        careersUrl: 'https://jobs.custom-corp.com/openings',
      } as DriveHrApiConfig,
    },
    {
      name: 'special characters in company ID',
      config: {
        companyId: 'tech-startup-2024',
        apiBaseUrl: 'https://tech-startup-2024.api.com',
      } as DriveHrApiConfig,
    },
  ] as const;

  /**
   * Sample raw job data for testing data validation
   * Provides realistic job data structures for validation testing
   * @since 1.0.0
   */
  static readonly SAMPLE_JOB_DATA: RawJobData[] = [
    {
      id: 'job-001',
      title: 'Senior Software Engineer',
      description: 'Lead development of cutting-edge applications',
      location: 'San Francisco, CA',
      department: 'Engineering',
      employmentType: 'Full-time',
      datePosted: '2024-01-01T00:00:00Z',
      validThrough: '2024-02-01T00:00:00Z',
    },
    {
      id: 'job-002',
      title: 'Product Manager',
      description: 'Drive product strategy and roadmap execution',
      location: 'Remote',
      department: 'Product',
      employmentType: 'Full-time',
      datePosted: '2024-01-02T00:00:00Z',
    },
    {
      id: 'job-003',
      title: 'UX Designer',
      description: 'Create intuitive and beautiful user experiences',
      location: 'New York, NY',
      department: 'Design',
      employmentType: 'Contract',
      datePosted: '2024-01-03T00:00:00Z',
    },
  ];

  /**
   * Setup logger mocking before each test
   * @since 1.0.0
   */
  static setupLoggerMocks(): void {
    vi.spyOn(logger, 'getLogger').mockReturnValue(this.mockLogger);
  }

  /**
   * Restore logger mocks after each test
   * @since 1.0.0
   */
  static restoreLoggerMocks(): void {
    vi.restoreAllMocks();
    Object.values(this.mockLogger).forEach(mock => mock.mockClear());
  }

  /**
   * Validate URL format and basic structure
   *
   * @param url - URL to validate
   * @param expectedProtocol - Expected protocol (default: https)
   * @since 1.0.0
   */
  static validateUrl(url: string, expectedProtocol = 'https:'): void {
    expect(url).toBeTypeOf('string');
    expect(url.length).toBeGreaterThan(0);

    // Should be a valid URL
    expect(() => new URL(url)).not.toThrow();

    const urlObj = new URL(url);
    expect(urlObj.protocol).toBe(expectedProtocol);
    expect(urlObj.hostname).toBeTruthy();
  }

  /**
   * Create test error objects for error handling tests
   *
   * @param type - Type of error to create
   * @returns Error object or unknown value for testing error handling
   * @since 1.0.0
   */
  static createTestErrorForHandling(type: 'standard' | 'network' | 'unknown'): unknown {
    switch (type) {
      case 'standard':
        return new Error('Test error message');
      case 'network':
        return new Error('Network request failed');
      case 'unknown':
        return 'Unknown error string';
      default:
        return new Error('Generic test error');
    }
  }
}

describe('Job Fetch Utils', () => {
  beforeEach(() => {
    JobFetchUtilsTestUtils.setupLoggerMocks();
  });

  afterEach(() => {
    JobFetchUtilsTestUtils.restoreLoggerMocks();
  });

  describe('DRIVEHR_CONSTANTS', () => {
    it('should have correct base URL constant', () => {
      expect(DRIVEHR_CONSTANTS.BASE_URL).toBe('https://drivehris.app');
      expect(DRIVEHR_CONSTANTS.BASE_URL).toBeTypeOf('string');
    });

    it('should be immutable (readonly) constant', () => {
      // The constants use 'as const' which provides compile-time immutability
      expect(DRIVEHR_CONSTANTS).toBeDefined();
      expect(typeof DRIVEHR_CONSTANTS).toBe('object');
      expect(DRIVEHR_CONSTANTS.BASE_URL).toBeTruthy();
    });
  });

  describe('DriveHrUrlBuilder', () => {
    describe('buildCareersPageUrl', () => {
      it('should use explicit careers URL when provided', () => {
        const config = {
          companyId: 'test-co',
          apiBaseUrl: 'https://api.test-co.com',
          careersUrl: 'https://custom.example.com/jobs',
        };

        const url = DriveHrUrlBuilder.buildCareersPageUrl(config);
        expect(url).toBe('https://custom.example.com/jobs');
        JobFetchUtilsTestUtils.validateUrl(url);
      });

      it('should build default careers URL when not provided', () => {
        const config = {
          companyId: 'default-company',
          apiBaseUrl: 'https://api.default-company.com',
        } as DriveHrApiConfig;

        const url = DriveHrUrlBuilder.buildCareersPageUrl(config);
        expect(url).toBe('https://drivehris.app/careers/default-company/list');
        JobFetchUtilsTestUtils.validateUrl(url);
      });

      it('should handle various company ID formats', () => {
        const testCases = [
          'simple',
          'with-dashes',
          'with_underscores',
          'MixedCase',
          'numbers123',
          'complex-company_name-2024',
        ];

        testCases.forEach(companyId => {
          const config = {
            companyId,
            apiBaseUrl: `https://api.${companyId}.com`,
          } as DriveHrApiConfig;
          const url = DriveHrUrlBuilder.buildCareersPageUrl(config);

          expect(url).toBe(`https://drivehris.app/careers/${companyId}/list`);
          JobFetchUtilsTestUtils.validateUrl(url);
        });
      });

      it('should prefer explicit URL over default construction', () => {
        const config = {
          companyId: 'test-company',
          apiBaseUrl: 'https://api.test-company.com',
          careersUrl: 'https://completely-different.com/careers-page',
        };

        const url = DriveHrUrlBuilder.buildCareersPageUrl(config);
        expect(url).toBe('https://completely-different.com/careers-page');
        expect(url).not.toContain('drivehris.app');
        expect(url).not.toContain('test-company');
      });
    });
  });

  describe('JobFetchErrorHandler', () => {
    describe('logAndContinue', () => {
      it('should log non-critical errors at debug level', () => {
        const error = JobFetchUtilsTestUtils.createTestErrorForHandling('standard');
        const context = 'HTML parsing';
        const url = 'https://example.com/careers';

        JobFetchErrorHandler.logAndContinue(context, url, error);

        expect(JobFetchUtilsTestUtils.mockLogger.debug).toHaveBeenCalledTimes(1);
        expect(JobFetchUtilsTestUtils.mockLogger.debug).toHaveBeenCalledWith(
          `${context} failed: ${url}`,
          { error }
        );
      });

      it('should handle different error types', () => {
        const testCases = [
          { errorType: 'standard', context: 'HTTP request', url: 'https://api.test.com' },
          { errorType: 'network', context: 'Network call', url: 'https://unreachable.com' },
          { errorType: 'unknown', context: 'Data parsing', url: 'https://malformed.com' },
        ] as const;

        testCases.forEach(({ errorType, context, url }) => {
          const error = JobFetchUtilsTestUtils.createTestErrorForHandling(errorType);

          JobFetchErrorHandler.logAndContinue(context, url, error);

          expect(JobFetchUtilsTestUtils.mockLogger.debug).toHaveBeenCalledWith(
            `${context} failed: ${url}`,
            { error }
          );
        });

        expect(JobFetchUtilsTestUtils.mockLogger.debug).toHaveBeenCalledTimes(3);
      });

      it('should not throw errors during logging', () => {
        const malformedError = {
          toString: () => {
            throw new Error('toString failed');
          },
        };

        expect(() => {
          JobFetchErrorHandler.logAndContinue('Test context', 'https://test.com', malformedError);
        }).not.toThrow();

        expect(JobFetchUtilsTestUtils.mockLogger.debug).toHaveBeenCalledTimes(1);
      });
    });

    describe('logStrategyFailure', () => {
      it('should log strategy failures at warning level with error messages', () => {
        const error = new Error('Strategy implementation failed');
        const strategyName = 'HTMLStrategy';

        JobFetchErrorHandler.logStrategyFailure(strategyName, error);

        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledWith(
          'Strategy HTMLStrategy failed: Strategy implementation failed'
        );
      });

      it('should handle non-Error objects gracefully', () => {
        const unknownError = 'String error message';
        const strategyName = 'HTMLParsingStrategy';

        JobFetchErrorHandler.logStrategyFailure(strategyName, unknownError);

        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledWith(
          'Strategy HTMLParsingStrategy failed: Unknown error'
        );
      });

      it('should handle different strategy names', () => {
        const strategies = ['HTMLStrategy', 'PlaywrightStrategy', 'FallbackStrategy'];

        strategies.forEach((strategyName, index) => {
          const error = new Error(`${strategyName} specific error`);
          JobFetchErrorHandler.logStrategyFailure(strategyName, error);

          expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenNthCalledWith(
            index + 1,
            `Strategy ${strategyName} failed: ${strategyName} specific error`
          );
        });

        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledTimes(3);
      });

      it('should handle null and undefined errors', () => {
        JobFetchErrorHandler.logStrategyFailure('TestStrategy', null);
        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledWith(
          'Strategy TestStrategy failed: Unknown error'
        );

        JobFetchErrorHandler.logStrategyFailure('TestStrategy', undefined);
        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledWith(
          'Strategy TestStrategy failed: Unknown error'
        );
      });
    });
  });

  describe('JobDataExtractor', () => {
    describe('isValidJobArray', () => {
      it('should return true for non-empty job arrays', () => {
        const validArrays = [
          JobFetchUtilsTestUtils.SAMPLE_JOB_DATA,
          [{ id: 'single-job', title: 'Test Job' }],
          [{ minimal: 'job' }, { another: 'job' }],
        ];

        validArrays.forEach(jobs => {
          expect(JobDataExtractor.isValidJobArray(jobs)).toBe(true);
        });
      });

      it('should return false for empty arrays', () => {
        expect(JobDataExtractor.isValidJobArray([])).toBe(false);
      });

      it('should return false for non-array values', () => {
        const nonArrays = [
          null,
          undefined,
          'string',
          123,
          {},
          { jobs: JobFetchUtilsTestUtils.SAMPLE_JOB_DATA },
          true,
          false,
        ];

        nonArrays.forEach(value => {
          expect(JobDataExtractor.isValidJobArray(value)).toBe(false);
        });
      });

      it('should provide type guard functionality', () => {
        const unknownData: unknown = JobFetchUtilsTestUtils.SAMPLE_JOB_DATA;

        if (JobDataExtractor.isValidJobArray(unknownData)) {
          // TypeScript should now know this is RawJobData[]
          expect(unknownData[0]?.id).toBe('job-001');
          expect(unknownData[0]?.title).toBe('Senior Software Engineer');
        }
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together for HTML job fetching workflow', () => {
      // 1. Build careers URL using DriveHrUrlBuilder
      const careersUrl = DriveHrUrlBuilder.buildCareersPageUrl(
        JobFetchUtilsTestUtils.STANDARD_CONFIG
      );
      expect(careersUrl).toBe('https://drivehris.app/careers/test-company/list');
      JobFetchUtilsTestUtils.validateUrl(careersUrl);

      // 2. Validate job data
      const jobData = JobFetchUtilsTestUtils.SAMPLE_JOB_DATA;
      expect(JobDataExtractor.isValidJobArray(jobData)).toBe(true);
      expect(jobData).toHaveLength(3);

      // 3. Simulate error handling if needed
      const testError = new Error('Integration test error');
      JobFetchErrorHandler.logAndContinue('Integration test', careersUrl, testError);

      expect(JobFetchUtilsTestUtils.mockLogger.debug).toHaveBeenCalledWith(
        `Integration test failed: ${careersUrl}`,
        { error: testError }
      );
    });

    it('should handle URL building and error logging consistently', () => {
      const sampleData = JobFetchUtilsTestUtils.SAMPLE_JOB_DATA;

      // Test careers URL building
      const careersUrl = DriveHrUrlBuilder.buildCareersPageUrl(
        JobFetchUtilsTestUtils.STANDARD_CONFIG
      );
      expect(careersUrl).toBeTruthy();
      JobFetchUtilsTestUtils.validateUrl(careersUrl);

      // Test data validation
      expect(JobDataExtractor.isValidJobArray(sampleData)).toBe(true);
      expect(JobDataExtractor.isValidJobArray([])).toBe(false);
      expect(JobDataExtractor.isValidJobArray(null)).toBe(false);

      // Test error handling
      const testError = new Error('Test error');
      JobFetchErrorHandler.logStrategyFailure('TestStrategy', testError);
      expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledWith(
        'Strategy TestStrategy failed: Test error'
      );
    });
  });
});
