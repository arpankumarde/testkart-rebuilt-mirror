import type { ContentReportCategory, ContentReportCopyrightMaterial, ContentReportStatus } from "./schema";

/**
 * Shared by the public "Report an Issue" bar, the submit endpoint and the admin Content reports
 * page. Which pages carry the bar is decided by classifyContentReportPath alone: a path it does not
 * recognise (admin, login, checkout, dashboards, portals) gets no bar and is refused by the server.
 */

export const CONTENT_REPORT_CATEGORIES: readonly { value: ContentReportCategory; label: string }[] = [
  { value: "incorrect_information", label: "Incorrect Information" },
  { value: "outdated_information", label: "Outdated Information" },
  { value: "typo", label: "Typographical / Spelling Mistake" },
  { value: "broken_link", label: "Broken Link" },
  { value: "incorrect_answer", label: "Incorrect Answer or Explanation" },
  { value: "missing_information", label: "Missing Information" },
  { value: "copyright_violation", label: "Copyright Violation" },
  { value: "other", label: "Other" },
];

export const CONTENT_REPORT_CATEGORY_VALUES = CONTENT_REPORT_CATEGORIES.map((c) => c.value) as [
  ContentReportCategory,
  ...ContentReportCategory[],
];

export const CONTENT_REPORT_CATEGORY_LABELS = Object.fromEntries(
  CONTENT_REPORT_CATEGORIES.map((c) => [c.value, c.label])
) as Record<ContentReportCategory, string>;

export const COPYRIGHT_CATEGORY: ContentReportCategory = "copyright_violation";

export const COPYRIGHT_MATERIAL_TYPES: readonly { value: ContentReportCopyrightMaterial; label: string }[] = [
  { value: "text", label: "Text / Article" },
  { value: "image", label: "Image / Illustration" },
  { value: "video", label: "Video" },
  { value: "document", label: "PDF / Document" },
  { value: "other", label: "Other" },
];

export const COPYRIGHT_MATERIAL_VALUES = COPYRIGHT_MATERIAL_TYPES.map((m) => m.value) as [
  ContentReportCopyrightMaterial,
  ...ContentReportCopyrightMaterial[],
];

export const COPYRIGHT_MATERIAL_LABELS = Object.fromEntries(
  COPYRIGHT_MATERIAL_TYPES.map((m) => [m.value, m.label])
) as Record<ContentReportCopyrightMaterial, string>;

export const CONTENT_REPORT_STATUSES: readonly { value: ContentReportStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

export const CONTENT_REPORT_STATUS_VALUES = CONTENT_REPORT_STATUSES.map((s) => s.value) as [
  ContentReportStatus,
  ...ContentReportStatus[],
];

export const CONTENT_REPORT_STATUS_LABELS = Object.fromEntries(
  CONTENT_REPORT_STATUSES.map((s) => [s.value, s.label])
) as Record<ContentReportStatus, string>;

export const CONTENT_REPORT_TYPES = {
  exam: "Exam overview",
  exam_page: "Exam subpage",
  blog_post: "Blog post",
  help_article: "Help article",
  current_affairs: "Current affairs",
  exam_news: "Exam news",
  glossary_term: "Glossary term",
  course: "Course",
  study_note: "Study notes",
  mock_test: "Test series",
  live_test: "Live test",
  bundle: "Bundle",
  masterclass: "Masterclass",
  press: "Press / news",
  listing: "Listing page",
  page: "Information page",
} as const;

export type ContentReportType = keyof typeof CONTENT_REPORT_TYPES;

export const CONTENT_REPORT_TYPE_VALUES = Object.keys(CONTENT_REPORT_TYPES) as [
  ContentReportType,
  ...ContentReportType[],
];

export type ContentReportTarget = {
  contentType: ContentReportType;
  /** The content's own slug, or the listing's path segment. */
  slug: string | null;
  /** The exam slug on an exam subpage. */
  parentSlug: string | null;
};

const ARCHIVE_TYPES = new Set(["daily", "weekly", "monthly"]);

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment).toLowerCase();
  } catch {
    return segment.toLowerCase();
  }
};

const target = (
  contentType: ContentReportType,
  slug: string | null = null,
  parentSlug: string | null = null
): ContentReportTarget => ({ contentType, slug, parentSlug });

/** Section roots whose index is a listing and whose single child segment is one item. */
const SIMPLE_SECTIONS: Record<string, ContentReportType> = {
  blog: "blog_post",
  help: "help_article",
  glossary: "glossary_term",
  "study-notes": "study_note",
  bundles: "bundle",
  masterclass: "masterclass",
  press: "press",
  "news-and-events": "press",
};

/** Optional phone number: 7 to 15 digits, with an optional leading + and spaces or dashes. */
export const REPORT_PHONE_PATTERN = /^\+?[0-9][0-9\s-]{5,18}[0-9]$/;

export const isValidReportPhone = (value: string): boolean => {
  const digits = value.replace(/\D/g, "").length;
  return REPORT_PHONE_PATTERN.test(value) && digits >= 7 && digits <= 15;
};

/** The public content a path shows, or null when the path is not a reportable content page. */
export function classifyContentReportPath(pathname: string): ContentReportTarget | null {
  const segments = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean).map(decode);
  const [root, first, second, third] = segments;
  if (!root || segments.length > 3) return null;

  const simple = SIMPLE_SECTIONS[root];
  if (simple) {
    if (!first) return target("listing", root);
    return second ? null : target(simple, first);
  }

  switch (root) {
    case "exams":
      if (!first) return target("listing", root);
      if (!second) return target("exam", first);
      return third ? null : target("exam_page", second, first);
    case "current-affairs":
      if (!first) return target("listing", root);
      if (!second) return ARCHIVE_TYPES.has(first) ? target("listing", `${root}/${first}`) : target("current_affairs", first);
      return third ? null : target("current_affairs", second, first);
    case "exam-news":
      if (!first) return target("listing", root);
      if (first === "page" || first === "type") return target("listing", root);
      return second ? null : target("exam_news", first);
    case "course":
      if (!first) return target("listing", root);
      if (first === "live") return null;
      return second ? null : target("course", first);
    case "mock-test":
      if (!first) return target("listing", root);
      if (first === "live") {
        if (!second) return target("listing", `${root}/live`);
        return third ? null : target("live_test", second);
      }
      return second ? null : target("mock_test", first);
    case "govt-exams-calendar":
      return first ? null : target("page", root);
    default:
      return null;
  }
}