# Deployment Guide - DriveHR Netlify Sync

**Complete deployment instructions for the GitHub Actions + Netlify
architecture**

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ GitHub repository with Actions enabled
- ✅ Netlify account with site deployed
- ✅ WordPress site with REST API enabled
- ✅ Application passwords configured in WordPress
- ✅ DriveHR company ID (UUID format)

## 🔐 GitHub Actions Secrets Configuration

Navigate to your GitHub repository → Settings → Secrets and variables → Actions,
then add these **Repository Secrets**:

### Required Secrets

| Secret Name           | Description                                      | Example Value                                                |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `DRIVEHR_COMPANY_ID`  | Your DriveHR company UUID                        | `12345678-1234-5678-9abc-123456789012`                       |
| `WEBHOOK_SECRET`      | Shared secret for HMAC signatures (min 32 chars) | `your-super-secure-webhook-secret-key-here`                  |
| `WP_API_URL`          | WordPress webhook endpoint URL                   | `https://yoursite.com/webhook/drivehr-sync`                  |
| `NETLIFY_WEBHOOK_URL` | Netlify function URL for sync-jobs               | `https://your-site.netlify.app/.netlify/functions/sync-jobs` |

### Optional Secrets

| Secret Name       | Description              | Default Value |
| ----------------- | ------------------------ | ------------- |
| `LOG_LEVEL`       | Logging verbosity        | `info`        |
| `SCRAPER_TIMEOUT` | Playwright timeout in ms | `30000`       |
| `SCRAPER_RETRIES` | Number of retry attempts | `3`           |

### Setting GitHub Secrets

```bash
# Using GitHub CLI (if available)
gh secret set DRIVEHR_COMPANY_ID --body "your-company-uuid"
gh secret set WEBHOOK_SECRET --body "your-webhook-secret"
gh secret set WP_API_URL --body "https://yoursite.com/webhook/drivehr-sync"
gh secret set NETLIFY_WEBHOOK_URL --body "https://your-site.netlify.app/.netlify/functions/sync-jobs"
```

## 🌐 Netlify Configuration

### Environment Variables

In your Netlify site dashboard → Site settings → Environment variables, add:

| Variable Name             | Description                    | Example Value                               |
| ------------------------- | ------------------------------ | ------------------------------------------- |
| `DRIVEHR_COMPANY_ID`      | Your DriveHR company UUID      | `12345678-1234-5678-9abc-123456789012`      |
| `WEBHOOK_SECRET`          | Same secret as GitHub Actions  | `your-super-secure-webhook-secret-key-here` |
| `WP_API_URL`              | WordPress webhook endpoint URL | `https://yoursite.com/webhook/drivehr-sync` |
| `WP_USERNAME`             | WordPress username             | `api-user`                                  |
| `WP_APPLICATION_PASSWORD` | WordPress application password | `xxxx xxxx xxxx xxxx`                       |
| `LOG_LEVEL`               | Logging verbosity              | `info`                                      |
| `ENVIRONMENT`             | Deployment environment         | `production`                                |

### Netlify Site Settings

1. **Build Settings**:
   - Build command: `pnpm run build`
   - Publish directory: `dist`
   - Functions directory: `dist/functions`

2. **Deploy Settings**:
   - Branch to deploy: `main`
   - Auto-deploy: Enabled

## 🔧 WordPress Configuration

### Application Passwords

1. Go to WordPress Admin → Users → Your Profile
2. Scroll to "Application Passwords"
3. Create new application password for "DriveHR Sync"
4. Copy the generated password (format: `xxxx xxxx xxxx xxxx`)
5. Use this as `WP_APPLICATION_PASSWORD` in Netlify

### WordPress Webhook Endpoint Verification

Verify your WordPress webhook endpoint exists:

```bash
curl -X GET "https://yoursite.com/webhook/drivehr-sync" \
  -H "Accept: application/json"
```

