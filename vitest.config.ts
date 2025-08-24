/**
 * Vitest testing configuration for DriveHR Netlify Sync
 *
 * Implements enterprise testing standards with 80% coverage targets,
 * security-focused test isolation, and comprehensive reporting.
 *
 * @module vitest-config
 * @since 1.0.0
 * @see {@link ./CLAUDE.md} for testing standards
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname: string = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest configuration export
 *
 * @since 1.0.0
 */
export default defineConfig({
  test: {
    // Environment
    environment: 'node',

    // Test file patterns - using enterprise directory structure
    include: ['test/**/*.{test,spec}.{ts,js}'],
    exclude: ['node_modules', 'dist', 'coverage'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,tsx,js,jsx}',
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
    },

    // Test execution
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Performance
    maxConcurrency: 5,

    // Reporting
    reporters: ['verbose', 'json', 'junit'],
    outputFile: {
      json: './coverage/test-results.json',
      junit: './test-report.junit.xml',
    },

    // Security and isolation
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },

    // Setup files
    setupFiles: [],
    globalSetup: [],

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
      '@tests': path.resolve(__dirname, './tests'),
    },
  },

  // Define configuration for different environments
  define: {
    'process.env.NODE_ENV': '"test"',
  },

  // Plugins (if needed for testing specific libraries)
  plugins: [],
});
