import { getTrustedClientIp } from "./trustedClientIp";

/**
 * The originating client IP of a request, for rate limits, abuse checks and audit records.
 *
 * Reads only headers the hosting edge sets (see helpers/trustedClientIp). It used to take the first
 * X-Forwarded-For entry, then X-Real-IP, then CF-Connecting-IP, but on this hosting all three come
 * straight from the browser, so any client could choose its own IP and slip past IP-based limits.
 *
 * Returns null when no edge header is present (e.g. local/dev requests) - callers should treat a
 * null IP as "unknown" and skip IP-based checks rather than blocking the request outright.
 */
export function getClientIp(request: Request): string | null {
  return getTrustedClientIp(request);
}
