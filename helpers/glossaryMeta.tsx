import type { GlossaryCategory, GlossaryTermStatus } from "./schema";

const SITE_ORIGIN = "https://testkart.in";
const HUB_PATH = "/glossary";
const ADMIN_PATH = "/admin/glossary";

export const GLOSSARY_CATEGORY_VALUES = ["test_types", "scoring_and_assessment", "delivery_and_creation"] as const;
export const GLOSSARY_STATUS_VALUES = ["draft", "published"] as const;

const CATEGORIES: { value: GlossaryCategory; label: string }[] = [
  { value: "test_types", label: "Test types" },
  { value: "scoring_and_assessment", label: "Scoring and assessment" },
  { value: "delivery_and_creation", label: "Delivery and creation" },
];

const STATUSES: { value: GlossaryTermStatus; label: string }[] = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

/** How the public pages name each category. The admin keeps the wording in CATEGORIES. */
const PUBLIC_CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  test_types: "Test Types",
  scoring_and_assessment: "Scoring & Assessment",
  delivery_and_creation: "Delivery & Creation",
};

/** Landing pages that exist today, offered as shortcuts for the "See it on Testkart" link. */
const PRODUCT_PAGES: { path: string; name: string; label: string }[] = [
  { path: "/ai-mock-test-generator", name: "AI mock test generator", label: "Create a mock test" },
  { path: "/sell/mock-test", name: "Sell mock tests", label: "Sell your mock tests" },
  { path: "/sell/host-live-exam", name: "Host a live exam", label: "Host a live exam" },
  { path: "/sell/courses", name: "Sell courses", label: "Sell your courses" },
  { path: "/sell/study-notes-pdfs", name: "Sell study notes", label: "Sell your study notes" },
  { path: "/teach", name: "Teach on Testkart", label: "Start teaching on Testkart" },
];

const isCategory = (value: string | null): value is GlossaryCategory => CATEGORIES.some((c) => c.value === value);

const isStatus = (value: string | null): value is GlossaryTermStatus => STATUSES.some((s) => s.value === value);

const categoryLabel = (category: GlossaryCategory) => CATEGORIES.find((c) => c.value === category)?.label ?? category;

const publicCategoryLabel = (category: GlossaryCategory) => PUBLIC_CATEGORY_LABELS[category];

const statusLabel = (status: GlossaryTermStatus) => STATUSES.find((s) => s.value === status)?.label ?? status;

const termPath = (slug: string) => `${HUB_PATH}/${slug}`;

const canonicalUrl = (slug: string) => `${SITE_ORIGIN}${termPath(slug)}`;

const editPath = (id: number | "new") => `${ADMIN_PATH}/e/${id}`;

const previewPath = (id: number) => `${ADMIN_PATH}/preview/${id}`;

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasText = (html: string | null | undefined) => !!html && stripHtml(html).length > 0;

const explanationHeading = (term: string, heading: string | null | undefined) => heading?.trim() || `What is ${term}?`;

/** SEOHead appends "| Testkart" to whichever title this gives. */
const metaTitle = (term: string, seoTitle: string | null | undefined) => seoTitle?.trim() || `${term}: meaning and definition`;

const metaDescription = (definition: string, seoDescription: string | null | undefined) => seoDescription?.trim() || definition;

/** The hub section a term sits under; anything that does not start with a letter goes under "#". */
const letterOf = (term: string) => {
  const first = term.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
};

/** An admin's canonical override, when it points at testkart.in; anything else falls back to the term itself. */
const canonicalPath = (override: string | null | undefined, slug: string): string => {
  if (!override) return termPath(slug);
  try {
    const url = new URL(override);
    return url.hostname === "testkart.in" ? url.pathname.replace(/\/+$/, "") || termPath(slug) : termPath(slug);
  } catch {
    return termPath(slug);
  }
};

/** A path on this site. Rejects "//host" and "/\host", which browsers read as another site. */
const isInternalPath = (value: string) => /^\/(?![/\\])[^\s\\]*$/.test(value.trim());

const breadcrumbJsonLd = (items: { name: string; path: string }[]) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_ORIGIN}${item.path}`,
    })),
  }).replace(/</g, "\\u003c");

export const glossaryMeta = {
  HUB_PATH,
  ADMIN_PATH,
  CATEGORIES,
  STATUSES,
  PRODUCT_PAGES,
  isCategory,
  isStatus,
  categoryLabel,
  publicCategoryLabel,
  statusLabel,
  termPath,
  canonicalUrl,
  editPath,
  previewPath,
  stripHtml,
  hasText,
  explanationHeading,
  metaTitle,
  metaDescription,
  letterOf,
  canonicalPath,
  isInternalPath,
  breadcrumbJsonLd,
};