import type { OrganizationTypeValue } from "../endpoints/teacher/organizations/create_POST.schema";

/**
 * Canonical public path for an organisation page, segmented by type -
 * testkart.in/school/:slug, /college/:slug, /coaching/:slug,
 * /university/:slug, and /organisation/:slug for "other". All five routes
 * render the same page (components/OrganizationProfilePage.tsx); this just
 * picks which one is the organisation's "home" link.
 */
export const getOrganizationProfilePath = (orgType: OrganizationTypeValue, slug: string): string => {
  const segment = orgType === "other" ? "organisation" : orgType;
  return `/${segment}/${slug}`;
};

/**
 * Matches every organisation route and its tab variants. Group 1 is the slug,
 * group 2 the optional tab segment.
 */
export const ORGANIZATION_PATH_PATTERN =
  /^\/(?:school|college|coaching|university|organisation)\/([^/]+)(?:\/([^/]+))?\/?$/;

/**
 * The organisation page's sub-navigation tabs - About is the "home" tab and
 * has no URL suffix of its own (it lives at the bare /school/:slug etc. path
 * from getOrganizationProfilePath above); every other tab appends its own
 * segment, e.g. /school/kanchan-public-school/courses. Array order is the
 * order the tab bar renders them in.
 */
export const ORGANIZATION_TAB_VALUES = [
  "about",
  "teachers",
  "courses",
  "mock-tests",
  "study-resources",
  "reviews",
  "posts",
] as const;
export type OrganizationTabValue = (typeof ORGANIZATION_TAB_VALUES)[number];

export const ORGANIZATION_TAB_LABELS: Record<OrganizationTabValue, string> = {
  about: "About",
  teachers: "Teachers",
  courses: "Courses",
  "mock-tests": "Mock Tests",
  "study-resources": "Study Resources",
  reviews: "Reviews",
  posts: "Posts",
};

export const isOrganizationTabValue = (value: string | undefined | null): value is OrganizationTabValue =>
  !!value && (ORGANIZATION_TAB_VALUES as readonly string[]).includes(value);

/**
 * Builds the URL for a specific tab of an organisation's page. Omitting tab
 * (or passing "about") returns the same bare path as getOrganizationProfilePath.
 */
export const getOrganizationTabPath = (
  orgType: OrganizationTypeValue,
  slug: string,
  tab?: OrganizationTabValue
): string => {
  const base = getOrganizationProfilePath(orgType, slug);
  if (!tab || tab === "about") return base;
  return `${base}/${tab}`;
};
