/*
 * Live teaching (1:1 sessions and group classes) is approval-only. A teacher
 * applies once their contact details, profile, 1:1 rate, weekly hours and an
 * uploaded intro video are in place; an admin approves, rejects or later
 * revokes. Shared by the teacher page, the teacher endpoints and the admin
 * review page.
 */

export const LIVE_TEACHING_MIN_BIO_CHARS = 150;
export const LIVE_TEACHING_HEADLINE_MAX = 150;
export const LIVE_TEACHING_VIDEO_FOLDER = "teacher-intro-videos";
export const LIVE_TEACHING_VIDEO_MAX_MB = 200;

/** Account contact rules, the same ones teacher signup and onboarding use. */
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LiveTeachingStatusValues = ["none", "pending", "approved", "rejected", "revoked"] as const;
export type LiveTeachingStatus = (typeof LiveTeachingStatusValues)[number];

export const toLiveTeachingStatus = (value: string | null | undefined): LiveTeachingStatus =>
  (LiveTeachingStatusValues as readonly string[]).includes(value ?? "") ? (value as LiveTeachingStatus) : "none";

/** Teachers can apply from these states; pending and approved teachers cannot. */
export const canApplyFromStatus = (status: LiveTeachingStatus) =>
  status === "none" || status === "rejected" || status === "revoked";

export type LiveTeachingChecklistKey =
  | "email"
  | "phone"
  | "photo"
  | "headline"
  | "bio"
  | "subjects"
  | "languages"
  | "rate"
  | "hours"
  | "video";

export type LiveTeachingChecklistItem = {
  key: LiveTeachingChecklistKey;
  label: string;
  done: boolean;
};

export type LiveTeachingProfileFacts = {
  email: string | null;
  mobileNumber: string | null;
  avatarUrl: string | null;
  tagline: string | null;
  bio: string | null;
  subjects: string[];
  languages: string[];
  ratePerUnit: number | null;
  minRatePerUnit: number;
  activeHourWindows: number;
  introVideoUrl: string | null;
};

const filled = (value: string | null | undefined) => !!value && value.trim().length > 0;

/** An intro video uploaded through the live teaching form. Links to other sites do not count. */
export function isUploadedIntroVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.pathname.includes(`/${LIVE_TEACHING_VIDEO_FOLDER}/`);
  } catch {
    return false;
  }
}

export function buildLiveTeachingChecklist(facts: LiveTeachingProfileFacts): LiveTeachingChecklistItem[] {
  return [
    { key: "email", label: "Email address", done: filled(facts.email) },
    { key: "phone", label: "Phone number", done: filled(facts.mobileNumber) },
    { key: "photo", label: "Profile photo", done: filled(facts.avatarUrl) },
    { key: "headline", label: "Headline", done: filled(facts.tagline) },
    {
      key: "bio",
      label: `Bio of ${LIVE_TEACHING_MIN_BIO_CHARS}+ characters`,
      done: (facts.bio?.trim().length ?? 0) >= LIVE_TEACHING_MIN_BIO_CHARS,
    },
    { key: "subjects", label: "Subjects you teach", done: facts.subjects.length > 0 },
    { key: "languages", label: "Languages you speak", done: facts.languages.length > 0 },
    {
      key: "rate",
      label: "1:1 rate",
      done: facts.ratePerUnit !== null && facts.ratePerUnit >= facts.minRatePerUnit,
    },
    { key: "hours", label: "Weekly hours", done: facts.activeHourWindows > 0 },
    { key: "video", label: "Intro video", done: isUploadedIntroVideoUrl(facts.introVideoUrl) },
  ];
}

/** jsonb list columns hold arrays or JSON-encoded strings; anything else reads as empty. */
export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
  }
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return asStringList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}