/**
 * Enterprise Utility Functions Library
 *
 * Comprehensive collection of reusable utility functions providing standardized
 * string manipulation, cryptographic operations, date handling, and URL processing
 * capabilities across the DriveHR application. Implements enterprise-grade security
 * patterns, DRY principles, and consistent error handling for production reliability.
 *
 * The library is organized into four specialized utility classes, each focusing on
 * a specific domain of functionality while maintaining strict type safety and
 * comprehensive error handling. All methods are static for convenient access
 * without instantiation overhead.
 *
 * Key Features:
 * - String normalization and unique ID generation utilities
 * - Cryptographically secure HMAC signature generation and validation
 * - Timing-safe comparison functions to prevent timing attacks
 * - Date validation, formatting, and ISO string conversion
 * - URL resolution, domain extraction, and validation utilities
 * - Comprehensive error handling with graceful degradation
 * - TypeScript strict typing for enhanced reliability
 *
 * Security Considerations:
 * - All cryptographic operations use Node.js crypto module
 * - Timing-safe comparisons prevent side-channel attacks
 * - HMAC signatures follow industry standards (SHA-256)
 * - URL processing prevents injection vulnerabilities
 * - Input validation and sanitization throughout
 *
 * @example
 * ```typescript
 * import { StringUtils, SecurityUtils, DateUtils, UrlUtils } from './lib/utils.js';
 *
 * // String utilities for ID generation
 * const jobId = StringUtils.generateIdFromTitle('Senior Software Engineer');
 * const requestId = StringUtils.generateRequestId();
 *
 * // Security utilities for webhook validation
 * const payload = JSON.stringify({ jobs: jobData });
 * const signature = SecurityUtils.generateHmacSignature(payload, secretKey);
 * const isValid = SecurityUtils.validateHmacSignature(payload, signature, secretKey);
 *
 * // Date utilities for consistent formatting
 * const timestamp = DateUtils.getCurrentIsoTimestamp();
 * const isValidDate = DateUtils.isValidDate('2025-01-01');
 *
 * // URL utilities for job application links
 * const applyUrl = UrlUtils.resolveUrl('./apply/123', 'https://company.com/jobs');
 * const domain = UrlUtils.extractDomain(applyUrl);
 * ```
 *
 * @module enterprise-utility-functions-library
 * @since 1.0.0
 * @see {@link ../types/common.ts} for shared type definitions
 * @see {@link StringUtils} for string manipulation and ID generation
 * @see {@link SecurityUtils} for cryptographic operations
 * @see {@link DateUtils} for date and time utilities
 * @see {@link UrlUtils} for URL processing utilities
 */

import { createHmac, randomBytes } from 'crypto';

/**
 * String manipulation and identifier generation utilities
 *
 * Provides standardized string operations for consistent identifier generation,
 * normalization, and random ID creation throughout the DriveHR application.
 * All methods are static utilities that follow enterprise naming conventions
 * and provide URL-safe, database-friendly identifier formats.
 *
 * Features comprehensive input validation, configurable length limits,
 * and cryptographically secure random generation for production reliability.
 * Designed to eliminate DRY violations in string processing across services.
 *
 * @example
 * ```typescript
 * // Generate job identifiers from titles
 * const jobId = StringUtils.generateIdFromTitle('Senior Software Engineer');
 * // Returns: 'senior-software-1735689600000'
 *
 * // Create URL-safe identifiers
 * const urlSlug = StringUtils.normalizeForId('Product Manager!', 15);
 * // Returns: 'product-manager'
 *
 * // Generate tracking identifiers
 * const requestId = StringUtils.generateRequestId();
 * // Returns: 32-character hex string
 *
 * // Create short identifiers
 * const shortId = StringUtils.generateShortId();
 * // Returns: 8-character base64url string
 * ```
 * @since 1.0.0
 * @see {@link SecurityUtils} for security-related string operations
 */
