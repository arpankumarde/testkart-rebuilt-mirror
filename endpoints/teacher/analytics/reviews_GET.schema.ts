import { z } from "zod";
import superjson from "superjson";
import { AnalyticsRangeValues, AnalyticsRange } from "../../../helpers/teacherAnalyticsTime";

export const schema = z.object({
  range: z.enum(AnalyticsRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

export type AnalyticsReviewKind = "mock_test" | "course" | "digital_product";

export type AnalyticsLatestReview = {
  id: number;
  rating: number;
  /** Trimmed to 280 characters; the Reviews page has the full text. */
  text: string | null;
  reviewerName: string;
  createdAt: Date;
  kind: AnalyticsReviewKind;
  title: string;
};

/** One calendar month (YYYY-MM) that had at least one review. */
export type AnalyticsRatingMonth = { month: string; average: number; count: number };

export type OutputType = {
  range: AnalyticsRange;
  generatedAt: Date;
  /** 0 when there were no reviews in that window. */
  average: { current: number; previous: number };
  count: { current: number; previous: number };
  /** Index 0 is one star, index 4 five stars. */
  distribution: number[];
  trend: AnalyticsRatingMonth[];
  latest: AnalyticsLatestReview[];
};

export const getTeacherAnalyticsReviews = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/teacher/analytics/reviews?${params.toString()}`, {
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