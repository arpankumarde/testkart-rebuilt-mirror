import type { LucideIcon } from "lucide-react";
import { BookCopy, BookOpen, FileText, Package, Radio } from "lucide-react";
import type { TeacherMixKind } from "../endpoints/teacher/dashboard/overview_GET.schema";

export type TeacherContentKind = TeacherMixKind;

export type TeacherContentKindMeta = {
  kind: TeacherContentKind;
  label: string;
  plural: string;
  icon: LucideIcon;
  createPath: string;
  listPath: string;
  /** One plain sentence on what the type is, for the create chooser and empty states. */
  pitch: string;
  /** Two or three words under the label on the Overview's first-item tiles. */
  hint: string;
};

/**
 * The one list of what a teacher can make, in the order the console shows it.
 * The create chooser, the Overview shelf, the sidebar and empty states all read
 * from here, so a label or route changes in one place. Colours live in
 * components/TeacherConsoleTheme, keyed by the same kind.
 */
export const TEACHER_CONTENT_KINDS: TeacherContentKindMeta[] = [
  {
    kind: "mock_test",
    label: "Test series",
    plural: "Test series",
    icon: BookCopy,
    createPath: "/teacher/create-test",
    listPath: "/teacher/test-series",
    pitch: "Full mocks and sectional tests that students attempt online.",
    hint: "Mock tests",
  },
  {
    kind: "course",
    label: "Course",
    plural: "Courses",
    icon: BookOpen,
    createPath: "/teacher/courses/create",
    listPath: "/teacher/courses",
    pitch: "Video lessons arranged in sections.",
    hint: "Video lessons",
  },
  {
    kind: "digital_product",
    label: "Notes and PDFs",
    plural: "Notes and PDFs",
    icon: FileText,
    createPath: "/teacher/products/create",
    listPath: "/teacher/products",
    pitch: "Study material students read on Testkart.",
    hint: "PDF study material",
  },
  {
    kind: "live_test",
    label: "Live test",
    plural: "Live tests",
    icon: Radio,
    createPath: "/teacher/create-live-test",
    listPath: "/teacher/live-tests",
    pitch: "One scheduled test with a rank list and optional prizes.",
    hint: "One test, one time",
  },
  {
    kind: "bundle",
    label: "Bundle",
    plural: "Bundles",
    icon: Package,
    createPath: "/teacher/bundles/create",
    listPath: "/teacher/bundles",
    pitch: "Several of your published items sold together at one price.",
    hint: "Items sold together",
  },
];

const BY_KIND = Object.fromEntries(TEACHER_CONTENT_KINDS.map((meta) => [meta.kind, meta])) as Record<
  TeacherContentKind,
  TeacherContentKindMeta
>;

export const teacherContentKind = (kind: TeacherContentKind): TeacherContentKindMeta => BY_KIND[kind];

/** Where a teacher edits one item of a kind; rejection notes show on each of these pages. */
export const teacherContentEditPath = (kind: TeacherContentKind, id: number): string => {
  switch (kind) {
    case "mock_test":
      return `/teacher/create-test/${id}/test-items`;
    case "course":
      return `/teacher/courses/${id}/edit`;
    case "digital_product":
      return `/teacher/products/${id}/edit`;
    case "bundle":
      return `/teacher/bundles/${id}/edit`;
    case "live_test":
      return `/teacher/live-test/${id}/edit`;
  }
};

/** The stage panel's headline and button for a teacher's very first item of a kind. */
export const TEACHER_FIRST_ITEM_COPY: Record<TeacherContentKind, { headline: string; action: string }> = {
  mock_test: { headline: "Create your first test series", action: "Create test series" },
  course: { headline: "Create your first course", action: "Create course" },
  digital_product: { headline: "Upload your first notes or PDF", action: "Upload notes" },
  live_test: { headline: "Schedule your first live test", action: "Schedule live test" },
  bundle: { headline: "Create your first bundle", action: "Create bundle" },
};

/** bundles/create and bundles/publish refuse fewer items than this, and publishing needs them all live. */
export const BUNDLE_MIN_PUBLISHED_ITEMS = 2;