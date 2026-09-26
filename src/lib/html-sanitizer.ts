/**
 * HTML sanitizer for scraped job descriptions
 *
 * Job descriptions arrive as raw `innerHTML` from a third-party careers page.
 * That HTML is authored by whoever administers the DriveHR tenant, travels
 * through this pipeline signed with the WordPress secret, and is rendered on
 * a public page. Nothing about the source is trusted, so the description is
 * reduced to a small allowlist of formatting elements before it is signed.
 *
 * WordPress applies `wp_kses_post()` independently on receipt; the two
 * filters are defence in depth, not alternatives.
 *
 * @module html-sanitizer
 * @since 1.10.0
 * @see {@link https://github.com/apostrophecms/sanitize-html} for the underlying library
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Elements permitted in a job description
 *
 * Structural and inline formatting only. No media, no embeds, no forms,
 * no tables (DriveHR descriptions are prose), no headings above h2.
 *
 * @since 1.10.0
 */
const ALLOWED_TAGS: readonly string[] = [
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'h2',
  'h3',
  'h4',
  'a',
  'blockquote',
];

/**
 * Attributes permitted per element
 *
 * Only anchors keep attributes: `href`, whose scheme `sanitize-html` validates
 * against {@link ALLOWED_SCHEMES} (dropping `javascript:` and `data:` URLs),
 * and `rel`, which the anchor transform below always overwrites with a fixed
 * safe value so a feed-supplied `rel` never survives.
 *
 * @since 1.10.0
 */
const ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'rel'],
};

/**
 * URL schemes permitted on anchor hrefs
 *
 * @since 1.10.0
 */
const ALLOWED_SCHEMES: readonly string[] = ['http', 'https', 'mailto'];

/**
 * Upper bound on a description after sanitization, in characters
 *
 * Matches the WordPress plugin's MAX_DESCRIPTION_LENGTH so a description the
 * scraper sends is never silently truncated on the other end.
 *
 * @since 1.10.0
 */
export const MAX_DESCRIPTION_LENGTH = 262144;

/**
 * Sanitize a scraped job description for storage and public rendering
 *
 * Removes every element and attribute outside the allowlist, discards the
 * contents of `script`, `style`, `iframe`, `object` and similar elements
 * rather than unwrapping them, forces anchors to open safely, and bounds the
 * result length.
 *
 * @param html - Raw description HTML from the careers page; non-strings yield ''
 * @returns Sanitized HTML containing only allowlisted markup
 * @example
 * ```typescript
 * sanitizeJobDescription('<p onclick="x()">Hi <script>evil()</script></p>');
 * // Returns: '<p>Hi </p>'
 * ```
 * @since 1.10.0
 */
export function sanitizeJobDescription(html: unknown): string {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }

  const clean = sanitizeHtml(html, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: Object.fromEntries(
      Object.entries(ALLOWED_ATTRIBUTES).map(([tag, attrs]) => [tag, [...attrs]])
    ),
    allowedSchemes: [...ALLOWED_SCHEMES],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }, true),
    },
  }).trim();

  return clean.length > MAX_DESCRIPTION_LENGTH ? clean.slice(0, MAX_DESCRIPTION_LENGTH) : clean;
}
