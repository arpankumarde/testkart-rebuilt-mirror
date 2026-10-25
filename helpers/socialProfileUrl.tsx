// Turns whatever a teacher typed into a social link field into a safe,
// absolute URL, or null when it is not a link at all. Pure, so it runs on the
// server render and the client alike.

export type SocialPlatform = "youtube" | "instagram" | "linkedin" | "twitter" | "telegram" | "facebook";

/** Where a bare "@handle" points, for the platforms whose handles map to one URL. */
const HANDLE_URL: Partial<Record<SocialPlatform, (handle: string) => string>> = {
  youtube: (h) => `https://www.youtube.com/@${h}`,
  instagram: (h) => `https://www.instagram.com/${h}`,
  twitter: (h) => `https://x.com/${h}`,
  telegram: (h) => `https://t.me/${h}`,
};

/**
 * Accepts full URLs, scheme-less links ("instagram.com/name") and, where the
 * platform allows it, "@handle". Rejects placeholders such as "no", "NA", "-"
 * and plain names, and anything that is not http(s) with a dotted host.
 */
export const normalizeSocialUrl = (platform: SocialPlatform, value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const handle = raw.match(/^@([A-Za-z0-9_.]{2,64})$/);
  if (handle) return HANDLE_URL[platform]?.(handle[1]) ?? null;

  if (/\s/.test(raw)) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw);
  if (!hasScheme && !/^[^/]+\.[a-z]{2,}(\/|$)/i.test(raw)) return null;
  try {
    const url = new URL(hasScheme ? raw : `https://${raw}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
};