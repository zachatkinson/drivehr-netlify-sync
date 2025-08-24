/**
 * WordPress Payload Testing Tool Test Suite
 *
 * Comprehensive test coverage for the WordPress payload testing tool following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates payload generation, CLI argument parsing, output
 * formatting, and mock server functionality.
 *
 * Test Features:
 * - CLI argument parsing and validation
 * - Payload generation with proper structure and signatures
 * - Multiple output format testing (json, table, detailed)
 * - Mock WordPress server functionality
 * - File export and import validation
 * - Error handling and edge cases
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/scripts/test-wordpress-payload.test.ts -- --grep "payload generation"
 * ```
 *
 * @module test-wordpress-payload-test-suite
 * @since 1.0.0
 * @see {@link ../../scripts/test-wordpress-payload.mts} for the tool being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { BaseTestUtils } from '../shared/base-test-utils.js';
import type { NormalizedJob, JobSyncRequest } from '../../src/types/job.js';

/**
 * WordPress payload testing utilities
 *
 * Extends BaseTestUtils with WordPress payload testing specific methods.
 * Maintains DRY principles while providing specialized testing functionality.
 *
 * @since 1.0.0
 */
class WordPressPayloadTestUtils extends BaseTestUtils {
  /**
   * Create mock normalized job for testing
   *
   * Generates a realistic normalized job object for use in payload testing.
   * Includes all required fields with sensible defaults.
   *
   * @param overrides - Optional field overrides for customization
   * @returns Mock normalized job with realistic data
   * @example
   * ```typescript
   * const job = WordPressPayloadTestUtils.createMockJob({
   *   title: 'Custom Title',
   *   department: 'Engineering'
   * });
   * ```
   * @since 1.0.0
   */
  static createMockJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
    return {
      id: 'test-job-001',
      title: 'Software Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'Join our engineering team...',
      postedDate: '2024-01-15T10:00:00.000Z',
      applyUrl: 'https://example.com/apply/test-job-001',
      source: 'webhook',
      rawData: {},
      processedAt: '2024-01-15T10:30:00.000Z',
      ...overrides,
    };
  }

  /**
   * Create array of mock jobs for testing
   *
   * Generates multiple mock job objects with varied data for comprehensive
   * testing of payload generation and formatting.
   *
   * @param count - Number of mock jobs to generate
   * @returns Array of mock normalized jobs
   * @example
   * ```typescript
   * const jobs = WordPressPayloadTestUtils.createMockJobs(5);
   * expect(jobs).toHaveLength(5);
   * ```
   * @since 1.0.0
   */
  static createMockJobs(count: number = 3): NormalizedJob[] {
    return Array.from({ length: count }, (_, index) =>
      this.createMockJob({
        id: `test-job-${String(index + 1).padStart(3, '0')}`,
        title: `Test Job ${index + 1}`,
        department: ['Engineering', 'Product', 'Design'][index % 3],
        location: ['San Francisco, CA', 'New York, NY', 'Remote'][index % 3],
      })
    );
  }

  /**
   * Execute payload testing script with arguments
   *
   * Runs the WordPress payload testing script as a child process with
   * specified arguments and returns the output for testing.
   *
   * @param args - Command line arguments for the script
   * @returns Promise resolving to script output and exit code
   * @example
   * ```typescript
   * const result = await WordPressPayloadTestUtils.executePayloadScript([
   *   '--use-test-data', '--format', 'json'
   * ]);
   * expect(result.exitCode).toBe(0);
   * ```
   * @since 1.0.0
   */
  static async executePayloadScript(args: string[]): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise(resolve => {
      const child = spawn('tsx', ['scripts/test-wordpress-payload.mts', ...args], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });
    });
  }

  /**
   * Validate WordPress payload structure
   *
   * Performs comprehensive validation of WordPress webhook payload structure
   * to ensure it matches expected format and contains required fields.
   *
   * @param payload - WordPress webhook payload to validate
   * @returns True if payload structure is valid
   * @example
   * ```typescript
   * const isValid = WordPressPayloadTestUtils.validatePayloadStructure(payload);
   * expect(isValid).toBe(true);
   * ```
   * @since 1.0.0
   */
  static validatePayloadStructure(payload: unknown): payload is JobSyncRequest {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const p = payload as Record<string, unknown>;
    const requiredKeys = ['source', 'jobs', 'timestamp', 'requestId'];
    const hasOnlyRequiredKeys =
      Object.keys(p).every(key => requiredKeys.includes(key)) &&
      requiredKeys.every(key => key in p);

    return (
      hasOnlyRequiredKeys &&
      typeof p['source'] === 'string' &&
      Array.isArray(p['jobs']) &&
      typeof p['timestamp'] === 'string' &&
      typeof p['requestId'] === 'string' &&
      (p['jobs'] as unknown[]).every(
        (job: unknown) =>
          typeof job === 'object' &&
          job !== null &&
          typeof (job as Record<string, unknown>)['id'] === 'string' &&
          typeof (job as Record<string, unknown>)['title'] === 'string' &&
          typeof (job as Record<string, unknown>)['department'] === 'string' &&
          typeof (job as Record<string, unknown>)['location'] === 'string' &&
          typeof (job as Record<string, unknown>)['type'] === 'string'
      )
    );
  }

  /**
   * Create temporary test file path
   *
   * Generates a unique temporary file path for testing file operations
   * without interfering with production files.
   *
   * @param extension - File extension (default: 'json')
   * @returns Temporary file path
   * @since 1.0.0
   */
  static createTempFilePath(extension: string = 'json'): string {
    return join(process.cwd(), `temp-test-payload-${Date.now()}.${extension}`);
  }

  /**
   * Clean up temporary test files
   *
   * Removes temporary files created during testing to keep the workspace clean.
   *
   * @param filePaths - Array of file paths to remove
   * @since 1.0.0
   */
  static async cleanupTempFiles(filePaths: string[]): Promise<void> {
    await Promise.all(
      filePaths.map(async path => {
        if (existsSync(path)) {
          await unlink(path);
        }
      })
    );
  }
}

