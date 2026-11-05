import { z } from "zod";
import superjson from "superjson";

export const TeacherOverviewRangeValues = ["7d", "30d", "90d"] as const;
export type TeacherOverviewRange = (typeof TeacherOverviewRangeValues)[number];

export const schema = z.object({
  range: z.enum(TeacherOverviewRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

export type TeacherBankStatus = "missing" | "pending" | "verified" | "rejected";

/**
 * The teacher's own work queues — only things that block money, block a
 * listing from selling, or leave somebody waiting on a reply. Work in progress
 * (drafts) is deliberately not here; it lives in the totals footer instead.
 *
 * Content awaiting approval is split by kind rather than totalled, because
 * each kind is edited on a different page and a tile has to link to the right
 * one. Counts only, except the one rupee amount and the bank status, which the
 * tile builder in helpers/teacherAttention reads directly.
 */
export type TeacherAttentionCounts = {
  reviewsPendingTests: number;
  reviewsPendingCourses: number;
  reviewsPendingProducts: number;
  reviewsPendingBundles: number;
  reviewsPendingLiveTests: number;
  withdrawalsPending: number;
  withdrawalsPendingAmount: number;
  supportUnread: number;
  prizesUndistributed: number;
  liveTestsSoon: number;
  subscriptionExpiring: number;
  bankStatus: TeacherBankStatus;
};

export type KpiPair = { current: number; previous: number };

export type TeacherOverviewKpis = {
  /** Net of the platform fee — the money that actually reaches the wallet. */
  earnings: KpiPair;
  /** Before the platform fee, so the fee is visible rather than implied. */
  grossSales: KpiPair;
  sales: KpiPair;
  buyers: KpiPair;
  enrollments: KpiPair;
  attempts: KpiPair;
};

/** One calendar day in Asia/Kolkata. `day` is YYYY-MM-DD. */
export type TeacherDailyPoint = {
  day: string;
  earnings: number;
  sales: number;
  enrollments: number;
  attempts: number;
};

export const TeacherMixKindValues = [
  "mock_test",
  "live_test",
  "course",
  "digital_product",
  "bundle",
] as const;
export type TeacherMixKind = (typeof TeacherMixKindValues)[number];

export type TeacherTopSeller = {
  kind: TeacherMixKind;
  /** The listing's own id; for a live test this is its backing mock test. Null on responses cached before it shipped. */
  itemId: number | null;
  title: string;
  /** Null for study notes, which carry no thumbnail anywhere on the site. */
  thumbnail: string | null;
  units: number;
  earnings: number;
};

/**
 * Orders touching this teacher's content, any status — a failed checkout on
 * your own test series is worth seeing, which is why this is not filtered to
 * completed the way the earnings rows are.
 */
export type TeacherRecentSale = {
  orderId: number;
  amount: number;
  status: string;
  createdAt: Date;
  studentName: string;
  summary: string;
  itemCount: number;
  /** The first of this teacher's items on the order, for the row's thumbnail. */
  kind: TeacherMixKind | null;
  thumbnail: string | null;
};

/**
 * Live and draft counts per asset type, so each one can be shown and linked
 * separately. Draft counts are the real draft statuses, not total minus
 * published - courses and study notes can also be archived, which is neither.
 *
 * Test series counts follow the Test series page's tabs: a mock test behind
 * any of the teacher's live tests is left out, and an unpublished series that
 * was live once belongs to Unpublished, not Drafts.
 */
export type TeacherOverviewTotals = {
  students: number;
  followers: number;
  publishedTests: number;
  draftTests: number;
  publishedCourses: number;
  draftCourses: number;
  publishedProducts: number;
  draftProducts: number;
  publishedBundles: number;
  draftBundles: number;
  activeLiveTests: number;
  lifetimeEarnings: number;
  availableBalance: number;
};

/**
 * One piece of the teacher's own work the Overview names by title: the draft
 * to continue, the item waiting on review, or one sent back. `note` is the
 * admin's review note and is only set on rejections.
 */
export type TeacherStageItem = {
  kind: TeacherMixKind;
  id: number;
  title: string;
  at: Date;
  note: string | null;
};

export type OutputType = {
  range: TeacherOverviewRange;
  days: number;
  generatedAt: Date;
  attention: TeacherAttentionCounts;
  kpis: TeacherOverviewKpis;
  daily: TeacherDailyPoint[];
  topSellers: TeacherTopSeller[];
  recentSales: TeacherRecentSale[];
  totals: TeacherOverviewTotals;
  /** Most recently edited draft that is not waiting on review. */
  lastDraft: TeacherStageItem | null;
  /** Items whose latest review is pending, newest first. */
  inReview: TeacherStageItem[];
  /** Items whose latest review is a rejection from the last 90 days, newest first. */
  rejected: TeacherStageItem[];
  /** What the teacher said in onboarding they would publish first; test series when unknown. */
  firstContentType: TeacherMixKind;
};

export const getTeacherDashboardOverview = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/teacher/dashboard/overview?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
