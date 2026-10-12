import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  organizationId: z.coerce.number().int().positive(),
  page: z.coerce.number().int().positive().optional().default(1),
});

export type InputType = z.infer<typeof schema>;

export type OrganizationReviewItem = {
  id: number;
  rating: number;
  reviewText: string | null;
  createdAt: Date;
  isMine: boolean;
};

export type OutputType = {
  reviews: OrganizationReviewItem[];
  totalCount: number;
  averageRating: number | null;
  page: number;
  pageSize: number;
  hasMore: boolean;
  myReview: OrganizationReviewItem | null;
};

export const getOrganizationsReviews = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const params = new URLSearchParams({
    organizationId: String(validatedInput.organizationId),
    page: String(validatedInput.page),
  });
  const result = await fetch(`/_api/organizations/reviews?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};
