# DriveHR Netlify Sync - Deployment Runbook

## 📋 Overview

This runbook provides comprehensive deployment procedures, operational
guidelines, and troubleshooting steps for the DriveHR Netlify Sync application.
Designed for DevOps teams, site reliability engineers, and operations personnel.

## 🚀 Deployment Procedures

### Pre-Deployment Checklist

- [ ] **Environment Variables Configured**
  - `DRIVEHR_COMPANY_ID` - Valid UUID
  - `WP_API_URL` - WordPress webhook endpoint
  - `WEBHOOK_SECRET` - Minimum 32 characters
  - `NODE_ENV` - Set to `production`
  - `LOG_LEVEL` - Set to `info` or `warn`

- [ ] **Code Quality Gates Passed**
  - All CI/CD tests passing
  - ESLint checks with zero violations
  - TypeScript compilation successful
  - Security audit clean (no high/critical vulnerabilities)
  - Code coverage ≥90%

- [ ] **External Dependencies Verified**
  - WordPress site accessible and responsive
  - DriveHR API endpoints reachable
  - Database connections tested
  - CDN and static assets available

- [ ] **Monitoring and Alerting**
  - Performance monitoring configured
  - Error tracking enabled
  - Log aggregation setup
  - Alert thresholds defined

### Deployment Steps

#### 1. Production Build Verification

```bash
# Install dependencies and run build
pnpm install --frozen-lockfile
pnpm run build

# Verify build artifacts
ls -la dist/functions/
# Should contain: sync-jobs.mjs, health-check.mjs, manual-trigger.mjs

# Run final quality checks
pnpm run type-check
pnpm run lint
pnpm run test:coverage
```

#### 2. Environment Configuration

```bash
# Validate environment configuration
node scripts/verify-config.js

# Test environment connectivity
pnpm run health-check:local
```

#### 3. Netlify Deployment

```bash
# Deploy to staging first
netlify deploy --build --context=staging

# Verify staging deployment
curl -X GET "https://staging--drivehr-sync.netlify.app/.netlify/functions/health-check"

# Deploy to production
netlify deploy --build --prod

# Verify production deployment
curl -X GET "https://drivehr-sync.netlify.app/.netlify/functions/health-check"
```

#### 4. Post-Deployment Verification

```bash
# Monitor deployment status
node scripts/monitor-deployment.js

# Run smoke tests
pnpm run test:smoke

# Verify job sync functionality
curl -X POST "https://drivehr-sync.netlify.app/.netlify/functions/manual-trigger" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=..." \
  -d '{"reason": "deployment verification", "dryRun": true}'
```

### Rollback Procedures

#### 1. Immediate Rollback (< 5 minutes)

```bash
# Rollback to previous deployment
netlify api listSiteDeploys --site-id="your-site-id" | head -10
netlify api restoreSiteDeploy --site-id="your-site-id" --deploy-id="previous-deploy-id"

# Verify rollback
curl -X GET "https://drivehr-sync.netlify.app/.netlify/functions/health-check"
```

#### 2. Code Rollback (5-15 minutes)

```bash
# Revert to previous commit
git log --oneline -10  # Find previous stable commit
git revert HEAD --no-edit
git push origin main

# Monitor auto-deployment
netlify watch
```

#### 3. Configuration Rollback

```bash
# Restore previous environment variables
netlify env:restore --from-backup="backup-timestamp"

# Restart functions
netlify functions:invoke health-check
```

## 🔧 Configuration Management

### Environment Variables

| Variable             | Required | Default       | Description                       | Example                                          |
| -------------------- | -------- | ------------- | --------------------------------- | ------------------------------------------------ |
| `DRIVEHR_COMPANY_ID` | ✅       | -             | DriveHR company UUID              | `123e4567-e89b-12d3-a456-426614174000`           |
| `WP_API_URL`         | ✅       | -             | WordPress webhook endpoint URL    | `https://yourwebsite.com/webhook/drivehr-sync`   |
| `WEBHOOK_SECRET`     | ✅       | -             | HMAC signature secret (≥32 chars) | `super-secret-webhook-key-minimum-32-characters` |
| `NODE_ENV`           | ✅       | `development` | Environment identifier            | `production`                                     |
| `LOG_LEVEL`          | ❌       | `info`        | Minimum log level                 | `info`, `warn`, `error`                          |

### Performance Tuning

#### Function Configuration

```toml
# netlify.toml
[functions]
  timeout = 30
  memory = 512

[functions.sync-jobs]
  timeout = 60
  memory = 1024

[functions.health-check]
  timeout = 10
  memory = 256
```

#### Caching Strategy