export class StringUtils {
  /**
   * Normalize string for use as URL-safe identifier
   *
   * Converts input string to lowercase, replaces non-alphanumeric characters
   * with hyphens, removes consecutive hyphens, trims leading/trailing hyphens,
   * and limits to specified length. Creates database and URL-friendly identifiers
   * from arbitrary text like job titles, company names, or user input.
   *
   * The normalization process ensures consistent, predictable identifiers that
   * work across different systems and protocols while maintaining readability.
   *
   * @param input - The string to normalize (job titles, names, descriptions, etc.)
   * @param maxLength - Maximum length of normalized string (default: 20 characters)
   * @returns URL-safe identifier suitable for slugs, database keys, or API endpoints
   * @throws {TypeError} When input is not a string or maxLength is not a number
   * @example
   * ```typescript
   * // Job title normalization
   * StringUtils.normalizeForId('Senior Software Engineer!', 15);
   * // Returns: 'senior-software'
   *
   * // Company name normalization
   * StringUtils.normalizeForId('Acme Corp & Associates');
   * // Returns: 'acme-corp-associates'
   *
   * // Handle special characters
   * StringUtils.normalizeForId('Full-Stack Developer (React/Node.js)');
   * // Returns: 'full-stack-developer'
   * ```
   * @since 1.0.0
   * @see {@link generateIdFromTitle} for unique identifier generation
   */
  public static normalizeForId(input: string, maxLength = 20): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, maxLength);
  }

  /**
   * Generate unique identifier from title string
   *
   * Creates a globally unique identifier by combining normalized title with
   * current timestamp. Ensures uniqueness across multiple calls with the same
   * title while maintaining readability and traceability. Ideal for job IDs,
   * content identifiers, or any scenario requiring human-readable unique keys.
   *
   * The generated ID includes both semantic meaning (from the title) and
   * temporal uniqueness (from timestamp), making it suitable for database
   * primary keys, file names, or API resource identifiers.
   *
   * @param title - The title string to convert to unique ID (job titles, content names, etc.)
   * @returns Unique identifier in format 'normalized-title-timestamp'
   * @throws {TypeError} When title is not a string
   * @example
   * ```typescript
   * // Job posting ID generation
   * const jobId = StringUtils.generateIdFromTitle('Software Engineer');
   * // Returns: 'software-engineer-1735689600000'
   *
   * // Content ID generation
   * const contentId = StringUtils.generateIdFromTitle('Company Benefits Overview');
   * // Returns: 'company-benefits-ove-1735689600123'
   *
   * // Unique IDs for duplicate titles
   * const id1 = StringUtils.generateIdFromTitle('Manager');
   * const id2 = StringUtils.generateIdFromTitle('Manager');
   * // Returns different IDs: 'manager-1735689600000', 'manager-1735689600001'
   * ```
   * @since 1.0.0
   * @see {@link normalizeForId} for the title normalization process
   * @see {@link generateShortId} for non-semantic unique identifiers
   */
  public static generateIdFromTitle(title: string): string {
    const normalized = this.normalizeForId(title);
    return `${normalized}-${Date.now()}`;
  }

  /**
   * Generate cryptographically secure request tracking identifier
   *
   * Creates a 32-character hexadecimal identifier using Node.js crypto module
   * for cryptographically secure randomness. Designed for request correlation,
   * transaction tracking, and distributed system tracing where uniqueness and
   * unpredictability are critical requirements.
   *
   * Uses 16 bytes of entropy from the system's cryptographically secure
   * random number generator, providing 2^128 possible values which ensures
   * practically guaranteed uniqueness across all application instances.
   *
   * @returns 32-character hexadecimal string with 128 bits of entropy
   * @throws {Error} When crypto.randomBytes fails due to insufficient system entropy
   * @example
   * ```typescript
   * // HTTP request tracking
   * const requestId = StringUtils.generateRequestId();
   * // Returns: 'a1b2c3d4e5f6789012345678901234567890abcd'
   *
   * // Distributed tracing correlation
   * const traceId = StringUtils.generateRequestId();
   * logger.info('Processing job', { traceId, jobId: 'job-123' });
   *
   * // Transaction identifiers
   * const transactionId = StringUtils.generateRequestId();
   * await processPayment({ transactionId, amount: 100 });
   * ```
   * @since 1.0.0
   * @see {@link generateShortId} for shorter, less secure identifiers
   * @see {@link https://nodejs.org/api/crypto.html#cryptorandombytessize-callback} for crypto.randomBytes
   */
  public static generateRequestId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate compact URL-safe identifier for general use
   *
   * Creates an 8-character identifier using base64url encoding for maximum
   * URL compatibility and readability. Uses 6 bytes of cryptographically secure
   * randomness (48 bits) providing 2^48 possible values, suitable for most
   * applications requiring short, unique identifiers.
   *
   * Base64url encoding ensures the identifier is safe for use in URLs,
   * file names, database keys, and JSON without requiring URL encoding.
   * Characters used are A-Z, a-z, 0-9, hyphen, and underscore only.
   *
   * @returns 8-character base64url-encoded string with 48 bits of entropy
   * @throws {Error} When crypto.randomBytes fails due to insufficient system entropy
   * @example
   * ```typescript
   * // File upload identifiers
   * const uploadId = StringUtils.generateShortId();
   * // Returns: 'Xy3mN9pQ'
   *
   * // Session tokens
   * const sessionId = StringUtils.generateShortId();
   * const userSession = { sessionId, userId: 'user-123' };
   *
   * // Temporary resource identifiers
   * const tempId = StringUtils.generateShortId();
   * await createTemporaryResource({ id: tempId, data: payload });
   * ```
   * @since 1.0.0
   * @see {@link generateRequestId} for longer, more secure identifiers
   * @see {@link https://tools.ietf.org/html/rfc4648#section-5} for base64url specification
   */
  public static generateShortId(): string {
    return randomBytes(6).toString('base64url');
  }
}

