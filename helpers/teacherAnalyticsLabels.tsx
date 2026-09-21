import type { TeacherMixKind } from "../endpoints/teacher/dashboard/overview_GET.schema";
import type { AnalyticsRange, AnalyticsBucket } from "./teacherAnalyticsTime";
import { adminFormat } from "./adminFormat";

export const ANALYTICS_KIND_LABELS: Record<TeacherMixKind, string> = {
  mock_test: "Test series",
  live_test: "Live test",
  course: "Course",
  digital_product: "Study notes",
  bundle: "Bundle",
};

export const ANALYTICS_KIND_PLURALS: Record<TeacherMixKind, string> = {
  mock_test: "Test series",
  live_test: "Live tests",
  course: "Courses",
  digital_product: "Study notes",
  bundle: "Bundles",
};

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
};

/** Where a teacher edits an item, for links out of the Analytics tables. */
export const analyticsEditHref = (kind: TeacherMixKind, id: number): string => {
  switch (kind) {
    case "mock_test":
      return `/teacher/test/${id}/edit`;
    case "live_test":
      return `/teacher/live-test/${id}/questions`;
    case "course":
      return `/teacher/courses/${id}/edit`;
    case "digital_product":
      return `/teacher/products/${id}/edit`;
    case "bundle":
      return `/teacher/bundles/${id}/edit`;
  }
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" to "Sep 2026" (long) or "Sep" (short). */
export const monthLabel = (month: string, long = false): string => {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;
  return long ? `${MONTHS[index - 1]} ${year}` : MONTHS[index - 1];
};

/** Axis and tooltip text for a series bucket: "6 Sep" for days, "Sep" / "Sep 2026" for months. */
export const bucketLabel = (bucket: string, kind: AnalyticsBucket, long = false): string =>
  kind === "month" ? monthLabel(bucket, long) : adminFormat.dayLabel(bucket);

export const percent = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
};

/** Where a visit came from, as classified by analytics/track. */
export const SOURCE_LABELS: Record<string, string> = {
  share_whatsapp: "WhatsApp link",
  share_telegram: "Telegram link",
  share_facebook: "Facebook link",
  share_x: "X link",
  share_linkedin: "LinkedIn link",
  share_email: "Email link",
  share_copy: "Copied link",
  campaign: "Other tagged links",
  search: "Google and other search",
  social: "Social media",
  internal: "Testkart pages",
  referral: "Other websites",
  direct: "Direct or app",
};

/** utm_campaign values: which share surface a link came from. */
export const CAMPAIGN_LABELS: Record<string, string> = {
  teacher_share: "Shared from your console",
  expert_profile_share: "Shared from your profile page",
  public_page_share: "Shared from a product page",
  certificate_share: "Student certificates",
  course_completion_share: "Course completion posts",
};

export const PLATFORM_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  x: "X",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  email: "Email",
  copy: "Copy link",
};

export const ENTITY_LABELS: Record<string, string> = {
  teacher_profile: "Your profile",
  mock_test: "Test series",
  live_test: "Live tests",
  course: "Courses",
  digital_product: "Study notes",
  bundle: "Bundles",
};

export const DEVICE_LABELS: Record<string, string> = {
  mobile: "Phone",
  tablet: "Tablet",
  desktop: "Computer",
  unknown: "Unknown",
};

export const labelFor = (labels: Record<string, string>, key: string): string => labels[key] ?? key.replace(/_/g, " ");

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

/** DD-MM-YYYY, the date style used across the teacher console's notes. */
export const shortDate = (value: Date | string): string => dateFormatter.format(new Date(value)).replace(/\//g, "-");