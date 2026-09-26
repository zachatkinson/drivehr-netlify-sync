/**
 * HTML Sanitizer Test Suite
 *
 * Comprehensive test coverage for the job description sanitizer following
 * enterprise testing standards with DRY principles and SOLID architecture.
 * This test suite validates that third-party careers-page HTML is reduced to
 * the formatting allowlist before it is signed and sent to WordPress.
 *
 * Test Features:
 * - Allowlisted formatting elements survive intact
 * - Script, style, iframe, object and event-handler payloads are removed
 * - Dangerous URL schemes on anchors are stripped
 * - Non-string input and oversized input are handled safely
 *
 * @example
 * ```typescript
 * // Example of running specific test group
 * pnpm test test/lib/html-sanitizer.test.ts -- --grep "dangerous"
 * ```
 *
 * @module html-sanitizer-test-suite
 * @since 1.10.0
 * @see {@link ../../src/lib/html-sanitizer.ts} for the sanitizer being tested
 * @see {@link ../../CLAUDE.md} for testing standards and practices
 */

import { describe, it, expect } from 'vitest';
import { sanitizeJobDescription, MAX_DESCRIPTION_LENGTH } from '../../src/lib/html-sanitizer.js';

/**
 * Sanitizer-specific test utilities
 *
 * Provides parameterized fixtures for XSS payloads so each dangerous shape is
 * asserted once through a shared helper instead of repeated per test.
 *
 * @since 1.10.0
 */
class HtmlSanitizerTestUtils {
  /**
   * Payloads that must never survive sanitization
   *
   * Each entry pairs a raw HTML fragment with a substring that must be absent
   * from the sanitized output.
   *
   * @since 1.10.0
   */
  static readonly DANGEROUS_PAYLOADS: ReadonlyArray<{
    readonly html: string;
    readonly forbidden: string;
  }> = [
    { html: '<p>Hi<script>alert(1)</script></p>', forbidden: 'alert' },
    { html: '<img src=x onerror="alert(1)">', forbidden: 'onerror' },
    { html: '<p onclick="alert(1)">Click</p>', forbidden: 'onclick' },
    { html: '<a href="javascript:alert(1)">x</a>', forbidden: 'javascript:' },
    { html: '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', forbidden: 'data:' },
    { html: '<iframe src="https://evil.example/"></iframe>', forbidden: 'iframe' },
    { html: '<object data="https://evil.example/x.swf"></object>', forbidden: 'object' },
    { html: '<svg onload="alert(1)"><circle r="1"/></svg>', forbidden: 'onload' },
    { html: '<style>body{display:none}</style><p>x</p>', forbidden: 'display' },
    { html: '<form action="https://evil.example/"><input name="pw"></form>', forbidden: 'form' },
    { html: '<p style="background:url(https://evil.example/b.png)">x</p>', forbidden: 'url(' },
    { html: '<base href="https://evil.example/">', forbidden: 'base' },
  ];

  /**
   * Assert that a payload's forbidden fragment is absent after sanitization
   *
   * @param html - Raw HTML fragment to sanitize
   * @param forbidden - Substring that must not appear in the output
   * @example
   * ```typescript
   * HtmlSanitizerTestUtils.expectStripped('<script>x</script>', 'script');
   * ```
   * @since 1.10.0
   */
  static expectStripped(html: string, forbidden: string): void {
    const result = sanitizeJobDescription(html);
    expect(result.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
}

describe('sanitizeJobDescription', () => {
  describe('when given allowlisted formatting', () => {
    it('should preserve paragraphs, lists, emphasis and headings', () => {
      const html =
        '<h2>Role</h2><p>We need <strong>you</strong> to <em>build</em>.</p><ul><li>One</li><li>Two</li></ul>';

      expect(sanitizeJobDescription(html)).toBe(html);
    });

    it('should keep https anchors and force safe rel attributes', () => {
      const result = sanitizeJobDescription('<a href="https://example.com/apply">Apply</a>');

      expect(result).toContain('href="https://example.com/apply"');
      expect(result).toContain('rel="noopener noreferrer nofollow"');
    });

    it('should drop non-allowlisted attributes while keeping the element', () => {
      const result = sanitizeJobDescription('<p class="x" id="y" data-track="z">Text</p>');

      expect(result).toBe('<p>Text</p>');
    });
  });

  describe('when given dangerous markup', () => {
    it.each(HtmlSanitizerTestUtils.DANGEROUS_PAYLOADS)(
      'should strip $forbidden from $html',
      ({ html, forbidden }) => {
        HtmlSanitizerTestUtils.expectStripped(html, forbidden);
      }
    );

    it('should discard script contents rather than unwrapping them as text', () => {
      expect(sanitizeJobDescription('<p>Hi</p><script>evil()</script>')).toBe('<p>Hi</p>');
    });

    it('should strip protocol-relative and unknown-scheme hrefs', () => {
      expect(sanitizeJobDescription('<a href="//evil.example/x">x</a>')).toBe(
        '<a rel="noopener noreferrer nofollow">x</a>'
      );
      expect(sanitizeJobDescription('<a href="vbscript:x">x</a>')).not.toContain('vbscript');
    });
  });

  describe('when given unusual input', () => {
    it('should return an empty string for non-string values', () => {
      expect(sanitizeJobDescription(undefined)).toBe('');
      expect(sanitizeJobDescription(null)).toBe('');
      expect(sanitizeJobDescription(42)).toBe('');
      expect(sanitizeJobDescription({ html: '<p>x</p>' })).toBe('');
    });

    it('should return an empty string for empty input', () => {
      expect(sanitizeJobDescription('')).toBe('');
    });

    it('should bound the output at MAX_DESCRIPTION_LENGTH', () => {
      const oversized = `<p>${'a'.repeat(MAX_DESCRIPTION_LENGTH + 1000)}</p>`;

      expect(sanitizeJobDescription(oversized).length).toBe(MAX_DESCRIPTION_LENGTH);
    });
  });
});
