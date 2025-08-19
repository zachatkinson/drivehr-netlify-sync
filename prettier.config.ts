import type { Config } from 'prettier';

const config: Config = {
  // Core formatting
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',

  // Trailing commas for better git diffs
  trailingComma: 'es5',

  // Bracket spacing
  bracketSpacing: true,
  bracketSameLine: false,

  // Arrow function parentheses
  arrowParens: 'avoid',

  // Line endings (consistent across platforms)
  endOfLine: 'lf',

  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',

  // HTML whitespace sensitivity
  htmlWhitespaceSensitivity: 'css',

  // JSX settings
  jsxSingleQuote: true,

  // Prose wrapping for markdown
  proseWrap: 'preserve',

  // Range formatting
  rangeStart: 0,
  rangeEnd: Infinity,

  // Parser requirements
  requirePragma: false,
  insertPragma: false,

  // Vue files
  vueIndentScriptAndStyle: false,

  // Override settings for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 120,
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
      },
    },
    {
      files: '*.yaml',
      options: {
        printWidth: 120,
        tabWidth: 2,
      },
    },
    {
      files: '*.yml',
      options: {
        printWidth: 120,
        tabWidth: 2,
      },
    },
  ],
};

export default config;