# DriveHR Netlify Sync - Development Standards

## Project Overview

A TypeScript-based Netlify serverless function that scrapes DriveHR job postings
and syncs them to WordPress via webhooks, built with enterprise-grade security
and code quality standards.

## Core Development Principles

### 1. Code Quality Standards

#### SOLID Principles (Non-Negotiable)

- **Single Responsibility**: Each class/function has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Derived classes must be substitutable for base
  classes
- **Interface Segregation**: Clients shouldn't depend on interfaces they don't
  use
- **Dependency Inversion**: Depend on abstractions, not concretions

#### DRY Principle

- No code duplication - extract common functionality into reusable utilities
- Create shared interfaces and types for common data structures
- Use dependency injection for shared services

#### Zero Technical Debt Policy

- All code must meet quality standards before merge
- No TODO comments in production code - create GitHub issues instead
- All deprecated code must be removed, not commented out

### 2. TypeScript Standards

#### Strict Configuration (Required)

```typescript
// tsconfig.json must include:
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true,
"strictFunctionTypes": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true
```

#### Type Safety Rules

- **NEVER use `any` type** - use `unknown` and type guards instead
- All function parameters and return types must be explicitly typed
- Use discriminated unions for complex state management
- Implement comprehensive interfaces for all external API responses
- Use generic types for reusable functions and classes

#### JSDoc Documentation Standards (2025 Best Practices)

**ALL public functions, classes, and interfaces must have comprehensive JSDoc:**

````typescript
/**
 * Brief description of what the function does
 *
 * Detailed explanation if needed, including business logic,
 * architectural decisions, or important implementation details.
 *
 * @param paramName - Description of parameter, including constraints
 * @param optionalParam - Description with default behavior
 * @returns Description of return value and possible states
 * @throws {ErrorType} When and why this error is thrown
 * @example
 * ```typescript
 * const result = await fetchJobs(config, 'manual');
 * if (result.success) {
 *   console.log(`Fetched ${result.jobs.length} jobs`);
 * }
 * ```
 * @since 1.0.0
 * @see {@link RelatedFunction} for related functionality
 */
````

**Required JSDoc tags:**

- `@param` for all parameters
- `@returns` for all return values (except void)
- `@throws` for all possible exceptions
- `@example` for complex functions or public APIs
- `@since` for version tracking
- `@deprecated` with migration path for deprecated code

**Documentation requirements:**

- Explain WHY not just WHAT (business logic, architectural decisions)
- Include usage examples for complex APIs
- Document error conditions and recovery strategies
- Reference related functions/classes with `@see`
- Use proper TypeScript syntax in examples

#### Test File JSDoc Standards (2025 Best Practices)

**ALL test files must follow comprehensive JSDoc documentation:**

**File-level documentation:** Every test file must have complete module JSDoc
with:

````typescript
/**
 * Service Name Test Suite
 *
 * Comprehensive test coverage for [service description] following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates [key functionality areas].
 *
 * Test Features:
 * - [Feature 1 description]
 * - [Feature 2 description]
 * - [Feature 3 description]
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/path/service.test.ts -- --grep "pattern"
 * ```
 *
 * @module service-test-suite
 * @since 1.0.0
 * @see {@link ../../src/path/service.ts} for the service being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */
````

**Test utility classes:** All utility classes extending BaseTestUtils must have:

````typescript
/**
 * Service-specific test utilities
 *
 * Extends BaseTestUtils with service-specific testing patterns.
 * Maintains DRY principles while providing specialized testing methods.
 *
 * @since 1.0.0
 */
class ServiceTestUtils extends BaseTestUtils {
  /**
   * Brief description of utility method
   *
   * Detailed explanation of what the method does, how it helps with testing,
   * and when to use it. Include any important implementation details.
   *
   * @param param1 - Description of parameter
   * @param param2 - Description of parameter
   * @returns Description of return value
   * @example
   * ```typescript
   * ServiceTestUtils.utilityMethod(param1, param2);
   * ```
   * @since 1.0.0
   */
  static utilityMethod(param1: type, param2: type): returnType {}
}
````

**CRITICAL: Test JSDoc Requirements:**

- All test utility classes must have comprehensive JSDoc
- All utility methods must have @param, @returns, @example, @since
- File-level JSDoc must explain test scope and features
- Examples must show real usage patterns
- Reference the source file being tested with @see
- Follow the same enterprise standards as production code

**Test File Creation Checklist:**

- [ ] File-level JSDoc with comprehensive description
- [ ] Test utility class with full JSDoc documentation
- [ ] All utility methods have @param, @returns, @example, @since
- [ ] Examples show realistic usage patterns
- [ ] References to source files and standards with @see
- [ ] Module name follows kebab-case pattern
- [ ] Test features clearly documented

