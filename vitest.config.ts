/**
 * DriveHR Netlify Sync - Vitest Testing Configuration
 *
 * Enterprise-grade testing configuration using Vitest with comprehensive
 * coverage reporting, TypeScript integration, and performance optimization.
 * Configured for Node.js testing environment with enterprise directory
 * structure and strict coverage thresholds.
 *
 * Testing Features:
 * - Node.js environment testing with Vitest
 * - Comprehensive coverage reporting with V8 provider
 * - Enterprise directory structure support (/test separate from /src)
 * - Fork-based test isolation for reliability
 * - 80% coverage thresholds aligned with enterprise standards
 * - TypeScript integration with path aliases
 *
 * Coverage Configuration:
 * - Global 80% thresholds for branches, functions, lines, statements
 * - Multiple reporter formats: text, JSON, HTML, LCOV
 * - Excludes configuration files, type definitions, and test utilities
 * - Reports uncovered lines for continuous improvement
 *
 * @example
 * ```bash
 * # Run all tests with coverage
 * pnpm test
 *
 * # Run tests in watch mode during development
 * pnpm test --watch
 *
 * # Generate coverage report only
 * pnpm test --coverage --run
 * ```
 *
 * @module vitest-configuration
 * @since 1.0.0
 * @see {@link https://vitest.dev/config/} Vitest configuration documentation
 * @see {@link ../CLAUDE.md} for testing standards and coverage requirements
 * @see {@link ../test/} for enterprise test directory structure
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

/** Current directory path for ES modules compatibility */
const __dirname: string = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Environment
    environment: 'node',

    // Test file patterns - using enterprise directory structure
    include: [
      'test/**/*.test.ts',
      'test/**/*.spec.ts',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: [
        'text',
        'json',
        'html',
        'lcov',
        'json-summary',
        'text-summary',
      ],
      include: [
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        'test/',
        'scripts/',
        '.netlify/',
        'coverage-cli/',
        'lcov-viewer/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/index.ts',
        '**/*.test.*',
        '**/*.spec.*',
        // Exclude type-only files from coverage
        'src/types/**/*.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      all: true,
      skipFull: false,
      // Report uncovered lines
      reportOnFailure: true,
    },

    // Concurrency and timeouts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
      },
    },

    // Setup files
    // setupFiles: [],
    // globalSetup: [],

    // Watch mode
    watch: false,

    // TypeScript integration
    typecheck: {
      enabled: false, // We'll use tsc for type checking
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // '@tests': path.resolve(__dirname, './tests'), // Unused alias
    },
  },

  // Define configuration for different environments
  define: {
    'process.env.NODE_ENV': '"test"',
  },

  // Build configuration for testing
  esbuild: {
    target: 'node18',
    format: 'esm',
  },
});