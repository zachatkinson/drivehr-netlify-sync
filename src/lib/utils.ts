/**
 * Shared Utility Functions
 *
 * Common utility functions used across the application to eliminate
 * DRY violations and ensure consistent behavior.
 */

import { createHmac, randomBytes } from 'crypto';

/**
 * String normalization and ID generation utilities
 *
 * Provides standardized string manipulation and identifier generation
 * functions to eliminate code duplication across the application.
 * All methods are static for convenient access without instantiation.
 *
 * @since 1.0.0
 * @see {@link SecurityUtils} for security-related string operations
 */
export class StringUtils {
  /**
   * Normalize a string for use as an identifier
   *
   * Converts input string to lowercase, replaces non-alphanumeric characters
   * with dashes, removes consecutive dashes, and trims to specified length.
   * Useful for creating URL-safe identifiers from arbitrary text.
   *
   * @param input - The string to normalize (job titles, names, etc.)
   * @param maxLength - Maximum length of the normalized string (default: 20)
   * @returns Normalized string suitable for use as an identifier
   * @throws {TypeError} When input is not a string
   * @example
   * ```typescript
   * const id = StringUtils.normalizeForId('Senior Software Engineer!', 15);
   * // Returns: 'senior-software'
   * ```
   * @since 1.0.0
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
   * Generate a unique ID from a title string
   *
   * Creates a unique identifier by combining a normalized version of the
   * input title with a timestamp. Ensures uniqueness across multiple
   * calls with the same title string.
   *
   * @param title - The title string to convert to an ID (e.g., job title)
   * @returns Unique identifier in format 'normalized-title-timestamp'
   * @throws {TypeError} When title is not a string
   * @example
   * ```typescript
   * const jobId = StringUtils.generateIdFromTitle('Software Engineer');
   * // Returns: 'software-engineer-1704067200000'
   * ```
   * @since 1.0.0
   * @see {@link normalizeForId} for the normalization logic
   */
  public static generateIdFromTitle(title: string): string {
    const normalized = this.normalizeForId(title);
    return `${normalized}-${Date.now()}`;
  }

  /**
   * Generate a unique request ID for tracking
   *
   * Creates a cryptographically secure random identifier for request
   * tracking and correlation across services. Uses Node.js crypto module
   * for true randomness.
   *
   * @returns 32-character hexadecimal string (16 bytes of randomness)
   * @throws {Error} When crypto.randomBytes fails (system entropy issues)
   * @example
   * ```typescript
   * const requestId = StringUtils.generateRequestId();
   * // Returns: 'a1b2c3d4e5f6789012345678901234567890abcd'
   * ```
   * @since 1.0.0
   * @see {@link generateShortId} for shorter identifiers
   */
  public static generateRequestId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate a shorter unique ID for general use
   *
   * Creates a compact, URL-safe identifier using base64url encoding.
   * Provides good uniqueness for most use cases while maintaining
   * readability and URL compatibility.
   *
   * @returns 8-character base64url-encoded string (6 bytes of randomness)
   * @throws {Error} When crypto.randomBytes fails
   * @example
   * ```typescript
   * const shortId = StringUtils.generateShortId();
   * // Returns: 'Xy3mN9pQ'
   * ```
   * @since 1.0.0
   * @see {@link generateRequestId} for longer, more unique identifiers
   */
  public static generateShortId(): string {
    return randomBytes(6).toString('base64url');
  }
}

/**
 * Security utilities for cryptographic operations
 *
 * Provides enterprise-grade cryptographic functions for webhook validation,
 * signature generation, and timing-safe comparisons. Centralizes all
 * security-sensitive operations to ensure consistent implementation
 * and prevent timing attacks.
 *
 * @since 1.0.0
 * @see {@link StringUtils} for general utility functions
 */
