/**
 * @fileoverview Comprehensive test suite for HTML parser service
 *
 * Tests the HTML parsing service that extracts structured job data from
 * unstructured HTML content using configurable CSS selectors and intelligent
 * fallback mechanisms. Uses DRY principles with specialized utilities.
 *
 * Key test areas:
 * - HtmlParsingConfig: Configuration interface and defaults
 * - HtmlParserService: Main parsing service with CSS selectors
 * - createHtmlParser: Factory function with configuration merging
 * - parseJobsFromHtml: Core parsing logic with various HTML structures
 * - Error handling and edge cases for malformed HTML
 * - Integration patterns with different job site layouts
 *
 * @since 1.0.0
 * @see {@link ../../src/services/html-parser.ts} for implementation details
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HtmlParserService,
  createHtmlParser,
  type IHtmlParser,
  type HtmlParsingConfig,
} from '../../src/services/html-parser.js';
import type { RawJobData } from '../../src/types/job.js';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import * as logger from '../../src/lib/logger.js';
import * as utils from '../../src/lib/utils.js';

/**
 * Specialized test utilities for HTML parser testing
 *
 * Extends BaseTestUtils with HTML-parser-specific testing capabilities including
 * sample HTML generation, selector testing patterns, and comprehensive
 * test data creation. Implements DRY principles for consistent test patterns.
 *
 * @extends BaseTestUtils
 * @since 1.0.0
 */
