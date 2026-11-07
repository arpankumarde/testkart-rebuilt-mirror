/**
 * The "Profile strength" checks on /teacher/edit-profile. The page scores the
 * unsaved form and the teacher onboarding emails score the saved users row, so
 * both read this one list and a teacher at 100% on the page is at 100% here.
 *
 * jsonb columns can come back as JSON-encoded strings, so list and object
 * fields are parsed tolerantly.
 */

export type TeacherProfileSection = "basics" | "details" | "credentials";

export type TeacherProfileField =
  | "avatarUrl"
  | "displayName"
  | "slug"
  | "tagline"
  | "bio"
  | "location"
  | "languages"
  | "expertiseAreas"
  | "socialLinks"
  | "awardsCertificates";

export type TeacherProfileCompletenessInput = {
  avatarUrl?: string | null;
  displayName?: string | null;
  slug?: string | null;
  tagline?: string | null;
  bio?: string | null;
  location?: string | null;
  languages?: unknown;
  expertiseAreas?: unknown;
  websiteUrl?: string | null;
  socialLinks?: unknown;
  awardsCertificates?: unknown;
};

export type TeacherProfileCheck = {
  label: string;
  done: boolean;
  section: TeacherProfileSection;
  /** The form field the check reads, so the edit page can jump to it. */
  field: TeacherProfileField;
};

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const listOf = (value: unknown): unknown[] => {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
};

const recordOf = (value: unknown): Record<string, unknown> => {
  const parsed = parseJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
};

const text = (value: string | null | undefined) => (value ?? "").trim();

export const teacherProfileChecks = (
  input: TeacherProfileCompletenessInput
): TeacherProfileCheck[] => [
  { label: "Add a profile photo", done: text(input.avatarUrl).length > 0, section: "basics", field: "avatarUrl" },
  { label: "Set your display name", done: text(input.displayName).length >= 2, section: "basics", field: "displayName" },
  { label: "Claim your profile URL", done: text(input.slug).length > 0, section: "basics", field: "slug" },
  { label: "Write a tagline", done: text(input.tagline).length > 0, section: "basics", field: "tagline" },
  { label: "Write an about section", done: text(input.bio).length >= 40, section: "basics", field: "bio" },
  { label: "Add your location", done: text(input.location).length > 0, section: "details", field: "location" },
  { label: "List the languages you teach in", done: listOf(input.languages).length > 0, section: "details", field: "languages" },
  { label: "List your expertise areas", done: listOf(input.expertiseAreas).length > 0, section: "details", field: "expertiseAreas" },
  {
    label: "Link a website or social profile",
    done:
      text(input.websiteUrl).length > 0 ||
      Object.values(recordOf(input.socialLinks)).some(
        (link) => typeof link === "string" && link.trim().length > 0
      ),
    section: "details",
    field: "socialLinks",
  },
  {
    label: "Add an award or certificate",
    done: listOf(input.awardsCertificates).length > 0,
    section: "credentials",
    field: "awardsCertificates",
  },
];

export const teacherProfileCompleteness = (input: TeacherProfileCompletenessInput) => {
  const checks = teacherProfileChecks(input);
  const done = checks.filter((check) => check.done).length;
  return {
    checks,
    percent: Math.round((done / checks.length) * 100),
    done,
    total: checks.length,
    next: checks.find((check) => !check.done) ?? null,
  };
};