export class SecurityUtils {
  /**
   * Generate HMAC-SHA256 signature for webhook validation
   *
   * Creates a cryptographically secure HMAC signature using SHA256
   * algorithm. Used for webhook authentication and data integrity
   * verification. Returns signature in the standard 'sha256=hash' format.
   *
   * @param data - The payload data to sign (JSON string, form data, etc.)
   * @param secret - The shared secret key for HMAC generation
   * @returns HMAC signature in format 'sha256=hexadecimalhash'
   * @throws {TypeError} When data or secret is not a string
   * @throws {Error} When HMAC generation fails
   * @example
   * ```typescript
   * const payload = JSON.stringify({ message: 'hello' });
   * const signature = SecurityUtils.generateHmacSignature(payload, 'secret');
   * // Returns: 'sha256=a1b2c3d4e5f6...'
   * ```
   * @since 1.0.0
   * @see {@link validateHmacSignature} for signature validation
   */
  public static generateHmacSignature(data: string, secret: string): string {
    const hmac = createHmac('sha256', secret).update(data).digest('hex');
    return `sha256=${hmac}`;
  }

  /**
   * Validate HMAC signature in timing-safe manner
   *
   * Verifies an HMAC signature against the expected value using timing-safe
   * comparison to prevent timing attack vulnerabilities. Essential for
   * webhook security and API authentication.
   *
   * @param data - The original payload data that was signed
   * @param signature - The HMAC signature to validate (in 'sha256=hash' format)
   * @param secret - The shared secret key used for signature generation
   * @returns True if signature is valid, false otherwise
   * @throws {TypeError} When any parameter is not a string
   * @example
   * ```typescript
   * const isValid = SecurityUtils.validateHmacSignature(
   *   payload,
   *   'sha256=a1b2c3d4...',
   *   'secret'
   * );
   * if (isValid) {
   *   console.log('Webhook is authentic');
   * }
   * ```
   * @since 1.0.0
   * @see {@link generateHmacSignature} for signature generation
   * @see {@link timingSafeEqual} for the underlying comparison logic
   */
  public static validateHmacSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHmacSignature(data, secret);
    return this.timingSafeEqual(signature, expectedSignature);
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   *
   * Performs constant-time string comparison that takes the same amount
   * of time regardless of where the strings differ. Critical for
   * cryptographic operations to prevent timing-based side-channel attacks.
   *
   * @param a - First string to compare
   * @param b - Second string to compare
   * @returns True if strings are identical, false otherwise
   * @throws {TypeError} When either parameter is not a string
   * @example
   * ```typescript
   * const isEqual = SecurityUtils.timingSafeEqual(
   *   'secret123',
   *   'secret123'
   * );
   * // Returns: true (but takes constant time regardless of match)
   * ```
   * @since 1.0.0
   * @see {@link https://en.wikipedia.org/wiki/Timing_attack} for timing attack info
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
 * Date and time utilities
 *
 * Provides standardized date and time operations for consistent
 * handling across the application. Includes validation, formatting,
 * and safe conversion utilities.
 *
 * @since 1.0.0
 * @see {@link StringUtils} for string-related utilities
 */
export class DateUtils {
  /**
   * Get current ISO timestamp
   *
   * Returns the current date and time in ISO 8601 format.
   * Provides consistent timestamp formatting across the entire
   * application for logging, data storage, and API responses.
   *
   * @returns Current timestamp in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   * @example
   * ```typescript
   * const timestamp = DateUtils.getCurrentIsoTimestamp();
   * // Returns: '2024-01-01T12:00:00.000Z'
   * ```
   * @since 1.0.0
   * @see {@link toIsoString} for converting existing dates
   */
  public static getCurrentIsoTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Validate if a string represents a valid date
   *
   * Checks whether a string can be successfully parsed as a valid date.
   * Used throughout the application for data validation and safe
   * date processing, particularly in HTML parsing and API responses.
   *
   * @param dateString - The string to validate as a date
   * @returns True if the string represents a valid date, false otherwise
   * @example
   * ```typescript
   * DateUtils.isValidDate('2024-01-01'); // Returns: true
   * DateUtils.isValidDate('invalid-date'); // Returns: false
   * ```
   * @since 1.0.0
   * @see {@link toIsoString} for safe date conversion
   */
  public static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Convert date to ISO string safely
   *
   * Safely converts a date string or Date object to ISO format.
   * If the input is invalid, returns the current timestamp instead
   * of throwing an error. Ensures consistent date formatting
   * throughout the application.
   *
   * @param date - Date string or Date object to convert
   * @returns ISO 8601 formatted date string
   * @example
   * ```typescript
   * DateUtils.toIsoString('2024-01-01'); // Returns: '2024-01-01T00:00:00.000Z'
   * DateUtils.toIsoString('invalid'); // Returns: current timestamp
   * DateUtils.toIsoString(new Date()); // Returns: date as ISO string
   * ```
   * @since 1.0.0
   * @see {@link isValidDate} for date validation
   * @see {@link getCurrentIsoTimestamp} for current timestamp
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
 * URL manipulation utilities
 *
 * Provides comprehensive URL manipulation and validation utilities
 * for consistent URL handling across the application. Includes
 * resolution, validation, and domain extraction capabilities.
 *
 * @since 1.0.0
 * @see {@link StringUtils} for string manipulation utilities
 */
export class UrlUtils {
  /**
   * Resolve relative URL against base URL
   *
   * Safely resolves relative URLs against a base URL, handling all
   * standard URL formats including absolute URLs, protocol-relative URLs,
   * absolute paths, and relative paths. Used throughout job parsing
   * to ensure apply URLs are properly formed.
   *
   * @param url - The URL to resolve (can be relative or absolute)
   * @param baseUrl - The base URL to resolve against
   * @returns Fully resolved absolute URL
   * @throws {TypeError} When parameters are not strings
   * @example
   * ```typescript
   * // Absolute URL (returned as-is)
   * UrlUtils.resolveUrl('https://example.com/job', 'https://base.com');
   * // Returns: 'https://example.com/job'
   *
   * // Relative path
   * UrlUtils.resolveUrl('./apply', 'https://example.com/careers');
   * // Returns: 'https://example.com/apply'
   *
   * // Absolute path
   * UrlUtils.resolveUrl('/apply/123', 'https://example.com/careers');
   * // Returns: 'https://example.com/apply/123'
   * ```
   * @since 1.0.0
   * @see {@link extractDomain} for domain extraction
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
   * Extract domain from URL safely
   *
   * Safely extracts the hostname (domain) from a URL string.
   * Returns null if the URL is malformed or invalid, preventing
   * runtime errors in URL processing.
   *
   * @param url - The URL string to extract domain from
   * @returns The hostname/domain, or null if URL is invalid
   * @example
   * ```typescript
   * UrlUtils.extractDomain('https://example.com/path');
   * // Returns: 'example.com'
   *
   * UrlUtils.extractDomain('invalid-url');
   * // Returns: null
   * ```
   * @since 1.0.0
   * @see {@link isFromDomain} for domain comparison
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
   * Check if URL is from a specific domain
   *
   * Performs case-insensitive comparison to check if a URL
   * belongs to a specific domain. Useful for security checks
   * and domain-based filtering.
   *
   * @param url - The URL to check
   * @param domain - The domain to compare against
   * @returns True if URL is from the specified domain, false otherwise
   * @example
   * ```typescript
   * UrlUtils.isFromDomain('https://api.example.com/data', 'example.com');
   * // Returns: true
   *
   * UrlUtils.isFromDomain('https://other.com/data', 'example.com');
   * // Returns: false
   * ```
   * @since 1.0.0
   * @see {@link extractDomain} for domain extraction
   */
  public static isFromDomain(url: string, domain: string): boolean {
    const urlDomain = this.extractDomain(url);
    return urlDomain?.toLowerCase() === domain.toLowerCase();
  }
}
