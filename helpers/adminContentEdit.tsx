import type { AdminModule } from "./adminPermissions";

/**
 * Admins edit a teacher's catalogue item inside the admin panel with the teacher's own editor.
 * The editor keeps calling the teacher endpoints, carrying a short-lived session for the item's
 * teacher that is marked with the content type. That session only reaches the teacher routes
 * listed here, and only while the admin who opened it still holds the matching section.
 */
export const ADMIN_EDIT_TYPES = ["digital_product", "course_bundle", "course", "live_test", "mock_test"] as const;

export type AdminEditType = (typeof ADMIN_EDIT_TYPES)[number];

export const isAdminEditType = (value: unknown): value is AdminEditType =>
  typeof value === "string" && (ADMIN_EDIT_TYPES as readonly string[]).includes(value);

export const ADMIN_EDIT_MODULES: Record<AdminEditType, AdminModule> = {
  digital_product: "notes",
  course_bundle: "bundles",
  course: "courses",
  live_test: "live_tests",
  mock_test: "test_series",
};

export const ADMIN_EDIT_LABELS: Record<AdminEditType, string> = {
  digital_product: "study note",
  course_bundle: "bundle",
  course: "course",
  live_test: "live test",
  mock_test: "test series",
};

/* Subjects, sections and questions of a test, shared by test series and live tests. */
const QUESTION_ROUTES = [
  "teacher/test-item-subjects/",
  "teacher/subject-sections/",
  "teacher/questions/",
  "teacher/question-bank/list",
  "teacher/question-bank/import-to-test",
  "teacher/test-item/download-pdf",
  "teacher/exam-subjects/by-exam",
  "teacher/tests/list",
  "teacher/test-items/list",
] as const;

/* AI runs on the teacher's credits, so it stays out even under an allowed prefix. */
const DENIED_ROUTES = ["teacher/questions/generate-ai", "teacher/questions/accept-ai"];

/*
 * Route keys after /_api/; a key ending in "/" allows everything under it. Publishing, deleting
 * the item itself, AI tools and anything about money stay out.
 */
const EDIT_ROUTES: Record<AdminEditType, readonly string[]> = {
  digital_product: [
    "teacher/products/details",
    "teacher/products/update",
    "teacher/products/pdf-page-count",
  ],
  // The item pickers list the teacher's own courses, tests and notes.
  course_bundle: [
    "teacher/bundles/details",
    "teacher/bundles/update",
    "teacher/courses/list",
    "teacher/tests/list",
    "teacher/products/list",
  ],
  // Chapters and lessons are part of the course's content, so they can be added, changed and removed.
  course: [
    "teacher/courses/details",
    "teacher/courses/update",
    "teacher/courses/list",
    "teacher/course-sections/",
    "teacher/course-lessons/",
    "teacher/assets/list",
    "teacher/assets/create",
  ],
  // Prize changes are refused server-side for these sessions (teacher/live-tests/update).
  live_test: ["teacher/live-test/details", "teacher/live-tests/update", ...QUESTION_ROUTES],
  // Tests inside the series can be added, changed, reordered and moved to Trash.
  mock_test: ["teacher/tests/update", "teacher/test-items/", ...QUESTION_ROUTES],
};

const UPLOAD_ROUTE_PREFIXES = ["upload/presign", "upload/delete", "upload/multipart/"];

export function isAdminEditRouteAllowed(type: AdminEditType, pathname: string): boolean {
  const key = pathname.replace(/^\/+/, "").replace(/^_api\//, "").replace(/\/+$/, "");
  if (DENIED_ROUTES.includes(key)) return false;
  const matches = (rule: string) => (rule.endsWith("/") ? key.startsWith(rule) : key === rule);
  return EDIT_ROUTES[type].some(matches) || UPLOAD_ROUTE_PREFIXES.some((p) => key === p || key.startsWith(p));
}

/** Where the admin editor for an item lives, or null for a type with no admin editor yet. */
export function adminEditPath(type: string, id: number): string | null {
  switch (type) {
    case "digital_product":
      return `/admin/notes/${id}/edit`;
    case "course_bundle":
      return `/admin/bundles/${id}/edit`;
    case "course":
      return `/admin/courses/${id}/edit`;
    case "live_test":
      return `/admin/live-tests/${id}/edit`;
    case "mock_test":
      return `/admin/test-series/${id}/edit`;
    default:
      return null;
  }
}
