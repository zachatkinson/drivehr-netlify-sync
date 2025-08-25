# Deployment Guide

This deployment guide provides comprehensive instructions for deploying DriveHR
Netlify Sync in production environments. Follow enterprise deployment practices
with security, monitoring, and reliability as core principles.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Netlify Configuration](#netlify-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
- [Security Configuration](#security-configuration)
- [Monitoring & Observability](#monitoring--observability)
- [Database & External Services](#database--external-services)
- [Performance Optimization](#performance-optimization)
- [Disaster Recovery](#disaster-recovery)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
| --------- | ------- | ----------- |
| Node.js   | 20.0.0  | 20.18.0+    |
| pnpm      | 8.0.0   | 9.0.0+      |
| Git       | 2.30.0  | 2.42.0+     |
| Memory    | 512MB   | 1GB+        |
| Storage   | 1GB     | 2GB+        |

### Required Accounts & Services

- **Netlify Account** with Functions enabled
- **GitHub Repository** with Actions enabled
- **WordPress Site** with webhook capability
- **DriveHR Account** with API access
- **Codecov Account** (optional, for coverage reporting)

### Development Tools

```bash
# Required global tools
npm install -g pnpm@latest
npm install -g netlify-cli@latest
npm install -g @antfu/ni@latest

# Verify installation
node --version    # Should be 20+
pnpm --version    # Should be 8+
netlify --version # Should be latest
```

## Environment Setup

### 1. Repository Setup

```bash
# Clone repository
git clone https://github.com/zachatkinson/drivehr-netlify-sync.git
cd drivehr-netlify-sync

# Install dependencies
pnpm install

# Verify setup
pnpm run format && pnpm typecheck && pnpm lint && pnpm test
```

### 2. Environment Configuration

Create production environment file:

```bash
# Create environment file
cp .env.example .env.production
```

#### Required Environment Variables

```bash
# DriveHR Configuration
DRIVEHR_COMPANY_ID=your_company_id
DRIVEHR_BASE_URL=https://your-company.drivehr.com

# WordPress Integration
WP_API_URL=https://yoursite.com/webhook/drivehr-sync
WEBHOOK_SECRET=your_secure_webhook_secret_minimum_32_chars

# GitHub Integration
GITHUB_TOKEN=ghp_your_github_personal_access_token
GITHUB_REPOSITORY=your-username/drivehr-netlify-sync

# Application Configuration
LOG_LEVEL=info
NODE_ENV=production
ENABLE_TELEMETRY=true

# Security Headers
CORS_ORIGINS=https://yoursite.com,https://www.yoursite.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Performance Settings
FUNCTION_TIMEOUT=30000
MAX_CONCURRENT_JOBS=10
RETRY_MAX_ATTEMPTS=3
RETRY_DELAY_MS=1000
```

### 3. Security Configuration

#### HMAC Webhook Secret Generation

```bash
# Generate secure webhook secret (use one of these methods)
openssl rand -hex 32
node -p "require('crypto').randomBytes(32).toString('hex')"
python3 -c "import secrets; print(secrets.token_hex(32))"
```

#### GitHub Token Setup

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Create token with permissions:
   - `repo` (if private repository)
   - `actions:write`
   - `contents:read`
   - `metadata:read`

## Netlify Configuration

### 1. Site Creation

#### Via Netlify Dashboard

1. **Connect Repository**
   - New site from Git
   - Choose GitHub provider
   - Select `drivehr-netlify-sync` repository
   - Authorize Netlify access

2. **Build Settings**
   ```
   Build command: pnpm run build
   Publish directory: dist
   Functions directory: dist/functions
   ```

#### Via Netlify CLI

```bash
# Login to Netlify
netlify login

# Initialize site
netlify init

# Configure build settings
netlify sites:update --build-cmd "pnpm run build" --dir "dist" --functions "dist/functions"
```

### 2. Environment Variables Setup

#### Via Dashboard

Site Settings → Environment variables → Add variables

#### Via CLI

```bash
# Set environment variables
netlify env:set DRIVEHR_COMPANY_ID "your_company_id"
netlify env:set WP_API_URL "https://yoursite.com/webhook/drivehr-sync"
netlify env:set WEBHOOK_SECRET "your_secure_webhook_secret"
netlify env:set GITHUB_TOKEN "ghp_your_token"
netlify env:set GITHUB_REPOSITORY "your-username/repo-name"
netlify env:set LOG_LEVEL "info"
netlify env:set NODE_ENV "production"
netlify env:set ENABLE_TELEMETRY "true"

# Verify variables
netlify env:list
```

### 3. Function Configuration

Create `netlify.toml` in project root:

```toml
[build]
  command = "pnpm run build"
  functions = "dist/functions"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  PNPM_VERSION = "9"

[[functions]]
  included_files = ["dist/**"]

[functions]
  directory = "dist/functions"

[functions."sync-jobs"]
  timeout = 30

[functions."manual-trigger"]
  timeout = 15

[functions."health-check"]
  timeout = 5

[dev]
  functions = "dist/functions"
  publish = "dist"

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    X-XSS-Protection = "1; mode=block"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

## CI/CD Pipeline

### 1. GitHub Actions Setup

Our intelligent CI pipeline is pre-configured with:

- **Smart test selection** based on changed files
- **Security auditing** with vulnerability scanning
- **Quality gates** with formatting, linting, type checking
- **Coverage reporting** with Codecov integration
- **Performance monitoring** with build optimization

### 2. Repository Secrets

Configure in GitHub → Settings → Secrets and variables → Actions:

```bash
# Required secrets
NETLIFY_AUTH_TOKEN=your_netlify_token
NETLIFY_SITE_ID=your_site_id
CODECOV_TOKEN=your_codecov_token (optional)

# Optional secrets for enhanced monitoring
SENTRY_AUTH_TOKEN=your_sentry_token
DATADOG_API_KEY=your_datadog_key
```

### 3. Deployment Workflow

```yaml
# .github/workflows/deploy.yml (example)
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run quality checks
        run: |
          pnpm run format:check
          pnpm typecheck  
          pnpm lint
          pnpm run security

      - name: Run tests
        run: pnpm test:coverage

      - name: Build
        run: pnpm run build

      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=dist --functions=dist/functions
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## Security Configuration

### 1. Webhook Security

#### WordPress Endpoint Setup

Ensure your WordPress webhook endpoint validates HMAC signatures:

```php
<?php
// WordPress webhook handler example
function verify_drivehr_signature($payload, $signature) {
    $expected = hash_hmac('sha256', $payload, WEBHOOK_SECRET);
    return hash_equals($expected, $signature);
}

function handle_drivehr_webhook() {
    $signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
    $payload = file_get_contents('php://input');

    if (!verify_drivehr_signature($payload, str_replace('sha256=', '', $signature))) {
        http_response_code(401);
        exit('Unauthorized');
    }

    // Process webhook payload
    $data = json_decode($payload, true);
    // Handle job data...
}
```

### 2. Function Security

#### Rate Limiting

```javascript
// Implemented in functions with
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
};
```

#### Input Validation

```javascript
// All inputs validated with Zod schemas
const JobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  company: z.string().min(1).max(100),
  // ... additional validation
});
```

### 3. Security Headers

Configured in `netlify.toml`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

## Monitoring & Observability

### 1. Health Checks

The system includes comprehensive health monitoring:

```bash
# Check function health
curl https://yoursite.netlify.app/.netlify/functions/health-check

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "wordpress": "ok",
    "github": "ok"
  }
}
```

### 2. Logging Configuration

#### Structured Logging

```javascript
// All functions use structured JSON logging
logger.info('Job sync started', {
  correlationId: 'abc-123',
  jobCount: 25,
  source: 'drivehr',
  timestamp: new Date().toISOString(),
});
```

#### Log Levels

- `error`: System errors, failures
- `warn`: Recoverable issues, deprecations
- `info`: Normal operations, job completions
- `debug`: Detailed tracing (development only)

### 3. Metrics & Alerting

#### Key Performance Indicators

Monitor these metrics in production:

```javascript
// Business Metrics
-job_sync_success_rate -
  job_sync_duration -
  webhook_delivery_success_rate -
  error_rate_by_function -
  // System Metrics
  function_cold_start_duration -
  memory_usage_percentage -
  function_timeout_rate -
  concurrent_execution_count;
```

#### Recommended Alerting Thresholds

```yaml
alerts:
  - name: 'Job Sync Failure Rate'
    condition: 'job_sync_success_rate < 95%'
    duration: '5m'

  - name: 'Function Errors'
    condition: 'error_rate > 1%'
    duration: '2m'

  - name: 'High Response Time'
    condition: 'p95_response_time > 10s'
    duration: '5m'
```

## Database & External Services

### 1. WordPress Integration

#### Endpoint Requirements

```bash
# WordPress endpoint must be accessible
curl -X POST https://yoursite.com/webhook/drivehr-sync \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=signature" \
  -d '{"test": "connection"}'
```

#### WordPress Configuration

Required WordPress setup:

- Custom webhook handler (not REST API)
- HMAC signature validation
- Job data processing capability
- Error handling and logging

### 2. DriveHR Integration

#### Access Requirements

- Company-specific DriveHR URL
- Valid company ID
- Network access to DriveHR platform
- Ability to scrape job listings

#### Rate Limiting Compliance

- Maximum 1 request per minute to DriveHR
- Respect robots.txt and scraping policies
- Implement exponential backoff for errors

### 3. GitHub Integration

#### Workflow Triggers

- Personal access token with appropriate scopes
- Repository dispatch permissions
- Actions workflow enabled

## Performance Optimization

### 1. Function Performance

#### Memory Allocation

```toml
# netlify.toml function optimization
[functions."sync-jobs"]
  memory = 1024  # MB for large job datasets

[functions."manual-trigger"]
  memory = 512   # MB for API calls

[functions."health-check"]
  memory = 256   # MB for simple checks
```

#### Cold Start Optimization

- Minimal dependencies in function bundles
- Tree-shaking enabled in build process
- Connection pooling for external services
- Cached configuration and secrets

### 2. Build Optimization

```json
{
  "build": {
    "esbuild": {
      "bundle": true,
      "minify": true,
      "target": "node20",
      "format": "esm",
      "treeShaking": true
    }
  }
}
```

### 3. Caching Strategy

#### Function-level Caching

```javascript
// Configuration caching
const configCache = new Map();
const getCachedConfig = key => {
  if (!configCache.has(key)) {
    configCache.set(key, loadConfig(key));
  }
  return configCache.get(key);
};
```

## Disaster Recovery

### 1. Backup Strategy

#### Code Repository

- Primary: GitHub repository
- Mirror: Consider GitLab or Bitbucket mirror
- Local: Development team local clones

#### Configuration Backup

```bash
# Export Netlify configuration
netlify sites:list --json > netlify-sites-backup.json
netlify env:list --json > environment-backup.json

# Store securely (encrypted)
gpg --encrypt --recipient admin@company.com environment-backup.json
```

### 2. Recovery Procedures

#### Service Outage Response

1. **Identify Impact**

   ```bash
   # Check function status
   curl https://yoursite.netlify.app/.netlify/functions/health-check

   # Check CI/CD pipeline
   gh run list --repo your-username/drivehr-netlify-sync
   ```

2. **Implement Workarounds**
   - Manual job synchronization
   - Temporary WordPress direct updates
   - Communication to stakeholders

3. **Recovery Process**
   - Restore from last known good deployment
   - Validate all environment variables
   - Run comprehensive test suite
   - Monitor for 24 hours post-recovery

#### Data Recovery

```bash
# Restore environment configuration
netlify env:set --from-file environment-backup.json

# Redeploy from last stable commit
git checkout last-stable-tag
netlify deploy --prod
```

## Troubleshooting

### 1. Common Issues

#### Function Timeout Errors

```bash
# Symptoms
Error: Function timeout after 30000ms

# Solutions
1. Check function memory allocation
2. Optimize database queries
3. Implement request pagination
4. Add connection pooling
```

#### Webhook Delivery Failures

```bash
# Symptoms
HTTP 401 Unauthorized on WordPress endpoint

# Solutions
1. Verify WEBHOOK_SECRET matches WordPress
2. Check HMAC signature generation
3. Validate WordPress endpoint availability
4. Review WordPress error logs
```

#### Build Failures

```bash
# Symptoms
Build command failed with exit code 1

# Solutions
1. Check Node.js version compatibility
2. Clear pnpm cache: pnpm store prune
3. Verify dependencies: pnpm install --frozen-lockfile
4. Check TypeScript compilation: pnpm typecheck
```

### 2. Debugging Tools

#### Local Development

```bash
# Run functions locally
netlify dev

# Debug with verbose logging
LOG_LEVEL=debug netlify dev

# Test specific function
netlify functions:invoke sync-jobs --payload '{"test": true}'
```

#### Production Debugging

```bash
# View function logs
netlify logs:functions

# Monitor real-time
netlify logs:functions --follow

# Check build logs
netlify logs:build
```

### 3. Performance Debugging

#### Function Performance Analysis

```bash
# Enable performance monitoring
ENABLE_TELEMETRY=true

# Analyze cold start times
curl -w "@curl-format.txt" -o /dev/null -s https://yoursite.netlify.app/.netlify/functions/health-check
```

#### Memory Usage Analysis

```javascript
// Add to function for debugging
process.memoryUsage();
// Returns: { rss, heapTotal, heapUsed, external, arrayBuffers }
```

## Maintenance

### 1. Regular Updates

#### Dependency Updates

```bash
# Weekly dependency check
pnpm update --interactive

# Security updates
pnpm audit --fix

# Check for vulnerabilities
pnpm run security
```

#### Node.js Updates

```bash
# Check current version
node --version

# Update in netlify.toml
[build.environment]
  NODE_VERSION = "20.18.0"  # Latest LTS
```

### 2. Monitoring & Alerts

#### Weekly Health Checks

- [ ] Function response times < 5s average
- [ ] Error rate < 0.1%
- [ ] Job sync success rate > 99%
- [ ] WordPress webhook delivery > 98%
- [ ] Security audit passing

#### Monthly Reviews

- [ ] Dependency vulnerability scan
- [ ] Performance metrics analysis
- [ ] Cost optimization review
- [ ] Documentation updates
- [ ] Disaster recovery test

### 3. Scaling Considerations

#### Traffic Growth

```javascript
// Monitor these metrics for scaling decisions
-concurrent_function_executions -
  average_response_time -
  memory_usage_percentage -
  error_rate_trends;
```

#### Cost Optimization

```bash
# Review Netlify usage
netlify status

# Optimize function memory allocation based on usage
# Monitor and adjust timeout values
# Implement request caching where appropriate
```

---

## Additional Resources

- **[README.md](./README.md)** - Project overview and quick start
- **[CLAUDE.md](./CLAUDE.md)** - Development standards and practices
- **[SECURITY.md](./SECURITY.md)** - Security policies and reporting
- **[Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)**
- **[GitHub Actions Documentation](https://docs.github.com/en/actions)**

---

**For additional support, please open an issue in the GitHub repository or
contact the development team.**