```toml
# netlify.toml
[[headers]]
  for = "/.netlify/functions/health-check"
  [headers.values]
    Cache-Control = "public, max-age=60"

[[headers]]
  for = "/.netlify/functions/sync-jobs"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
```

### Security Configuration

#### Required Headers

```toml
# netlify.toml
[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-XSS-Protection = "1; mode=block"
    Content-Security-Policy = "default-src 'self'"
```

#### Rate Limiting

Configure Netlify Edge Functions for rate limiting:

```typescript
// netlify/edge-functions/rate-limit.ts
export default async (request: Request) => {
  const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
  // Implement rate limiting logic
};
```

## 📊 Monitoring and Observability

### Health Check Endpoints

#### Primary Health Check

```bash
# Basic health check
curl -X GET "https://drivehr-sync.netlify.app/.netlify/functions/health-check"

# Expected Response:
{
  "status": "healthy",
  "timestamp": "2025-01-20T15:30:45.123Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "config": {"status": "pass", "duration": 12},
    "wordpress": {"status": "pass", "duration": 234},
    "drivehr": {"status": "pass", "duration": 156}
  }
}
```

#### Deep Health Check

```bash
# Comprehensive system check
curl -X GET "https://drivehr-sync.netlify.app/.netlify/functions/health-check?deep=true"
```

### Performance Metrics

#### Key Performance Indicators (KPIs)

1. **Availability Metrics**
   - Uptime percentage (target: 99.9%)
   - Response time (target: <2000ms)
   - Error rate (target: <1%)

2. **Business Metrics**
   - Jobs synchronized per hour
   - Sync success rate (target: >95%)
   - Data freshness (lag time)

3. **System Metrics**
   - Memory usage
   - CPU utilization
   - Function cold starts

#### Monitoring Setup

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'drivehr-sync'
    static_configs:
      - targets: ['drivehr-sync.netlify.app']
    metrics_path: '/.netlify/functions/metrics'
    scrape_interval: 30s
```

### Log Management

#### Log Levels and Structured Logging

```typescript
// Example log output
{
  "timestamp": "2025-01-20T15:30:45.123Z",
  "level": "info",
  "message": "Job sync completed successfully",
  "metadata": {
    "jobsProcessed": 45,
    "duration": 2847,
    "strategy": "api",
    "requestId": "req-abc123"
  }
}
```

#### Log Aggregation

```bash
# View recent logs
netlify logs:function sync-jobs --tail

# Search logs with filters
netlify logs:function sync-jobs --filter="ERROR" --since="1h"

# Export logs for analysis
netlify logs:function sync-jobs --format=json > logs/sync-$(date +%Y%m%d).json
```

### Alerting Configuration

#### Critical Alerts (Immediate Response)

1. **Function Failures**
   - 5xx errors > 5% in 5 minutes
   - Function timeouts > 10% in 10 minutes
   - Health check failures > 2 consecutive

2. **Business Impact**
   - Zero jobs synchronized in 2 hours
   - WordPress API unavailable > 5 minutes
   - DriveHR API errors > 50% in 15 minutes

#### Warning Alerts (Monitor Closely)

1. **Performance Degradation**
   - Response time > 5000ms average over 10 minutes
   - Memory usage > 80% of allocated
   - Cold start rate > 20%

2. **Data Quality**
   - Job validation failures > 5%
   - Missing required job fields > 1%
   - Duplicate job detection > 10%

## 🚨 Troubleshooting Guide

### Common Issues and Resolutions

#### 1. Function Timeout Errors

**Symptoms:**

- HTTP 504 Gateway Timeout
- Logs show function execution cutoff
- Partial sync results

**Diagnosis:**

```bash
# Check function performance
netlify functions:list --json | jq '.[] | select(.name=="sync-jobs")'

# Review execution times
netlify logs:function sync-jobs --filter="duration" --since="1h"
```

**Resolution:**

```toml
# Increase timeout in netlify.toml
[functions.sync-jobs]
  timeout = 120  # Increase from 60 to 120 seconds
```

#### 2. Memory Limit Exceeded

**Symptoms:**

- Function crashes during execution
- "Out of memory" errors in logs
- Incomplete job processing

**Diagnosis:**

```bash
# Monitor memory usage
netlify logs:function sync-jobs --filter="memory" --since="1h"

# Check job count correlation
curl -X GET "https://drivehris.app/careers/company/list?id=YOUR_COMPANY_ID" | jq '. | length'
```

**Resolution:**

```toml
# Increase memory allocation
[functions.sync-jobs]
  memory = 2048  # Increase from 1024 to 2048 MB
