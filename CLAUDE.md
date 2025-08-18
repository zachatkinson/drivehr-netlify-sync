# DriveHR Netlify Sync - Development Standards

## Project Overview

A TypeScript-based Netlify serverless function that scrapes DriveHRIS job
postings and syncs them to WordPress via REST API, built with enterprise-grade
security and code quality standards.

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

- Minimum 90% code coverage for all modules
- 100% coverage for security-critical functions
- Unit tests for all business logic
- Integration tests for all API endpoints
- Security tests for authentication and authorization

#### Vitest Configuration

- Use TypeScript configuration files
- Mock external dependencies appropriately
- Test error conditions and edge cases
- Performance testing for critical paths

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
- [ ] Documentation updated
- [ ] No eslint-disable without justification
- [ ] Performance implications considered

## Package Manager Policy

**IMPORTANT: This project uses pnpm EXCLUSIVELY**

- NEVER use npm or yarn commands
- Always use pnpm for package management
- All scripts should be run with `pnpm run <script>`
- Dependencies should be added with `pnpm add <package>`

## Commands to Remember

### Local Development

```bash
pnpm run lint          # Check code quality
pnpm run lint:fix      # Auto-fix linting issues
pnpm run type-check    # TypeScript validation
pnpm run test          # Run test suite
pnpm run test:coverage # Generate coverage report
pnpm run security      # Security vulnerability scan
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