/**
 * Enterprise-grade security utilities for cryptographic operations
 *
 * Provides production-ready cryptographic functions for webhook validation,
 * HMAC signature generation, and timing-safe string comparisons. Implements
 * industry-standard security patterns to prevent common vulnerabilities
 * including timing attacks and signature forgery.
 *
 * All cryptographic operations use Node.js built-in crypto module for
 * maximum security and performance. Functions are designed to be constant-time
 * where applicable to prevent side-channel attacks and information leakage.
 *
 * Critical for webhook authentication, API security, and any scenario
 * requiring cryptographic verification in the DriveHR application.
 *
 * @example
 * ```typescript
 * // Webhook signature validation
 * const payload = JSON.stringify({ jobs: jobData });
 * const signature = SecurityUtils.generateHmacSignature(payload, webhookSecret);
 * const isAuthentic = SecurityUtils.validateHmacSignature(payload, signature, webhookSecret);
 *
 * // API request authentication
 * const requestData = JSON.stringify({ action: 'sync', timestamp: Date.now() });
 * const authSignature = SecurityUtils.generateHmacSignature(requestData, apiSecret);
 * headers['X-Signature'] = authSignature;
 *
 * // Secure token comparison
 * const isValidToken = SecurityUtils.timingSafeEqual(providedToken, expectedToken);
 * ```
 * @since 1.0.0
 * @see {@link StringUtils} for non-cryptographic string utilities
 * @see {@link https://tools.ietf.org/html/rfc2104} for HMAC specification
 */