class HtmlParserTestUtils extends BaseTestUtils {
  /**
   * Mock logger for testing logging behavior
   * @since 1.0.0
   */
  static mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  };

  /**
   * Sample HTML content with various job posting structures
   * @since 1.0.0
   */
  static readonly SAMPLE_HTML_STRUCTURES = {
    standardJobListing: `
      <html>
        <body>
          <div class="job-listing" data-job-id="job-001">
            <h2 class="job-title">Senior Software Engineer</h2>
            <div class="department">Engineering</div>
            <div class="location">San Francisco, CA</div>
            <div class="employment-type">Full-time</div>
            <div class="description">Build scalable applications using modern technologies.</div>
            <div class="posted-date">2024-01-01</div>
            <a href="/apply/job-001" class="apply-link">Apply Now</a>
          </div>
          <div class="job-listing" data-job-id="job-002">
            <h2 class="job-title">Product Manager</h2>
            <div class="department">Product</div>
            <div class="location">Remote</div>
            <div class="employment-type">Full-time</div>
            <div class="description">Lead product strategy and execution.</div>
            <div class="posted-date">2024-01-02</div>
            <a href="/apply/job-002" class="apply-link">Apply Now</a>
          </div>
        </body>
      </html>
    `,

    alternativeSelectors: `
      <html>
        <body>
          <article class="career-item">
            <h3 class="position-title">UX Designer</h3>
            <span class="category">Design</span>
            <span class="city">New York, NY</span>
            <span class="job-type">Contract</span>
            <p class="summary">Create beautiful user experiences.</p>
            <time class="date-posted">January 3, 2024</time>
            <a href="https://example.com/careers/apply/ux-designer" class="application-link">Apply</a>
          </article>
        </body>
      </html>
    `,

    minimalStructure: `
      <html>
        <body>
          <div class="job-post">
            <h1>DevOps Engineer</h1>
            <div class="description">Manage infrastructure and deployment pipelines.</div>
          </div>
        </body>
      </html>
    `,

    malformedHtml: `
      <html>
        <body>
          <div class="job-listing">
            <h2>Broken Job Title
            <div class="location">Boston, MA
            <p>Missing closing tags and malformed structure
        </body>
      </html>
    `,

    emptyContent: `
      <html>
        <body>
          <div class="no-jobs">
            <p>No positions available at this time.</p>
          </div>
        </body>
      </html>
    `,

    multipleJobFormats: `
      <html>
        <body>
          <div class="job-listing">
            <h2 class="job-title">Backend Developer</h2>
            <div class="department">Engineering</div>
            <div class="location">Seattle, WA</div>
          </div>
          <div class="job-listing" data-job-id="frontend-dev">
            <h3 class="job-title">Frontend Developer</h3>
            <div class="department">Engineering</div>
            <div class="location">Austin, TX</div>
          </div>
          <div class="job-listing">
            <h4 class="job-title">Data Scientist</h4>
            <div class="department">Analytics</div>
            <div class="location">Remote</div>
          </div>
        </body>
      </html>
    `,
  } as const;

  /**
   * Expected parsed job data for testing
   * @since 1.0.0
   */
  static readonly EXPECTED_JOB_DATA = {
    standardJobs: [
      {
        id: 'job-001',
        title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        type: 'Full-time',
        description: 'Build scalable applications using modern technologies.',
        posted_date: '2024-01-01T00:00:00.000Z',
        apply_url: 'https://example.com/apply/job-001',
      },
      {
        id: 'job-002',
        title: 'Product Manager',
        department: 'Product',
        location: 'Remote',
        type: 'Full-time',
        description: 'Lead product strategy and execution.',
        posted_date: '2024-01-02T00:00:00.000Z',
        apply_url: 'https://example.com/apply/job-002',
      },
    ] as RawJobData[],

    alternativeJob: [
      {
        id: 'generated-ux-designer-1704067200000',
        title: 'UX Designer',
        department: 'Design',
        location: 'New York, NY',
        type: 'Contract',
        description: 'Create beautiful user experiences.',
        posted_date: '2024-01-03T00:00:00.000Z',
        apply_url: 'https://example.com/careers/apply/ux-designer',
      },
    ] as RawJobData[],

    minimalJob: [
      {
        id: 'generated-devops-engineer-1704067200000',
        title: 'DevOps Engineer',
        department: '',
        location: '',
        type: '',
        description: 'Manage infrastructure and deployment pipelines.',
        posted_date: '2024-01-01T12:00:00.000Z',
        apply_url: 'https://drivehris.app/apply/generated-devops-engineer-1704067200000',
      },
    ] as RawJobData[],
  } as const;

  /**
   * Custom parsing configurations for testing
   * @since 1.0.0
   */
  static readonly TEST_CONFIGS = {
    restrictive: {
      jobSelectors: ['.specific-job-card'],
      titleSelectors: ['h1.exact-title'],
      departmentSelectors: ['.exact-department'],
      locationSelectors: ['.exact-location'],
      typeSelectors: ['.exact-type'],
      descriptionSelectors: ['.exact-description'],
      dateSelectors: ['.exact-date'],
      applyUrlSelectors: ['.exact-apply'],
    } as Partial<HtmlParsingConfig>,

    permissive: {
      jobSelectors: [
        '.job-listing',
        '.career-item',
        '.position-card',
        '.job-post',
        '.opportunity',
        'article',
        'section',
        'div',
      ],
      titleSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.title', '.heading'],
    } as Partial<HtmlParsingConfig>,
  } as const;

  /**
   * Setup mocks for testing HTML parser service
   *
   * Configures all necessary mocks including logger, date utilities,
   * string utilities, and URL utilities for consistent test behavior.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * beforeEach(() => {
   *   HtmlParserTestUtils.setupMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static setupMocks(): void {
    vi.spyOn(logger, 'getLogger').mockReturnValue(this.mockLogger);
    vi.spyOn(utils.DateUtils, 'toIsoString').mockImplementation((date: string | Date) => {
      const dateStr = typeof date === 'string' ? date : date.toISOString();
      if (dateStr.includes('2024-01-01')) return '2024-01-01T00:00:00.000Z';
      if (dateStr.includes('2024-01-02')) return '2024-01-02T00:00:00.000Z';
      if (dateStr.includes('2024-01-03') || dateStr.includes('January 3'))
        return '2024-01-03T00:00:00.000Z';
      return '2024-01-01T12:00:00.000Z';
    });
    vi.spyOn(utils.DateUtils, 'getCurrentIsoTimestamp').mockReturnValue('2024-01-01T12:00:00.000Z');
    vi.spyOn(utils.StringUtils, 'generateIdFromTitle').mockImplementation(
      (title: string) => `generated-${title.toLowerCase().replace(/\s+/g, '-')}-1704067200000`
    );
    vi.spyOn(utils.UrlUtils, 'resolveUrl').mockImplementation((url: string, base: string) => {
      if (url.startsWith('http')) return url;
      const baseUrl = new URL(base);
      return `${baseUrl.protocol}//${baseUrl.host}${url}`;
    });
  }

  /**
   * Restore mocks after testing
   *
   * Cleans up all mock functions and restores original implementations
   * to prevent test interference between test cases.
   *
   * @returns {void} No return value
   * @example
   * ```typescript
   * afterEach(() => {
   *   HtmlParserTestUtils.restoreMocks();
   * });
   * ```
   * @since 1.0.0
   */
  static restoreMocks(): void {
    vi.restoreAllMocks();
    Object.values(this.mockLogger).forEach(mock => mock.mockClear());
  }

  /**
   * Verify job data structure and content
   *
   * Performs comprehensive validation of job data objects to ensure
   * all fields match expected values with proper typing and content.
   *
   * @param {RawJobData} actual - The actual job data to validate
   * @param {RawJobData} expected - The expected job data values
   * @returns {void} No return value, throws assertion errors on mismatch
   * @example
   * ```typescript
   * const actualJob = parser.parseJobsFromHtml(html)[0];
   * const expectedJob = HtmlParserTestUtils.EXPECTED_JOB_DATA.standardJobs[0];
   * HtmlParserTestUtils.verifyJobData(actualJob, expectedJob);
   * ```
   * @since 1.0.0
   */
  static verifyJobData(actual: RawJobData, expected: RawJobData): void {
    expect(actual.id).toBe(expected.id);
    expect(actual.title).toBe(expected.title);
    expect(actual.department).toBe(expected.department);
    expect(actual.location).toBe(expected.location);
    expect(actual.type).toBe(expected.type);
    expect(actual.description).toBe(expected.description);
    expect(actual.posted_date).toBe(expected.posted_date);
    expect(actual.apply_url).toBe(expected.apply_url);
  }

  /**
   * Create test HTML with custom structure
   *
   * Generates HTML content with job data using customizable selectors
   * for testing various HTML parser configurations and edge cases.
   *
   * @param {Object} jobData - Job data and selector configuration
   * @param {string} jobData.title - Job title (required)
   * @param {string} [jobData.department] - Job department (optional)
   * @param {string} [jobData.location] - Job location (optional)
   * @param {string} [jobData.type] - Job type (optional)
   * @param {string} [jobData.description] - Job description (optional)
   * @param {Object} [jobData.selectors] - Custom CSS selectors (optional)
   * @returns {string} Generated HTML string with job data
   * @example
   * ```typescript
   * const html = HtmlParserTestUtils.createTestHtml({
   *   title: 'Software Engineer',
   *   department: 'Engineering',
   *   selectors: { container: 'custom-job-card' }
   * });
   * const jobs = parser.parseJobsFromHtml(html, 'https://example.com');
   * ```
   * @since 1.0.0
   */
  static createTestHtml(jobData: {
    title: string;
    department?: string;
    location?: string;
    type?: string;
    description?: string;
    selectors?: {
      container?: string;
      title?: string;
      department?: string;
      location?: string;
      type?: string;
      description?: string;
    };
  }): string {
    const selectors = jobData.selectors ?? {};
    const containerClass = selectors.container ?? 'job-listing';
    const titleElement = selectors.title ?? 'h2';
    const deptElement = selectors.department ?? 'div';
    const locElement = selectors.location ?? 'div';
    const typeElement = selectors.type ?? 'div';
    const descElement = selectors.description ?? 'div';

    return `
      <html>
        <body>
          <div class="${containerClass}">
            <${titleElement} class="job-title">${jobData.title}</${titleElement}>
            ${jobData.department ? `<${deptElement} class="department">${jobData.department}</${deptElement}>` : ''}
            ${jobData.location ? `<${locElement} class="location">${jobData.location}</${locElement}>` : ''}
            ${jobData.type ? `<${typeElement} class="employment-type">${jobData.type}</${typeElement}>` : ''}
            ${jobData.description ? `<${descElement} class="description">${jobData.description}</${descElement}>` : ''}
          </div>
        </body>
      </html>
    `;
  }
}

