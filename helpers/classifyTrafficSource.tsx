const SHARE_SOURCES: Record<string, string> = {
  whatsapp: "share_whatsapp",
  facebook: "share_facebook",
  x: "share_x",
  telegram: "share_telegram",
  linkedin: "share_linkedin",
  email: "share_email",
  copy_link: "share_copy",
};

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z.]+|ecosia\.org)$/;
const SOCIAL_HOSTS =
  /(^|\.)(facebook\.com|fb\.com|instagram\.com|t\.co|x\.com|twitter\.com|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|t\.me|telegram\.org|whatsapp\.com|reddit\.com|quora\.com|threads\.net)$/;
const OWN_HOSTS = /(^|\.)(testkart\.in|floot\.app)$/;

/**
 * Where a visit came from, decided on the server rather than trusted from the
 * client: a Testkart share link (share_<platform>), another tagged link
 * (campaign), search, social, Testkart itself, another site, or no referrer at
 * all. Shared by the storefront tracker and the autopilot's funnel events.
 */
export function classifyTrafficSource(
  utmSource: string | null | undefined,
  referrerHost: string | null | undefined
): string {
  if (utmSource) return SHARE_SOURCES[utmSource] ?? "campaign";
  if (!referrerHost) return "direct";
  if (OWN_HOSTS.test(referrerHost)) return "internal";
  if (SEARCH_HOSTS.test(referrerHost)) return "search";
  if (SOCIAL_HOSTS.test(referrerHost)) return "social";
  return "referral";
}