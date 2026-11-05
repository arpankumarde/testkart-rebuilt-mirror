/**
 * Rules for autopilot click links (endpoints/go_GET): where a link may send
 * people, and which requests are link previews or scanners rather than a
 * person clicking. Pure, shared by the endpoint and its spec.
 */

const SITE_ORIGIN = "https://testkart.in";

/** A same-site path to redirect to, or null for anything that could leave testkart.in. */
export function safeRedirectPath(path: string | null | undefined): string | null {
  if (typeof path !== "string" || path.length === 0 || path.length > 500) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  if (/[\x00-\x1f\x7f\\]/.test(path)) return null;
  let url: URL;
  try {
    url = new URL(path, SITE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== SITE_ORIGIN) return null;
  if (url.pathname.startsWith("/_api/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

const PREVIEW_AGENTS =
  /(whatsapp|facebookexternalhit|facebot|slackbot|twitterbot|telegrambot|linkedinbot|discordbot|skypeuripreview|googlebot|bingbot|bingpreview|googleimageproxy|applebot|yahoo! slurp|embedly|pinterest|redditbot|headlesschrome|python-requests|curl\/|wget\/|go-http-client|okhttp\/|axios\/|node-fetch|preview|scanner|crawler|spider)/i;

/**
 * True when a request to a click link is a preview fetch, a link scanner or a
 * prefetch, which must not count as a click. Some mail scanners use ordinary
 * browser agents, so click counts stay an upper bound; conversions decide impact.
 */
export function isLinkPrefetch(method: string, headers: Headers): boolean {
  if (method.toUpperCase() === "HEAD") return true;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""} ${headers.get("x-purpose") ?? ""}`;
  if (/prefetch|preview/i.test(purpose)) return true;
  const agent = headers.get("user-agent") ?? "";
  if (!agent) return true;
  return PREVIEW_AGENTS.test(agent);
}