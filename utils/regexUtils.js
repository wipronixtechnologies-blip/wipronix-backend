/**
 * Safely escapes regular expression special characters in user input.
 * Note: Spaces are intentionally NOT escaped as MongoDB PCRE regex handles spaces literally,
 * and escaping spaces (\ ) causes MongoDB regex mismatches.
 *
 * @param {string} string - The input string to escape
 * @returns {string} - Regex-safe escaped string
 */
const escapeRegex = (string) => {
  if (!string || typeof string !== 'string') return '';
  return string.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
};

module.exports = { escapeRegex };
