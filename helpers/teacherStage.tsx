import type {
  TeacherOverviewTotals,
  TeacherStageItem,
} from "../endpoints/teacher/dashboard/overview_GET.schema";

/**
 * Where a teacher is on the way to selling, which decides what the Overview
 * leads with:
 * - start: nothing made yet
 * - drafting: drafts only, nothing live, nothing waiting on review
 * - review: nothing live yet, and something is in review or was sent back
 * - live: something is live, no students yet
 * - learners: students, but no money earned
 * - selling: money earned
 *
 * Team managers get the owner's money zeroed by the endpoint, so they never
 * reach selling and see the learners view instead.
 */
export type TeacherStage = "start" | "drafting" | "review" | "live" | "learners" | "selling";

export type TeacherStageInput = {
  totals: TeacherOverviewTotals;
  inReview: TeacherStageItem[];
  rejected: TeacherStageItem[];
  lastDraft: TeacherStageItem | null;
};

export const publishedCount = (totals: TeacherOverviewTotals) =>
  totals.publishedTests +
  totals.publishedCourses +
  totals.publishedProducts +
  totals.publishedBundles +
  totals.activeLiveTests;

export const draftCount = (totals: TeacherOverviewTotals) =>
  totals.draftTests + totals.draftCourses + totals.draftProducts + totals.draftBundles;

export const teacherStage = ({ totals, inReview, rejected, lastDraft }: TeacherStageInput): TeacherStage => {
  if (totals.lifetimeEarnings > 0) return "selling";
  if (publishedCount(totals) > 0) return totals.students > 0 ? "learners" : "live";
  if (totals.students > 0) return "learners";
  if (inReview.length > 0 || rejected.length > 0) return "review";
  if (lastDraft || draftCount(totals) > 0) return "drafting";
  return "start";
};

export type TeacherStageStep = { key: string; label: string; done: boolean };

/** The four milestones on the stage panel's track, each done or not. */
export const teacherStageSteps = ({ totals, inReview, rejected, lastDraft }: TeacherStageInput): TeacherStageStep[] => {
  const live = publishedCount(totals) > 0;
  const made = live || inReview.length > 0 || rejected.length > 0 || Boolean(lastDraft) || draftCount(totals) > 0;
  return [
    { key: "create", label: "Create", done: made },
    { key: "approve", label: "Go live", done: live },
    { key: "student", label: "First student", done: totals.students > 0 },
    { key: "sale", label: "First sale", done: totals.lifetimeEarnings > 0 },
  ];
};