import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Environment
    environment: 'node',

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{ts,js}', 'src/**/*.{test,spec}.{ts,js}'],
    exclude: ['node_modules', 'dist', 'coverage'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/index.ts',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
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
