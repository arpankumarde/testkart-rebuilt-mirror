import { z } from "zod";
import superjson from "superjson";
import { ContentTypeArrayValues } from "../../../helpers/schema";

export const schema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  contentType: z.enum(ContentTypeArrayValues).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type MockTestMeta = {
  type: "mock_test";
  totalTests: number;
  totalQuestions: number;
  price: string;
  examName: string | null;
  isFree: boolean;
  rating: string | null;
  reviewsCount: number;
  studentsEnrolled: number;
  description: string | null;
  thumbnailUrl: string | null;
  language: string | null;
  discountPrice: string | null;
  freeTestsCount: number;
  aiQuestionsCount: number;
  manualQuestionsCount: number;
  totalOrders: number;
};

export type CourseMeta = {
  type: "course";
  sectionsCount: number;
  lessonsCount: number;
  price: string;
  level: string;
  category: string | null;
  estimatedDurationMinutes: number | null;
  description: string | null;
  thumbnailUrl: string | null;
  language: string | null;
  totalPurchases: number;
  rating: string | null;
  reviewsCount: number;
};

export type DigitalProductMeta = {
  type: "digital_product";
  pageCount: number | null;
  price: string;
  category: string | null;
  fileSizeBytes: string | null;
  pdfUrl: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  language: string | null;
  totalPurchases: number;
  rating: string | null;
  reviewsCount: number;
  previewPages: number | null;
};

export type CourseBundleMeta = {
  type: "course_bundle";
  itemsCount: number;
  price: string;
  originalPrice: string;
  discountPercentage: string | null;
  description: string | null;
  thumbnailUrl: string | null;
};

export type LiveTestMeta = {
  type: "live_test";
  startTime: Date | null;
  endTime: Date;
  maxSeats: number;
  price: string;
  totalPrizePool: string;
  hasPrizes: boolean;
  enrolledCount: number;
  description: string | null;
  thumbnailUrl: string | null;
};

export type ContentMeta =
  | MockTestMeta
  | CourseMeta
  | DigitalProductMeta
  | CourseBundleMeta
  | LiveTestMeta;

export type ContentReviewAdminView = {
  id: number;
  contentType: string;
  contentId: number;
  contentTitle: string;
  teacherName: string;
  teacherEmail: string;
  teacherId: number;
  status: string;
  adminNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  contentMeta: ContentMeta | null;
};

export type OutputType = {
  reviews: ContentReviewAdminView[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export const getAdminContentReviews = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.contentType) query.set("contentType", params.contentType);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());

  const result = await fetch(
    `/_api/admin/content-reviews/list?${query.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};