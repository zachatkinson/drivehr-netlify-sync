# Operational Runbook

> **Production operations guide for DriveHR Netlify Sync**

## 📋 Overview

This runbook provides operational procedures for maintaining the DriveHR Netlify
Sync service in production. Designed for DevOps engineers and operations teams
managing the live service.

## 🚀 Service Overview

- **Architecture**: Serverless Netlify Functions
- **Functions**: 3 endpoints (health-check, sync-jobs, manual-trigger)
- **Dependencies**: DriveHR career portal, WordPress webhook endpoint
- **Monitoring**: Built-in health checks and function logs
- **Deployment**: Git-based auto-deployment via Netlify

## 📊 Service Level Objectives (SLOs)

| Metric            | Target       | Measurement             |
| ----------------- | ------------ | ----------------------- |
| **Availability**  | 99.9% uptime | Monthly basis           |
| **Response Time** | < 2000ms P95 | Health check endpoint   |
| **Error Rate**    | < 1%         | Function invocations    |
| **Recovery Time** | < 15 minutes | From incident detection |

## 🔍 Monitoring & Alerting

### Health Check Monitoring

**Primary Health Endpoint:**

```
GET https://your-site.netlify.app/.netlify/functions/health-check
```

**Set up monitoring** (recommended tools):

- **UptimeRobot**: 5-minute interval checks
- **Pingdom**: HTTP response monitoring
- **Netlify Analytics**: Built-in function monitoring

**Alert Thresholds:**

- Health check failure: **Immediate alert**
- Response time > 5000ms: **Warning**
- 3+ consecutive failures: **Critical alert**

### Function Monitoring

**Netlify Dashboard Metrics:**

- Function invocation count
- Execution duration
- Memory usage
- Error rates

**CLI Monitoring:**

```bash
# Monitor function logs in real-time
netlify logs:function sync-jobs --tail

# Check recent errors
netlify logs:function sync-jobs --filter="ERROR" --since="1h"

# View function performance
netlify logs:function health-check --since="24h"
```

### Key Performance Indicators (KPIs)

1. **Health Check Success Rate** (target: 100%)
2. **Function Invocation Success Rate** (target: >99%)
3. **Average Response Time** (target: <2000ms)
4. **WordPress Sync Success Rate** (monitor via logs)

## ⚠️ Common Issues & Solutions

### Health Check Failures

**Symptoms:**

- Health endpoint returns 503 or timeout
- "Unhealthy" status in monitoring system

**Diagnosis:**

```bash
# Check health endpoint directly
curl -v https://your-site.netlify.app/.netlify/functions/health-check

# Check function logs
netlify logs:function health-check --tail
```

**Root Causes & Solutions:**

1. **Configuration Issues**
   - **Cause**: Missing environment variables
   - **Fix**: Verify all required env vars in Netlify dashboard
   - **Prevention**: Monitor config validation in health checks

2. **WordPress Connectivity**
   - **Cause**: WordPress site down/unreachable
   - **Fix**: Check WordPress site, verify webhook endpoint
   - **Prevention**: Coordinate with WordPress team on maintenance

3. **DriveHR Connectivity**
   - **Cause**: DriveHR portal temporarily unavailable
   - **Fix**: Monitor DriveHR status, wait for recovery
   - **Prevention**: Implement retry logic and graceful degradation

### Function Execution Errors

**Symptoms:**

- HTTP 500 errors from functions
- Timeout errors in logs
- High error rate in metrics

**Diagnosis:**

```bash
# Check specific function logs
netlify logs:function sync-jobs --filter="ERROR" --since="1h"

# Monitor function performance
netlify logs:function manual-trigger --tail
```

**Common Errors & Solutions:**

#### "Configuration not loaded"

```json
{
  "success": false,
  "error": "Configuration not loaded or invalid"
}
```

**Root Cause**: Missing or invalid environment variables  
**Solution**:

1. Check Netlify environment variables
2. Verify all required variables are set
3. Redeploy if variables were added/changed

#### "Invalid webhook signature"

```json
{
  "success": false,
  "error": "Invalid webhook signature"
}
```

**Root Cause**: HMAC signature validation failure  
**Solution**:

1. Verify `WEBHOOK_SECRET` matches in all systems
2. Check signature generation in calling system
3. Test with manually generated signature

#### WordPress sync failures

```json
{
  "success": false,
  "error": "WordPress sync failed: timeout"
}
```

**Root Cause**: WordPress endpoint issues  
**Solution**:

1. Test WordPress endpoint directly
2. Check WordPress logs for errors
3. Verify webhook handler implementation
4. Check network connectivity

### Performance Issues

**Symptoms:**

- Slow response times (>5000ms)
- Function timeouts
- High memory usage

**Diagnosis:**

