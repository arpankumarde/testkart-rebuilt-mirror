import { z } from "zod";
import superjson from "superjson";
import type { OrganizationReviewItem } from "./reviews_GET.schema";

export const schema = z.object({
  organizationId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(2000).optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  review: OrganizationReviewItem;
  averageRating: number | null;
  totalCount: number;
};

export const postOrganizationsReviews = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/organizations/reviews`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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