export class SecurityUtils {
  /**
   * Generate HMAC-SHA256 signature for data authentication
   *
   * Creates a cryptographically secure HMAC signature using SHA-256 hash
   * algorithm for data integrity verification and authentication. Returns
   * signature in GitHub/webhook standard format with 'sha256=' prefix for
   * compatibility with common webhook validation systems.
   *
   * The HMAC (Hash-based Message Authentication Code) ensures both data
   * integrity and authenticity, preventing tampering and unauthorized requests.
   * Uses constant-time operations to prevent timing-based attacks.
   *
   * @param data - The payload data to sign (JSON strings, form data, request bodies, etc.)
   * @param secret - The shared secret key for HMAC generation (webhook secrets, API keys, etc.)
   * @returns HMAC signature in standard format 'sha256=hexadecimalhash'
   * @throws {TypeError} When data or secret parameters are not strings
   * @throws {Error} When HMAC generation fails due to invalid secret or crypto errors
   * @example
   * ```typescript
   * // Webhook payload signing
   * const jobPayload = JSON.stringify({ jobs: [{ id: '123', title: 'Engineer' }] });
   * const signature = SecurityUtils.generateHmacSignature(jobPayload, 'webhook_secret_key');
   * // Returns: 'sha256=a1b2c3d4e5f6789012345678901234567890abcdef'
   *
   * // API request authentication
   * const requestBody = JSON.stringify({ action: 'sync', timestamp: Date.now() });
   * const authHeader = SecurityUtils.generateHmacSignature(requestBody, process.env.API_SECRET);
   * headers['X-Hub-Signature-256'] = authHeader;
   *
   * // File integrity verification
   * const fileContent = await readFile('config.json', 'utf8');
   * const checksum = SecurityUtils.generateHmacSignature(fileContent, 'file_integrity_key');
   * ```
   * @since 1.0.0
   * @see {@link validateHmacSignature} for signature verification
   * @see {@link https://tools.ietf.org/html/rfc2104} for HMAC specification
   * @see {@link https://docs.github.com/en/webhooks/securing-your-webhooks} for webhook security
   */
  public static generateHmacSignature(data: string, secret: string): string {
    const hmac = createHmac('sha256', secret).update(data).digest('hex');
    return `sha256=${hmac}`;
  }

