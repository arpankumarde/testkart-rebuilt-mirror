/**
 * Canonical public URLs for everything the site lets people share, and the
 * UTM-tagged links built for them. Every share surface in the app - the teacher
 * console cards, the public asset pages, the blog, knowledge base, news and
 * careers pages, the certificate pages - routes through here and through
 * ShareAssetDialog, so a shared Testkart link always carries the same three tags.
 *
 * UTM scheme - the standard reading of each field, so the numbers land in the
 * right buckets in analytics:
 *   utm_source    where the click comes FROM: whatsapp, facebook, x, ...
 *   utm_medium    the channel type: social, email, or copy for a pasted link
 *   utm_campaign  which share surface produced the link (see the constants
 *                 below); never a user's role, which says nothing about where
 *                 the link came from
 */

/** The public site. The app also runs on other origins (preview, sandbox), so
    a shared link must never be built from window.location. */
export const SITE_ORIGIN = "https://testkart.in";

export type ShareAssetKind =
  | "test-series"
  | "live-test"
  | "course"
  | "bundle"
  | "study-note"
  | "expert"
  | "blog-post"
  | "help-article"
  | "certificate"
  | "exam-page"
  | "news"
  | "career";

export const SHARE_ASSET_LABELS: Record<ShareAssetKind, string> = {
  "test-series": "test series",
  "live-test": "live test",
  course: "course",
  bundle: "bundle",
  "study-note": "study notes",
  expert: "profile",
  "blog-post": "article",
  "help-article": "article",
  certificate: "certificate",
  "exam-page": "page",
  news: "story",
  career: "job",
};

/** `handle` is the slug for everything except live tests, which are routed by
    id, certificates, which are routed by certificate number, and exam pages,
    which take "<examSlug>/<section slug>". */
export const buildPublicAssetUrl = (kind: ShareAssetKind, handle: string | number): string => {
  const segment = encodeURIComponent(String(handle));
  switch (kind) {
    case "exam-page":
      return `${SITE_ORIGIN}/exams/${String(handle).split("/").map(encodeURIComponent).join("/")}`;
    case "test-series":
      return `${SITE_ORIGIN}/mock-test/${segment}`;
    case "live-test":
      return `${SITE_ORIGIN}/mock-test/live/${segment}`;
    case "course":
      return `${SITE_ORIGIN}/course/${segment}`;
    case "bundle":
      return `${SITE_ORIGIN}/bundles/${segment}`;
    case "study-note":
      return `${SITE_ORIGIN}/study-notes/${segment}`;
    case "expert":
      return `${SITE_ORIGIN}/expert/${segment}`;
    case "blog-post":
      return `${SITE_ORIGIN}/blog/${segment}`;
    case "help-article":
      return `${SITE_ORIGIN}/help/${segment}`;
    case "certificate":
      return `${SITE_ORIGIN}/certificates/${segment}`;
    case "news":
      return `${SITE_ORIGIN}/news-and-events/${segment}`;
    case "career":
      return `${SITE_ORIGIN}/careers/${segment}`;
  }
};

export type SharePlatformId =
  | "whatsapp"
  | "facebook"
  | "x"
  | "telegram"
  | "linkedin"
  | "email"
  | "copy";

const PLATFORM_SOURCE: Record<SharePlatformId, string> = {
  whatsapp: "whatsapp",
  facebook: "facebook",
  x: "x",
  telegram: "telegram",
  linkedin: "linkedin",
  email: "email",
  copy: "copy_link",
};

const PLATFORM_MEDIUM: Record<SharePlatformId, string> = {
  whatsapp: "social",
  facebook: "social",
  x: "social",
  telegram: "social",
  linkedin: "social",
  email: "email",
  copy: "copy",
};

/**
 * The campaigns, one per share surface. They are separate because they answer
 * different questions and mixing them makes all of them unanswerable: how well
 * the console's share button works, how far a profile travels on its own, how
 * much traffic the catalogue and content pages refer to themselves, and how
 * strong the two student-side loops are - a finished certificate and a finished
 * course.
 *
 * ShareAssetDialog takes the campaign as a required prop rather than defaulting
 * to one, so a new share surface has to say which bucket it reports into.
 */
export const TEACHER_CONSOLE_SHARE_CAMPAIGN = "teacher_share";
export const EXPERT_PROFILE_SHARE_CAMPAIGN = "expert_profile_share";
export const PUBLIC_PAGE_SHARE_CAMPAIGN = "public_page_share";
export const CERTIFICATE_SHARE_CAMPAIGN = "certificate_share";
export const COURSE_COMPLETION_SHARE_CAMPAIGN = "course_completion_share";

/**
 * Tags a public URL for one platform. Existing query parameters are preserved;
 * utm_* keys are overwritten rather than appended, so re-tagging a URL that
 * already carries them cannot produce duplicates.
 */
export const buildTrackedShareUrl = (
  url: string,
  platform: SharePlatformId,
  campaign: string
): string => {
  try {
    const tagged = new URL(url, SITE_ORIGIN);
    tagged.searchParams.set("utm_source", PLATFORM_SOURCE[platform]);
    tagged.searchParams.set("utm_medium", PLATFORM_MEDIUM[platform]);
    tagged.searchParams.set("utm_campaign", campaign);
    return tagged.toString();
  } catch {
    // A malformed URL should not take the dialog down - hand back what we got.
    return url;
  }
};

/**
 * The platform's own share endpoint, pointed at an already-tagged URL.
 *
 * Facebook and LinkedIn accept only the URL and scrape the page for title and
 * image, so the message is dropped for those two by design - the UTM travels
 * in the link either way.
 */
export const buildShareIntentUrl = (
  platform: Exclude<SharePlatformId, "copy">,
  trackedUrl: string,
  message: string,
  subject: string
): string => {
  const url = encodeURIComponent(trackedUrl);
  const text = encodeURIComponent(message);

  switch (platform) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${message} ${trackedUrl}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    case "x":
      return `https://x.com/intent/post?text=${text}&url=${url}`;
    case "telegram":
      return `https://t.me/share/url?url=${url}&text=${text}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        `${message}\n\n${trackedUrl}`
      )}`;
  }
};
