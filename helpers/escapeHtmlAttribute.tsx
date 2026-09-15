/**
 * Escapes special characters in a string to safely use it as an HTML attribute value.
 * Prevents XSS attacks by encoding ampersands, less-than, greater-than, and quote characters.
 */
export const escapeHtmlAttribute = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};