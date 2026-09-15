/**
 * Best-effort extraction of the originating client IP address from an
 * incoming Request. The app sits behind a CDN/reverse proxy, so the real
 * client address arrives in a forwarding header rather than as a direct
 * socket address.
 *
 * Returns null if no forwarding header is present (e.g. local/dev requests) -
 * callers should treat a null IP as "unknown" and skip IP-based checks
 * rather than blocking the request outright.
 */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list; the first entry is the
    // original client.
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  return null;
}
