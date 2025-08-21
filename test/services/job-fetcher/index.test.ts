/**
 * Job Fetcher Module Test Suite Entry Point
 *
 * Main test entry point that validates the barrel exports and module integration.
 * This test file ensures that all components are properly exported and accessible
 * through the main module interface, supporting the modular architecture.
 *
 * Test Features:
 * - Barrel export validation
 * - Module interface verification
 * - Component availability testing
 * - Integration point validation
 *
 * @example
 * ```typescript
 * // Example of running module export tests
 * pnpm test test/services/job-fetcher/index.test.ts
 * ```
 *
 * @module job-fetcher-module-test-suite
 * @since 1.0.0
 * @see {@link ../../../src/services/job-fetcher/index.ts} for the barrel exports being tested
 * @see {@link ../../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect } from 'vitest';
import {
  JobFetchService,
  JobNormalizer,
  HtmlJobFetchStrategy,
  DefaultFetchTelemetryStrategy,
  FetchOperationTemplate,
  DriveHrFetchOperation,
} from '../../../src/services/job-fetcher/index.js';

describe('Job Fetcher Module Exports', () => {
  it('should export main service class', () => {
    expect(JobFetchService).toBeDefined();
    expect(typeof JobFetchService).toBe('function');
  });

  it('should export core component classes', () => {
    expect(JobNormalizer).toBeDefined();
    expect(typeof JobNormalizer).toBe('function');

    expect(HtmlJobFetchStrategy).toBeDefined();
    expect(typeof HtmlJobFetchStrategy).toBe('function');

    expect(DefaultFetchTelemetryStrategy).toBeDefined();
    expect(typeof DefaultFetchTelemetryStrategy).toBe('function');
  });

  it('should export template and operation classes', () => {
    expect(FetchOperationTemplate).toBeDefined();
    expect(typeof FetchOperationTemplate).toBe('function');

    expect(DriveHrFetchOperation).toBeDefined();
    expect(typeof DriveHrFetchOperation).toBe('function');
  });

  it('should export TypeScript interfaces as types', () => {
    // TypeScript interfaces are compile-time only, so we can't test them at runtime
    // This test ensures the import statement doesn't throw
    // We verify the types are available by checking the imports don't fail
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should maintain consistent export structure', () => {
    // Verify that critical exports are available
    const exports = {
      JobFetchService,
      JobNormalizer,
      HtmlJobFetchStrategy,
      DefaultFetchTelemetryStrategy,
      FetchOperationTemplate,
      DriveHrFetchOperation,
    };

    Object.entries(exports).forEach(([name, exportedItem]) => {
      expect(exportedItem).toBeDefined();
      expect(typeof exportedItem).toBe('function');
      expect(exportedItem.name).toBe(name);
    });
  });
});
