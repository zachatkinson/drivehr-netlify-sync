# Changelog

All notable changes to DriveHR Netlify Sync will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive enterprise documentation suite (README, DEPLOYMENT, SECURITY,
  CONTRIBUTING)
- Smart test selection in CI/CD pipeline based on changed files
- Multi-level security auditing (`pnpm audit`) with moderate, high, and
  production levels
- Path-based filtering for optimized CI/CD performance (~60% faster for targeted
  changes)
- Enhanced error handling with custom error types and structured logging
- Comprehensive JSDoc documentation for all public APIs and test utilities
- Comprehensive Playwright scraper test suite with 21 test cases covering
  configuration validation, initialization patterns, resource disposal, and API
  interface compliance
- Mandatory CHANGELOG.md update requirement in pre-commit workflow to ensure
  proper documentation of all changes
- Enterprise-grade automated versioning with semantic-release
- Automated CHANGELOG.md generation and GitHub releases
- Conventional commit format enforcement for version management

### Changed

- Consolidated CI/CD pipeline from dual pipelines to single unified workflow
- Updated all test files to follow enterprise JSDoc documentation standards
- Improved HMAC signature validation with better Unicode support
- Enhanced rate limiting with configurable windows and limits
- Replaced complex Playwright browser automation mocks with simplified interface
  testing for more reliable CI/CD execution
- Enhanced pre-commit requirements in CLAUDE.md to include mandatory changelog
  updates

### Fixed

- GitHub Actions JSON matrix generation for dynamic test selection
- ESLint configuration for better TypeScript 5.9 compatibility
- Test coverage reporting with proper Codecov integration

### Security

- Implemented comprehensive security headers for all function responses
- Added multi-level dependency vulnerability scanning
- Enhanced input validation using Zod schemas
- Improved secret management with environment variable validation

## [1.0.0] - 2025-01-25

### Added

- Initial production release of DriveHR Netlify Sync
- Automated job scraping from DriveHR platforms
- Secure webhook delivery to WordPress endpoints
- HMAC SHA-256 signature validation for webhook security
- Playwright-based intelligent web scraping with fallback strategies
- OpenTelemetry integration for distributed tracing
- Comprehensive test suite with 80%+ coverage
- GitHub Actions CI/CD pipeline with automated testing
- Netlify Functions serverless architecture
- Rate limiting and circuit breaker patterns
- Structured JSON logging with correlation IDs
- Health check endpoint for monitoring
- Manual trigger function for on-demand synchronization

### Security

- HMAC signature validation for all webhook communications
- Input sanitization and validation
- Security headers (CSP, X-Frame-Options, etc.)
- Automated dependency vulnerability scanning
- Secret management via environment variables

## [0.9.0] - 2025-01-20

### Added

- Beta release for testing and feedback
- Core job synchronization functionality
- Basic WordPress webhook integration
- Initial Playwright scraper implementation
- Unit and integration test framework
- Basic CI/CD pipeline setup

### Changed

- Migrated from Node.js callbacks to async/await
- Switched from npm to pnpm for package management
- Updated to TypeScript strict mode

### Fixed

- Memory leaks in Playwright browser instances
- Webhook timeout issues with large payloads
- Type safety issues in job normalization

## [0.8.0] - 2025-01-15

### Added

- Alpha release for internal testing
- Basic DriveHR scraping functionality
- WordPress webhook delivery
- Simple error handling
- Basic logging

### Known Issues

- No retry logic for failed webhooks
- Limited error handling
- No rate limiting
- Basic test coverage

## [0.7.0] - 2025-01-10

### Added

- Proof of concept implementation
- Basic Netlify Function structure
- Simple job data extraction
- Manual testing scripts

### Changed

- Architecture from standalone script to serverless function
- Data flow from synchronous to asynchronous processing

## [0.5.0] - 2025-01-05

### Added

- Initial project setup
- Basic TypeScript configuration
- Development environment setup
- Project documentation structure

---

## Version Guidelines

### Versioning Strategy

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

### Pre-release Versions

- **Alpha**: `x.y.z-alpha.n` - Early testing, unstable API
- **Beta**: `x.y.z-beta.n` - Feature complete, testing phase
- **RC**: `x.y.z-rc.n` - Release candidate, final testing

### Release Process

1. **Development**: Work on `develop` branch
2. **Feature Freeze**: Merge to `release/x.y.z` branch
3. **Testing**: QA and bug fixes on release branch
4. **Release**: Merge to `main` and tag
5. **Hotfix**: Direct fixes to `main` for critical issues

## Migration Guides

### Migrating from 0.x to 1.0

#### Breaking Changes

1. **Environment Variables**

   ```bash
   # Old format
   DRIVEHR_API_KEY=xxx
   WP_ENDPOINT=xxx

   # New format
   DRIVEHR_COMPANY_ID=xxx
   WP_API_URL=xxx
   WEBHOOK_SECRET=xxx
   ```

2. **Function Endpoints**

   ```bash
   # Old
   /.netlify/functions/sync

   # New
   /.netlify/functions/sync-jobs
   /.netlify/functions/manual-trigger
   /.netlify/functions/health-check
   ```

3. **Webhook Payload Structure**

   ```typescript
   // Old
   {
     jobs: Job[],
     timestamp: string
   }

   // New
   {
     source: 'webhook' | 'manual' | 'scheduled',
     jobs: NormalizedJob[],
     timestamp: string,
     requestId: string
   }
   ```

#### Migration Steps

1. **Update environment variables** to new format
2. **Update webhook endpoints** in WordPress
3. **Test webhook signature** validation
4. **Verify job data structure** compatibility
5. **Update monitoring** for new endpoints

### Future Deprecations

#### Planned for 2.0.0

- Legacy job format support
- Synchronous webhook delivery mode
- Direct DriveHR API access (moving to event-driven)

#### Planned for 3.0.0

- Node.js 18 support (minimum will be Node.js 20)
- CommonJS module support (ESM only)

## Support

For questions about upgrades and migrations:

- See [SUPPORT.md](SUPPORT.md) for support channels
- Check
  [GitHub Discussions](https://github.com/zachatkinson/drivehr-netlify-sync/discussions)
- Review
  [Migration Wiki](https://github.com/zachatkinson/drivehr-netlify-sync/wiki/migrations)

---

[Unreleased]:
  https://github.com/zachatkinson/drivehr-netlify-sync/compare/v1.0.0...HEAD
[1.0.0]:
  https://github.com/zachatkinson/drivehr-netlify-sync/compare/v0.9.0...v1.0.0
[0.9.0]:
  https://github.com/zachatkinson/drivehr-netlify-sync/compare/v0.8.0...v0.9.0
[0.8.0]:
  https://github.com/zachatkinson/drivehr-netlify-sync/compare/v0.7.0...v0.8.0
[0.7.0]:
  https://github.com/zachatkinson/drivehr-netlify-sync/compare/v0.5.0...v0.7.0
[0.5.0]:
  https://github.com/zachatkinson/drivehr-netlify-sync/releases/tag/v0.5.0
