import { Kysely } from "kysely";
import type { DB } from "./schema";

// ---------------------------------------------------------------------------
// SEO Indexability System — Testkart UGC pages (Mock Tests, Study Notes,
// Courses, Bundles).
//
// Design note: indexability is computed LIVE from current relational data on
// every SSR render and every sitemap generation, rather than cached in a
// stored `seo_indexable` column that would need to be recalculated at every
// create/edit/publish/unpublish/delete/questions-lessons-pages mutation
// call site. A stored column risks silently going stale the moment a
// mutation path forgets to call the recalculation hook; a computed value
// can't drift because it's re-derived from the source tables every time.
// This still satisfies "recalculate whenever a UGC item is created / edited
// / published / unpublished / deleted / has content added or removed" — it
// just does so unconditionally, on every read, instead of on a maintained
// cache.
//
// Every function here returns a SeoResult with `indexable` (the gate) and
// `qualityScore` (0-100, for transparency/debugging). `indexable` is only
// true when ALL hard requirements pass AND qualityScore >= 60.
// ---------------------------------------------------------------------------

export type SeoResult = {
  indexable: boolean;
  qualityScore: number;
  robots: "index,follow" | "noindex,follow";
  reasons: string[];
};

export const QUALITY_SCORE_THRESHOLD = 60;
export const MIN_MOCK_TEST_QUESTIONS = 20;
export const MIN_STUDY_NOTE_PAGES = 5;
export const MIN_COURSE_VIDEO_LESSONS = 5;
export const MIN_BUNDLE_ITEMS = 2;
const MIN_TITLE_LENGTH = 10;

