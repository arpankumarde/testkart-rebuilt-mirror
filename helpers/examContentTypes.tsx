// Shared metadata for exam content management.
//
// Two overlapping sets, on purpose:
// - EXAM_CONTENT_PAGE_TYPES: the 4 page types that get a REAL, routable,
//   indexable URL at /exams/:examSlug/:slug (syllabus, exam pattern,
//   eligibility, cutoff) — used by public routing, the sitemap, and the
//   hub page's sub-nav. A slug only ever gets generated/linked for a type
//   that's actually published; nothing here is ever a blank or 404 page.
// - ADMIN_EXAM_SECTION_TYPES: everything the admin content editor manages,
//   which additionally includes "overview" — the content + FAQ block that
//   appears on the exam's own hub page, below the mock test grid. Overview
//   has NO separate URL/slug; its published content/FAQs are folded
//   directly into /exams/:examSlug. This replaces the old standalone
//   exams.additionalContent field — one editor for what shows below the
//   mock tests, instead of two.
//
// Every section (overview + the 4 silo pages) has a body content editor
// plus optional FAQs — neither is mandatory to publish, but at least one of
// the two must have something in it.
//
// On top of the fixed set, admins can add CUSTOM pages per exam (rows in
// exam_custom_pages). Their content lives in exam_content_pages like every
// other section, under the page type "custom:<slug>", and once published they
// get a routable URL at /exams/:examSlug/:slug just like the 4 silo types.

import { z } from "zod";

export const EXAM_CONTENT_PAGE_TYPES = [
  "syllabus",
  "exam_pattern",
  "eligibility",
  "cutoff",
] as const;

export type ExamContentPageType = (typeof EXAM_CONTENT_PAGE_TYPES)[number];

// The 4 product listing pages (/exams/:examSlug/mock-tests, /courses,
// /study-notes, /bundles) — unlike EXAM_CONTENT_PAGE_TYPES these are NOT
// silo pages (they always exist and render real products; the CMS only
// supplies an optional editable title/description/content/FAQ overlay), so
// they're deliberately kept out of EXAM_CONTENT_PAGE_TYPES/META, which drive
// the "redirect to hub if unpublished" silo routing and sitemap logic.
export const PRODUCT_PAGE_TYPES = ["mock_tests", "courses", "study_notes", "bundles"] as const;

export type ProductPageType = (typeof PRODUCT_PAGE_TYPES)[number];

export const ADMIN_EXAM_SECTION_TYPES = [
  "overview",
  ...EXAM_CONTENT_PAGE_TYPES,
  ...PRODUCT_PAGE_TYPES,
] as const;

export type AdminExamSectionType = (typeof ADMIN_EXAM_SECTION_TYPES)[number];

export interface ExamContentPageTypeMeta {
  type: ExamSectionPageType;
  // URL segment, e.g. /exams/ssc-cgl/exam-pattern — null for "overview",
  // which has no page of its own. For product page types this is the
  // existing route segment of that listing page (e.g. "mock-tests"), used
  // only to build the admin editor's "View live" link — publishing here
  // never creates or removes that page's URL, unlike the 4 silo types.
  slug: string | null;
  // Short label for admin UI tabs / nav
  label: string;
  // Longer description shown in the admin editor
  adminHint: string;
  // Used to build a default page title / SEO title when the admin hasn't set one
  titleSuffix: string;
  // Whether this section has a main content editor (the 4 silo types plus
  // the 4 product page types) or is FAQ-only (overview).
  hasBodyContent: boolean;
  // Whether this section also has an editable short "description" (a
  // subtitle line shown right under the page's H1) — currently only the 4
  // product page types render one.
  hasDescription?: boolean;
}

export const ADMIN_EXAM_SECTION_META: Record<AdminExamSectionType, ExamContentPageTypeMeta> = {
  overview: {
    type: "overview",
    slug: null,
    label: "Overview",
    adminHint: "Content and FAQs shown below the mock test listings on the exam's own page - what the exam is, who should take it, how to prepare.",
    titleSuffix: "Overview",
    hasBodyContent: true,
  },
  syllabus: {
    type: "syllabus",
    slug: "syllabus",
    label: "Syllabus",
    adminHint: "Subject/topic-wise breakdown of what's covered in the exam.",
    titleSuffix: "Syllabus",
    hasBodyContent: true,
  },
  exam_pattern: {
    type: "exam_pattern",
    slug: "exam-pattern",
    label: "Exam Pattern",
    adminHint: "Sections, question types, duration, and marking scheme.",
    titleSuffix: "Exam Pattern",
    hasBodyContent: true,
  },
  eligibility: {
    type: "eligibility",
    slug: "eligibility",
    label: "Eligibility",
    adminHint: "Education, age, and other eligibility criteria.",
    titleSuffix: "Eligibility Criteria",
    hasBodyContent: true,
  },
  cutoff: {
    type: "cutoff",
    slug: "cutoff",
    label: "Cutoff",
    adminHint: "How cutoffs work for this exam and what affects them. Avoid inventing specific numeric cutoffs - those belong in official sources.",
    titleSuffix: "Cutoff",
    hasBodyContent: true,
  },
  mock_tests: {
    type: "mock_tests",
    slug: "mock-tests",
    label: "Mock Tests Page",
    adminHint: "Optional title, description, and content for this exam's Mock Tests listing page. Leave blank to use the default title/description - the page always shows real mock tests regardless.",
    titleSuffix: "Mock Tests",
    hasBodyContent: true,
    hasDescription: true,
  },
  courses: {
    type: "courses",
    slug: "courses",
    label: "Courses Page",
    adminHint: "Optional title, description, and content for this exam's Courses listing page. Leave blank to use the default title/description - the page always shows real courses regardless.",
    titleSuffix: "Courses",
    hasBodyContent: true,
    hasDescription: true,
  },
  study_notes: {
    type: "study_notes",
    slug: "study-notes",
    label: "Study Notes Page",
    adminHint: "Optional title, description, and content for this exam's Study Notes listing page. Leave blank to use the default title/description - the page always shows real study notes regardless.",
    titleSuffix: "Study Notes",
    hasBodyContent: true,
    hasDescription: true,
  },
  bundles: {
    type: "bundles",
    slug: "bundles",
    label: "Bundles Page",
    adminHint: "Optional title, description, and content for this exam's Bundles listing page. Leave blank to use the default title/description - the page always shows real bundles regardless.",
    titleSuffix: "Bundles",
    hasBodyContent: true,
    hasDescription: true,
  },
};