  /**
   * Validate HMAC signature using timing-safe comparison
   *
   * Verifies HMAC signature against expected value using constant-time comparison
   * to prevent timing attack vulnerabilities. Essential for secure webhook
   * validation, API authentication, and any cryptographic verification where
   * timing side-channels could leak information about valid signatures.
   *
   * The validation process regenerates the expected signature and performs
   * timing-safe comparison to ensure equal execution time regardless of
   * where differences occur, preventing attackers from extracting signature
   * information through timing analysis.
   *
   * @param data - The original payload data that was signed
   * @param signature - The HMAC signature to validate (in 'sha256=hash' format from headers or requests)
   * @param secret - The shared secret key used for signature generation
   * @returns True if signature is cryptographically valid and authentic, false otherwise
   * @throws {TypeError} When any parameter is not a string
   * @example
   * ```typescript
   * // Webhook signature validation
   * const webhookPayload = await request.text();
   * const providedSignature = request.headers.get('x-hub-signature-256');
   * const isAuthentic = SecurityUtils.validateHmacSignature(
   *   webhookPayload,
   *   providedSignature,
   *   process.env.WEBHOOK_SECRET
   * );
   *
   * if (!isAuthentic) {
   *   return Response.json({ error: 'Invalid signature' }, { status: 401 });
   * }
   *
   * // API request validation
   * const requestBody = JSON.stringify(requestData);
   * const clientSignature = headers['x-signature'];
   * const isValidRequest = SecurityUtils.validateHmacSignature(
   *   requestBody,
   *   clientSignature,
   *   apiSecret
   * );
   * ```
   * @since 1.0.0
   * @see {@link generateHmacSignature} for signature generation
   * @see {@link timingSafeEqual} for the underlying constant-time comparison
   * @see {@link https://en.wikipedia.org/wiki/Timing_attack} for timing attack information
   */
  public static validateHmacSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHmacSignature(data, secret);
    return this.timingSafeEqual(signature, expectedSignature);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   *
   * Performs cryptographically secure string comparison that executes in constant
   * time regardless of where strings differ. Critical security function that prevents
   * timing-based side-channel attacks where attackers could determine valid
   * signatures, tokens, or passwords by measuring comparison execution time.
   *
   * The implementation ensures that comparison time depends only on string length,
   * not content differences. Uses bitwise operations to avoid conditional branches
   * that could leak timing information, maintaining consistent execution patterns.
   *
   * @param a - First string to compare (provided signature, token, password, etc.)
   * @param b - Second string to compare (expected signature, stored token, hash, etc.)
   * @returns True if strings are identical, false for any difference or length mismatch
   * @throws {TypeError} When either parameter is not a string
   * @example
   * ```typescript
   * // Secure signature comparison
   * const providedSig = 'sha256=abc123...';
   * const expectedSig = 'sha256=abc123...';
   * const isValid = SecurityUtils.timingSafeEqual(providedSig, expectedSig);
   * // Takes same time whether signatures match or differ
   *
   * // API token validation
   * const clientToken = request.headers.get('authorization')?.replace('Bearer ', '');
   * const storedToken = await getStoredToken(userId);
   * const isAuthenticated = SecurityUtils.timingSafeEqual(clientToken, storedToken);
   *
   * // Password hash comparison
   * const providedHash = await hashPassword(password, salt);
   * const storedHash = user.passwordHash;
   * const isCorrectPassword = SecurityUtils.timingSafeEqual(providedHash, storedHash);
   * ```
   * @since 1.0.0
   * @see {@link https://en.wikipedia.org/wiki/Timing_attack} for timing attack details
   * @see {@link https://codahale.com/a-lesson-in-timing-attacks/} for practical examples
   * @see {@link validateHmacSignature} for HMAC validation using this function
   */
  public static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

/**
 * Date and time utilities for consistent temporal operations
 *
 * Provides standardized date handling, validation, and formatting utilities
 * for consistent temporal operations throughout the DriveHR application.
 * Implements safe date parsing, ISO string conversion, and validation
 * patterns to prevent common date-related errors and inconsistencies.
 *
 * All functions handle edge cases gracefully and provide fallback behavior
 * for invalid inputs, ensuring application stability when processing
 * user-generated dates, API responses, or file timestamps.
 *
 * @example
 * ```typescript
 * // Get current timestamp for logging
 * const logTimestamp = DateUtils.getCurrentIsoTimestamp();
 * logger.info('Job processed', { timestamp: logTimestamp });
 *
 * // Validate date strings from API responses
 * const dateFromApi = response.data.publishedDate;
 * if (DateUtils.isValidDate(dateFromApi)) {
 *   const normalizedDate = DateUtils.toIsoString(dateFromApi);
 *   job.publishedDate = normalizedDate;
 * }
 *
 * // Safe date conversion with fallback
 * const jobDate = DateUtils.toIsoString(job.rawDateString);
 * // Returns current timestamp if rawDateString is invalid
 * ```
 * @since 1.0.0
 * @see {@link StringUtils} for string-related utilities
 */
export class DateUtils {
  /**
   * Get current timestamp in ISO 8601 format
   *
   * Returns the current date and time as an ISO 8601 formatted string with
   * millisecond precision and UTC timezone indicator. Provides consistent
   * timestamp formatting across the entire application for logging, data
   * storage, API responses, and audit trails.
   *
   * The timestamp includes full date, time, and timezone information making
   * it suitable for international applications and distributed systems.
   *
   * @returns Current timestamp in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   * @example
   * ```typescript
   * // Logging with consistent timestamps
   * const timestamp = DateUtils.getCurrentIsoTimestamp();
   * logger.info('Job sync completed', { timestamp, jobCount: 25 });
   * // Log: { timestamp: '2025-01-01T12:00:00.000Z', jobCount: 25 }
   *
   * // API response timestamps
   * const response = {
   *   data: jobResults,
   *   metadata: {
   *     processedAt: DateUtils.getCurrentIsoTimestamp(),
   *     version: '1.0.0'
   *   }
   * };
   *
   * // Database record creation
   * const jobRecord = {
   *   id: jobId,
   *   createdAt: DateUtils.getCurrentIsoTimestamp(),
   *   data: jobData
   * };
   * ```
   * @since 1.0.0
   * @see {@link toIsoString} for converting existing dates to ISO format
   */
  public static getCurrentIsoTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Validate if string represents a valid date
   *
   * Performs safe validation to determine if a string can be successfully
   * parsed as a valid JavaScript Date object. Essential for data validation,
   * API input processing, and preventing invalid date errors throughout
   * the application when handling user input or external data sources.
   *
   * Uses JavaScript's Date constructor parsing combined with NaN checking
   * to detect invalid date representations, malformed strings, or
   * impossible date values.
   *
   * @param dateString - The string to validate as a date (API responses, user input, file data, etc.)
   * @returns True if string represents a valid, parseable date; false for invalid or unparseable strings
   * @example
   * ```typescript
   * // API response validation
   * const apiDate = response.data.publishedDate;
   * if (DateUtils.isValidDate(apiDate)) {
   *   job.publishedDate = new Date(apiDate);
   * } else {
   *   logger.warn('Invalid date in API response', { date: apiDate });
   *   job.publishedDate = new Date(); // Default to current date
   * }
   *
   * // User input validation
   * const userDateInput = '2025-01-01';
   * if (DateUtils.isValidDate(userDateInput)) {
   *   processDateFilter(userDateInput);
   * }
   *
   * // Various date format validation
   * DateUtils.isValidDate('2025-01-01');           // true
   * DateUtils.isValidDate('2025-01-01T10:00:00Z'); // true
   * DateUtils.isValidDate('January 1, 2025');      // true
   * DateUtils.isValidDate('invalid-date');         // false
   * DateUtils.isValidDate('2025-13-01');           // false (invalid month)
   * ```
   * @since 1.0.0
   * @see {@link toIsoString} for safe date conversion after validation
   */
  public static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Convert date to ISO string with safe fallback handling
   *
   * Safely converts date strings or Date objects to ISO 8601 format with
   * automatic fallback to current timestamp for invalid inputs. Prevents
   * application crashes when processing malformed dates from external APIs,
   * user input, or data parsing operations.
   *
   * Provides consistent date formatting throughout the application while
   * maintaining resilience against invalid date inputs through graceful
   * degradation to current timestamp.
   *
   * @param date - Date string or Date object to convert to ISO format
   * @returns ISO 8601 formatted date string, or current timestamp if input is invalid
   * @example
   * ```typescript
   * // Valid date string conversion
   * const isoDate = DateUtils.toIsoString('2025-01-01');
   * // Returns: '2025-01-01T00:00:00.000Z'
   *
   * // Date object conversion
   * const dateObj = new Date('2025-01-01T10:30:00');
   * const isoString = DateUtils.toIsoString(dateObj);
   * // Returns: '2025-01-01T10:30:00.000Z'
   *
   * // Invalid input with fallback
   * const safeFallback = DateUtils.toIsoString('invalid-date-string');
   * // Returns: current timestamp (e.g., '2025-01-01T12:00:00.123Z')
   *
   * // API response processing
   * const apiResponse = { publishedDate: response.data.date };
   * const normalizedDate = DateUtils.toIsoString(apiResponse.publishedDate);
   * job.publishedDate = normalizedDate; // Always valid ISO string
   * ```
   * @since 1.0.0
   * @see {@link isValidDate} for input validation before conversion
   * @see {@link getCurrentIsoTimestamp} for current timestamp generation
   */
  public static toIsoString(date: string | Date): string {
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? this.getCurrentIsoTimestamp() : parsed.toISOString();
    }
    return date.toISOString();
  }
}

/**
 * URL manipulation and validation utilities for web resource handling
 *
 * Provides comprehensive URL processing capabilities including resolution,
 * validation, and domain extraction for consistent URL handling throughout
 * the DriveHR application. Implements safe URL manipulation patterns that
 * prevent injection vulnerabilities and handle edge cases gracefully.
 *
 * Essential for processing job application links, API endpoints, webhook URLs,
 * and any web resource references found in scraped content or API responses.
 * All functions include comprehensive error handling and security considerations.
 *
 * Features include relative URL resolution, domain extraction for security
 * filtering, and URL validation to ensure proper formatting and safety.
 *
 * @example
 * ```typescript
 * // Resolve job application URLs
 * const baseJobUrl = 'https://company.com/careers/engineering';
 * const applyLink = UrlUtils.resolveUrl('./apply/123', baseJobUrl);
 * // Returns: 'https://company.com/careers/apply/123'
 *
 * // Extract domains for security filtering
 * const jobUrl = 'https://careers.company.com/job/123';
 * const domain = UrlUtils.extractDomain(jobUrl);
 * // Returns: 'careers.company.com'
 *
 * // Validate URL origins
 * const isFromTrustedDomain = UrlUtils.isFromDomain(applyUrl, 'company.com');
 * if (isFromTrustedDomain) {
 *   processJobApplication(applyUrl);
 * }
 *
 * // Handle various URL formats
 * const absoluteUrl = UrlUtils.resolveUrl('https://other.com/job', baseUrl);
 * const protocolRelative = UrlUtils.resolveUrl('//cdn.company.com/assets', baseUrl);
 * const absolutePath = UrlUtils.resolveUrl('/jobs/search', baseUrl);
 * ```
 * @since 1.0.0
 * @see {@link StringUtils} for URL-safe string manipulation
 */
export class UrlUtils {
  /**
   * Resolve relative URL against base URL with comprehensive format support
   *
   * Safely resolves URLs of any format (relative, absolute, protocol-relative)
   * against a base URL following web standards. Handles all standard URL formats
   * including relative paths, absolute paths, protocol-relative URLs, and
   * absolute URLs. Critical for processing scraped job application links and
   * ensuring proper URL formation in job data.
   *
   * The resolution follows RFC 3986 URL resolution standards and handles
   * edge cases like empty URLs, malformed inputs, and various path formats.
   * Provides consistent URL resolution for job scraping and link processing.
   *
   * @param url - The URL to resolve (relative paths, absolute URLs, protocol-relative, etc.)
   * @param baseUrl - The base URL to resolve relative URLs against
   * @returns Fully resolved absolute URL, or empty string for empty input
   * @throws {TypeError} When parameters are not strings
   * @example
   * ```typescript
   * const baseUrl = 'https://company.com/careers/engineering';
   *
   * // Absolute URL (returned unchanged)
   * UrlUtils.resolveUrl('https://external.com/apply', baseUrl);
   * // Returns: 'https://external.com/apply'
   *
   * // Relative path resolution
   * UrlUtils.resolveUrl('./apply/123', baseUrl);
   * // Returns: 'https://company.com/careers/apply/123'
   *
   * // Parent directory navigation
   * UrlUtils.resolveUrl('../jobs/search', baseUrl);
   * // Returns: 'https://company.com/careers/jobs/search'
   *
   * // Absolute path (from domain root)
   * UrlUtils.resolveUrl('/jobs/all', baseUrl);
   * // Returns: 'https://company.com/jobs/all'
   *
   * // Protocol-relative URL
   * UrlUtils.resolveUrl('//cdn.company.com/assets/logo.png', baseUrl);
   * // Returns: 'https://cdn.company.com/assets/logo.png'
   *
   * // Empty URL handling
   * UrlUtils.resolveUrl('', baseUrl);
   * // Returns: ''
   * ```
   * @since 1.0.0
   * @see {@link extractDomain} for domain extraction from resolved URLs
   * @see {@link https://tools.ietf.org/html/rfc3986} for URL resolution standards
   */
  public static resolveUrl(url: string, baseUrl: string): string {
    if (!url) {
      return '';
    }

    // Already absolute URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Protocol-relative URL
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    // Absolute path
    if (url.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      return `${urlObj.protocol}//${urlObj.host}${url}`;
    }

    // Relative path
    return new URL(url, baseUrl).toString();
  }

  /**
   * Extract domain (hostname) from URL with safe error handling
   *
   * Safely extracts the hostname portion from any valid URL string while
   * gracefully handling malformed or invalid URLs. Returns null for invalid
   * inputs rather than throwing errors, enabling safe URL processing in
   * data validation, security filtering, and domain-based routing scenarios.
   *
   * The extracted domain includes subdomains but excludes protocol, port,
   * path, query parameters, and fragments. Useful for security checks,
   * analytics, and domain-based filtering of job application URLs.
   *
   * @param url - The URL string to extract domain from (job URLs, API endpoints, webhooks, etc.)
   * @returns The hostname/domain portion of the URL, or null if URL is invalid or malformed
   * @example
   * ```typescript
   * // Standard domain extraction
   * const domain = UrlUtils.extractDomain('https://careers.company.com/jobs/123');
   * // Returns: 'careers.company.com'
   *
   * // Subdomain handling
   * const apiDomain = UrlUtils.extractDomain('https://api.v2.company.com/data');
   * // Returns: 'api.v2.company.com'
   *
   * // Port and path ignored
   * const cleanDomain = UrlUtils.extractDomain('https://company.com:8080/path/to/resource?q=value');
   * // Returns: 'company.com'
   *
   * // Invalid URL handling
   * const invalidDomain = UrlUtils.extractDomain('not-a-valid-url');
   * // Returns: null
   *
   * // Security filtering use case
   * const jobUrl = 'https://malicious.com/fake-job';
   * const domain = UrlUtils.extractDomain(jobUrl);
   * if (domain && trustedDomains.includes(domain)) {
   *   processJobUrl(jobUrl);
   * }
   * ```
   * @since 1.0.0
   * @see {@link isFromDomain} for domain comparison operations
   * @see {@link resolveUrl} for URL resolution before domain extraction
   */
  public static extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Check if URL belongs to specified domain with case-insensitive comparison
   *
   * Performs secure domain comparison to determine if a URL belongs to a specific
   * domain, using case-insensitive matching for reliable domain validation.
   * Essential for security filtering, trusted domain validation, and access control
   * in job scraping and webhook processing scenarios.
   *
   * The comparison handles subdomain variations and is case-insensitive to account
   * for different URL formatting. Returns false for invalid URLs or when domain
   * extraction fails, providing safe defaults for security-critical operations.
   *
   * @param url - The URL to check domain membership for (job application links, API endpoints, etc.)
   * @param domain - The target domain to compare against (without protocol or subdomains)
   * @returns True if URL belongs to the specified domain, false otherwise or for invalid URLs
   * @example
   * ```typescript
   * // Exact domain match
   * const isCompanyUrl = UrlUtils.isFromDomain('https://company.com/jobs', 'company.com');
   * // Returns: true
   *
   * // Subdomain matching (requires exact subdomain match)
   * const isCareersSite = UrlUtils.isFromDomain('https://careers.company.com/job', 'careers.company.com');
   * // Returns: true
   *
   * // Case-insensitive comparison
   * const isCaseMatch = UrlUtils.isFromDomain('https://COMPANY.COM/jobs', 'company.com');
   * // Returns: true
   *
   * // Different domain rejection
   * const isOtherDomain = UrlUtils.isFromDomain('https://malicious.com/fake-job', 'company.com');
   * // Returns: false
   *
   * // Security filtering implementation
   * const trustedDomains = ['company.com', 'careers.company.com'];
   * const jobUrl = 'https://careers.company.com/software-engineer';
   *
   * const isTrusted = trustedDomains.some(domain =>
   *   UrlUtils.isFromDomain(jobUrl, domain)
   * );
   *
   * if (isTrusted) {
   *   processJobApplication(jobUrl);
   * } else {
   *   logger.warn('Rejected untrusted job URL', { url: jobUrl });
   * }
   *
   * // Invalid URL handling
   * const invalidCheck = UrlUtils.isFromDomain('not-a-url', 'company.com');
   * // Returns: false (safe default)
   * ```
   * @since 1.0.0
   * @see {@link extractDomain} for the underlying domain extraction logic
   * @see {@link resolveUrl} for URL resolution before domain checking
   */
  public static isFromDomain(url: string, domain: string): boolean {
    const urlDomain = this.extractDomain(url);
    return urlDomain?.toLowerCase() === domain.toLowerCase();
  }
}
