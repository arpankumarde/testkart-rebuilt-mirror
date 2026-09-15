import { z } from "zod";
import superjson from "superjson";

export const ContentRangeValues = ["7d", "30d", "90d"] as const;
export type ContentRange = (typeof ContentRangeValues)[number];

export const schema = z.object({
  range: z.enum(ContentRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

export const ContentKindValues = [
  "mock_test",
  "course",
  "digital_product",
  "live_test",
  "course_bundle",
] as const;
export type ContentKind = (typeof ContentKindValues)[number];

/** Catalogue gaps and work queues a content admin can act on. Every field is a count. */
export type ContentQueues = {
  reviewsPending: number;
  reviewsOldestDays: number;
  prizesUndistributed: number;
  emptySeries: number;
  testsWithoutQuestions: number;
  coursesWithoutLessons: number;
  notesWithoutFile: number;
  liveTestsUpcoming7d: number;
};

export type KpiPair = { current: number; previous: number };

export type ContentKpis = {
  created: KpiPair;
  published: KpiPair;
  questions: KpiPair;
  bankQuestions: KpiPair;
  attempts: KpiPair;
  enrollments: KpiPair;
};

/**
 * One row per content type. `publishedInRange` is null for the types that keep
 * no publish timestamp - test series and live tests carry a boolean only.
 */
export type PipelineRow = {
  kind: ContentKind;
  total: number;
  draft: number;
  published: number;
  archived: number;
  createdInRange: number;
  publishedInRange: number | null;
  staleDrafts: number;
};

/** One calendar day in Asia/Kolkata. `day` is YYYY-MM-DD. */
export type ContentDailyPoint = {
  day: string;
  mockTest: number;
  course: number;
  digitalProduct: number;
  liveTest: number;
  courseBundle: number;
  questions: number;
  published: number;
  attempts: number;
};

export type CoverageRow = {
  categoryId: number;
  categoryName: string;
  exams: number;
  covered: number;
  publishedItems: number;
};

export type TopContentRow = {
  kind: ContentKind;
  id: number;
  title: string;
  teacherName: string | null;
  engagement: number;
};

export type TopCreatorRow = {
  teacherId: number | null;
  name: string;
  created: number;
  published: number;
  questions: number;
};

export type RecentContentRow = {
  kind: ContentKind;
  id: number;
  title: string;
  teacherName: string | null;
  status: string;
  createdAt: Date;
};

export type ContentTotals = {
  examCategories: number;
  exams: number;
  testItems: number;
  questions: number;
  bankQuestions: number;
  sections: number;
  lessons: number;
};

export type OutputType = {
  range: ContentRange;
  days: number;
  generatedAt: Date;
  queues: ContentQueues;
  kpis: ContentKpis;
  pipeline: PipelineRow[];
  daily: ContentDailyPoint[];
  coverage: CoverageRow[];
  topContent: TopContentRow[];
  topCreators: TopCreatorRow[];
  recent: RecentContentRow[];
  totals: ContentTotals;
};

export const getAdminCatalogueDashboard = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/admin/catalogue/dashboard?${params.toString()}`, {
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
