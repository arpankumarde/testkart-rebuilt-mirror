/**
 * Extracts the R2 object key from a URL or key string.
 * If the input is a full URL, the path portion (minus leading slash) is returned as the key.
 * If the input is already a key (not a valid URL), it is returned as-is.
 */
export function extractR2Key(urlOrKey: string): string {
  try {
    const url = new URL(urlOrKey);
    return url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
  } catch {
    // Already a key
    return urlOrKey;
  }
}