### 3. ESLint Policy (Zero Tolerance)

#### eslint-disable Usage

- **PROHIBITED** except in the following scenarios:
  - Legitimate TypeScript compiler limitations
  - Third-party library compatibility issues that cannot be resolved
  - Performance-critical code with documented justification
- Every eslint-disable must include a detailed comment explaining why it's
  architecturally necessary
- All alternatives must be documented and attempted first

#### Required ESLint Rules

- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unused-vars`: error
- `prefer-const`: error
- `no-var`: error
- Security-focused rules for preventing common vulnerabilities

#### Operator Safety Rules

- **ALWAYS use nullish coalescing operator (`??`) instead of logical OR (`||`)**
  - Safer for handling `null` and `undefined` values
  - Prevents false positives with falsy values like `0`, `false`, `""`
  - **Bad**: `const value = config.timeout || 5000;` (fails if timeout is 0)
  - **Good**: `const value = config.timeout ?? 5000;` (only uses default for
    null/undefined)

### 4. Security Requirements (2025 Standards)

#### Input Validation & Sanitization

- All external input must be validated using schema validation (Zod/Joi)
- HTML sanitization for any user-generated content
- SQL injection prevention through parameterized queries
- XSS prevention through proper encoding

#### Secret Management

- **NEVER** hardcode secrets, API keys, or credentials
- All sensitive data in environment variables only
- Use runtime validation for required environment variables
- Implement secret rotation procedures

#### HTTP Security Headers

```typescript
// Required headers for all responses:
'Content-Security-Policy': "default-src 'self'",
'X-Frame-Options': 'DENY',
'X-Content-Type-Options': 'nosniff',
'Referrer-Policy': 'strict-origin-when-cross-origin',
'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
```

#### Error Handling Security

- Never expose internal system details in error messages
- Log security events without sensitive data
- Implement proper error boundaries to prevent information leakage
- Use structured logging with appropriate log levels

### 5. Testing Requirements

#### Coverage Standards

- **Target 80% code coverage** for enterprise-grade quality (industry standard)
- **90%+ coverage for security-critical functions** (authentication, webhook
  validation, HMAC signature generation)
- **70%+ coverage for integration services** (HTTP clients, external API
  wrappers)
- **Focus on business logic over framework glue code** (prioritize job parsing,
  sync logic, data transformations)
- Unit tests for all business logic
- Integration tests for all API endpoints
- Security tests for authentication and authorization
- **Quality over quantity**: Prefer maintainable tests that catch real bugs over
  brittle mocks that chase coverage percentages

**Coverage Target Rationale:**

- 80% aligns with industry standard for enterprise serverless applications
- 90%+ reserved for life-critical systems (medical, aviation, nuclear) - our
  system is business-critical, not life-critical
- Focus on testing business logic, error paths, and integration points rather
  than framework boilerplate
- Avoid brittle mocks for external services; use dependency injection and
  interface testing instead
- Prioritize end-to-end workflow testing over exhaustive unit test coverage

#### Test Naming Standards

Test names must be descriptive and follow this format:

```
describe('[ServiceName/FunctionName]', () => {
  describe('when [specific condition]', () => {
    it('should [expected behavior]', () => {
      // Test implementation
    });
  });
});
```

**Examples of GOOD test names:**

- `should return valid normalized job when given complete raw job data`
- `should throw WordPressClientError when webhook signature validation fails`
- `should retry HTTP requests with exponential backoff when rate limited`
- `should parse job listings from HTML using CSS selectors successfully`

**Examples of BAD test names:**

- `should work`
- `test job fetch`
- `config test`
- `it works properly`

#### Test Organization

- Group related tests using nested `describe` blocks
- Each test file should test ONE module/service/class
- Use descriptive describe blocks that explain the component being tested
- Use descriptive it blocks that explain the specific behavior being verified
- Test files must end with `.test.ts` or `.spec.ts`

#### DRY and SOLID Principles for Test Code (MANDATORY)

**Test code must follow the same DRY and SOLID principles as source code:**

- **NO duplicate mock setup** - Create shared mock factories and utilities
- **NO repeated assertion patterns** - Extract common assertion helpers
- **Single Responsibility** - Each test helper has one clear purpose
- **Interface Segregation** - Mock interfaces should only include methods under
  test
- **Dependency Inversion** - Tests should depend on abstractions, not concrete
  implementations

**Required test utilities pattern:**

```typescript
// test/utils/mock-helpers.ts
export function createMockHttpClient(): MockHttpClient & {
  asInterface(): IHttpClient;
};
export function expectDefined<T>(value: T | undefined): asserts value is T;
export function expectArrayWithLength<T>(
  array: T[],
  length: number
): asserts array is T[];
```

**Examples of DRY violations to avoid:**

- Repeating the same mock setup in multiple test files
- Duplicating the same assertion patterns across tests
- Copy-pasting test helper functions instead of sharing them
- Creating multiple similar test fixtures instead of parameterized factories

#### Test Directory Structure (Enterprise Standard)

**REQUIRED: Use separate test directory with mirrored structure**

```
/test/                          # Root test directory
  fixtures/                     # Shared test data and mock objects
    raw-job-data.ts            # Mock job data for testing
    http-responses.ts          # Mock HTTP responses
    environment-configs.ts     # Mock configuration data
    netlify-events.ts          # Mock Netlify function events
  utils/                        # Shared test utilities and factories
    test-factories.ts          # Factory functions for generating test data
  lib/                          # Tests for src/lib/ (mirrors source structure)
    config.test.ts
    http-client.test.ts
  services/                     # Tests for src/services/
    job-fetcher.test.ts
    html-parser.test.ts
    wordpress-client.test.ts
  functions/                    # Tests for src/functions/
    sync-jobs.test.ts
