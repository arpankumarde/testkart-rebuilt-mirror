import type { LucideIcon } from "lucide-react";
import { ListChecks, MonitorPlay, FileText, Radio, Package } from "lucide-react";
import type { ContentKind } from "../endpoints/admin/catalogue/dashboard_GET.schema";

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  mock_test: "Test series",
  course: "Courses",
  digital_product: "Study notes",
  live_test: "Live tests",
  course_bundle: "Bundles",
};

export const CONTENT_KIND_SINGULAR: Record<ContentKind, string> = {
  mock_test: "Test series",
  course: "Course",
  digital_product: "Study note",
  live_test: "Live test",
  course_bundle: "Bundle",
};

export const CONTENT_KIND_COLORS: Record<ContentKind, string> = {
  mock_test: "var(--chart-color-1)",
  course: "var(--chart-color-5)",
  digital_product: "var(--chart-color-2)",
  live_test: "var(--chart-color-4)",
  course_bundle: "var(--chart-color-3)",
};

export const CONTENT_KIND_HREFS: Record<ContentKind, string> = {
  mock_test: "/admin/test-series",
  course: "/admin/courses",
  digital_product: "/admin/notes",
  live_test: "/admin/live-tests",
  course_bundle: "/admin/bundles",
};

/** Opens the type's list focused on one item, with its detail panel open. */
export const contentItemHref = (kind: ContentKind, id: number): string =>
  `${CONTENT_KIND_HREFS[kind]}?id=${id}`;

export const CONTENT_KIND_ICONS: Record<ContentKind, LucideIcon> = {
  mock_test: ListChecks,
  course: MonitorPlay,
  digital_product: FileText,
  live_test: Radio,
  course_bundle: Package,
};

/** Live tests and bundles have no draft state, only an unpublished one. */
export const CONTENT_DRAFT_LABELS: Record<ContentKind, string> = {
  mock_test: "Draft",
  course: "Draft",
  digital_product: "Draft",
  live_test: "Inactive",
  course_bundle: "Unpublished",
};

/** What one unit of engagement means for each type. */
export const CONTENT_ENGAGEMENT_LABELS: Record<ContentKind, [string, string]> = {
  mock_test: ["attempt", "attempts"],
  course: ["enrolment", "enrolments"],
  digital_product: ["purchase", "purchases"],
  live_test: ["enrolment", "enrolments"],
  course_bundle: ["enrolment", "enrolments"],
};