```

#### 3. WordPress Webhook Connection Issues

**Symptoms:**

- HTTP 401/403 errors
- "Invalid webhook signature" messages
- Health check failures for WordPress endpoint
- Webhook delivery failures

**Diagnosis:**

```bash
# Test WordPress webhook endpoint accessibility
curl -I "https://your-site.com/webhook/drivehr-sync"

# Test webhook with proper signature
# Generate test signature
node -e "
const crypto = require('crypto');
const secret = 'your-webhook-secret';
const payload = JSON.stringify({test: 'data'});
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('sha256=' + signature);
"

# Test webhook with signature
curl -X POST "https://your-site.com/webhook/drivehr-sync" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=GENERATED_SIGNATURE" \
  -d '{"test": "data"}'
```

**Resolution:**

1. Verify WordPress webhook endpoint is accessible
2. Check webhook secret configuration matches
3. Confirm endpoint URL is correct
4. Review WordPress webhook handler implementation
5. Verify HMAC signature generation/validation

#### 4. DriveHR API Rate Limiting

**Symptoms:**

- HTTP 429 responses
- "Rate limit exceeded" errors
- Sporadic sync failures

**Diagnosis:**

```bash
# Check rate limit headers
curl -I "https://drivehris.app/careers/company/list?id=YOUR_COMPANY_ID"

# Review retry patterns in logs
netlify logs:function sync-jobs --filter="retry" --since="1h"
```

**Resolution:**

1. Implement exponential backoff
2. Reduce sync frequency
3. Contact DriveHR for rate limit increase
4. Optimize API query patterns

#### 5. Webhook Signature Validation Failures

**Symptoms:**

- HTTP 401 Unauthorized
- "Invalid webhook signature" errors
- Manual triggers failing

**Diagnosis:**

```bash
# Verify webhook secret configuration
netlify env:get WEBHOOK_SECRET

# Test signature generation
node -e "
const crypto = require('crypto');
const secret = 'your-webhook-secret';
const payload = JSON.stringify({test: 'data'});
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('sha256=' + signature);
"
```

**Resolution:**

1. Verify webhook secret matches
2. Check signature generation algorithm
3. Ensure UTF-8 encoding consistency
4. Review request body parsing

### Emergency Procedures

#### 1. Complete Service Outage

```bash
# 1. Immediate assessment
curl -X GET "https://drivehr-sync.netlify.app/.netlify/functions/health-check"

# 2. Check Netlify status
curl -X GET "https://api.netlify.com/api/v1/sites/YOUR_SITE_ID/deploys" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Review recent deployments
netlify api listSiteDeploys --site-id="YOUR_SITE_ID" | head -5

# 4. Rollback if needed
netlify api restoreSiteDeploy --site-id="YOUR_SITE_ID" --deploy-id="STABLE_DEPLOY_ID"
```

#### 2. Data Corruption or Loss

```bash
# 1. Stop automatic syncs
netlify env:set MAINTENANCE_MODE=true

# 2. Create data backup (if available via your WordPress setup)
# Note: Backup method depends on your WordPress webhook implementation

# 3. Validate data integrity
node scripts/validate-job-data.mts

# 4. Restore from backup if needed
# (Implement based on your backup strategy)
```

#### 3. Security Incident

```bash
# 1. Immediate isolation
netlify env:set SECURITY_LOCKDOWN=true

# 2. Rotate secrets
netlify env:set WEBHOOK_SECRET="new-secure-secret-$(date +%s)"

# 3. Review access logs
netlify logs:function sync-jobs --filter="401\|403\|unauthorized" --since="24h"

# 4. Update security configurations
# Review and update all authentication mechanisms
```

## 📈 Performance Optimization

### Function Optimization

#### Cold Start Reduction

```typescript
// Implement module-level caching
const config = loadConfig(); // Load once at module level
const httpClient = createHttpClient(config); // Reuse across invocations

export const handler = async (event, context) => {
  // Function logic here
};
```

#### Memory Management

```typescript
// Efficient memory usage patterns
const processJobsBatch = async (jobs: Job[], batchSize = 50) => {
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    await processBatch(batch);
    // Allow garbage collection between batches
    if (global.gc) global.gc();
  }
};
```

### Database Optimization

#### Connection Pooling

```typescript
// Implement connection reuse
let connectionPool: ConnectionPool | null = null;

const getConnection = () => {
  if (!connectionPool) {
    connectionPool = createConnectionPool({
      maxConnections: 10,
      idleTimeout: 30000,
    });
  }
  return connectionPool;
};
```

#### Query Optimization

```sql
-- Efficient job querying
SELECT id, title, description, posted_date
FROM jobs
WHERE updated_at > ?
ORDER BY updated_at DESC
LIMIT 100;