describe('WordPress Payload Testing Tool', () => {
  let tempFiles: string[] = [];

  beforeEach(() => {
    tempFiles = [];
    // Mock environment variables for consistent testing
    vi.stubEnv('DRIVEHR_COMPANY_ID', 'test-company-123');
    vi.stubEnv('WEBHOOK_SECRET', 'test-webhook-secret-with-sufficient-length');
  });

  afterEach(async () => {
    // Clean up any temporary files created during tests
    await WordPressPayloadTestUtils.cleanupTempFiles(tempFiles);
    vi.unstubAllEnvs();
  });

  describe('when parsing CLI arguments', () => {
    it('should parse all supported command line options correctly', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript(['--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('WordPress Payload Testing Tool');
      expect(stdout).toContain('--company-id');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--save');
      expect(stdout).toContain('--inspect');
      expect(stdout).toContain('--mock-wordpress');
      expect(stdout).toContain('--use-test-data');
      expect(stdout).toContain('--format');
    });

    it('should use environment variables when CLI options are not provided', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'table',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Company ID: test-company-123');
      expect(stdout).toContain('Test Mode: Mock Data');
    });

    it('should override environment variables with CLI options', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--company-id',
        'override-company-456',
        '--use-test-data',
        '--format',
        'table',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Company ID: override-company-456');
    });
  });

  describe('when generating WordPress payloads', () => {
    it('should generate valid payload structure with test data', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'json',
      ]);

      expect(exitCode).toBe(0);

      // Extract JSON payload from stdout
      const lines = stdout.split('\n');
      const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
      const jsonEnd = lines.findIndex(
        (line, index) =>
          index > jsonStart &&
          line.trim() === '}' &&
          lines
            .slice(jsonStart, index + 1)
            .join('\n')
            .split('{').length ===
            lines
              .slice(jsonStart, index + 1)
              .join('\n')
              .split('}').length
      );

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonPayload = lines.slice(jsonStart, jsonEnd + 1).join('\n');
        const payload = JSON.parse(jsonPayload);

        expect(WordPressPayloadTestUtils.validatePayloadStructure(payload)).toBe(true);
        expect(payload.jobs).toHaveLength(3); // Mock data generates 3 jobs
        expect(payload.source).toBe('webhook');
        expect(payload.requestId).toMatch(/^req_/);
      }
    });

    it('should include proper HMAC signature in detailed output', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--inspect',
        '--format',
        'detailed',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Headers:');
      expect(stdout).toContain('X-Webhook-Signature: sha256=');
      expect(stdout).toContain('X-Request-ID:');
      expect(stdout).toContain('Content-Type: application/json');
    });

    it('should generate different request IDs for each execution', async () => {
      const result1 = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'detailed',
      ]);

      const result2 = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'detailed',
      ]);

      expect(result1.exitCode).toBe(0);
      expect(result2.exitCode).toBe(0);

      // Extract request IDs from outputs
      const requestId1Match = result1.stdout.match(/X-Request-ID: (req_[a-zA-Z0-9]+)/);
      const requestId2Match = result2.stdout.match(/X-Request-ID: (req_[a-zA-Z0-9]+)/);

      expect(requestId1Match).toBeTruthy();
      expect(requestId2Match).toBeTruthy();
      expect(requestId1Match?.[1]).not.toBe(requestId2Match?.[1]);
    });
  });

  describe('when saving payloads to files', () => {
    it('should save valid JSON payload to specified file', async () => {
      const tempFile = WordPressPayloadTestUtils.createTempFilePath();
      tempFiles.push(tempFile);

      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--save',
        tempFile,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(`Payload saved to: ${tempFile}`);
      expect(existsSync(tempFile)).toBe(true);

      // Validate saved file content
      const savedContent = await readFile(tempFile, 'utf8');
      const savedData = JSON.parse(savedContent);

      expect(savedData).toHaveProperty('payload');
      expect(savedData).toHaveProperty('headers');
      expect(savedData).toHaveProperty('metadata');
      expect(savedData.note).toBe('Generated by DriveHR WordPress Payload Tester');
      expect(WordPressPayloadTestUtils.validatePayloadStructure(savedData.payload)).toBe(true);
    });

    it('should include comprehensive metadata in saved files', async () => {
      const tempFile = WordPressPayloadTestUtils.createTempFilePath();
      tempFiles.push(tempFile);

      const { exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--company-id',
        'metadata-test-company',
        '--use-test-data',
        '--save',
        tempFile,
      ]);

      expect(exitCode).toBe(0);

      const savedContent = await readFile(tempFile, 'utf8');
      const savedData = JSON.parse(savedContent);

      expect(savedData.metadata).toMatchObject({
        jobCount: 3,
        companyId: 'metadata-test-company',
        source: 'webhook',
      });
      expect(savedData.metadata.payloadSize).toBeGreaterThan(0);
      expect(savedData.metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('when formatting output', () => {
    it('should display payload in JSON format when requested', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'json',
      ]);

      expect(exitCode).toBe(0);

      // Should contain valid JSON structure
      expect(stdout).toContain('"source": "webhook"');
      expect(stdout).toContain('"jobs": [');
      expect(stdout).toContain('"requestId":');
      expect(stdout).toContain('"timestamp":');
    });

    it('should display payload in table format with job overview', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'table',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Payload Summary:');
      expect(stdout).toContain('Jobs Overview:');
      expect(stdout).toContain('Job Count');
      expect(stdout).toContain('Payload Size');
      expect(stdout).toContain('Company ID');
    });

    it('should display comprehensive details in detailed format', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'detailed',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Detailed Payload Analysis:');
      expect(stdout).toContain('Metadata:');
      expect(stdout).toContain('Headers:');
      expect(stdout).toContain('Jobs:');
      expect(stdout).toContain('Raw Payload:');
      expect(stdout).toContain('Senior Software Engineer');
      expect(stdout).toContain('Product Manager');
      expect(stdout).toContain('UX Designer');
    });
  });

  describe('when handling errors', () => {
    it('should fail gracefully when company ID is missing', async () => {
      // Temporarily hide .env.development to test missing company ID
      const fs = await import('fs');
      const tempEnvPath = '.env.development.backup';

      // Backup the env file
      if (fs.existsSync('.env.development')) {
        fs.renameSync('.env.development', tempEnvPath);
      }

      try {
        vi.unstubAllEnvs(); // Remove environment variables

        const { stderr, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
          '--format',
          'json',
        ]);

        expect(exitCode).toBe(1);
        expect(stderr).toContain('Company ID is required');
      } finally {
        // Restore the env file
        if (fs.existsSync(tempEnvPath)) {
          fs.renameSync(tempEnvPath, '.env.development');
        }
      }
    });

    it('should fail gracefully when webhook secret is missing', async () => {
      // Temporarily hide .env.development and only set company ID
      const fs = await import('fs');
      const tempEnvPath = '.env.development.backup';

      // Backup the env file
      if (fs.existsSync('.env.development')) {
        fs.renameSync('.env.development', tempEnvPath);
      }

      try {
        vi.unstubAllEnvs();
        // Don't set WEBHOOK_SECRET

        const { stderr, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
          '--company-id',
          'test-company',
          '--use-test-data',
          '--format',
          'json',
        ]);

        expect(exitCode).toBe(1);
        expect(stderr).toContain('Webhook secret is required');
      } finally {
        // Restore the env file
        if (fs.existsSync(tempEnvPath)) {
          fs.renameSync(tempEnvPath, '.env.development');
        }
      }
    });

    it('should handle invalid file paths gracefully', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist.json';

      const { stderr, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--save',
        invalidPath,
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('WordPress payload testing failed');
    });
  });

  describe('when using test data mode', () => {
    it('should generate consistent mock job data', async () => {
      const result1 = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'json',
      ]);

      const result2 = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'json',
      ]);

      expect(result1.exitCode).toBe(0);
      expect(result2.exitCode).toBe(0);

      // Both should contain the same job titles (though request IDs will differ)
      expect(result1.stdout).toContain('Senior Software Engineer');
      expect(result1.stdout).toContain('Product Manager');
      expect(result1.stdout).toContain('UX Designer');

      expect(result2.stdout).toContain('Senior Software Engineer');
      expect(result2.stdout).toContain('Product Manager');
      expect(result2.stdout).toContain('UX Designer');
    });

    it('should indicate test mode in output', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--format',
        'detailed',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Test Mode: Mock Data');
    });
  });

  describe('when inspecting payloads', () => {
    it('should show inspection details by default when no save file specified', async () => {
      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Detailed Payload Analysis:');
      expect(stdout).toContain('Payload testing completed successfully!');
    });

    it('should show inspection details when explicitly requested', async () => {
      const tempFile = WordPressPayloadTestUtils.createTempFilePath();
      tempFiles.push(tempFile);

      const { stdout, exitCode } = await WordPressPayloadTestUtils.executePayloadScript([
        '--use-test-data',
        '--save',
        tempFile,
        '--inspect',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(`Payload saved to: ${tempFile}`);
      expect(stdout).toContain('Detailed Payload Analysis:');
    });
  });

  describe('utility functions', () => {
    it('should create valid mock jobs with proper structure', () => {
      const job = WordPressPayloadTestUtils.createMockJob();

      expect(job.id).toBe('test-job-001');
      expect(job.title).toBe('Software Engineer');
      expect(job.department).toBe('Engineering');
      expect(job.location).toBe('San Francisco, CA');
      expect(job.type).toBe('Full-time');
      expect(job.source).toBe('webhook');
      expect(job.applyUrl).toMatch(/^https?:\/\//);
      expect(job.postedDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should create multiple mock jobs with unique IDs', () => {
      const jobs = WordPressPayloadTestUtils.createMockJobs(5);

      expect(jobs).toHaveLength(5);

      const ids = jobs.map(job => job.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds).toHaveLength(5);

      jobs.forEach((job, index) => {
        expect(job.id).toBe(`test-job-${String(index + 1).padStart(3, '0')}`);
        expect(job.title).toBe(`Test Job ${index + 1}`);
      });
    });

    it('should validate valid payload structures correctly', () => {
      const validPayload: JobSyncRequest = {
        source: 'webhook',
        jobs: [WordPressPayloadTestUtils.createMockJob()],
        timestamp: new Date().toISOString(),
        requestId: 'req_test_123',
      };

      expect(WordPressPayloadTestUtils.validatePayloadStructure(validPayload)).toBe(true);
    });

    it('should reject invalid payload structures', () => {
      const invalidPayloads = [
        null,
        undefined,
        'string',
        123,
        {},
        { source: 'webhook' }, // missing required fields
        { source: 'webhook', jobs: [], timestamp: '', requestId: '', extraField: true },
        { source: 'webhook', jobs: [{}], timestamp: '', requestId: '' }, // invalid job structure
      ];

      invalidPayloads.forEach(payload => {
        expect(WordPressPayloadTestUtils.validatePayloadStructure(payload)).toBe(false);
      });
    });
  });
});
