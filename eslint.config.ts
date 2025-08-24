/**
 * ESLint configuration for DriveHR Netlify Sync project
 *
 * Implements enterprise-grade linting rules enforcing CLAUDE.md standards including
 * zero-tolerance for any types, security-focused rules, and TypeScript strict mode.
 *
 * @module eslint-config
 * @since 1.0.0
 * @see {@link ./CLAUDE.md} for complete development standards
 */

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import type { Linter } from 'eslint';

const config: Linter.Config[] = [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '.netlify/**',
      'coverage/**',
      'docs/**',
      '*.d.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        AbortController: 'readonly',
        URL: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Web APIs available in Node.js 18+ for modern Netlify Functions
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        RequestInit: 'readonly',
      },
    },
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Third-party library compatibility issue that cannot be resolved
      '@typescript-eslint': typescript as any,
      prettier,
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Allow unused parameters in interfaces and type definitions
          args: 'after-used',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-redeclare': ['error', { ignoreDeclarationMerge: true }],

      // Security rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',

      // Best practices
      'prefer-const': 'error',
      'no-var': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-unused-vars': 'off', // Disabled in favor of @typescript-eslint/no-unused-vars for better TypeScript support
      'no-redeclare': 'off', // Disabled in favor of @typescript-eslint/no-redeclare for better function overload support
      'no-unreachable': 'error',
      eqeqeq: ['error', 'always'],
      'no-fallthrough': 'error',
      complexity: ['warn', 10],

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },
  // Configuration files should have relaxed rules
  {
    files: ['*.config.ts', '*.config.js', 'eslint.config.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'no-console': 'off',
    },
  },
  // Test files should have relaxed rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      complexity: 'off',
    },
  },
  // Browser-side modules (for page.evaluate context)
  {
    files: ['src/services/browser/**/*.ts'],
    languageOptions: {
      globals: {
        // Browser globals
        document: 'readonly',
        window: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        NodeList: 'readonly',
        globalThis: 'readonly',
        JSON: 'readonly',
        Date: 'readonly',
        URL: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-console': 'warn', // Allow console in browser modules for debugging
    },
  },
  prettierConfig,
];

/**
 * ESLint configuration export
 *
 * @since 1.0.0
 */
export default config;