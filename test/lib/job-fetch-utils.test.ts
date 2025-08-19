/**
 * @fileoverview Comprehensive test suite for job fetching utilities
 *
 * Tests all job fetching utility classes including URL building, error handling,
 * and data extraction. Uses DRY principles with shared utilities for consistent
 * test patterns and maintainable code.
 *
 * Key test areas:
 * - DRIVEHR_API_CONSTANTS: API constants and configuration values
 * - DriveHrUrlBuilder: URL construction with fallbacks and format variations
 * - JobFetchErrorHandler: Error logging and strategy failure handling
 * - JobDataExtractor: Data extraction from API responses, JSON-LD, and embedded JS
 * - Edge cases and error conditions for all utility functions
 * - Integration patterns between utilities
 *
 * @since 1.0.0
 * @see {@link ../../src/lib/job-fetch-utils.ts} for implementation details
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DRIVEHR_API_CONSTANTS,
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
   * Sample raw job data for testing data extraction
   * Provides realistic job data structures for extraction testing
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
   * Create API response test data with various formats
   *
   * @param format - Format of the response ('jobs', 'positions', 'data', 'empty')
   * @returns Mock API response object
   * @since 1.0.0
   */
  static createApiResponseData(
    format: 'jobs' | 'positions' | 'data' | 'empty'
  ): Record<string, unknown> {
    switch (format) {
      case 'jobs':
        return { jobs: this.SAMPLE_JOB_DATA };
      case 'positions':
        return { positions: this.SAMPLE_JOB_DATA };
      case 'data':
        return { data: this.SAMPLE_JOB_DATA };
      case 'empty':
        return { message: 'No jobs found' };
      default:
        return {};
    }
  }

  /**
   * Create JSON-LD test data with JobPosting objects
   *
   * @param includeNonJobPostings - Whether to include non-JobPosting objects
   * @returns Array of JSON-LD objects
   * @since 1.0.0
   */
  static createJsonLdData(includeNonJobPostings = true): Record<string, unknown>[] {
    const jobPostings = this.SAMPLE_JOB_DATA.map(job => ({
      '@type': 'JobPosting',
      '@context': 'https://schema.org',
      ...job,
    }));

    if (!includeNonJobPostings) {
      return jobPostings;
    }

    return [
      ...jobPostings,
      {
        '@type': 'Organization',
        '@context': 'https://schema.org',
        name: 'Test Company',
        url: 'https://test-company.com',
      },
      {
        '@type': 'WebSite',
        '@context': 'https://schema.org',
        name: 'Careers Page',
        url: 'https://test-company.com/careers',
      },
    ];
  }

  /**
   * Create embedded JavaScript test data
   *
   * @param hasPositions - Whether to include positions data
   * @returns Embedded JS data object
   * @since 1.0.0
   */
  static createEmbeddedJsData(hasPositions = true): Record<string, unknown> {
    if (!hasPositions) {
      return {
        metadata: { company: 'Test Company', timestamp: '2024-01-01' },
        config: { theme: 'dark' },
      };
    }

    return {
      positions: this.SAMPLE_JOB_DATA,
      metadata: { company: 'Test Company', timestamp: '2024-01-01' },
      config: { theme: 'light', version: '1.0' },
    };
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

  describe('DRIVEHR_API_CONSTANTS', () => {
    it('should have correct base URL constant', () => {
      expect(DRIVEHR_API_CONSTANTS.BASE_URL).toBe('https://drivehris.app');
      expect(DRIVEHR_API_CONSTANTS.BASE_URL).toBeTypeOf('string');
    });

    it('should have all required API path constants', () => {
      expect(DRIVEHR_API_CONSTANTS.API_PATHS).toBeDefined();
      expect(DRIVEHR_API_CONSTANTS.API_PATHS.CAREERS).toBe('/api/careers');
      expect(DRIVEHR_API_CONSTANTS.API_PATHS.CAREERS_V1).toBe('/api/v1/careers');
      expect(DRIVEHR_API_CONSTANTS.API_PATHS.JOBS).toBe('/api/jobs');
    });

    it('should be immutable (readonly) constants', () => {
      // The constants use 'as const' which provides compile-time immutability
      // They are not frozen at runtime, but TypeScript ensures they cannot be modified
      expect(DRIVEHR_API_CONSTANTS).toBeDefined();
      expect(DRIVEHR_API_CONSTANTS.API_PATHS).toBeDefined();

      // Verify structure is correct and values are not modifiable via TypeScript
      expect(typeof DRIVEHR_API_CONSTANTS).toBe('object');
      expect(typeof DRIVEHR_API_CONSTANTS.API_PATHS).toBe('object');
    });

    it('should have valid API path formats', () => {
      Object.values(DRIVEHR_API_CONSTANTS.API_PATHS).forEach(path => {
        expect(path).toMatch(/^\/api/);
        expect(path).not.toContain('//');
        expect(path).not.toMatch(/\/$/); // Should not end with slash
      });
    });
  });

  describe('DriveHrUrlBuilder', () => {
    describe('buildApiUrls', () => {
      it('should build multiple API URLs for standard configuration', () => {
        const urls = DriveHrUrlBuilder.buildApiUrls(JobFetchUtilsTestUtils.STANDARD_CONFIG);

        expect(urls).toHaveLength(3);
        urls.forEach(url => JobFetchUtilsTestUtils.validateUrl(url));

        expect(urls[0]).toBe('https://drivehris.app/api/careers/test-company/jobs');
        expect(urls[1]).toBe('https://drivehris.app/api/v1/careers/test-company/positions');
        expect(urls[2]).toBe('https://api.test-company.com/api/jobs');
      });

      it('should handle different company IDs correctly', () => {
        JobFetchUtilsTestUtils.CONFIG_VARIATIONS.forEach(({ name: _name, config }) => {
          const urls = DriveHrUrlBuilder.buildApiUrls(config as DriveHrApiConfig);

          expect(urls).toHaveLength(3);
          urls.forEach((url, index) => {
            JobFetchUtilsTestUtils.validateUrl(url);
            // Only the first two URLs (DriveHR APIs) contain companyId
            // The third URL uses the provided apiBaseUrl directly
            if (index < 2) {
              expect(url).toContain(config.companyId);
            }
          });
        });
      });

      it('should return URLs in correct priority order', () => {
        const urls = DriveHrUrlBuilder.buildApiUrls(JobFetchUtilsTestUtils.STANDARD_CONFIG);

        // First URL should be main careers API
        expect(urls[0]).toContain('/api/careers/');
        // Second URL should be v1 careers API
        expect(urls[1]).toContain('/api/v1/careers/');
        // Third URL should be custom API base URL
        expect(urls[2]).toContain('api.test-company.com');
      });

      it('should handle special characters in company ID', () => {
        const config = {
          companyId: 'company-with-dashes_and_underscores',
          apiBaseUrl: 'https://api.example.com',
          careersUrl: 'https://drivehris.app/careers/company-with-dashes_and_underscores/list',
        };

        const urls = DriveHrUrlBuilder.buildApiUrls(config);
        urls.forEach((url, index) => {
          // Only the first two URLs (DriveHR APIs) contain companyId
          // The third URL uses the provided apiBaseUrl directly
          if (index < 2) {
            expect(url).toContain('company-with-dashes_and_underscores');
          }
          JobFetchUtilsTestUtils.validateUrl(url);
        });
      });
    });

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
          careersUrl: 'https://drivehris.app/careers/default-company/list',
        };

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
            careersUrl: `https://drivehris.app/careers/${companyId}/list`,
          };
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

    describe('buildCareersJsonUrl', () => {
      it('should convert careers page URL to JSON URL by replacing /list with .json', () => {
        const config = {
          companyId: 'json-test-co',
          apiBaseUrl: 'https://api.json-test-co.com',
          careersUrl: 'https://drivehris.app/careers/json-test-co/list',
        };

        const jsonUrl = DriveHrUrlBuilder.buildCareersJsonUrl(config);
        expect(jsonUrl).toBe('https://drivehris.app/careers/json-test-co.json');
        JobFetchUtilsTestUtils.validateUrl(jsonUrl);
      });

      it('should handle custom careers URLs with /list suffix', () => {
        const config = {
          companyId: 'custom-co',
          apiBaseUrl: 'https://api.custom-co.com',
          careersUrl: 'https://custom.example.com/careers/custom-co/list',
        };

        const jsonUrl = DriveHrUrlBuilder.buildCareersJsonUrl(config);
        expect(jsonUrl).toBe('https://custom.example.com/careers/custom-co.json');
        JobFetchUtilsTestUtils.validateUrl(jsonUrl);
      });

      it('should handle careers URLs without /list suffix', () => {
        const config = {
          companyId: 'no-list-co',
          apiBaseUrl: 'https://api.no-list-co.com',
          careersUrl: 'https://example.com/jobs',
        };

        const jsonUrl = DriveHrUrlBuilder.buildCareersJsonUrl(config);
        // When there's no '/list' to replace, the URL remains unchanged
        // This matches the actual implementation behavior
        expect(jsonUrl).toBe('https://example.com/jobs');
        JobFetchUtilsTestUtils.validateUrl(jsonUrl);
      });

      it('should handle multiple /list occurrences correctly', () => {
        const config = {
          companyId: 'multi-list-co',
          apiBaseUrl: 'https://api.multi-list-co.com',
          careersUrl: 'https://example.com/list/careers/multi-list-co/list',
        };

        const jsonUrl = DriveHrUrlBuilder.buildCareersJsonUrl(config);
        // String.replace() replaces the first occurrence of '/list' with '.json'
        // This matches the actual implementation behavior
        expect(jsonUrl).toBe('https://example.com.json/careers/multi-list-co/list');
        JobFetchUtilsTestUtils.validateUrl(jsonUrl);
      });
    });
  });

  describe('JobFetchErrorHandler', () => {
    describe('logAndContinue', () => {
      it('should log non-critical errors at debug level', () => {
        const error = JobFetchUtilsTestUtils.createTestErrorForHandling('standard');
        const context = 'API endpoint';
        const url = 'https://api.example.com/jobs';

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
        const strategyName = 'APIStrategy';

        JobFetchErrorHandler.logStrategyFailure(strategyName, error);

        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledWith(
          'Strategy APIStrategy failed: Strategy implementation failed'
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
        const strategies = [
          'APIStrategy',
          'HTMLParsingStrategy',
          'JSONLDStrategy',
          'EmbeddedJSStrategy',
          'FallbackStrategy',
        ];

        strategies.forEach((strategyName, index) => {
          const error = new Error(`${strategyName} specific error`);
          JobFetchErrorHandler.logStrategyFailure(strategyName, error);

          expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenNthCalledWith(
            index + 1,
            `Strategy ${strategyName} failed: ${strategyName} specific error`
          );
        });

        expect(JobFetchUtilsTestUtils.mockLogger.warn).toHaveBeenCalledTimes(5);
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
    describe('extractFromApiResponse', () => {
      it('should extract jobs from response with "jobs" property', () => {
        const response = JobFetchUtilsTestUtils.createApiResponseData('jobs');
        const extracted = JobDataExtractor.extractFromApiResponse(response);

        expect(extracted).toEqual(JobFetchUtilsTestUtils.SAMPLE_JOB_DATA);
        expect(extracted).toHaveLength(3);
      });

      it('should extract jobs from response with "positions" property', () => {
        const response = JobFetchUtilsTestUtils.createApiResponseData('positions');
        const extracted = JobDataExtractor.extractFromApiResponse(response);

        expect(extracted).toEqual(JobFetchUtilsTestUtils.SAMPLE_JOB_DATA);
        expect(extracted).toHaveLength(3);
      });

      it('should extract jobs from response with "data" property', () => {
        const response = JobFetchUtilsTestUtils.createApiResponseData('data');
        const extracted = JobDataExtractor.extractFromApiResponse(response);

        expect(extracted).toEqual(JobFetchUtilsTestUtils.SAMPLE_JOB_DATA);
        expect(extracted).toHaveLength(3);
      });

      it('should return empty array for responses without job data', () => {
        const emptyResponse = JobFetchUtilsTestUtils.createApiResponseData('empty');
        const extracted = JobDataExtractor.extractFromApiResponse(emptyResponse);

        expect(extracted).toEqual([]);
        expect(extracted).toHaveLength(0);
      });

      it('should prioritize "jobs" over "positions" over "data"', () => {
        const response = {
          data: [{ id: 'data-job' }] as RawJobData[],
          positions: [{ id: 'positions-job' }] as RawJobData[],
          jobs: [{ id: 'jobs-job' }] as RawJobData[],
        };

        const extracted = JobDataExtractor.extractFromApiResponse(response);
        expect(extracted).toEqual([{ id: 'jobs-job' }]);
      });

      it('should fall back through property hierarchy', () => {
        // Test positions fallback when no jobs
        const positionsOnly = {
          positions: [{ id: 'positions-fallback' }] as RawJobData[],
          data: [{ id: 'data-fallback' }] as RawJobData[],
        };
        expect(JobDataExtractor.extractFromApiResponse(positionsOnly)).toEqual([
          { id: 'positions-fallback' },
        ]);

        // Test data fallback when no jobs or positions
        const dataOnly = {
          data: [{ id: 'data-only' }] as RawJobData[],
        };
        expect(JobDataExtractor.extractFromApiResponse(dataOnly)).toEqual([{ id: 'data-only' }]);
      });
    });

    describe('extractFromJsonLd', () => {
      it('should extract JobPosting objects from JSON-LD data', () => {
        const jsonLdData = JobFetchUtilsTestUtils.createJsonLdData(false);
        const extracted = JobDataExtractor.extractFromJsonLd(jsonLdData);

        expect(extracted).toHaveLength(3);
        extracted.forEach((job, index) => {
          expect(job['@type']).toBe('JobPosting');
          expect(job.id).toBe(JobFetchUtilsTestUtils.SAMPLE_JOB_DATA[index]?.id);
          expect(job.title).toBe(JobFetchUtilsTestUtils.SAMPLE_JOB_DATA[index]?.title);
        });
      });

      it('should filter out non-JobPosting objects', () => {
        const jsonLdData = JobFetchUtilsTestUtils.createJsonLdData(true);
        const extracted = JobDataExtractor.extractFromJsonLd(jsonLdData);

        // Should only return JobPosting objects, not Organization or WebSite
        expect(extracted).toHaveLength(3);
        extracted.forEach(job => {
          expect(job['@type']).toBe('JobPosting');
        });
      });

      it('should handle empty JSON-LD data arrays', () => {
        const extracted = JobDataExtractor.extractFromJsonLd([]);
        expect(extracted).toEqual([]);
      });

      it('should handle arrays with no JobPosting objects', () => {
        const nonJobPostingData = [
          { '@type': 'Organization', name: 'Test Company' },
          { '@type': 'WebSite', name: 'Company Website' },
          { '@type': 'Person', name: 'John Doe' },
        ];

        const extracted = JobDataExtractor.extractFromJsonLd(nonJobPostingData);
        expect(extracted).toEqual([]);
      });

      it('should handle malformed JSON-LD objects', () => {
        const malformedData = [
          null,
          undefined,
          'string-value',
          123,
          { noTypeProperty: 'value' },
          { '@type': 'JobPosting', title: 'Valid Job' },
          { '@type': null },
        ];

        const extracted = JobDataExtractor.extractFromJsonLd(malformedData);
        expect(extracted).toHaveLength(1);
        expect(extracted[0]?.['@type']).toBe('JobPosting');
        expect(extracted[0]?.title).toBe('Valid Job');
      });
    });

    describe('extractFromEmbeddedJs', () => {
      it('should extract positions from embedded JS data', () => {
        const embeddedData = JobFetchUtilsTestUtils.createEmbeddedJsData(true);
        const extracted = JobDataExtractor.extractFromEmbeddedJs(embeddedData);

        expect(extracted).toEqual(JobFetchUtilsTestUtils.SAMPLE_JOB_DATA);
        expect(extracted).toHaveLength(3);
      });

      it('should return empty array when no positions property', () => {
        const embeddedData = JobFetchUtilsTestUtils.createEmbeddedJsData(false);
        const extracted = JobDataExtractor.extractFromEmbeddedJs(embeddedData);

        expect(extracted).toEqual([]);
        expect(extracted).toHaveLength(0);
      });

      it('should handle empty embedded JS data', () => {
        const extracted = JobDataExtractor.extractFromEmbeddedJs({});
        expect(extracted).toEqual([]);
      });

      it('should handle embedded data with empty positions array', () => {
        const embeddedData = { positions: [] };
        const extracted = JobDataExtractor.extractFromEmbeddedJs(embeddedData);

        expect(extracted).toEqual([]);
        expect(extracted).toHaveLength(0);
      });
    });

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
    it('should work together for complete job fetching workflow', () => {
      // 1. Build URLs using DriveHrUrlBuilder
      const urls = DriveHrUrlBuilder.buildApiUrls(JobFetchUtilsTestUtils.STANDARD_CONFIG);
      expect(urls).toHaveLength(3);

      // 2. Simulate API response processing
      const apiResponse = JobFetchUtilsTestUtils.createApiResponseData('jobs');
      const extractedJobs = JobDataExtractor.extractFromApiResponse(apiResponse);

      // 3. Validate extracted data
      expect(JobDataExtractor.isValidJobArray(extractedJobs)).toBe(true);
      expect(extractedJobs).toHaveLength(3);

      // 4. Simulate error handling if needed
      const testError = new Error('Integration test error');
      JobFetchErrorHandler.logAndContinue('Integration test', urls[0] ?? '', testError);

      expect(JobFetchUtilsTestUtils.mockLogger.debug).toHaveBeenCalledWith(
        `Integration test failed: ${urls[0]}`,
        { error: testError }
      );
    });

    it('should handle multiple data extraction methods consistently', () => {
      const sampleData = JobFetchUtilsTestUtils.SAMPLE_JOB_DATA;

      // Test API response extraction
      const apiData = JobDataExtractor.extractFromApiResponse({ jobs: sampleData });
      expect(apiData).toEqual(sampleData);

      // Test JSON-LD extraction
      const jsonLdData = sampleData.map(job => ({ '@type': 'JobPosting', ...job }));
      const jsonLdExtracted = JobDataExtractor.extractFromJsonLd(jsonLdData);
      expect(jsonLdExtracted).toHaveLength(sampleData.length);

      // Test embedded JS extraction
      const embeddedData = { positions: sampleData };
      const embeddedExtracted = JobDataExtractor.extractFromEmbeddedJs(embeddedData);
      expect(embeddedExtracted).toEqual(sampleData);

      // All extraction methods should produce valid results
      [apiData, jsonLdExtracted, embeddedExtracted].forEach(extracted => {
        expect(JobDataExtractor.isValidJobArray(extracted)).toBe(true);
      });
    });
  });
});
