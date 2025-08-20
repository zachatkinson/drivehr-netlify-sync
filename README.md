# DriveHR Netlify Sync

**Modern job synchronization service with GitHub Actions scraping and Netlify
webhook processing**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)](https://www.netlify.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)](https://playwright.dev/)

## 🏗️ Architecture Overview

This service modernizes job synchronization with a two-tier architecture:

1. **GitHub Actions Scraper**: Automated browser-based job scraping with
   Playwright
2. **Netlify Webhook Receiver**: Lightweight functions for processing and
   forwarding job data

### Key Features

- 🔄 **Automated Scraping**: GitHub Actions runs Playwright scraper on schedule
- ⚡ **Webhook Processing**: Fast, lightweight Netlify functions receive and
  process data
- 🔐 **HMAC Security**: Cryptographic signature validation for all webhook
  requests
- 🧪 **Comprehensive Testing**: 333+ tests ensuring reliability and correctness
- 📊 **Health Monitoring**: Built-in health checks and error reporting
- 🎯 **Manual Triggers**: On-demand job sync via authenticated API calls

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Netlify CLI for local development
- GitHub repository with Actions enabled

### Local Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type checking
pnpm run typecheck

# Code formatting
pnpm run format

# Linting
pnpm run lint

# Local Netlify dev server
netlify dev
```

### Environment Variables

Create `.env` file based on `.env.example`:

```bash
# Required
DRIVEHR_COMPANY_ID=your-company-uuid
WP_API_URL=https://your-wordpress-site.com
WEBHOOK_SECRET=minimum-32-character-secret

# GitHub Actions (for manual triggers)
GITHUB_TOKEN=github-personal-access-token
GITHUB_REPOSITORY=username/repo-name

# Optional
LOG_LEVEL=info
NODE_ENV=production
```

## 📡 API Endpoints

### Health Check

```http
GET /.netlify/functions/health-check
```

Returns system health status and configuration validation.

### Sync Jobs (Webhook Receiver)

```http
POST /.netlify/functions/sync-jobs
Content-Type: application/json
X-Webhook-Signature: sha256=<hmac-signature>

{
  "source": "github-actions",
  "jobs": [...],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "total_count": 5,
  "run_id": "github-run-123"
}
```

### Manual Trigger

```http
POST /.netlify/functions/manual-trigger
Content-Type: application/json
X-Webhook-Signature: sha256=<hmac-signature>

{
  "force_sync": true,
  "company_id": "optional-override"
}
```

## 🔧 GitHub Actions Configuration

The scraper runs automatically via GitHub Actions. Configure these repository
secrets:

- `DRIVEHR_COMPANY_ID`: Your DriveHR company UUID
- `WEBHOOK_SECRET`: Shared secret for HMAC signatures
- `WP_API_URL`: WordPress API endpoint for job sync
- `NETLIFY_WEBHOOK_URL`: Netlify function URL for receiving scraped data

## 🏛️ Architecture Details

### Data Flow

1. **GitHub Actions** triggers on schedule or manual dispatch
2. **Playwright scraper** extracts job data from DriveHR careers page
3. **Webhook payload** sent to Netlify with HMAC signature
4. **Netlify function** validates signature and forwards to WordPress
5. **WordPress** processes and stores job data

### Security Features

- HMAC-SHA256 signature validation on all webhook requests
- CORS configuration for GitHub Actions origins
- Comprehensive security headers (CSP, HSTS, etc.)
- Request ID tracking for distributed tracing
- Error boundary handling with graceful degradation

### Technology Stack

- **Runtime**: Node.js 18+ with ES modules
- **Language**: TypeScript with strict typing
- **Testing**: Vitest with comprehensive mocking
- **Automation**: Playwright for browser automation
- **Deployment**: Netlify Functions (modern format)
- **CI/CD**: GitHub Actions with automated workflows

## 🧪 Testing

The project maintains 100% test coverage across all components:

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test test/functions/
pnpm test test/services/

# Generate coverage report
pnpm run test:coverage
```

### Test Categories

- **Unit Tests**: Individual function and class testing
- **Integration Tests**: Service interaction validation
- **Function Tests**: Netlify function endpoint testing
- **Mock Tests**: Playwright and external service mocking

## 📊 Monitoring & Observability

### Health Monitoring

- Health check endpoint with dependency validation
- Request ID generation for distributed tracing
- Structured logging with configurable levels
- Error reporting with context preservation

### Performance Metrics

- Function execution time tracking
- Job processing statistics
- Error rate monitoring
- WordPress sync success rates

## 🔄 Migration from Legacy Architecture

The service has been modernized from a legacy Netlify-only architecture:

### What Changed

- ✅ **Added**: GitHub Actions-based scraping with Playwright
- ✅ **Added**: Webhook-based data transfer architecture
- ✅ **Added**: Comprehensive test suite (333+ tests)
- ✅ **Added**: HMAC signature validation
- ❌ **Removed**: Direct API/JSON/embedded fetch strategies
- ⬆️ **Upgraded**: Modern ES modules and TypeScript strict mode

### Backward Compatibility

- Manual trigger endpoint maintains compatibility
- Health check endpoint preserved
- Environment variable structure unchanged
- WordPress integration unchanged

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and ensure tests pass: `pnpm test`
4. Ensure code quality: `pnpm run lint && pnpm run typecheck`
5. Commit changes: `git commit -m 'feat: add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Quality Standards

- 100% TypeScript strict mode compliance
- Zero ESLint errors or warnings
- Comprehensive test coverage
- Consistent code formatting with Prettier
- Semantic commit messages

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:

1. Check the
   [GitHub Issues](https://github.com/zachatkinson/drivehr-netlify-sync/issues)
2. Review the [Architecture Documentation](./ARCHITECTURE.md)
3. Examine health check endpoint output for configuration issues
4. Enable debug logging: `LOG_LEVEL=debug`

---

**Last Updated**: January 2025  
**Architecture Version**: 2.0 (GitHub Actions + Netlify)