```

**Why separate directory over co-located tests:**

- Better for enterprise/production builds (easier to exclude tests)
- Cleaner directory structure for large codebases
- Industry standard for enterprise applications
- Easier to configure build tools to exclude test files
- Better separation of concerns between production and test code

#### Test Structure Standards

```typescript
// REQUIRED: All tests must follow this structure
describe('ServiceName', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset mocks, initialize test data
  });

  describe('when [condition/scenario]', () => {
    it('should [expected behavior]', () => {
      // Arrange: Set up test data
      // Act: Execute the code under test
      // Assert: Verify the results
    });

    it('should [different expected behavior]', () => {
      // Test implementation
    });
  });

  describe('when [different condition]', () => {
    it('should [expected behavior for this condition]', () => {
      // Test implementation
    });
  });
});
```

#### Mock and Test Data Standards

- Create realistic test fixtures that mirror production data
- Use factory functions for generating test data
- Mock external dependencies at the interface level
- Never use real API keys or sensitive data in tests
- Create separate test data files in `src/test/fixtures/`

#### Error Testing Requirements

- Test all error conditions and edge cases
- Verify error messages are appropriate for each scenario
- Test error handling doesn't leak sensitive information
- Verify proper cleanup happens during error scenarios

#### Security Testing Requirements

- Test authentication and authorization flows
- Verify input validation and sanitization
- Test rate limiting and abuse prevention
- Verify no sensitive data is logged or exposed

#### Performance Testing Standards

- Test performance of critical paths
- Verify memory usage stays within bounds
- Test with realistic data volumes
- Measure and assert on response times for key operations

#### Vitest Configuration

- Use TypeScript configuration files
- Mock external dependencies appropriately
- Generate JUnit XML reports for CI/CD integration
- Include code coverage reporting
- Use watch mode for development

### 6. Performance Standards

#### Rate Limiting

- Implement rate limiting for all public endpoints
- Use exponential backoff for external API calls
- Monitor and log performance metrics

#### Memory Management

- Avoid memory leaks in long-running functions
- Use streaming for large data processing
- Implement proper cleanup in error scenarios

### 7. Architecture Patterns

#### Dependency Injection

- Use constructor injection for dependencies
- Create interfaces for all external services
- Implement factory patterns for complex object creation

#### Error Handling

- Use Result/Either patterns for error handling
- Create custom error types with appropriate context
- Implement circuit breaker patterns for external services

#### Logging

- Use structured logging (JSON format)
- Include correlation IDs for request tracing
- Never log sensitive information (passwords, tokens, PII)

### 8. Git Workflow Standards

#### Pre-Commit Requirements (MANDATORY)

**CRITICAL: Before ANY commit can be made, ALL of the following must be executed
and pass without errors:**

1. **Code Formatting**: `pnpm run format`
   - Must complete successfully with no errors
   - All code must be properly formatted according to Prettier rules

2. **Type Checking**: `pnpm typecheck`
   - Must pass with zero TypeScript errors
   - All type issues must be resolved properly, not bypassed

3. **Linting**: `pnpm lint --fix`
   - Must pass with zero ESLint errors or warnings
   - Auto-fixable issues will be corrected
   - All remaining issues must be resolved manually
   - No eslint-disable additions without architectural justification

4. **Security Audit**: `pnpm run security`
   - Must pass dependency vulnerability scan at moderate level
   - Critical and high-severity vulnerabilities must be addressed
   - For production releases, use `pnpm run security:prod` for high-level audit
   - Auto-fixable vulnerabilities can be resolved with `pnpm run security:fix`

5. **Changelog Update** (MANDATORY)
   - CHANGELOG.md must be updated to document all changes before commit
   - Include version number, date, and categorized changes (Added, Changed,
     Fixed, etc.)
   - Follow Keep a Changelog format: https://keepachangelog.com/
   - Changes must be meaningful and describe business impact, not just technical
     details
   - Example entry format:

   ```markdown
   ## [1.2.0] - 2024-01-15

   ### Added

   - Playwright scraper tests with comprehensive error handling and edge cases
   - Enhanced telemetry system tests for initialization errors and metrics
     recording

   ### Changed

   - Updated JSDoc documentation to comply with enterprise standards
   - Improved test coverage from 74% to 85%

   ### Fixed

   - Resolved TypeScript strict mode compliance issues in test files
   ```

**These checks are NOT optional - they are requirements. Commits that bypass
these checks will be rejected.**

#### Commit Messages

- Use conventional commit format: `type(scope): description`
- Include ticket numbers when applicable
- Write descriptive commit messages explaining the "why"

#### Branch Protection

- All changes must go through Pull Requests
- Require passing CI/CD checks before merge
- Require code review approval from at least one maintainer

#### CI/CD Requirements

- All tests must pass
- Linting must pass with zero warnings
- Security scanning must pass
- Type checking must pass
- No eslint-disable additions without justification

### 9. Documentation Standards

#### Code Documentation

- JSDoc comments for all public functions and classes
- Include parameter and return type descriptions
- Document complex business logic and algorithms
- Explain security considerations where applicable

#### README Maintenance

- Keep installation and setup instructions current
- Document all environment variables
- Include troubleshooting section
- Maintain API documentation

### 10. Deployment Standards

#### Environment Configuration

- Separate configurations for development, staging, and production
- Validate all required environment variables at startup
- Use feature flags for gradual rollouts

#### Monitoring

- Implement health check endpoints
- Monitor error rates and response times
- Set up alerts for security events
- Track business metrics (job sync success rates)

## Enforcement

### Pre-commit Hooks

- Run ESLint with zero tolerance for warnings
- Execute type checking
- Run security linting
- Format code with Prettier

### CI/CD Pipeline

- Automated testing on all pull requests
- Security vulnerability scanning
- Dependency auditing
- Performance regression testing

### Code Review Checklist

- [ ] Follows SOLID principles
- [ ] No code duplication (DRY)
- [ ] Proper error handling
- [ ] Security considerations addressed
- [ ] Tests written and passing
- [ ] Test files have comprehensive JSDoc (classes and methods)
- [ ] Documentation updated
- [ ] No eslint-disable without justification
- [ ] Performance implications considered

## Package Manager Policy

**IMPORTANT: This project uses pnpm EXCLUSIVELY**

- NEVER use npm or yarn commands
- Always use pnpm for package management
- All scripts should be run with `pnpm run <script>`
- Dependencies should be added with `pnpm add <package>`

## WordPress Integration Standards

**CRITICAL: WordPress Webhook Endpoint Format**

The WordPress webhook endpoint URL format is **FIXED** and must NOT be changed:

- **Correct Format**: `https://yoursite.com/webhook/drivehr-sync`
- **NEVER use**: `https://yoursite.com/wp-json/drivehr/v1/sync` (this is REST
  API format)
- **NEVER use**: Any other wp-json or REST API endpoint format

**Important Notes:**

- We do NOT use WordPress REST API for this integration
- The endpoint is a custom webhook handler at `/webhook/drivehr-sync`
- All documentation must reflect this exact endpoint format
- Any references to wp-json or REST API endpoints are incorrect and must be
  fixed

## Commands to Remember

### Local Development

```bash
pnpm run lint          # Check code quality
pnpm run lint:fix      # Auto-fix linting issues
pnpm run type-check    # TypeScript validation
pnpm run test          # Run test suite
pnpm run test:coverage # Generate coverage report
pnpm run security      # Security vulnerability scan (moderate level)
pnpm run security:high # High-severity vulnerability scan
pnpm run security:prod # Production dependency audit (high level)
pnpm run security:fix  # Auto-fix security vulnerabilities
pnpm install           # Install dependencies
pnpm add <package>     # Add production dependency
pnpm add -D <package>  # Add development dependency
```

### CI/CD Integration

All commands above must pass in CI/CD pipeline before any code can be merged.

---

**Remember**: These standards are not suggestions - they are requirements. Code
that doesn't meet these standards will not be merged. When in doubt, choose the
more secure, more maintainable option.