This should return information about the webhook endpoint (or a 404 if the
plugin isn't installed).

## 🚀 Deployment Steps

### 1. Deploy to Netlify

```bash
# Option A: Auto-deploy (push to main branch)
git push origin main

# Option B: Manual deploy via CLI
netlify deploy --prod
```

### 2. Verify Function Deployment

Test the health check endpoint:

```bash
curl https://your-site.netlify.app/.netlify/functions/health-check
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "environment": "production",
    "wordpress_configured": true,
    "webhook_configured": true,
    "architecture": "github-actions-scraper",
    "version": "2.0.0"
  },
  "requestId": "webhook_xxxxx",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 3. Test GitHub Actions Workflow

#### Manual Trigger Test

```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/manual-trigger" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=$(echo -n '{"force_sync":true}' | openssl dgst -sha256 -hmac 'your-webhook-secret' -binary | base64)" \
  -d '{"force_sync": true}'
```

#### Scheduled Run Test

The workflow runs automatically based on the cron schedule in
`.github/workflows/scrape-jobs.yml`. Monitor:

1. GitHub → Actions tab → Check workflow runs
2. Netlify → Functions tab → Check sync-jobs logs

## 📊 Monitoring & Verification

### GitHub Actions Logs

Monitor workflow execution:

1. Go to GitHub → Actions tab
2. Click on latest "Scrape and Sync Jobs" workflow
3. Check each step for errors or issues

### Netlify Function Logs

Monitor function execution:

1. Go to Netlify site dashboard → Functions tab
2. Click on function name (sync-jobs, health-check, manual-trigger)
3. View recent invocations and logs

### WordPress Verification

Check if jobs are being synchronized:

1. Go to WordPress Admin → Posts (or custom post type)
2. Verify new job postings appear
3. Check post metadata for sync information

## 🔍 Troubleshooting

### Common Issues

#### 1. Build Failures

- **Issue**: TypeScript compilation errors
- **Solution**: Run `pnpm run typecheck` locally and fix errors

#### 2. Function Import Errors

- **Issue**: Cannot resolve module imports
- **Solution**: Check import paths use `.js` extensions

#### 3. HMAC Signature Failures

- **Issue**: Invalid webhook signature errors
- **Solution**: Verify WEBHOOK_SECRET matches in both GitHub and Netlify

#### 4. WordPress Connection Failures

- **Issue**: HTTP 401/403 errors
- **Solution**: Verify WP_APPLICATION_PASSWORD and user permissions

#### 5. GitHub Actions Permission Denied

- **Issue**: Cannot trigger workflow
- **Solution**: Check GITHUB_TOKEN has `actions:write` permission

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in environment variables.

### Health Check Diagnostics

The health check endpoint provides detailed system status:

```bash
# Check all system dependencies
curl https://your-site.netlify.app/.netlify/functions/health-check | jq '.'
```

## 🔄 Workflow Schedule

The scraper runs automatically based on the cron schedule in the GitHub Actions
workflow:

- **Default**: Every 6 hours (`0 */6 * * *`)
- **Timezone**: UTC
- **Manual triggers**: Available via API endpoint

### Customizing Schedule

Edit `.github/workflows/scrape-jobs.yml`:

```yaml
on:
  schedule:
    # Run every 4 hours instead of 6
    - cron: '0 */4 * * *'
```

## 📈 Performance Optimization

### Function Cold Starts

- Functions auto-scale based on demand
- Cold start time: ~2-3 seconds
- Warm execution time: ~200-500ms

### Scraping Performance

- Average scraping time: 30-60 seconds
- Timeout limit: 5 minutes (GitHub Actions)
- Retry logic: 3 attempts with exponential backoff

## 🔒 Security Considerations

### HMAC Signature Validation

- All webhook requests must include valid HMAC signatures
- Signatures use SHA-256 algorithm
- Shared secret must be at least 32 characters

### CORS Configuration

- GitHub Actions origins allowed
- Specific headers and methods whitelisted
- Preflight request handling

### Environment Variables

- Secrets stored securely in GitHub/Netlify
- No secrets logged or exposed in outputs
- Application passwords preferred over user passwords

---

**Deployment Version**: 2.0  
**Last Updated**: January 2025  
**Architecture**: GitHub Actions + Netlify Functions