describe('HTML Parser Service', () => {
  beforeEach(() => {
    HtmlParserTestUtils.setupMocks();
  });

  afterEach(() => {
    HtmlParserTestUtils.restoreMocks();
  });

  describe('createHtmlParser', () => {
    it('should create parser with default configuration', () => {
      const parser = createHtmlParser();

      expect(parser).toBeInstanceOf(HtmlParserService);
      expect(typeof parser.parseJobsFromHtml).toBe('function');
    });

    it('should create parser with custom configuration', () => {
      const customConfig = HtmlParserTestUtils.TEST_CONFIGS.restrictive;
      const parser = createHtmlParser(customConfig);

      expect(parser).toBeInstanceOf(HtmlParserService);
    });

    it('should merge custom config with defaults', () => {
      const partialConfig = {
        jobSelectors: ['.custom-job-selector'],
      };
      const parser = createHtmlParser(partialConfig);

      // Parser should still work with default selectors for other fields
      const html = HtmlParserTestUtils.createTestHtml({
        title: 'Test Job',
        department: 'Test Dept',
        selectors: { container: 'custom-job-selector' },
      });

      const result = parser.parseJobsFromHtml(html, 'https://example.com');
      expect(result).toHaveLength(1);
    });
  });

  describe('HtmlParserService', () => {
    let parser: IHtmlParser;

    beforeEach(() => {
      parser = createHtmlParser();
    });

    describe('parseJobsFromHtml', () => {
      it('should parse standard job listing HTML', () => {
        const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.standardJobListing;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(2);
        const firstJob = result[0];
        const secondJob = result[1];
        const expectedFirstJob = HtmlParserTestUtils.EXPECTED_JOB_DATA.standardJobs[0];
        const expectedSecondJob = HtmlParserTestUtils.EXPECTED_JOB_DATA.standardJobs[1];

        expect(firstJob).toBeDefined();
        expect(secondJob).toBeDefined();
        expect(expectedFirstJob).toBeDefined();
        expect(expectedSecondJob).toBeDefined();

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        HtmlParserTestUtils.verifyJobData(firstJob!, expectedFirstJob!);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        HtmlParserTestUtils.verifyJobData(secondJob!, expectedSecondJob!);
      });

      it('should parse HTML with alternative selectors', () => {
        const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.alternativeSelectors;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        const job = result[0];
        const expectedJob = HtmlParserTestUtils.EXPECTED_JOB_DATA.alternativeJob[0];

        expect(job).toBeDefined();
        expect(expectedJob).toBeDefined();

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        HtmlParserTestUtils.verifyJobData(job!, expectedJob!);
      });

      it('should handle minimal HTML structure with fallbacks', () => {
        const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.minimalStructure;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        const job = result[0];
        expect(job).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(job!.title).toBe('DevOps Engineer');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(job!.description).toBe('Manage infrastructure and deployment pipelines.');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(job!.department).toBe('');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(job!.location).toBe('');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(job!.type).toBe('');
      });

      it('should handle malformed HTML gracefully', () => {
        const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.malformedHtml;

        expect(() => {
          const result = parser.parseJobsFromHtml(html, 'https://example.com');
          expect(Array.isArray(result)).toBe(true);
        }).not.toThrow();
      });

      it('should return empty array for HTML with no jobs', () => {
        const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.emptyContent;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toEqual([]);
      });

      it('should parse multiple job formats in same HTML', () => {
        const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.multipleJobFormats;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(3);
        expect(result[0]?.title).toBe('Backend Developer');
        expect(result[1]?.title).toBe('Frontend Developer');
        expect(result[2]?.title).toBe('Data Scientist');
      });

      it('should handle empty HTML string', () => {
        const result = parser.parseJobsFromHtml('', 'https://example.com');
        expect(result).toEqual([]);
      });

      it('should handle HTML with only whitespace', () => {
        const html = '   \n\t   ';
        const result = parser.parseJobsFromHtml(html, 'https://example.com');
        expect(result).toEqual([]);
      });

      it('should extract job IDs from data attributes', () => {
        const html = `
          <div class="job-listing" data-job-id="custom-job-123">
            <h2>Test Job</h2>
          </div>
        `;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('custom-job-123');
      });

      it('should generate job IDs when not present', () => {
        const html = `
          <div class="job-listing">
            <h2>Test Job Title</h2>
          </div>
        `;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('generated-test-job-title-1704067200000');
        expect(utils.StringUtils.generateIdFromTitle).toHaveBeenCalledWith('Test Job Title');
      });

      it('should resolve relative URLs correctly', () => {
        const html = `
          <div class="job-listing">
            <h2>Test Job</h2>
            <a href="/apply/test-job" class="apply-link">Apply</a>
          </div>
        `;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        expect(result[0]?.apply_url).toBe('https://example.com/apply/test-job');
        expect(utils.UrlUtils.resolveUrl).toHaveBeenCalledWith(
          '/apply/test-job',
          'https://example.com'
        );
      });

      it('should handle absolute URLs without modification', () => {
        const html = `
          <div class="job-listing">
            <h2>Test Job</h2>
            <a href="https://careers.example.com/apply/test-job" class="apply-link">Apply</a>
          </div>
        `;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        expect(result[0]?.apply_url).toBe('https://careers.example.com/apply/test-job');
      });
    });

    describe('custom configuration parsing', () => {
      it('should use restrictive selectors when configured', () => {
        const restrictiveParser = createHtmlParser(HtmlParserTestUtils.TEST_CONFIGS.restrictive);
        const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.standardJobListing;

        const result = restrictiveParser.parseJobsFromHtml(html, 'https://example.com');

        // Should not find jobs because restrictive selectors don't match
        expect(result).toEqual([]);
      });

      it('should use permissive selectors to find more jobs', () => {
        const permissiveParser = createHtmlParser(HtmlParserTestUtils.TEST_CONFIGS.permissive);
        const html = `
          <html>
            <body>
              <section class="job-listing">
                <h5 class="job-title">Engineer</h5>
              </section>
              <section class="job-listing">
                <h6 class="job-title">Designer</h6>
              </section>
              <section class="job-listing">
                <h4 class="job-title">Manager</h4>
              </section>
            </body>
          </html>
        `;

        const result = permissiveParser.parseJobsFromHtml(html, 'https://example.com');
        expect(result).toHaveLength(3);
        expect(result[0]?.title).toBe('Engineer');
        expect(result[1]?.title).toBe('Designer');
        expect(result[2]?.title).toBe('Manager');
      });
    });

    describe('edge cases and error handling', () => {
      it('should handle jobs without titles gracefully', () => {
        const html = `
          <div class="job-listing">
            <div class="department">Engineering</div>
            <div class="location">Remote</div>
          </div>
        `;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        // Should skip jobs without titles
        expect(result).toEqual([]);
      });

      it('should handle deeply nested job elements', () => {
        const html = `
          <div class="job-listing">
            <div class="header">
              <div class="title-section">
                <h2 class="job-title">Nested Job Title</h2>
              </div>
            </div>
            <div class="content">
              <div class="meta">
                <span class="location">Remote</span>
              </div>
            </div>
          </div>
        `;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        expect(result[0]?.title).toBe('Nested Job Title');
        expect(result[0]?.location).toBe('Remote');
      });

      it('should handle special characters in job data', () => {
        const html = `
          <div class="job-listing">
            <h2 class="job-title">Software Engineer (C++/Python)</h2>
            <div class="location">San Francisco, CA & Remote</div>
            <div class="description">Work with cutting-edge tech & amazing team!</div>
          </div>
        `;
        const result = parser.parseJobsFromHtml(html, 'https://example.com');

        expect(result).toHaveLength(1);
        expect(result[0]?.title).toBe('Software Engineer (C++/Python)');
        expect(result[0]?.location).toBe('San Francisco, CA & Remote');
        expect(result[0]?.description).toBe('Work with cutting-edge tech & amazing team!');
      });

      it('should generate DriveHR apply URLs with company ID when present', () => {
        const html = `
          <div class="job-listing">
            <h2>Test Job</h2>
          </div>
        `;
        const baseUrlWithCompanyId = 'https://drivehris.app/careers/abc123-def456/jobs';
        const result = parser.parseJobsFromHtml(html, baseUrlWithCompanyId);

        expect(result).toHaveLength(1);
        expect(result[0]?.apply_url).toBe(
          'https://drivehris.app/careers/abc123-def456/apply/generated-test-job-1704067200000'
        );
      });

      it('should handle URL parsing errors gracefully when generating apply URLs', () => {
        const html = `
          <div class="job-listing">
            <h2>Test Job</h2>
          </div>
        `;

        // Mock URL constructor to throw an error for this test
        const originalURL = globalThis.URL;
        globalThis.URL = class extends originalURL {
          constructor(url: string) {
            if (url === 'invalid-url') {
              throw new Error('Invalid URL');
            }
            super(url);
          }
        } as typeof URL;

        const result = parser.parseJobsFromHtml(html, 'invalid-url');

        // Restore original URL constructor
        globalThis.URL = originalURL;

        expect(result).toHaveLength(1);
        expect(result[0]?.apply_url).toBe(
          'https://drivehris.app/apply/generated-test-job-1704067200000'
        );
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle real-world job site structure variations', () => {
      const parser = createHtmlParser();
      const realWorldVariations = [
        HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.standardJobListing,
        HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.alternativeSelectors,
        HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.multipleJobFormats,
      ];

      let totalJobs = 0;
      realWorldVariations.forEach(html => {
        const result = parser.parseJobsFromHtml(html, 'https://example.com');
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(0);
        totalJobs += result.length;

        // Verify all jobs have required fields
        result.forEach(job => {
          expect(job.id).toBeTruthy();
          expect(job.title).toBeTruthy();
          expect(typeof job.department).toBe('string');
          expect(typeof job.location).toBe('string');
          expect(typeof job.type).toBe('string');
          expect(typeof job.description).toBe('string');
          expect(typeof job.posted_date).toBe('string');
          expect(typeof job.apply_url).toBe('string');
        });
      });

      expect(totalJobs).toBeGreaterThan(0);
    });

    it('should maintain consistent behavior across multiple parsing calls', () => {
      const parser = createHtmlParser();
      const html = HtmlParserTestUtils.SAMPLE_HTML_STRUCTURES.standardJobListing;

      const result1 = parser.parseJobsFromHtml(html, 'https://example.com');
      const result2 = parser.parseJobsFromHtml(html, 'https://example.com');

      expect(result1).toEqual(result2);
      expect(result1).toHaveLength(result2.length);
    });
  });
});
