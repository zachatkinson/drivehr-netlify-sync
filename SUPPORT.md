# Support

## Table of Contents

- [Getting Help](#getting-help)
- [Support Channels](#support-channels)
- [Service Level Agreements](#service-level-agreements)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Training Resources](#training-resources)
- [Professional Services](#professional-services)

## Getting Help

### Before Requesting Support

1. **Check the documentation**
   - [README.md](README.md) - Project overview and quick start
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment and configuration guide
   - [SECURITY.md](SECURITY.md) - Security practices and troubleshooting
   - [CONTRIBUTING.md](CONTRIBUTING.md) - Development setup and guidelines

2. **Search existing resources**
   - [GitHub Issues](https://github.com/zachatkinson/drivehr-netlify-sync/issues) -
     Known issues and solutions
   - [GitHub Discussions](https://github.com/zachatkinson/drivehr-netlify-sync/discussions) -
     Community Q&A
   - [CHANGELOG.md](CHANGELOG.md) - Recent changes and migration guides

3. **Gather information**
   - Error messages and logs
   - Environment details (Node.js version, OS, etc.)
   - Steps to reproduce the issue
   - Configuration settings (without secrets)

## Support Channels

### Community Support (Free)

#### GitHub Discussions

- **URL**:
  [GitHub Discussions](https://github.com/zachatkinson/drivehr-netlify-sync/discussions)
- **Response Time**: 1-3 business days
- **Best For**: General questions, feature discussions, community help
- **How to Use**: Create a new discussion with appropriate category

#### GitHub Issues

- **URL**:
  [GitHub Issues](https://github.com/zachatkinson/drivehr-netlify-sync/issues)
- **Response Time**: 2-5 business days
- **Best For**: Bug reports, feature requests, documentation issues
- **How to Use**: Use issue templates for structured reporting

### Professional Support (Paid)

#### Standard Support

- **Response Time**: 24 hours (business days)
- **Channels**: Email, GitHub priority issues
- **Coverage**: Business hours (9 AM - 5 PM EST)
- **Includes**: Configuration help, troubleshooting, best practices

#### Premium Support

- **Response Time**: 4 hours (business hours)
- **Channels**: Email, phone, dedicated Slack channel
- **Coverage**: Extended hours (7 AM - 9 PM EST)
- **Includes**: Priority fixes, architecture reviews, performance optimization

#### Enterprise Support

- **Response Time**: 1 hour (24/7 for critical issues)
- **Channels**: All channels + dedicated support engineer
- **Coverage**: 24/7/365
- **Includes**: Custom development, SLA guarantees, training

### Contact Information

- **General Inquiries**: support@[your-domain].com
- **Sales**: sales@[your-domain].com
- **Security Issues**: security@[your-domain].com (see
  [SECURITY.md](SECURITY.md))
- **Partnership**: partners@[your-domain].com

## Service Level Agreements

### Issue Priority Levels

#### P1 - Critical

- **Definition**: Production system down, data loss risk, security breach
- **Response Time**: 1 hour (Enterprise), 4 hours (Premium), 24 hours (Standard)
- **Resolution Target**: 4 hours
- **Examples**:
  - All webhooks failing
  - Security vulnerability actively exploited
  - Complete function failure

#### P2 - High

- **Definition**: Major functionality impaired, significant performance
  degradation
- **Response Time**: 4 hours (Enterprise), 8 hours (Premium), 48 hours
  (Standard)
- **Resolution Target**: 24 hours
- **Examples**:
  - Intermittent webhook failures
  - Slow job synchronization
  - Rate limiting issues

#### P3 - Medium

- **Definition**: Minor functionality issues, workaround available
- **Response Time**: 24 hours (Enterprise), 48 hours (Premium), 5 days
  (Standard)
- **Resolution Target**: 5 business days
- **Examples**:
  - UI/UX improvements needed
  - Non-critical bug fixes
  - Documentation clarifications

#### P4 - Low

- **Definition**: Feature requests, enhancements, questions
- **Response Time**: 48 hours (Enterprise), 5 days (Premium), 10 days (Standard)
- **Resolution Target**: Next release cycle
- **Examples**:
  - Feature requests
  - Performance optimizations
  - Code refactoring suggestions

### Escalation Process

1. **Level 1**: Support Engineer
2. **Level 2**: Senior Engineer (after 2 hours for P1, 24 hours for P2)
3. **Level 3**: Engineering Manager (after 4 hours for P1, 48 hours for P2)
4. **Level 4**: CTO/Director (critical customer impact only)

## Frequently Asked Questions

### Installation & Setup

**Q: What are the minimum system requirements?** A: Node.js 20.0.0+, pnpm
8.0.0+, 512MB RAM minimum (1GB recommended)

**Q: Can I use npm or yarn instead of pnpm?** A: No, this project exclusively
uses pnpm for dependency management consistency.

**Q: How do I set up local development?** A: See the
[README.md](README.md#installation) for detailed setup instructions.

### Configuration

**Q: Where do I find my DriveHR Company ID?** A: Your Company ID is in your
DriveHR URL: `https://[company-id].drivehris.app`

**Q: How do I generate a webhook secret?** A: Use: `openssl rand -hex 32` or
`node -p "require('crypto').randomBytes(32).toString('hex')"`

**Q: Can I use multiple WordPress endpoints?** A: Currently, one endpoint per
deployment. Use multiple deployments for multiple sites.

### Deployment

**Q: How do I deploy to Netlify?** A: See
[DEPLOYMENT.md](DEPLOYMENT.md#netlify-configuration) for complete instructions.

**Q: Can I deploy to other platforms?** A: The functions are designed for
Netlify. AWS Lambda or Vercel would require modifications.

**Q: How do I set up CI/CD?** A: GitHub Actions is pre-configured. See
[DEPLOYMENT.md](DEPLOYMENT.md#cicd-pipeline).

### Troubleshooting

**Q: Webhooks are failing with 401 Unauthorized** A: Check that your
WEBHOOK_SECRET matches exactly on both sides.

**Q: Functions are timing out** A: Increase timeout in netlify.toml or optimize
your DriveHR page load time.

**Q: No jobs are being found** A: Verify your DRIVEHR_COMPANY_ID and check if
the careers page structure changed.

### Security

**Q: How is data encrypted?** A: All data is encrypted in transit via HTTPS.
Webhooks use HMAC SHA-256 signatures.

**Q: Where are secrets stored?** A: Secrets are stored as environment variables
in Netlify, never in code.

**Q: How do I report security issues?** A: See
[SECURITY.md](SECURITY.md#vulnerability-reporting) for responsible disclosure.

## Troubleshooting Guide

### Common Issues and Solutions

#### Webhook Signature Validation Failures

**Symptoms**: 401 Unauthorized errors on WordPress endpoint

**Diagnosis**:

```bash
# Check signature generation
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-jobs \
  -H "Content-Type: application/json" \
  -d '{"test": true}' -v
```

**Solutions**:

1. Verify WEBHOOK_SECRET matches exactly (no extra spaces)
2. Check for Unicode characters in payload
3. Ensure proper HMAC implementation on WordPress side
4. Validate timestamp synchronization between systems

#### Function Timeout Errors

**Symptoms**: Function execution exceeds 30 seconds

**Diagnosis**:

```bash
# Check function logs
netlify logs:functions --name sync-jobs
```

**Solutions**:

1. Increase timeout in netlify.toml
2. Implement pagination for large job sets
3. Optimize Playwright browser initialization
4. Add caching for repeated requests

#### Rate Limiting Issues

**Symptoms**: 429 Too Many Requests errors

**Diagnosis**:

```javascript
// Check rate limit headers
console.log(response.headers['x-ratelimit-remaining']);
console.log(response.headers['x-ratelimit-reset']);
```

**Solutions**:

1. Implement exponential backoff
2. Reduce request frequency
3. Use bulk operations where possible
4. Contact support for limit increases

#### Job Parsing Failures

**Symptoms**: Jobs not being extracted from DriveHR

**Diagnosis**:

```bash
# Test scraping locally
pnpm run scrape-live
```

**Solutions**:

1. Check for DriveHR HTML structure changes
2. Update CSS selectors in parser
3. Verify company ID is correct
4. Check for authentication requirements

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Set in environment
LOG_LEVEL=debug

# Or in function call
netlify functions:invoke sync-jobs --payload '{"debug": true}'
```

### Log Analysis

#### Accessing Logs

```bash
# Real-time logs
netlify logs:functions --follow

# Historical logs
netlify logs:functions --hours 24

# Specific function
netlify logs:functions --name sync-jobs
```

#### Log Levels

- **ERROR**: System failures requiring immediate attention
- **WARN**: Potential issues that may need investigation
- **INFO**: Normal operation events
- **DEBUG**: Detailed diagnostic information

## Training Resources

### Documentation

- **User Guide**: Comprehensive usage documentation
- **API Reference**: Detailed API documentation
- **Architecture Guide**: System design and data flow
- **Best Practices**: Recommended patterns and approaches

### Video Tutorials

- **Getting Started** (15 min): Installation and basic setup
- **Configuration Deep Dive** (30 min): Advanced configuration options
- **Troubleshooting Masterclass** (45 min): Common issues and solutions
- **Security Best Practices** (20 min): Secure deployment guidelines

### Workshops

#### Introduction Workshop (2 hours)

- System overview
- Basic configuration
- First deployment
- Q&A session

#### Advanced Workshop (4 hours)

- Custom modifications
- Performance optimization
- Security hardening
- Integration patterns

#### Enterprise Workshop (Full day)

- Architecture review
- Custom development
- Monitoring setup
- Team training

### Certification Program

- **Certified User**: Basic operation and configuration
- **Certified Administrator**: Deployment and maintenance
- **Certified Developer**: Custom development and integration
- **Certified Architect**: System design and optimization

## Professional Services

### Consulting Services

#### Implementation Services

- System setup and configuration
- Custom integration development
- Performance optimization
- Security auditing

#### Migration Services

- Legacy system migration
- Data transformation
- Parallel running setup
- Validation and testing

#### Training Services

- On-site team training
- Custom workshop development
- Documentation creation
- Knowledge transfer sessions

### Managed Services

#### Monitoring & Maintenance

- 24/7 system monitoring
- Proactive issue resolution
- Regular health checks
- Performance optimization

#### Update Management

- Security patch application
- Feature updates
- Dependency management
- Regression testing

### Custom Development

#### Feature Development

- Custom requirements analysis
- Solution design
- Implementation
- Testing and deployment

#### Integration Development

- Third-party system integration
- API development
- Webhook customization
- Data transformation

### Support Packages

#### Starter Package

- 10 support hours/month
- Email support
- Monthly health check
- Quarterly review

#### Professional Package

- 20 support hours/month
- Email + phone support
- Weekly health checks
- Monthly reviews

#### Enterprise Package

- Unlimited support hours
- Dedicated support engineer
- Daily health checks
- Custom SLA

## Additional Resources

### Community Resources

- **GitHub Repository**: Source code and issue tracking
- **Discussion Forum**: Community Q&A
- **Stack Overflow**: Tagged questions (#drivehr-sync)
- **Blog**: Updates and best practices

### External Resources

- **Netlify Documentation**: Platform-specific guidance
- **DriveHR API Docs**: Integration specifications
- **WordPress Webhooks**: Endpoint development
- **Node.js Best Practices**: Development guidelines

### Tools and Utilities

- **Health Check Dashboard**: Monitor system status
- **Log Analyzer**: Parse and analyze logs
- **Configuration Validator**: Verify setup
- **Performance Profiler**: Identify bottlenecks

---

## Contact Us

For support inquiries not covered above:

- **Email**: support@[your-domain].com
- **Phone**: +1-XXX-XXX-XXXX (Business hours)
- **Emergency**: +1-XXX-XXX-XXXX (24/7 for P1 issues)

---

Last Updated: 2025-01-25 Version: 1.0.0