export function toRobotsMeta(indexable: boolean): "index,follow" | "noindex,follow" {
  return indexable ? "index,follow" : "noindex,follow";
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreTitle(title: string | null | undefined): number {
  if (!title) return 0;
  const trimmed = title.trim();
  if (trimmed.length < MIN_TITLE_LENGTH) return 2;
  if (trimmed.length > 140) return 6; // likely keyword-stuffed
  return 10;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function scoreDescription(
  text: string | null | undefined,
  minLength = 40,
  maxScore = 10
): number {
  if (!text) return 0;
  const stripped = stripHtml(text);
  if (stripped.length === 0) return 0;
  if (stripped.length < minLength) {
    return Math.round((stripped.length / minLength) * (maxScore * 0.6));
  }
  if (stripped.length >= minLength * 3) return maxScore;
  return Math.round(maxScore * 0.8);
}

function isMeaningfulText(text: string | null | undefined, minLength = 40): boolean {
  if (!text) return false;
  return stripHtml(text).length >= minLength;
}

// Volume score rewards content that clears the minimum bar, then keeps
// giving credit up to 2x the minimum (capped). Below the minimum it scales
// down toward 0 so a near-miss still shows up as "low score" rather than a
// cliff — useful for the score to be a meaningful diagnostic even when the
// hard gate has already failed it.
function scoreVolume(count: number, min: number, cap = 40): number {
  if (min <= 0) return cap;
  if (count <= 0) return 0;
  const ratio = count / min;
  return Math.max(0, Math.min(cap, Math.round(ratio * (cap / 2))));
}

// Subtracts points when other published items of the same type share an
// identical (case-insensitive, trimmed) title — a classic thin/duplicate
// content signal (templated titles, copy-pasted listings).
function duplicatePenalty(duplicateCount: number): number {
  if (duplicateCount <= 0) return 0;
  return -Math.min(15, 5 + duplicateCount * 5);
}

function combineScore(
  hardGatesPass: boolean,
  volume: number,
  metadata: number,
  richness: number,
  dupPenalty: number
): number {
  const gatesBonus = hardGatesPass ? 10 : 0;
  return clampScore(gatesBonus + volume + metadata + richness + dupPenalty);
}

function normalizedForCompare(title: string): string {
  return title.trim();
}

// `mockTests.subject` (a free-text column on the package row) turned out to
// be dead data in practice — every single published mock test has it set to
// the literal string "[]" (a stringified empty array default that nothing
// ever populates). The real, actually-used subject/topic tagging lives one
// level down, on testItemSubjects.subjectName (per test-paper subject
// sections like "Physics", "Reasoning", etc.), so that's what the "subject/
// topic selected" gate checks instead — via the caller-supplied
// `hasSubjectTagging` flag on MockTestSeoInput. This also filters out
// generic placeholder labels ("Subject 1", "Subject 2", ...) that a wizard
// default-fills and many teachers never rename.
const PLACEHOLDER_SUBJECT_PATTERN = /^subject\s*\d*$/i;

export function isMeaningfulSubjectName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  return !PLACEHOLDER_SUBJECT_PATTERN.test(trimmed);
}

// ---------------------------------------------------------------------------
// Mock Tests
// ---------------------------------------------------------------------------

export type MockTestSeoInput = {
  id: number;
  title: string;
  description: string | null;
  longDescription: string | null;
  isPublished: boolean;
  deletedAt: Date | string | null;
  examId: number | null;
  // Whether at least one of this package's test items has a real (non-
  // placeholder) subject section name — see the isMeaningfulSubjectName
  // comment above for why this replaces the mockTests.subject column.
  hasSubjectTagging: boolean;
  totalQuestions: number;
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
  whatYouLearn: unknown;
  requirements: unknown;
};

function jsonArrayLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

// `db` may be omitted (pass null) when the caller has already computed the
// duplicate-title count itself — e.g. the sitemap endpoint, which builds a
// single title-frequency map for all published rows of a type up front
// instead of issuing one COUNT query per row. Per-row SSR/detail callers
// should keep passing a real `db` so the check reflects live data.
export async function computeMockTestSeo(
  db: Kysely<DB> | null,
  input: MockTestSeoInput,
  precomputedDuplicateCount?: number
): Promise<SeoResult> {
  const reasons: string[] = [];
  const title = (input.title || "").trim();

  const isLive = input.isPublished === true && !input.deletedAt;
  const hasValidTitle = title.length >= MIN_TITLE_LENGTH;
  // Neither exam tagging nor subject/topic tagging gates indexing here —
  // both excluded from the indexing decision site-wide per product
  // decision (input.hasSubjectTagging is accepted but intentionally unused
  // for gating/scoring; kept for potential future use).
  const hasMinQuestions = input.totalQuestions >= MIN_MOCK_TEST_QUESTIONS;

  if (!isLive) reasons.push("Not published");
  if (!hasValidTitle) reasons.push("Title missing or too short");
  if (!hasMinQuestions) {
    reasons.push(`Fewer than ${MIN_MOCK_TEST_QUESTIONS} questions (has ${input.totalQuestions})`);
  }

  const hardGatesPass = isLive && hasValidTitle && hasMinQuestions;

  let dupCount = precomputedDuplicateCount ?? 0;
  if (precomputedDuplicateCount === undefined && db && title) {
    const dupRow = await db
      .selectFrom("mockTests")
      .select((eb) => eb.fn.count<number>("mockTests.id").as("cnt"))
      .where("mockTests.id", "!=", input.id)
      .where("mockTests.isPublished", "=", true)
      .where("mockTests.deletedAt", "is", null)
      .where("mockTests.title", "ilike", normalizedForCompare(title))
      .executeTakeFirst();
    dupCount = Number(dupRow?.cnt ?? 0);
  }

  const volume = scoreVolume(input.totalQuestions, MIN_MOCK_TEST_QUESTIONS, 40);
  const metadata =
    scoreTitle(title) +
    scoreDescription(input.description || input.longDescription, 40, 10);
  const richness =
    (input.thumbnailUrl ? 5 : 0) +
    (jsonArrayLength(input.whatYouLearn) >= 3 ? 5 : 0) +
    (input.introVideoUrl || jsonArrayLength(input.requirements) >= 1 ? 5 : 0) +
    5; // reserved slot kept for symmetry with other types (rating/reviews signal not required)
  const dupPenalty = duplicatePenalty(dupCount);

  const qualityScore = combineScore(hardGatesPass, volume, metadata, richness, dupPenalty);
  if (qualityScore < QUALITY_SCORE_THRESHOLD) {
    reasons.push(`Quality score ${qualityScore} below threshold ${QUALITY_SCORE_THRESHOLD}`);
  }
  if (dupCount > 0) {
    reasons.push(`Duplicate title used by ${dupCount} other published mock test(s)`);
  }

  const indexable = hardGatesPass && qualityScore >= QUALITY_SCORE_THRESHOLD;
  return { indexable, qualityScore, robots: toRobotsMeta(indexable), reasons };
}

// ---------------------------------------------------------------------------
// Study Notes (digitalProducts)
// ---------------------------------------------------------------------------

export type StudyNoteSeoInput = {
  id: number;
  title: string;
  description: string | null;
  shortDescription: string | null;
  status: string | null;
  examId: number | null;
  category: string | null;
  actualPageCount: number;
  fileCount: number;
  thumbnailUrl: string | null;
  tags: string[] | null;
  language: string | null;
};

export async function computeStudyNoteSeo(
  db: Kysely<DB> | null,
  input: StudyNoteSeoInput,
  precomputedDuplicateCount?: number
): Promise<SeoResult> {
  const reasons: string[] = [];
  const title = (input.title || "").trim();

  const isPublished = input.status === "published";
  const hasValidTitle = title.length >= MIN_TITLE_LENGTH;
  // Neither exam tagging nor subject/topic (category) tagging gates
  // indexing here — both excluded from the indexing decision site-wide per
  // product decision (input.examId/category are accepted but intentionally
  // unused for gating/scoring; kept for potential future use).
  const hasMinPages = input.actualPageCount >= MIN_STUDY_NOTE_PAGES;

  if (!isPublished) reasons.push("Not published");
  if (!hasValidTitle) reasons.push("Title missing or too short");
  if (!hasMinPages) {
    reasons.push(`Fewer than ${MIN_STUDY_NOTE_PAGES} pages (has ${input.actualPageCount})`);
  }

  const hardGatesPass = isPublished && hasValidTitle && hasMinPages;

  let dupCount = precomputedDuplicateCount ?? 0;
  if (precomputedDuplicateCount === undefined && db && title) {
    const dupRow = await db
      .selectFrom("digitalProducts")
      .select((eb) => eb.fn.count<number>("digitalProducts.id").as("cnt"))
      .where("digitalProducts.id", "!=", input.id)
      .where("digitalProducts.status", "=", "published")
      .where("digitalProducts.title", "ilike", normalizedForCompare(title))
      .executeTakeFirst();
    dupCount = Number(dupRow?.cnt ?? 0);
  }

  const volume = scoreVolume(input.actualPageCount, MIN_STUDY_NOTE_PAGES, 40);
  const metadata =
    scoreTitle(title) +
    scoreDescription(input.description || input.shortDescription, 40, 10);
  const richness =
    (input.thumbnailUrl ? 5 : 0) +
    (input.fileCount >= 2 ? 5 : 0) +
    (input.tags && input.tags.length > 0 ? 5 : 0) +
    (input.language ? 5 : 0);
  const dupPenalty = duplicatePenalty(dupCount);

  const qualityScore = combineScore(hardGatesPass, volume, metadata, richness, dupPenalty);
  if (qualityScore < QUALITY_SCORE_THRESHOLD) {
    reasons.push(`Quality score ${qualityScore} below threshold ${QUALITY_SCORE_THRESHOLD}`);
  }
  if (dupCount > 0) {
    reasons.push(`Duplicate title used by ${dupCount} other published study note(s)`);
  }

  const indexable = hardGatesPass && qualityScore >= QUALITY_SCORE_THRESHOLD;
  return { indexable, qualityScore, robots: toRobotsMeta(indexable), reasons };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export type CourseSeoInput = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  examId: number | null;
  category: string | null;
  totalLessons: number;
  videoLessons: number;
  lessonsWithDescriptionRatio: number; // 0..1
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
  estimatedDurationMinutes: number | null;
};

export async function computeCourseSeo(
  db: Kysely<DB> | null,
  input: CourseSeoInput,
  precomputedDuplicateCount?: number
): Promise<SeoResult> {
  const reasons: string[] = [];
  const title = (input.title || "").trim();

  const isPublished = input.status === "published";
  const hasValidTitle = title.length >= MIN_TITLE_LENGTH;
  const hasMeaningfulDescription = isMeaningfulText(input.description, 40);
  // Neither exam tagging nor subject/topic (category) tagging gates
  // indexing here — both excluded from the indexing decision site-wide per
  // product decision (input.examId/category are accepted but intentionally
  // unused for gating/scoring; kept for potential future use).
  const hasMinVideoLessons = input.videoLessons >= MIN_COURSE_VIDEO_LESSONS;

  if (!isPublished) reasons.push("Not published");
  if (!hasValidTitle) reasons.push("Title missing or too short");
  if (!hasMeaningfulDescription) reasons.push("Description missing or too short");
  if (!hasMinVideoLessons) {
    reasons.push(`Fewer than ${MIN_COURSE_VIDEO_LESSONS} video lessons (has ${input.videoLessons})`);
  }

  const hardGatesPass = isPublished && hasValidTitle && hasMeaningfulDescription && hasMinVideoLessons;

  let dupCount = precomputedDuplicateCount ?? 0;
  if (precomputedDuplicateCount === undefined && db && title) {
    const dupRow = await db
      .selectFrom("courses")
      .select((eb) => eb.fn.count<number>("courses.id").as("cnt"))
      .where("courses.id", "!=", input.id)
      .where("courses.status", "=", "published")
      .where("courses.title", "ilike", normalizedForCompare(title))
      .executeTakeFirst();
    dupCount = Number(dupRow?.cnt ?? 0);
  }

  const volume = scoreVolume(input.videoLessons, MIN_COURSE_VIDEO_LESSONS, 40);
  const metadata = scoreTitle(title) + scoreDescription(input.description, 80, 10);
  const richness =
    (input.thumbnailUrl ? 5 : 0) +
    (input.lessonsWithDescriptionRatio >= 0.5 ? 5 : 0) +
    (input.introVideoUrl || (input.estimatedDurationMinutes ?? 0) > 0 ? 5 : 0) +
    (input.totalLessons > input.videoLessons ? 5 : 0); // has supplementary (non-video) material too
  const dupPenalty = duplicatePenalty(dupCount);

  const qualityScore = combineScore(hardGatesPass, volume, metadata, richness, dupPenalty);
  if (qualityScore < QUALITY_SCORE_THRESHOLD) {
    reasons.push(`Quality score ${qualityScore} below threshold ${QUALITY_SCORE_THRESHOLD}`);
  }
  if (dupCount > 0) {
    reasons.push(`Duplicate title used by ${dupCount} other published course(s)`);
  }

  const indexable = hardGatesPass && qualityScore >= QUALITY_SCORE_THRESHOLD;
  return { indexable, qualityScore, robots: toRobotsMeta(indexable), reasons };
}

// ---------------------------------------------------------------------------
// Bundles (courseBundles)
// ---------------------------------------------------------------------------

export type BundleSeoInput = {
  id: number;
  title: string;
  description: string | null;
  isPublished: boolean;
  itemCount: number;
  publishedItemCount: number; // how many of the bundle's items are themselves published/available
  distinctItemTypeCount: number;
  discountPercentage: number | null;
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
};

export async function computeBundleSeo(
  db: Kysely<DB> | null,
  input: BundleSeoInput,
  precomputedDuplicateCount?: number
): Promise<SeoResult> {
  const reasons: string[] = [];
  const title = (input.title || "").trim();

  const isPublished = input.isPublished === true;
  const hasValidTitle = title.length >= MIN_TITLE_LENGTH;
  const hasMeaningfulDescription = isMeaningfulText(input.description, 40);
  const hasMinItems = input.itemCount >= MIN_BUNDLE_ITEMS;
  const allItemsAvailable = input.itemCount > 0 && input.publishedItemCount === input.itemCount;

  if (!isPublished) reasons.push("Not published");
  if (!hasValidTitle) reasons.push("Title missing or too short");
  if (!hasMeaningfulDescription) reasons.push("Description missing or too short");
  if (!hasMinItems) {
    reasons.push(`Fewer than ${MIN_BUNDLE_ITEMS} products in bundle (has ${input.itemCount})`);
  }
  if (input.itemCount > 0 && !allItemsAvailable) {
    reasons.push(
      `${input.itemCount - input.publishedItemCount} of ${input.itemCount} included product(s) are not published/available`
    );
  }

  const hardGatesPass =
    isPublished && hasValidTitle && hasMeaningfulDescription && hasMinItems && allItemsAvailable;

  let dupCount = precomputedDuplicateCount ?? 0;
  if (precomputedDuplicateCount === undefined && db && title) {
    const dupRow = await db
      .selectFrom("courseBundles")
      .select((eb) => eb.fn.count<number>("courseBundles.id").as("cnt"))
      .where("courseBundles.id", "!=", input.id)
      .where("courseBundles.isPublished", "=", true)
      .where("courseBundles.title", "ilike", normalizedForCompare(title))
      .executeTakeFirst();
    dupCount = Number(dupRow?.cnt ?? 0);
  }

  const volume = scoreVolume(input.itemCount, MIN_BUNDLE_ITEMS, 40);
  const metadata = scoreTitle(title) + scoreDescription(input.description, 40, 20);
  const richness =
    (input.thumbnailUrl ? 5 : 0) +
    (input.discountPercentage && input.discountPercentage > 0 ? 5 : 0) +
    (input.itemCount >= 3 ? 5 : 0) +
    (input.introVideoUrl || input.distinctItemTypeCount >= 2 ? 5 : 0);
  const dupPenalty = duplicatePenalty(dupCount);

  const qualityScore = combineScore(hardGatesPass, volume, metadata, richness, dupPenalty);
  if (qualityScore < QUALITY_SCORE_THRESHOLD) {
    reasons.push(`Quality score ${qualityScore} below threshold ${QUALITY_SCORE_THRESHOLD}`);
  }
  if (dupCount > 0) {
    reasons.push(`Duplicate title used by ${dupCount} other published bundle(s)`);
  }

  const indexable = hardGatesPass && qualityScore >= QUALITY_SCORE_THRESHOLD;
  return { indexable, qualityScore, robots: toRobotsMeta(indexable), reasons };
}