```bash
# Check function performance metrics
netlify logs:function sync-jobs --filter="duration" --since="1h"

# Monitor memory usage
netlify logs:function sync-jobs --filter="memory" --since="1h"
```

**Solutions:**

1. **Cold Start Optimization**: Functions auto-warm, but review code for
   efficiency
2. **Memory Management**: Monitor large job datasets, implement pagination if
   needed
3. **Network Optimization**: Check external service response times

## 🚨 Incident Response

### Severity Levels

#### **P0 - Critical (Response: Immediate)**

- Complete service outage
- Health checks failing across all functions
- Data corruption or security breach

#### **P1 - High (Response: <30 minutes)**

- Individual function failures
- Significant performance degradation
- WordPress sync failures affecting operations

#### **P2 - Medium (Response: <2 hours)**

- Intermittent errors
- Non-critical performance issues
- Monitoring alerts

#### **P3 - Low (Response: <24 hours)**

- Minor performance issues
- Documentation updates needed
- Enhancement requests

### Incident Response Process

#### 1. **Detection & Assessment**

```bash
# Check overall service health
curl https://your-site.netlify.app/.netlify/functions/health-check

# Check Netlify service status
curl https://www.netlifystatus.com/api/v2/status.json

# Review recent deploys
netlify api listSiteDeploys --site-id="your-site-id" | head -5
```

#### 2. **Immediate Response** (P0/P1)

```bash
# Check if recent deploy caused issue
netlify api listSiteDeploys --site-id="your-site-id" | head -3

# Rollback if needed (last good deploy)
netlify api restoreSiteDeploy --site-id="your-site-id" --deploy-id="previous-deploy-id"

# Monitor rollback success
curl https://your-site.netlify.app/.netlify/functions/health-check
```

#### 3. **Investigation**

```bash
# Collect comprehensive logs
netlify logs:function health-check --since="2h" > health-logs.txt
netlify logs:function sync-jobs --since="2h" > sync-logs.txt
netlify logs:function manual-trigger --since="2h" > trigger-logs.txt

# Check environment configuration
netlify env:list

# Verify external dependencies
curl -I https://drivehris.app/careers/YOUR-COMPANY-ID/list
curl -I YOUR-WORDPRESS-WEBHOOK-ENDPOINT
```

#### 4. **Communication**

- Update status page/communication channels
- Notify stakeholders of issue and ETA
- Provide regular updates during resolution

#### 5. **Resolution & Recovery**

- Implement fix based on root cause
- Monitor service recovery
- Conduct post-incident review

### Emergency Procedures

#### Complete Service Outage

**If all functions are down:**

1. **Check Netlify Status**:

   ```bash
   curl https://www.netlifystatus.com/api/v2/status.json
   ```

2. **Check Recent Deployments**:

   ```bash
   netlify api listSiteDeploys --site-id="your-site-id" | head -5
   ```

3. **Rollback to Last Working Deploy**:

   ```bash
   netlify api restoreSiteDeploy --site-id="your-site-id" --deploy-id="last-good-deploy"
   ```

4. **Force Redeploy if Rollback Fails**:
   ```bash
   netlify deploy --prod --build
   ```

#### Data/Security Incident

**If security breach suspected:**

1. **Immediate Actions**:
   - Rotate all webhook secrets
   - Review access logs
   - Disable automatic deployments if needed

2. **Investigation**:

   ```bash
   # Check for unusual access patterns
   netlify logs:function sync-jobs --filter="401\|403\|unauthorized" --since="24h"

   # Review recent configuration changes
   netlify env:list
   ```

3. **Mitigation**:
   - Update security configurations
   - Implement additional monitoring
   - Coordinate with WordPress team on security measures

## 🔧 Maintenance Procedures

### Routine Maintenance

#### **Daily** (Automated monitoring should handle)

- [ ] Health check monitoring alerts reviewed
- [ ] Function error rates within normal range
- [ ] No critical alerts in past 24 hours

#### **Weekly**

- [ ] Review function performance metrics
- [ ] Check for dependency updates
- [ ] Verify backup procedures (environment variables)
- [ ] Test health monitoring alerts

#### **Monthly**

- [ ] Review and rotate webhook secrets
- [ ] Performance optimization review
- [ ] Documentation updates
- [ ] Disaster recovery testing

### Scheduled Maintenance

#### Environment Variable Updates

```bash
# Backup current configuration
netlify env:list > env-backup-$(date +%Y%m%d).json

# Update variables
netlify env:set VARIABLE_NAME "new-value"

# Trigger redeploy
netlify deploy --prod --build

# Verify health after update
curl https://your-site.netlify.app/.netlify/functions/health-check
```

#### Secret Rotation