// Convenience subset of the above, typed to only the 4 routable types —
// public routing/sitemap code should use this so "overview" can never leak
// into a URL.
export const EXAM_CONTENT_PAGE_META: Record<ExamContentPageType, ExamContentPageTypeMeta> =
  Object.fromEntries(
    EXAM_CONTENT_PAGE_TYPES.map((type) => [type, ADMIN_EXAM_SECTION_META[type]])
  ) as Record<ExamContentPageType, ExamContentPageTypeMeta>;

export function isExamContentPageType(value: string): value is ExamContentPageType {
  return (EXAM_CONTENT_PAGE_TYPES as readonly string[]).includes(value);
}

export function isAdminExamSectionType(value: string): value is AdminExamSectionType {
  return (ADMIN_EXAM_SECTION_TYPES as readonly string[]).includes(value);
}

// ---- Custom pages ---------------------------------------------------------

export const CUSTOM_PAGE_TYPE_PREFIX = "custom:";

export type CustomExamPageType = `custom:${string}`;

// Everything the admin editor and the content endpoints accept.
export type ExamSectionPageType = AdminExamSectionType | CustomExamPageType;

export const CUSTOM_PAGE_LABEL_MAX = 60;
export const CUSTOM_PAGE_SLUG_MAX = 60;
export const CUSTOM_PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// URL segments already taken under /exams/:examSlug/ - a custom page can't
// reuse one, or its route would be shadowed by the built-in page.
export const RESERVED_EXAM_PAGE_SLUGS: readonly string[] = [
  "overview",
  ...Object.values(ADMIN_EXAM_SECTION_META)
    .map((meta) => meta.slug)
    .filter((slug): slug is string => slug !== null),
];

export function customPageType(slug: string): CustomExamPageType {
  return `${CUSTOM_PAGE_TYPE_PREFIX}${slug}`;
}

export function isCustomPageType(value: string): value is CustomExamPageType {
  return (
    value.startsWith(CUSTOM_PAGE_TYPE_PREFIX) &&
    CUSTOM_PAGE_SLUG_PATTERN.test(value.slice(CUSTOM_PAGE_TYPE_PREFIX.length))
  );
}

export function customPageSlug(pageType: CustomExamPageType): string {
  return pageType.slice(CUSTOM_PAGE_TYPE_PREFIX.length);
}

export function isExamSectionPageType(value: string): value is ExamSectionPageType {
  return isAdminExamSectionType(value) || isCustomPageType(value);
}

// "Previous Year Papers" -> "previous-year-papers"
export function slugifyCustomPageLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CUSTOM_PAGE_SLUG_MAX)
    .replace(/-+$/g, "");
}

// Returns why a slug can't be used, or null when it's fine. Uniqueness per
// exam is checked separately (client against the loaded list, server by the
// table's unique constraint).
export function customPageSlugProblem(slug: string): string | null {
  if (!slug) return "Add a URL slug.";
  if (slug.length > CUSTOM_PAGE_SLUG_MAX) return `Keep the slug under ${CUSTOM_PAGE_SLUG_MAX} characters.`;
  if (!CUSTOM_PAGE_SLUG_PATTERN.test(slug)) return "Use lowercase letters, numbers and single hyphens only.";
  if (RESERVED_EXAM_PAGE_SLUGS.includes(slug)) return `"${slug}" is already used by a built-in section.`;
  return null;
}

// Custom pages behave like the 4 silo pages: title, SEO, body content, FAQs.
export function customSectionMeta(pageType: CustomExamPageType, label: string): ExamContentPageTypeMeta {
  return {
    type: pageType,
    slug: customPageSlug(pageType),
    label,
    adminHint: `A custom page for this exam. Once published it gets its own URL and appears in the exam's page navigation.`,
    titleSuffix: label,
    hasBodyContent: true,
  };
}

export const examSectionPageTypeSchema = z.union([
  z.enum(ADMIN_EXAM_SECTION_TYPES),
  z
    .string()
    .refine(isCustomPageType, "Unknown section type.")
    .transform((value) => value as CustomExamPageType),
]);

// A custom page as listed for an exam.
export interface ExamCustomPage {
  id: number;
  slug: string;
  label: string;
  pageType: CustomExamPageType;
}

export interface FaqItem {
  question: string;
  answer: string;
}
