/**
 * Sanitizes a URL value, converting null/undefined/"null"/"undefined" strings to null.
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || url === "null" || url === "undefined") return null;
  return url;
}