-- Add appropriate indexes
CREATE INDEX idx_jobs_updated_at ON jobs(updated_at);
CREATE INDEX idx_jobs_status ON jobs(status);
```

### Network Optimization

#### HTTP Client Configuration

```typescript
const httpClient = new HttpClient({
  timeout: 30000,
  retries: 3,
  keepAlive: true,
  maxSockets: 50,
  compression: true,
});
```

#### Caching Strategy

```typescript
// Implement intelligent caching
const cache = new Map<string, CacheEntry>();

const getCachedData = (key: string, ttl: number = 300000) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
};
```

## 🔐 Security Best Practices

### Access Control

#### Environment Variable Security

```bash
# Use Netlify CLI for secure secret management
netlify env:set WEBHOOK_SECRET "$(openssl rand -hex 32)"
netlify env:set WP_APPLICATION_PASSWORD "$(openssl rand -base64 32)"

# Verify secrets are not exposed in logs
netlify logs:function sync-jobs --filter="secret\|password\|token" --since="1h"
```

#### Network Security

```toml
# netlify.toml - Restrict function access
[[redirects]]
  from = "/.netlify/functions/sync-jobs"
  to = "/.netlify/functions/sync-jobs"
  status = 200
  headers = {X-Robots-Tag = "noindex"}
  conditions = {Role = ["admin"]}
```

### Audit and Compliance

#### Security Scanning

```bash
# Regular security audits
pnpm audit --audit-level moderate
npm audit --audit-level moderate

# Dependency vulnerability scanning
snyk test
npm audit fix
```

#### Access Logging

```typescript
// Implement comprehensive audit logging
const auditLog = {
  timestamp: new Date().toISOString(),
  action: 'job-sync',
  user: event.headers['x-user-id'] || 'system',
  source: event.headers['x-forwarded-for'],
  result: 'success',
  metadata: {
    jobsProcessed: 45,
    duration: 2847,
  },
};

logger.audit('Job sync completed', auditLog);
```

## 📋 Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks

- [ ] Review error logs and alerts
- [ ] Check system performance metrics
- [ ] Verify job sync success rates
- [ ] Monitor external service health

#### Weekly Tasks

- [ ] Review and update dependencies
- [ ] Analyze performance trends
- [ ] Validate backup procedures
- [ ] Update security configurations

#### Monthly Tasks

- [ ] Comprehensive security audit
- [ ] Performance optimization review
- [ ] Disaster recovery testing
- [ ] Documentation updates

### Backup and Recovery

#### Data Backup Strategy

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/drivehr-sync/${DATE}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup WordPress data (method depends on your WordPress webhook implementation)
# This may require custom endpoint or database backup

# Backup configuration
netlify env:list --json > "${BACKUP_DIR}/environment-config.json"

# Backup application code
git archive --format=tar.gz --prefix="drivehr-sync-${DATE}/" HEAD > "${BACKUP_DIR}/source-code.tar.gz"

echo "Backup completed: ${BACKUP_DIR}"
```

#### Recovery Procedures

```bash
# Emergency recovery from backup
BACKUP_DATE="20250120"
BACKUP_DIR="/backups/drivehr-sync/${BACKUP_DATE}"

# 1. Restore environment configuration
netlify env:import "${BACKUP_DIR}/environment-config.json"

# 2. Restore application from source
tar -xzf "${BACKUP_DIR}/source-code.tar.gz"
cd "drivehr-sync-${BACKUP_DATE}"
pnpm install
pnpm run build
netlify deploy --prod

# 3. Verify recovery
curl -X GET "https://drivehr-sync.netlify.app/.netlify/functions/health-check"
```

---

## 📞 Support and Escalation

### Contact Information

| Severity     | Contact          | Response Time | Escalation          |
| ------------ | ---------------- | ------------- | ------------------- |
| **Critical** | On-call Engineer | 15 minutes    | DevOps Lead         |
| **High**     | DevOps Team      | 2 hours       | Engineering Manager |
| **Medium**   | Support Team     | 8 hours       | Product Owner       |
| **Low**      | Ticket System    | 24 hours      | -                   |

### Emergency Contacts

- **On-Call Engineer**: +1-555-ONCALL (emergency only)
- **DevOps Lead**: devops-lead@company.com
- **Engineering Manager**: eng-manager@company.com
- **Security Team**: security@company.com

### Documentation and Resources

- **API Documentation**: `/docs/api-specification.yaml`
- **Architecture Diagrams**: `/docs/architecture/`
- **Runbook Updates**: Submit PR to `/docs/deployment-runbook.md`
- **Issue Tracking**: GitHub Issues
- **Change Management**: GitHub Pull Requests

---

_Last Updated: 2025-01-20_  
_Document Version: 1.0.0_  
_Next Review Date: 2025-02-20_