```bash
# Generate new webhook secret
NEW_SECRET=$(openssl rand -hex 32)

# Update in Netlify
netlify env:set WEBHOOK_SECRET "$NEW_SECRET"

# Coordinate update with WordPress team
# Update calling systems with new secret

# Redeploy
netlify deploy --prod --build
```

## 📈 Performance Optimization

### Function Performance Monitoring

```bash
# Analyze function performance trends
netlify logs:function sync-jobs --filter="duration" --since="7d" > performance-analysis.log

# Check memory usage patterns
netlify logs:function sync-jobs --filter="memory" --since="7d" > memory-analysis.log

# Review error patterns
netlify logs:function sync-jobs --filter="ERROR\|WARN" --since="7d" > error-analysis.log
```

### Optimization Strategies

1. **Cold Start Reduction**: Already optimized with module-level caching
2. **Memory Efficiency**: Monitor for memory leaks in long-running functions
3. **Network Optimization**: Review external API call patterns
4. **Error Handling**: Implement circuit breakers for external services

### Capacity Planning

**Current Limits** (Netlify):

- **Function timeout**: 10 seconds
- **Memory limit**: 1 GB
- **Concurrent executions**: 1,000
- **Monthly invocations**: Based on plan (125k free, 2M pro)

**Monitoring Usage**:

- Check Netlify analytics dashboard
- Set alerts at 80% of limits
- Plan upgrades before hitting limits

## 🔐 Security Operations

### Security Monitoring

```bash
# Monitor for security-related errors
netlify logs:function sync-jobs --filter="401\|403\|signature\|unauthorized" --since="24h"

# Check for unusual access patterns
netlify logs:function health-check --filter="unusual\|suspicious" --since="24h"
```

### Security Maintenance

#### **Weekly Security Checks**

- [ ] Review function access logs for anomalies
- [ ] Verify webhook signature validation working
- [ ] Check for dependency security updates
- [ ] Monitor WordPress endpoint security

#### **Monthly Security Tasks**

- [ ] Rotate webhook secrets
- [ ] Review and update security headers
- [ ] Audit environment variable access
- [ ] Coordinate security updates with WordPress team

### Security Incident Response

**If security breach detected:**

1. **Immediate Response**:

   ```bash
   # Rotate all secrets immediately
   netlify env:set WEBHOOK_SECRET "$(openssl rand -hex 32)"

   # Review recent access
   netlify logs:function sync-jobs --filter="401\|403" --since="48h"

   # Force redeploy with new secrets
   netlify deploy --prod --build
   ```

2. **Investigation**:
   - Review all function logs for suspicious activity
   - Check WordPress logs for related security events
   - Coordinate with security team for forensic analysis

## 📋 Runbook Checklist Templates

### Weekly Health Check

```bash
#!/bin/bash
# Weekly health check script

echo "=== Weekly DriveHR Sync Health Check ==="
echo "Date: $(date)"

# Test health endpoint
echo "Testing health endpoint..."
curl -s https://your-site.netlify.app/.netlify/functions/health-check | jq '.'

# Check function metrics
echo "Checking function performance..."
netlify logs:function sync-jobs --filter="duration" --since="7d" | tail -10

# Check error rates
echo "Checking error rates..."
ERROR_COUNT=$(netlify logs:function sync-jobs --filter="ERROR" --since="7d" | wc -l)
echo "Errors in past 7 days: $ERROR_COUNT"

echo "=== Health check complete ==="
```

### Emergency Response Checklist

**Service Outage Response:**

- [ ] Confirm outage (health check, monitoring)
- [ ] Check Netlify service status
- [ ] Review recent deployments
- [ ] Rollback if recent deploy caused issue
- [ ] Notify stakeholders
- [ ] Monitor recovery
- [ ] Document incident

**Performance Issue Response:**

- [ ] Identify affected functions
- [ ] Check function logs for errors
- [ ] Monitor external dependencies
- [ ] Review recent code changes
- [ ] Implement temporary fixes if needed
- [ ] Schedule permanent solution

---

## 📞 Escalation Contacts

| Issue Type                | Primary Contact | Secondary Contact   |
| ------------------------- | --------------- | ------------------- |
| **Service Outage**        | DevOps On-call  | Engineering Lead    |
| **Performance Issues**    | Platform Team   | DevOps Lead         |
| **Security Incidents**    | Security Team   | Engineering Manager |
| **WordPress Integration** | WordPress Team  | Integration Lead    |

## 📚 Additional Resources

- **[Architecture Documentation](../ARCHITECTURE.md)** - Technical system design
- **[Deployment Guide](../DEPLOYMENT.md)** - Deployment procedures
- **[Project README](../README.md)** - General project information
- **[GitHub Issues](https://github.com/zachatkinson/drivehr-netlify-sync/issues)** -
  Bug reports and enhancements

---

**Runbook Version**: 2.0  
**Last Updated**: January 2025  
**Next Review**: April 2025
