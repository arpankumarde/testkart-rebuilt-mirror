import { z } from "zod";
import superjson from "superjson";

export const ReviewKindValues = ["mock_test", "course", "digital_product"] as const;
export type ReviewKind = (typeof ReviewKindValues)[number];

export const ReviewSortValues = ["newest", "oldest", "highest", "lowest"] as const;
export type ReviewSort = (typeof ReviewSortValues)[number];

export const schema = z.object({
  kind: z.enum(ReviewKindValues).optional(),
  itemId: z.coerce.number().int().positive().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  replied: z.enum(["all", "replied", "unreplied"]).default("all"),
  sort: z.enum(ReviewSortValues).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
});

export type InputType = z.input<typeof schema>;

export type TeacherReview = {
  id: number;
  rating: number;
  reviewText: string | null;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  createdAt: Date | null;
  kind: ReviewKind;
  itemId: number;
  itemTitle: string;
  testItemTitle: string | null;
  teacherReply: string | null;
  teacherRepliedAt: Date | null;
};

/** Over every review in the chosen kind and item, whatever the rating or reply filter. */
export type TeacherReviewSummary = {
  count: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  written: number;
  unreplied: number;
  latestAt: Date | null;
};

export type TeacherReviewedItem = { kind: ReviewKind; id: number; title: string; count: number };

export type OutputType = {
  reviews: TeacherReview[];
  total: number;
  page: number;
  pageSize: number;
  summary: TeacherReviewSummary;
  items: TeacherReviewedItem[];
};

export const getTeacherReviews = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const result = await fetch(`/_api/teacher/reviews/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Your reviews could not be loaded.");
  }
  return superjson.parse<OutputType>(await result.text());
};