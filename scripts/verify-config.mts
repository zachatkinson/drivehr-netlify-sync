#!/usr/bin/env tsx
/**
 * Configuration Verification Script
 *
 * Enterprise-grade configuration validation tool that verifies all required
 * environment variables and configurations are properly set for deployment.
 * Performs comprehensive validation of DriveHR company IDs, webhook secrets,
 * WordPress URLs, and environment-specific requirements.
 *
 * Validation Features:
 * - Required and optional environment variable checking
 * - UUID format validation for DriveHR company IDs
 * - Webhook secret length and security validation
 * - WordPress URL format and HTTPS enforcement
 * - HMAC signature generation testing
 * - Environment-specific configuration validation
 * - Production readiness checks
 *
 * Exit Codes:
 * - 0: All configurations valid and ready for deployment
 * - 1: Configuration errors found that must be fixed
 *
 * @example
 * ```bash
 * # Run configuration verification
 * pnpm tsx scripts/verify-config.mts
 *
 * # Environment variables will be validated
 * export DRIVEHR_COMPANY_ID="12345678-1234-1234-1234-123456789012"
 * export WEBHOOK_SECRET="your-32-character-webhook-secret-here"
 * export WP_API_URL="https://yoursite.com/webhook/drivehr-sync"
 * ```
 *
 * @module config-verification
 * @since 1.0.0
 * @see {@link ../CLAUDE.md} for development standards and configuration requirements
 * @see {@link ../README.md} for deployment setup instructions
 */

import { createHmac } from 'crypto';

const requiredEnvVars: string[] = [
  'DRIVEHR_COMPANY_ID',
  'WEBHOOK_SECRET',
  'WP_API_URL'
];

const optionalEnvVars: string[] = [
  'WP_USERNAME',
  'WP_APPLICATION_PASSWORD',
  'LOG_LEVEL',
  'ENVIRONMENT',
  'GITHUB_TOKEN',
  'GITHUB_REPOSITORY',
  'NETLIFY_WEBHOOK_URL'
];

console.log('🔍 DriveHR Netlify Sync - Configuration Verification\n');

let hasErrors: boolean = false;

// Check required environment variables
console.log('📋 Required Environment Variables:');
for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];
  if (!value) {
    console.log(`❌ ${envVar}: Missing`);
    hasErrors = true;
  } else {
    const displayValue = envVar.includes('SECRET') || envVar.includes('PASSWORD') 
      ? '*'.repeat(value.length) 
      : value;
    console.log(`✅ ${envVar}: ${displayValue}`);
  }
}

console.log('\n📋 Optional Environment Variables:');
for (const envVar of optionalEnvVars) {
  const value = process.env[envVar];
  if (!value) {
    console.log(`⚠️  ${envVar}: Not set (using defaults)`);
  } else {
    const displayValue = envVar.includes('SECRET') || envVar.includes('PASSWORD') || envVar.includes('TOKEN')
      ? '*'.repeat(value.length) 
      : value;
    console.log(`✅ ${envVar}: ${displayValue}`);
  }
}

// Validate specific configurations
console.log('\n🔧 Configuration Validation:');

// Validate DriveHR Company ID format
const companyId: string | undefined = process.env.DRIVEHR_COMPANY_ID;
if (companyId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(companyId)) {
    console.log('✅ DRIVEHR_COMPANY_ID: Valid UUID format');
  } else {
    console.log('❌ DRIVEHR_COMPANY_ID: Invalid UUID format (expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)');
    hasErrors = true;
  }
}

// Validate webhook secret length
const webhookSecret: string | undefined = process.env.WEBHOOK_SECRET;
if (webhookSecret) {
  if (webhookSecret.length >= 32) {
    console.log('✅ WEBHOOK_SECRET: Sufficient length');
  } else {
    console.log(`❌ WEBHOOK_SECRET: Too short (${webhookSecret.length} chars, minimum 32 required)`);
    hasErrors = true;
  }
}

// Validate WordPress URL format
const wpApiUrl: string | undefined = process.env.WP_API_URL;
if (wpApiUrl) {
  try {
    const url = new URL(wpApiUrl);
    if (url.protocol === 'https:') {
      console.log('✅ WP_API_URL: Valid HTTPS URL');
    } else {
      console.log('⚠️  WP_API_URL: Not using HTTPS (recommended for security)');
    }
  } catch (error) {
    console.log('❌ WP_API_URL: Invalid URL format');
    hasErrors = true;
  }
}

// Test HMAC signature generation
if (webhookSecret) {
  console.log('\n🔐 HMAC Signature Test:');
  try {
    const testPayload = '{"test": "data"}';
    const signature = createHmac('sha256', webhookSecret)
      .update(testPayload)
      .digest('hex');
    console.log(`✅ HMAC generation working: sha256=${signature.substring(0, 16)}...`);
  } catch (error) {
    console.log('❌ HMAC generation failed:', error.message);
    hasErrors = true;
  }
}

// Environment-specific checks
console.log('\n🌍 Environment Configuration:');
const environment: string = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
console.log(`📍 Environment: ${environment}`);

if (environment === 'production') {
  const productionChecks: Array<{ name: string; required: boolean }> = [
    { name: 'WP_USERNAME', required: true },
    { name: 'WP_APPLICATION_PASSWORD', required: true },
    { name: 'NETLIFY_WEBHOOK_URL', required: false }
  ];
  
  for (const check of productionChecks) {
    const value = process.env[check.name];
    if (check.required && !value) {
      console.log(`❌ ${check.name}: Required for production environment`);
      hasErrors = true;
    } else if (value) {
      console.log(`✅ ${check.name}: Configured for production`);
    }
  }
}

// Final summary
console.log('\n📊 Configuration Summary:');
if (hasErrors) {
  console.log('❌ Configuration has errors that must be fixed before deployment');
  console.log('\n📚 For setup instructions, see:');
  console.log('   - README.md - General setup guide');
  console.log('   - DEPLOYMENT.md - Detailed deployment instructions');
  console.log('   - .env.example - Environment variable examples');
  process.exit(1);
} else {
  console.log('✅ Configuration looks good! Ready for deployment');
  console.log('\n🚀 Next steps:');
  console.log('   1. Deploy to Netlify: git push origin main');
  console.log('   2. Configure GitHub Actions secrets');
  console.log('   3. Test health check endpoint');
  console.log('   4. Test manual trigger');
  console.log('   5. Verify scheduled workflow');
}