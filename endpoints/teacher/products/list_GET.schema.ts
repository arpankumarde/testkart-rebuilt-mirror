import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts, DigitalProductStatusArrayValues } from "../../../helpers/schema";
import type { ContentExam } from "../../../helpers/contentExams";
import type { ContentRejection } from "../../../helpers/contentReviewStatus";

export const schema = z.object({
  status: z.enum(DigitalProductStatusArrayValues).optional(),
  category: z.string().optional(),
  /** Matches title, category or exam name, case-insensitive. */
  search: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type InputType = z.infer<typeof schema>;

export type TeacherProductListItem = Omit<Selectable<DigitalProducts>, "price" | "rating" | "fileSizeBytes"> & {
  price: number;
  rating: number | null;
  fileSizeBytes: number | null;
  /** Every exam the product is listed under, primary first. */
  exams: ContentExam[];
  /** Submitted for publishing and waiting on admin approval. */
  inReview: boolean;
  /** Set when the latest review was rejected, with the admin's reason. */
  rejection: ContentRejection | null;
};

export type OutputType = {
  products: TeacherProductListItem[];
  page: number;
  limit: number;
  /** Products matching the filters across all pages. */
  total: number;
};

export const getTeacherProductsList = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.set("status", params.status);
  if (params.category) queryParams.set("category", params.category);
  if (params.search) queryParams.set("search", params.search);
  queryParams.set("page", params.page.toString());
  queryParams.set("limit", params.limit.toString());

  const result = await fetch(`/_api/teacher/products/list?${queryParams.toString()}`, {
    method: "GET",
    // Always hit the server: this list needs to reflect a just-created or
    // just-edited product immediately, and GET requests are otherwise
    // fair game for the browser/CDN to serve from an HTTP cache.
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};