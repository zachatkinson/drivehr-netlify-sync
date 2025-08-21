# Deployment Guide

> **Simple, straightforward deployment instructions for DriveHR Netlify Sync**

## 🚀 Quick Deployment

Our serverless architecture makes deployment remarkably simple - just connect
your repository to Netlify and configure environment variables. No complex
infrastructure or orchestration required.

## 📋 Prerequisites

- **GitHub Repository** - Fork or clone this repository
- **Netlify Account** - Free tier sufficient for most use cases
- **WordPress Site** - With webhook endpoint configured
- **DriveHR Company ID** - UUID format from your DriveHR account

## 🌐 Netlify Deployment

### 1. Connect Repository to Netlify

**Option A: Netlify Dashboard**

1. Login to [Netlify](https://netlify.com)
2. Click "New site from Git"
3. Choose GitHub and authorize access
4. Select your `drivehr-netlify-sync` repository
5. Configure build settings:
   - **Build command**: `pnpm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `dist/functions` (auto-detected)

**Option B: Netlify CLI**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site from repository root
netlify init

# Deploy
netlify deploy --prod
```

### 2. Configure Environment Variables

In your Netlify site dashboard → **Site settings** → **Environment variables**:

| Variable             | Value                                       | Required |
| -------------------- | ------------------------------------------- | -------- |
| `DRIVEHR_COMPANY_ID` | `your-uuid-from-drivehr`                    | ✅       |
| `WP_API_URL`         | `https://yoursite.com/webhook/drivehr-jobs` | ✅       |
| `WEBHOOK_SECRET`     | `secure-secret-32-chars-minimum`            | ✅       |
| `NODE_ENV`           | `production`                                | ✅       |
| `LOG_LEVEL`          | `info`                                      | ❌       |

#### Setting Environment Variables

**Via Netlify Dashboard:**

1. Go to **Site settings** → **Environment variables**
2. Click **Add a variable**
3. Enter name and value
4. Click **Create variable**

**Via Netlify CLI:**

```bash
netlify env:set DRIVEHR_COMPANY_ID "your-uuid-here"
netlify env:set WP_API_URL "https://yoursite.com/webhook/endpoint"
netlify env:set WEBHOOK_SECRET "your-secure-secret-key"
netlify env:set NODE_ENV "production"
```

### 3. Deploy and Verify

**Automatic Deployment:**

- Push to `main` branch triggers automatic deployment
- Build process runs `pnpm run build`
- Functions automatically deployed to `/.netlify/functions/`

**Manual Deployment:**

```bash
# Deploy to production
netlify deploy --prod

# Deploy preview
netlify deploy
```

## ✅ Verification Steps

### 1. Health Check

```bash
curl https://your-site-name.netlify.app/.netlify/functions/health-check
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "environment": "production",
    "wordpress_configured": true,
    "drivehr_configured": true,
    "architecture": "netlify-functions"
  }
}
```

### 2. Test Manual Trigger

Generate HMAC signature:

```bash
# Generate test payload signature
echo -n '{"force_sync": false, "reason": "deployment test"}' | \
  openssl dgst -sha256 -hmac "your-webhook-secret" -binary | \
  base64
```

Test endpoint:

```bash
curl -X POST https://your-site-name.netlify.app/.netlify/functions/manual-trigger \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=YOUR_GENERATED_SIGNATURE" \
  -d '{"force_sync": false, "reason": "deployment test"}'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "message": "Manual sync triggered successfully",
    "timestamp": "2025-01-21T12:00:00.000Z"
  }
}
```

### 3. Monitor Function Logs

**Via Netlify Dashboard:**

1. Go to **Functions** tab
2. Click on function name
3. View **Function log**

**Via CLI:**

```bash
netlify logs:function sync-jobs --tail
```

## 🔧 Configuration Details

### Required Environment Variables

#### `DRIVEHR_COMPANY_ID`

- **Format**: UUID (e.g., `123e4567-e89b-12d3-a456-426614174000`)
- **Purpose**: Identifies your company in DriveHR system
- **Where to find**: DriveHR admin panel or career page URL

#### `WP_API_URL`

- **Format**: Full URL (e.g., `https://yoursite.com/webhook/drivehr-sync`)
- **Purpose**: WordPress webhook endpoint for job data
- **Requirements**: Must accept POST requests with JSON payload

#### `WEBHOOK_SECRET`

- **Format**: String (minimum 32 characters)
- **Purpose**: HMAC signature validation for security
- **Generate**: `openssl rand -hex 32`

#### `NODE_ENV`

- **Format**: `production` | `development` | `staging`
- **Purpose**: Controls logging, security headers, and error handling
- **Production**: Use `production` for live deployment

### Optional Environment Variables

#### `LOG_LEVEL`

- **Default**: `info`
- **Options**: `error` | `warn` | `info` | `debug` | `trace`
- **Purpose**: Controls logging verbosity

## 🔍 Troubleshooting

### Build Failures

**TypeScript Errors:**

```bash
# Run locally to identify issues
pnpm run typecheck
pnpm run lint
```

**Dependency Issues:**

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Function Errors

**Environment Variables:**

- Verify all required variables are set in Netlify
- Check variable names match exactly (case-sensitive)
- Ensure no trailing spaces in values

**HMAC Signature Issues:**

- Verify webhook secret matches between systems
- Ensure signature format: `sha256=hexdigest`
- Use UTF-8 encoding for payload

**WordPress Connectivity:**

- Test WordPress endpoint directly
- Verify URL accessibility from external networks
- Check WordPress webhook handler implementation

### Common Issues

#### "Configuration not loaded" Error

**Cause**: Missing required environment variables  
**Fix**: Verify all required variables are set in Netlify dashboard

#### "Invalid webhook signature" Error

**Cause**: HMAC signature mismatch  
**Fix**: Ensure `WEBHOOK_SECRET` matches in all systems

#### Function timeout

**Cause**: WordPress endpoint slow/unresponsive  
**Fix**: Optimize WordPress webhook handler, increase timeout if needed

#### "Module not found" Error

**Cause**: Build or import path issues  
**Fix**: Check import paths use `.js` extensions, run build locally

## 📊 Monitoring

### Function Performance

**Netlify Analytics:**

- Function invocation count
- Execution duration
- Error rates
- Memory usage

**Built-in Monitoring:**

```bash
# View recent function logs
netlify logs:function sync-jobs --since="1h"

# Monitor specific function
netlify logs:function health-check --tail
```

### Health Monitoring

**Automated Health Checks:** Set up external monitoring (e.g., UptimeRobot) to
check:

```
GET https://your-site.netlify.app/.netlify/functions/health-check
```

**Expected Response Time**: < 2 seconds  
**Expected Uptime**: 99.9%

## 🔄 Updates & Maintenance

### Updating Code

1. **Push Changes**: Commit and push to `main` branch
2. **Auto-Deploy**: Netlify automatically builds and deploys
3. **Verify**: Check health endpoint after deployment
4. **Monitor**: Watch function logs for any issues

### Environment Updates

```bash
# Update environment variables
netlify env:set VARIABLE_NAME "new-value"

# List current variables
netlify env:list

# Trigger redeploy with new variables
netlify deploy --prod --build
```

### Rollback

**Via Netlify Dashboard:**

1. Go to **Deploys** tab
2. Find previous successful deploy
3. Click **Publish deploy**

**Via CLI:**

```bash
# List recent deploys
netlify api listSiteDeploys --site-id="your-site-id"

# Rollback to specific deploy
netlify api restoreSiteDeploy --site-id="your-site-id" --deploy-id="deploy-id"
```

## 🔐 Security Considerations

### Webhook Security

- Always use HTTPS endpoints
- Implement proper HMAC validation in WordPress
- Use strong, unique webhook secrets
- Regularly rotate webhook secrets

### Environment Variables

- Never commit secrets to version control
- Use Netlify's encrypted environment variables
- Limit access to production environment settings
- Monitor for leaked credentials

### Network Security

- WordPress endpoints should validate signatures
- Consider IP allowlisting if possible
- Enable WordPress security plugins
- Use CDN/WAF for additional protection

## 📈 Scaling

### Performance Optimization

- Functions auto-scale based on demand
- No infrastructure management required
- Cold start optimization built-in

### Cost Optimization

- Netlify Free tier: 125,000 function calls/month
- Pro tier: 2,000,000 function calls/month
- Monitor usage in Netlify analytics

### High Availability

- Netlify provides 99.9% uptime SLA
- Global CDN distribution
- Automatic failover and redundancy

---

**Deployment is complete! Your DriveHR sync service is now live and ready to
process job synchronization requests.**

## 📞 Support

- **Issues**:
  [GitHub Issues](https://github.com/zachatkinson/drivehr-netlify-sync/issues)
- **Documentation**: [Project Documentation](./README.md)
- **Health Check**: Monitor `/.netlify/functions/health-check` endpoint
- **Logs**: Use `netlify logs:function function-name` for troubleshooting
