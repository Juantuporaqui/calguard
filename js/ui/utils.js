/**
 * @module ui/utils
 * Shared UI helpers
 */

/**
 * Escape text for interpolation into HTML (element content and
 * double-quoted attribute values). Use on ANY value that does not
 * come from a code constant: names parsed from imported files,
 * user notes, labels, etc.
 * @param {*} str
 * @returns {string}
 */
export function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
